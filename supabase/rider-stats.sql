-- Biyahe: rider stats for the owner console (jobs done, customer reviews of each rider).
-- Run AFTER supabase/admin-dashboard.sql. Safe to re-run.

-- 1. Customer reviews of a rider (one per booking).
create table if not exists public.rider_reviews (
  id          uuid primary key default gen_random_uuid(),
  booking_id  text not null unique,
  rider_id    uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  rating      int  not null check (rating between 1 and 5),
  comment     text check (comment is null or length(comment) <= 1000),
  created_at  timestamptz not null default now()
);
alter table public.rider_reviews enable row level security;

-- Nobody writes here directly; reviews go through rate_rider() below.
drop policy if exists "customer reads own reviews" on public.rider_reviews;
create policy "customer reads own reviews" on public.rider_reviews for select using (auth.uid() = customer_id);
drop policy if exists "rider reads own reviews" on public.rider_reviews;
create policy "rider reads own reviews" on public.rider_reviews for select using (auth.uid() = rider_id);
drop policy if exists "admin reads reviews" on public.rider_reviews;
create policy "admin reads reviews" on public.rider_reviews for select using (public.is_admin());

-- Lets the owner console receive live booking changes (job counts update by themselves).
drop policy if exists "admin reads bookings" on public.bookings;
create policy "admin reads bookings" on public.bookings for select using (public.is_admin());

do $$ begin alter publication supabase_realtime add table public.rider_reviews; exception when others then null; end $$;

-- 2. A customer rates the rider of one of THEIR finished bookings.
--    (Assumes bookings has a customer column named user_id or customer_id.)
create or replace function public.rate_rider(p_booking text, p_rating int, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  b jsonb;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Pick 1 to 5 stars.'; end if;
  select to_jsonb(x) into b from public.bookings x where x.id::text = p_booking;
  if b is null then raise exception 'Booking not found.'; end if;
  if coalesce(b->>'user_id', b->>'customer_id') is distinct from uid::text then raise exception 'That is not your booking.'; end if;
  if b->>'status' <> 'done' or b->>'rider_id' is null then raise exception 'You can rate a rider once the job is done.'; end if;
  insert into public.rider_reviews (booking_id, rider_id, customer_id, rating, comment)
  values (p_booking, (b->>'rider_id')::uuid, uid, p_rating, nullif(trim(coalesce(p_comment, '')), ''))
  on conflict (booking_id) do update set rating = excluded.rating, comment = excluded.comment;
end $$;
revoke all on function public.rate_rider(text, int, text) from public, anon;
grant execute on function public.rate_rider(text, int, text) to authenticated;

-- 3. Owner list of riders, now with jobs done / in progress and average rating.
drop function if exists public.admin_list_riders();
create function public.admin_list_riders()
returns table (user_id uuid, email text, full_name text, phone text, vehicle text, plate text, last_seen timestamptz, joined timestamptz,
               jobs_done int, jobs_active int, avg_rating numeric, review_count int)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Owners only.'; end if;
  return query
    select p.id, u.email::text, coalesce(a.full_name, p.full_name), coalesce(a.phone, p.phone), a.vehicle, a.plate, p.last_seen, a.created_at,
           (select count(*) from public.bookings b where b.rider_id = p.id and b.status = 'done')::int,
           (select count(*) from public.bookings b where b.rider_id = p.id and b.status in ('accepted', 'on_the_way'))::int,
           (select round(avg(r.rating), 1) from public.rider_reviews r where r.rider_id = p.id),
           (select count(*) from public.rider_reviews r where r.rider_id = p.id)::int
    from public.profiles p join auth.users u on u.id = p.id left join public.rider_applications a on a.user_id = p.id
    where p.role = 'rider' order by p.last_seen desc nulls last;
end $$;

-- 4. Owner list of customer reviews about riders.
create or replace function public.admin_list_rider_reviews()
returns table (id uuid, rider_id uuid, rider_name text, rider_email text, customer_name text, customer_email text,
               rating int, comment text, booking_type text, booking_summary text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Owners only.'; end if;
  return query
    select r.id, r.rider_id, coalesce(a.full_name, rp.full_name), ru.email::text, cp.full_name, cu.email::text,
           r.rating, r.comment, b.type::text, b.details->>'summary', r.created_at
    from public.rider_reviews r
    join auth.users ru on ru.id = r.rider_id
    join auth.users cu on cu.id = r.customer_id
    left join public.profiles rp on rp.id = r.rider_id
    left join public.rider_applications a on a.user_id = r.rider_id
    left join public.profiles cp on cp.id = r.customer_id
    left join public.bookings b on b.id::text = r.booking_id
    order by r.created_at desc limit 500;
end $$;

-- 5. App feedback list, now with user_id so a rider's own feedback can be shown on their profile.
drop function if exists public.admin_list_feedback();
create function public.admin_list_feedback()
returns table (id uuid, email text, full_name text, role text, rating int, message text, created_at timestamptz, user_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Owners only.'; end if;
  return query
    select f.id, u.email::text, p.full_name, p.role::text, f.rating, f.message, f.created_at, f.user_id
    from public.feedback f join auth.users u on u.id = f.user_id left join public.profiles p on p.id = f.user_id
    order by f.created_at desc limit 200;
end $$;

revoke all on function public.admin_list_riders(), public.admin_list_rider_reviews(), public.admin_list_feedback() from public, anon;
grant execute on function public.admin_list_riders(), public.admin_list_rider_reviews(), public.admin_list_feedback() to authenticated;
