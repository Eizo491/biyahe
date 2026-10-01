-- Biyahe: let a customer see WHO is coming for them (rider name, vehicle and plate number).
-- Run AFTER supabase/rider-apply.sql and supabase/rider-stats.sql. Safe to re-run.
--
-- Why an RPC and not a table policy: rider_applications stays private. This function only ever
-- returns the rider of a booking that belongs to the person calling it, and only once a rider
-- has actually accepted it, so nobody can look up plates at random.
create or replace function public.get_my_booking_riders()
returns table (booking_id text, rider_name text, vehicle text, plate text, avg_rating numeric, review_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  return query
    select b.id::text,
           coalesce(a.full_name, p.full_name, 'Your rider'),
           a.vehicle,
           a.plate,
           (select round(avg(r.rating), 1) from public.rider_reviews r where r.rider_id = b.rider_id),
           (select count(*) from public.rider_reviews r where r.rider_id = b.rider_id)::int
    from public.bookings b
    join public.rider_applications a on a.user_id = b.rider_id and a.status = 'approved'
    left join public.profiles p on p.id = b.rider_id
    where b.rider_id is not null
      and b.status in ('accepted', 'on_the_way', 'done')
      and coalesce(to_jsonb(b)->>'user_id', to_jsonb(b)->>'customer_id') = uid::text
    order by b.created_at desc
    limit 200;
end $$;

revoke all on function public.get_my_booking_riders() from public, anon;
grant execute on function public.get_my_booking_riders() to authenticated;
