-- Biyahe: "Share my trip". A customer can send a private link to someone they trust (family, a friend).
-- That person opens the link in any browser, WITHOUT the app or an account, and sees the live location of
-- the customer and the rider, plus the rider's name, vehicle and plate number.
-- Run AFTER supabase/rider-plate.sql. Safe to re-run.
--
-- Privacy rules built into this file:
--   * Nothing is shared unless the customer taps "Share my trip" (only the customer can create a link).
--   * The link holds a long random secret. It can't be guessed and there is no list of links to browse.
--   * The customer can stop sharing at any time; the stored locations are erased immediately.
--   * Sharing stops by itself when the trip is done or cancelled, or after 6 hours.
--   * Only the LATEST point is stored (it is overwritten, no location history is kept).
--   * The public page never gets emails or phone numbers, only the customer's first name.

create table if not exists public.trip_shares (
  token       text primary key default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  booking_id  text not null,
  customer_id uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '6 hours',
  stopped_at  timestamptz,
  cust_lat double precision, cust_lng double precision, cust_at  timestamptz,
  rider_lat double precision, rider_lng double precision, rider_at timestamptz
);
create index if not exists trip_shares_booking_idx  on public.trip_shares (booking_id);
create index if not exists trip_shares_customer_idx on public.trip_shares (customer_id);

-- Locked down: the browser never reads or writes this table directly, only through the functions below.
alter table public.trip_shares enable row level security;
revoke all on public.trip_shares from anon, authenticated;

-- 1. Customer starts sharing one of THEIR trips that is still in progress (returns the secret token).
create or replace function public.create_trip_share(p_booking text)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  b jsonb;
  t text;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  select to_jsonb(x) into b from public.bookings x where x.id::text = p_booking;
  if b is null then raise exception 'Booking not found.'; end if;
  if coalesce(b->>'user_id', b->>'customer_id') is distinct from uid::text then raise exception 'That is not your booking.'; end if;
  if b->>'status' not in ('searching', 'accepted', 'on_the_way') then raise exception 'You can only share a trip that is in progress.'; end if;

  delete from public.trip_shares where expires_at < now() - interval '1 day';   -- tidy up old rows

  select s.token into t from public.trip_shares s
   where s.booking_id = p_booking and s.customer_id = uid and s.stopped_at is null and s.expires_at > now();
  if t is null then
    insert into public.trip_shares (booking_id, customer_id) values (p_booking, uid) returning token into t;
  end if;
  return t;
end $$;

-- 2. Customer stops sharing. The stored locations are wiped.
create or replace function public.stop_trip_share(p_booking text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  update public.trip_shares
     set stopped_at = now(), cust_lat = null, cust_lng = null, cust_at = null, rider_lat = null, rider_lng = null, rider_at = null
   where booking_id = p_booking and customer_id = auth.uid() and stopped_at is null;
end $$;

-- 3. The customer's active links (so the app can offer "send link again" / "stop sharing" after a reload).
create or replace function public.my_trip_shares()
returns table (booking_id text, token text) language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  return query select s.booking_id, s.token from public.trip_shares s
   where s.customer_id = auth.uid() and s.stopped_at is null and s.expires_at > now();
end $$;

-- 4. The customer's phone sends its location. Returns false once the share has ended (the app then stops sending).
create or replace function public.share_update_location(p_token text, p_lat double precision, p_lng double precision)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Bad location.'; end if;
  update public.trip_shares set cust_lat = p_lat, cust_lng = p_lng, cust_at = now()
   where token = p_token and customer_id = auth.uid() and stopped_at is null and expires_at > now();
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- 5. The rider's phone sends its location for a job the rider actually accepted.
--    Returns true if someone is following this trip (the rider app slows down when nobody is).
create or replace function public.share_update_rider(p_booking text, p_lat double precision, p_lng double precision)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Bad location.'; end if;
  update public.trip_shares s set rider_lat = p_lat, rider_lng = p_lng, rider_at = now()
   where s.booking_id = p_booking and s.stopped_at is null and s.expires_at > now()
     and exists (select 1 from public.bookings b where b.id::text = p_booking and b.rider_id = auth.uid()
                   and b.status in ('accepted', 'on_the_way'));
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- 6. What the public share page (share.html) reads. Works without signing in; the secret token IS the permission.
create or replace function public.get_trip_share(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  s public.trip_shares;
  b record;
  a record;
  cname text;
  ended boolean;
begin
  select * into s from public.trip_shares where token = p_token;
  if not found then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;
  if s.stopped_at is not null then return jsonb_build_object('ok', false, 'reason', 'stopped'); end if;
  if s.expires_at <= now() then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;

  select x.id, x.type::text as type, x.status::text as status, x.pickup, x.dropoff, x.rider_id, x.details->>'summary' as summary
    into b from public.bookings x where x.id::text = s.booking_id;
  if b.id is null then return jsonb_build_object('ok', false, 'reason', 'not_found'); end if;

  select ra.full_name, ra.vehicle, ra.plate into a
    from public.rider_applications ra where ra.user_id = b.rider_id and ra.status = 'approved';
  select nullif(split_part(coalesce(p.full_name, ''), ' ', 1), '') into cname from public.profiles p where p.id = s.customer_id;

  ended := b.status in ('done', 'cancelled');
  return jsonb_build_object(
    'ok', true,
    'status', b.status,
    'ended', ended,
    'type', b.type,
    'customer_name', coalesce(cname, 'Your contact'),
    'pickup', b.pickup,
    'dropoff', b.dropoff,
    'summary', b.summary,
    'rider', case when b.rider_id is null or a.plate is null then null
                  else jsonb_build_object('name', a.full_name, 'vehicle', a.vehicle, 'plate', a.plate) end,
    -- locations are never returned once the trip has ended
    'customer', case when ended or s.cust_lat is null then null
                     else jsonb_build_object('lat', s.cust_lat, 'lng', s.cust_lng, 'age', round(extract(epoch from now() - s.cust_at))) end,
    'rider_pos', case when ended or s.rider_lat is null then null
                      else jsonb_build_object('lat', s.rider_lat, 'lng', s.rider_lng, 'age', round(extract(epoch from now() - s.rider_at))) end
  );
end $$;

revoke all on function public.create_trip_share(text), public.stop_trip_share(text), public.my_trip_shares(),
  public.share_update_location(text, double precision, double precision),
  public.share_update_rider(text, double precision, double precision), public.get_trip_share(text) from public, anon, authenticated;
grant execute on function public.create_trip_share(text), public.stop_trip_share(text), public.my_trip_shares(),
  public.share_update_location(text, double precision, double precision),
  public.share_update_rider(text, double precision, double precision) to authenticated;
grant execute on function public.get_trip_share(text) to anon, authenticated;
