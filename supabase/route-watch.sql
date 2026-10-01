-- Biyahe: Route Watch. Flags a rider whose GPS trail looks unusual for the trip they accepted.
-- Run AFTER supabase/admin-dashboard.sql and supabase/trip-share.sql. Safe to re-run.
--
-- How it works
--   * While a job is 'accepted' / 'on_the_way', the rider app sends a GPS point every ~10 s (rider_log_point).
--   * Each point is checked on the SERVER (so a rider can't switch it off from the browser) against the planned route.
--   * Rules (all thresholds are in route_watch_cfg() below, tune them to your city):
--       off_route    trip started and the rider is far away from the pickup -> dropoff corridor
--       wrong_way    rider keeps moving AWAY from where they should be heading
--       long_stop    rider stays in one spot for minutes, away from pickup/dropoff
--       detour       distance driven so far is far longer than the trip should need
--       gps_jump     position teleports (impossible speed) - possible fake GPS
--       gps_silent   trip in progress but no GPS points for a few minutes
--       ended_far    trip marked "done" far from the drop-off point
--   * A flag is NOT proof of wrongdoing (traffic, road closures, a customer asking for a stop). It goes to the
--     owner's "Alerts" tab with the trail so a person can look and decide.
--
-- Privacy: trail points are only stored while a job is in progress, only the owner can read them, and they are
-- deleted after 30 days. Riders are told in the app that trips are route-monitored.

-- 0. Settings in one place ---------------------------------------------------------------------------------
create or replace function public.route_watch_cfg() returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'off_route_m',     700,    -- metres away from the planned corridor (also scaled up for long trips, see below)
    'off_route_pts',   3,      -- ...for this many points in a row
    'wrong_way_m',     500,    -- got this much FARTHER from the destination than the closest point so far
    'long_stop_s',     300,    -- seconds standing still mid-trip
    'long_stop_r_m',   40,     -- "still" = staying inside this radius
    'near_stop_m',     150,    -- stops this close to pickup/dropoff are normal
    'detour_x',        2.5,    -- driven distance > this x the straight-line trip ...
    'detour_extra_m',  1500,   -- ... plus this many metres
    'jump_kmh',        160,    -- faster than this between two points = GPS jump
    'silent_s',        180,    -- no points for this long while on_the_way
    'ended_far_m',     400,    -- trip marked done this far from the drop-off
    'keep_days',       30
  ) $$;

-- 1. Tables (no browser access; only the functions below) --------------------------------------------------
create table if not exists public.trip_track (
  id         bigint generated always as identity primary key,
  booking_id text not null,
  rider_id   uuid not null references auth.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  at  timestamptz not null default now()
);
create index if not exists trip_track_booking_idx on public.trip_track (booking_id, at);
create index if not exists trip_track_at_idx on public.trip_track (at);
alter table public.trip_track enable row level security;
revoke all on public.trip_track from anon, authenticated;

create table if not exists public.route_alerts (
  id          uuid primary key default gen_random_uuid(),
  booking_id  text not null,
  rider_id    uuid not null references auth.users(id) on delete cascade,
  kind        text not null,
  severity    text not null default 'warn' check (severity in ('info', 'warn', 'high')),
  message     text not null,
  lat double precision, lng double precision,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  note        text
);
create index if not exists route_alerts_open_idx on public.route_alerts (created_at desc) where resolved_at is null;
create unique index if not exists route_alerts_once on public.route_alerts (booking_id, kind) where resolved_at is null;   -- one open flag per kind per trip
alter table public.route_alerts enable row level security;
revoke all on public.route_alerts from anon, authenticated;
drop policy if exists "admin reads route alerts" on public.route_alerts;
create policy "admin reads route alerts" on public.route_alerts for select using (public.is_admin());
grant select on public.route_alerts to authenticated;   -- the policy above limits it to the owner; needed for live updates
do $$ begin alter publication supabase_realtime add table public.route_alerts; exception when others then null; end $$;

-- 2. Geometry helpers ----------------------------------------------------------------------------------------
create or replace function public.rw_dist(a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns double precision language sql immutable as $$   -- metres, haversine
  select 2 * 6371000 * asin(sqrt(
    power(sin(radians(b_lat - a_lat) / 2), 2) +
    cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lng - a_lng) / 2), 2)))
$$;

create or replace function public.rw_seg_dist(p_lat double precision, p_lng double precision,
  a_lat double precision, a_lng double precision, b_lat double precision, b_lng double precision)
