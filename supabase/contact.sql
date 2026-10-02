-- Biyahe: Call / Message between rider and customer + phone number for Google sign-in.
-- Run AFTER rider-plate.sql, signup.sql and phone-login.sql. Safe to re-run.

-- 1) Customer: who is my rider (now also returns the rider's phone, so the Call / Message buttons work).
drop function if exists public.get_my_booking_riders();
create or replace function public.get_my_booking_riders()
returns table (booking_id text, rider_name text, vehicle text, plate text, avg_rating numeric, review_count int, rider_phone text)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  return query
    select b.id::text,
           coalesce(a.full_name, p.full_name, 'Your rider'),
           a.vehicle, a.plate,
           (select round(avg(r.rating), 1) from public.rider_reviews r where r.rider_id = b.rider_id),
           (select count(*) from public.rider_reviews r where r.rider_id = b.rider_id)::int,
           coalesce(a.phone, p.phone)
    from public.bookings b
    join public.rider_applications a on a.user_id = b.rider_id and a.status = 'approved'
    left join public.profiles p on p.id = b.rider_id
    where b.rider_id is not null
      and b.status in ('accepted', 'on_the_way', 'done')
      and coalesce(to_jsonb(b)->>'user_id', to_jsonb(b)->>'customer_id') = uid::text
    order by b.created_at desc limit 200;
end $$;
revoke all on function public.get_my_booking_riders() from public, anon;
grant execute on function public.get_my_booking_riders() to authenticated;

-- 2) Rider: the customer's name + phone, only for a job THIS rider accepted and that is still active.
create or replace function public.get_booking_customer(p_booking_id text)
returns table (customer_name text, customer_phone text)
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  return query
    select p.full_name, p.phone
    from public.bookings b
    join public.profiles p on p.id::text = coalesce(to_jsonb(b)->>'user_id', to_jsonb(b)->>'customer_id')
    where b.id::text = p_booking_id and b.rider_id = uid and b.status in ('accepted', 'on_the_way')
    limit 1;
end $$;
revoke all on function public.get_booking_customer(text) from public, anon;
grant execute on function public.get_booking_customer(text) to authenticated;

-- 3) Google sign-in: save the mobile number the person gives after logging in with Google.
create or replace function public.set_my_phone(p_phone text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); d text := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10);
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if length(d) <> 10 then raise exception 'Enter a valid mobile number.'; end if;
  if exists (select 1 from public.profiles x where x.id <> uid and x.phone is not null and right(regexp_replace(x.phone, '\D', '', 'g'), 10) = d)
    then raise exception 'That mobile number is already registered.'; end if;
  insert into public.profiles (id, role, phone) values (uid, 'customer', d)
  on conflict (id) do update set phone = excluded.phone;
end $$;
revoke all on function public.set_my_phone(text) from public, anon;
grant execute on function public.set_my_phone(text) to authenticated;
