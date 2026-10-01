-- Biyahe: SOS for "Share my trip". Run AFTER supabase/trip-share.sql. Safe to re-run.
-- The customer taps SOS -> the trusted contact's share page shows a red alert with the latest locations.
-- The customer can cancel the alert. It also clears when sharing stops or the trip ends.

alter table public.trip_shares add column if not exists sos_at timestamptz;

-- 1. Customer turns the SOS alert on/off for one of their shares. Returns true if a live share was updated.
create or replace function public.share_sos(p_booking text, p_on boolean)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  update public.trip_shares set sos_at = case when p_on then now() else null end
   where booking_id = p_booking and customer_id = auth.uid() and stopped_at is null and expires_at > now();
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- 2. Stopping a share also clears the alert and the stored locations.
create or replace function public.stop_trip_share(p_booking text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  update public.trip_shares
     set stopped_at = now(), sos_at = null, cust_lat = null, cust_lng = null, cust_at = null, rider_lat = null, rider_lng = null, rider_at = null
   where booking_id = p_booking and customer_id = auth.uid() and stopped_at is null;
end $$;

-- 3. The customer's active links now also say whether SOS is on (so the app remembers it after a reload).
drop function if exists public.my_trip_shares();
create function public.my_trip_shares()
returns table (booking_id text, token text, sos boolean) language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  return query select s.booking_id, s.token, s.sos_at is not null from public.trip_shares s
   where s.customer_id = auth.uid() and s.stopped_at is null and s.expires_at > now();
end $$;

-- 4. The public share page now also receives the SOS state.
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
    'sos', (s.sos_at is not null and not ended),
    'rider', case when b.rider_id is null or a.plate is null then null
                  else jsonb_build_object('name', a.full_name, 'vehicle', a.vehicle, 'plate', a.plate) end,
    'customer', case when ended or s.cust_lat is null then null
                     else jsonb_build_object('lat', s.cust_lat, 'lng', s.cust_lng, 'age', round(extract(epoch from now() - s.cust_at))) end,
    'rider_pos', case when ended or s.rider_lat is null then null
                      else jsonb_build_object('lat', s.rider_lat, 'lng', s.rider_lng, 'age', round(extract(epoch from now() - s.rider_at))) end
  );
end $$;

revoke all on function public.share_sos(text, boolean), public.stop_trip_share(text), public.my_trip_shares(), public.get_trip_share(text) from public, anon, authenticated;
grant execute on function public.share_sos(text, boolean), public.stop_trip_share(text), public.my_trip_shares() to authenticated;
grant execute on function public.get_trip_share(text) to anon, authenticated;