returns double precision language plpgsql immutable as $$   -- metres from a point to the segment A-B (flat-earth maths, fine for city distances)
declare
  k double precision := cos(radians((a_lat + b_lat) / 2));
  ax double precision := a_lng * k * 111320; ay double precision := a_lat * 110540;
  bx double precision := b_lng * k * 111320; b_y double precision := b_lat * 110540;
  px double precision := p_lng * k * 111320; py double precision := p_lat * 110540;
  dx double precision := bx - ax; dy double precision := b_y - ay;
  t double precision;
begin
  if dx = 0 and dy = 0 then return sqrt(power(px - ax, 2) + power(py - ay, 2)); end if;
  t := greatest(0, least(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return sqrt(power(px - (ax + t * dx), 2) + power(py - (ay + t * dy), 2));
end $$;

-- 3. Raise a flag (once per kind per trip) --------------------------------------------------------------------
create or replace function public.rw_flag(p_booking text, p_rider uuid, p_kind text, p_sev text, p_msg text, p_lat double precision, p_lng double precision)
returns void language sql security definer set search_path = public as $$
  insert into public.route_alerts (booking_id, rider_id, kind, severity, message, lat, lng)
  values (p_booking, p_rider, p_kind, p_sev, p_msg, p_lat, p_lng)
  on conflict (booking_id, kind) where resolved_at is null do nothing
$$;
revoke all on function public.rw_flag(text, uuid, text, text, text, double precision, double precision) from public, anon, authenticated;

-- 4. The rider's phone sends a point; the server runs the rules ----------------------------------------------
create or replace function public.rider_log_point(p_booking text, p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cfg jsonb := public.route_watch_cfg();
  b record;
  d jsonb;
  pa jsonb; pb jsonb;            -- planned pickup / drop-off (may be null for package jobs)
  ta jsonb; tb jsonb;            -- where the rider should be heading right now
  a_lat double precision; a_lng double precision; b_lat double precision; b_lng double precision;
  tgt_lat double precision; tgt_lng double precision;
  trip_m double precision; corridor double precision;
  prev record; n int; hits int;
  dt double precision; kmh double precision;
  span double precision; drv double precision; best double precision; cur double precision;
  leg_from timestamptz;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Bad location.'; end if;

  select x.id::text as id, x.type::text as type, x.status::text as status, x.rider_id, x.details into b
    from public.bookings x where x.id::text = p_booking;
  if b.id is null or b.rider_id is distinct from uid or b.status not in ('accepted', 'on_the_way') then return; end if;
  d := coalesce(b.details, '{}'::jsonb);

  -- previous point (for jumps) then store this one
  select * into prev from public.trip_track where booking_id = p_booking order by at desc limit 1;
  insert into public.trip_track (booking_id, rider_id, lat, lng) values (p_booking, uid, p_lat, p_lng);
  if random() < 0.01 then delete from public.trip_track where at < now() - make_interval(days => (cfg->>'keep_days')::int); end if;

  -- 4a. GPS jump (teleporting = fake-GPS apps, or a phone swap)
  if prev.id is not null then
    dt := greatest(1, extract(epoch from now() - prev.at));
    kmh := public.rw_dist(prev.lat, prev.lng, p_lat, p_lng) / dt * 3.6;
    if kmh > (cfg->>'jump_kmh')::float and dt < 120 then
      perform public.rw_flag(p_booking, uid, 'gps_jump', 'high',
        format('Location jumped %s m in %s s (about %s km/h). Possible fake GPS.', round(public.rw_dist(prev.lat, prev.lng, p_lat, p_lng)), round(dt), round(kmh)), p_lat, p_lng);
    end if;
  end if;

  -- 4b. Planned route, from the geo the customer's booking already holds
  if b.type = 'food' then
    pa := d #> '{restaurant,geo}'; pb := d -> 'dropoff_geo';
  else
    pa := d -> 'pickup_geo'; pb := d -> 'dropoff_geo';
  end if;
  if pa is null or pb is null then return; end if;   -- package jobs have no coordinates: only the GPS rules above/below apply
  a_lat := (pa->>'lat')::float; a_lng := (pa->>'lng')::float; b_lat := (pb->>'lat')::float; b_lng := (pb->>'lng')::float;
  trip_m := public.rw_dist(a_lat, a_lng, b_lat, b_lng);

  -- Where should the rider be heading now?
  --   ride:  accepted -> to the pickup, on_the_way -> to the drop-off
  --   food:  before pickup (stage to_rest/at_rest, status accepted) -> restaurant, on_the_way -> customer
  if b.status = 'on_the_way' then tgt_lat := b_lat; tgt_lng := b_lng;
  else tgt_lat := a_lat; tgt_lng := a_lng; end if;

  -- 4c. Off route + wrong way + detour only make sense once the trip leg to the drop-off has started
  if b.status = 'on_the_way' then
    corridor := greatest((cfg->>'off_route_m')::float, trip_m * 0.25);   -- long trips get a wider corridor (real roads bend)

    -- off_route: last N points ALL outside the corridor
    select count(*) filter (where public.rw_seg_dist(t.lat, t.lng, a_lat, a_lng, b_lat, b_lng) > corridor) into hits
      from (select lat, lng from public.trip_track where booking_id = p_booking order by at desc limit (cfg->>'off_route_pts')::int) t;
    if hits >= (cfg->>'off_route_pts')::int then
      perform public.rw_flag(p_booking, uid, 'off_route', 'high',
        format('Rider is about %s m away from the planned route (allowed %s m).', round(public.rw_seg_dist(p_lat, p_lng, a_lat, a_lng, b_lat, b_lng)), round(corridor)), p_lat, p_lng);
    end if;

    -- wrong_way: now much farther from the drop-off than the closest the rider has been on this leg
    select min(public.rw_dist(t.lat, t.lng, tgt_lat, tgt_lng)) into best from public.trip_track t
      where t.booking_id = p_booking and t.at > now() - interval '30 minutes';
    cur := public.rw_dist(p_lat, p_lng, tgt_lat, tgt_lng);
    if best is not null and cur - best > (cfg->>'wrong_way_m')::float and cur > 300 then
      perform public.rw_flag(p_booking, uid, 'wrong_way', 'warn',
        format('Rider moved %s m farther from the drop-off than their closest point.', round(cur - best)), p_lat, p_lng);
    end if;

    -- detour: distance driven since the rider LEFT THE PICKUP vs. what the trip should need
    select max(t.at) into leg_from from public.trip_track t
      where t.booking_id = p_booking and public.rw_dist(t.lat, t.lng, a_lat, a_lng) <= (cfg->>'near_stop_m')::float * 2;
    drv := 0;
    if leg_from is not null then
      select coalesce(sum(public.rw_dist(t.lat, t.lng, t.nlat, t.nlng)), 0) into drv from (
        select lat, lng, lead(lat) over (order by at) as nlat, lead(lng) over (order by at) as nlng
          from public.trip_track where booking_id = p_booking and at >= leg_from) t
        where t.nlat is not null;
    end if;
    if drv > trip_m * (cfg->>'detour_x')::float + (cfg->>'detour_extra_m')::float then
      perform public.rw_flag(p_booking, uid, 'detour', 'warn',
        format('Rider has driven about %s km for a %s km trip.', round((drv / 1000)::numeric, 1), round((trip_m / 1000)::numeric, 1)), p_lat, p_lng);
    end if;
  end if;

  -- 4d. Long stop: everything in the last N seconds stayed inside a tiny radius, and it isn't at pickup/dropoff
  select count(*), max(public.rw_dist(t.lat, t.lng, p_lat, p_lng)) into n, span from public.trip_track t
    where t.booking_id = p_booking and t.at > now() - make_interval(secs => (cfg->>'long_stop_s')::int);
  if n >= 5 and span <= (cfg->>'long_stop_r_m')::float
     and (select min(t.at) from public.trip_track t where t.booking_id = p_booking) <= now() - make_interval(secs => (cfg->>'long_stop_s')::int)
     and public.rw_dist(p_lat, p_lng, a_lat, a_lng) > (cfg->>'near_stop_m')::float
     and public.rw_dist(p_lat, p_lng, b_lat, b_lng) > (cfg->>'near_stop_m')::float
     and b.status = 'on_the_way' then
    perform public.rw_flag(p_booking, uid, 'long_stop', 'warn',
      format('Rider has been stopped for over %s min away from pickup and drop-off.', round(((cfg->>'long_stop_s')::int / 60.0)::numeric)), p_lat, p_lng);
  end if;
end $$;

-- 5. Silence check: a trip in progress with no GPS for a while. Called by the owner console on its refresh. --
create or replace function public.route_scan_silent() returns void
language plpgsql security definer set search_path = public as $$
declare cfg jsonb := public.route_watch_cfg(); r record;
begin
  if not public.is_admin() then return; end if;
  for r in
    select x.id::text as id, x.rider_id, (select max(t.at) from public.trip_track t where t.booking_id = x.id::text) as last_at
      from public.bookings x where x.status = 'on_the_way' and x.rider_id is not null
  loop
    if r.last_at is not null and r.last_at < now() - make_interval(secs => (cfg->>'silent_s')::int) then
      perform public.rw_flag(r.id, r.rider_id, 'gps_silent', 'warn',
        format('No GPS from the rider for %s min while the trip is in progress.', round(extract(epoch from now() - r.last_at) / 60)), null, null);
    end if;
  end loop;
end $$;

-- 6. Trip finished far from the drop-off ---------------------------------------------------------------------
create or replace function public.rw_on_booking_done() returns trigger language plpgsql security definer set search_path = public as $$
declare cfg jsonb := public.route_watch_cfg(); pt record; g jsonb; m double precision;
begin
  if new.status::text = 'done' and old.status::text is distinct from 'done' and new.rider_id is not null then
    g := new.details -> 'dropoff_geo';
    select * into pt from public.trip_track where booking_id = new.id::text order by at desc limit 1;
    if g is not null and pt.id is not null then
      m := public.rw_dist(pt.lat, pt.lng, (g->>'lat')::float, (g->>'lng')::float);
      if m > (cfg->>'ended_far_m')::float then
        perform public.rw_flag(new.id::text, new.rider_id, 'ended_far', 'high',
          format('Trip was marked done about %s m from the drop-off point.', round(m)), pt.lat, pt.lng);
      end if;
    end if;
  end if;
  return new;
exception when others then return new;   -- a detection problem must never block a booking update
end $$;
drop trigger if exists rw_done on public.bookings;
create trigger rw_done after update on public.bookings for each row execute function public.rw_on_booking_done();

-- 7. Owner functions -------------------------------------------------------------------------------------------
create or replace function public.admin_list_route_alerts()
returns table (id uuid, booking_id text, rider_id uuid, rider_name text, rider_email text, plate text, kind text, severity text,
               message text, lat double precision, lng double precision, created_at timestamptz, resolved_at timestamptz, note text, summary text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Owners only.'; end if;
  return query
    select a.id, a.booking_id, a.rider_id, coalesce(ra.full_name, p.full_name), u.email::text, ra.plate, a.kind, a.severity,
           a.message, a.lat, a.lng, a.created_at, a.resolved_at, a.note, x.details->>'summary'
      from public.route_alerts a
      join auth.users u on u.id = a.rider_id
      left join public.profiles p on p.id = a.rider_id
      left join public.rider_applications ra on ra.user_id = a.rider_id
      left join public.bookings x on x.id::text = a.booking_id
     order by (a.resolved_at is null) desc, a.created_at desc
     limit 300;
end $$;

create or replace function public.admin_resolve_route_alert(p_alert uuid, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Owners only.'; end if;
  update public.route_alerts set resolved_at = now(), resolved_by = auth.uid(), note = nullif(trim(coalesce(p_note, '')), '') where id = p_alert;
end $$;

-- The trail + planned route of one trip, for the map in the owner console.
create or replace function public.admin_trip_track(p_booking text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare b record; d jsonb; pa jsonb; pb jsonb;
begin
  if not public.is_admin() then raise exception 'Owners only.'; end if;
  select x.type::text as type, x.status::text as status, x.pickup, x.dropoff, x.details into b from public.bookings x where x.id::text = p_booking;
  d := coalesce(b.details, '{}'::jsonb);
  if b.type = 'food' then pa := d #> '{restaurant,geo}'; else pa := d -> 'pickup_geo'; end if;
  pb := d -> 'dropoff_geo';
  return jsonb_build_object(
    'status', b.status, 'pickup', b.pickup, 'dropoff', b.dropoff, 'from', pa, 'to', pb,
    'points', coalesce((select jsonb_agg(jsonb_build_array(t.lat, t.lng, extract(epoch from t.at)::bigint) order by t.at)
                          from public.trip_track t where t.booking_id = p_booking), '[]'::jsonb));
end $$;

revoke all on function public.rider_log_point(text, double precision, double precision), public.route_scan_silent(),
  public.admin_list_route_alerts(), public.admin_resolve_route_alert(uuid, text), public.admin_trip_track(text) from public, anon;
grant execute on function public.rider_log_point(text, double precision, double precision), public.route_scan_silent(),
  public.admin_list_route_alerts(), public.admin_resolve_route_alert(uuid, text), public.admin_trip_track(text) to authenticated;
