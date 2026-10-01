-- Biyahe: owner (admin) dashboard, rider approval and feedback.
-- Run AFTER supabase/rider-apply.sql (which now leaves applications as 'pending'). Safe to re-run.

-- 1. Allow the 'admin' role (drops any old check on profiles that mentions role).
do $$ declare c record; begin
  for c in select conname from pg_constraint
           where conrelid = 'public.profiles'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%role%'
  loop execute format('alter table public.profiles drop constraint %I', c.conname); end loop;
end $$;
alter table public.profiles add constraint profiles_role_check check (role in ('customer', 'rider', 'admin'));
-- (If profiles.role is an enum type instead of text, run: alter type <enum_name> add value 'admin';)

-- 2. Nobody can change their own role from the browser. Only SQL editor / security-definer functions can.
create or replace function public.protect_role() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then new.role := 'customer';
    elsif new.role is distinct from old.role then new.role := old.role;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists protect_role on public.profiles;
create trigger protect_role before insert or update on public.profiles for each row execute function public.protect_role();

-- 3. Who is the owner?
create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- 4. Feedback from anyone signed in.
create table if not exists public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rating     int check (rating between 1 and 5),
  message    text not null check (length(trim(message)) between 3 and 1000),
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
drop policy if exists "send own feedback" on public.feedback;
create policy "send own feedback" on public.feedback for insert with check (auth.uid() = user_id);
drop policy if exists "read own feedback" on public.feedback;
create policy "read own feedback" on public.feedback for select using (auth.uid() = user_id);
drop policy if exists "admin reads feedback" on public.feedback;
create policy "admin reads feedback" on public.feedback for select using (public.is_admin());
drop policy if exists "admin reads applications" on public.rider_applications;
create policy "admin reads applications" on public.rider_applications for select using (public.is_admin());

-- Live updates for the owner dashboard (ignore the error if already added).
do $$ begin alter publication supabase_realtime add table public.rider_applications; exception when others then null; end $$;
do $$ begin alter publication supabase_realtime add table public.feedback; exception when others then null; end $$;

-- 5. Owner-only functions used by the dashboard.
create or replace function public.admin_list_applications()
returns table (user_id uuid, email text, full_name text, phone text, vehicle text, plate text, status text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Owners only.'; end if;
  return query
    select a.user_id, u.email::text, a.full_name, a.phone, a.vehicle, a.plate, a.status, a.created_at
    from public.rider_applications a join auth.users u on u.id = a.user_id
    order by (a.status = 'pending') desc, a.created_at desc;
end $$;

create or replace function public.admin_list_feedback()
returns table (id uuid, email text, full_name text, role text, rating int, message text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Owners only.'; end if;
  return query
    select f.id, u.email::text, p.full_name, p.role::text, f.rating, f.message, f.created_at
    from public.feedback f join auth.users u on u.id = f.user_id left join public.profiles p on p.id = f.user_id
    order by f.created_at desc limit 200;
end $$;

-- Approve = becomes a rider. Reject = application rejected, and a current rider goes back to customer.
create or replace function public.admin_review_application(p_user uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Owners only.'; end if;
  update public.rider_applications set status = case when p_approve then 'approved' else 'rejected' end where user_id = p_user;
  if not found then raise exception 'Application not found.'; end if;
  if p_approve then
    update public.profiles set role = 'rider' where id = p_user and role <> 'admin';
    if not found and not exists (select 1 from public.profiles where id = p_user) then
      insert into public.profiles (id, role) values (p_user, 'rider');
    end if;
  else
    update public.profiles set role = 'customer' where id = p_user and role = 'rider';
  end if;
end $$;

revoke all on function public.admin_list_applications(), public.admin_list_feedback(), public.admin_review_application(uuid, boolean) from public, anon;
grant execute on function public.admin_list_applications(), public.admin_list_feedback(), public.admin_review_application(uuid, boolean) to authenticated;

-- 6. Riders online/offline: "last seen" stamp + owner list of company riders.
alter table public.profiles add column if not exists last_seen timestamptz;

create or replace function public.rider_heartbeat() returns void
language sql security definer set search_path = public as
$$ update public.profiles set last_seen = now() where id = auth.uid() and role = 'rider' $$;

create or replace function public.admin_list_riders()
returns table (user_id uuid, email text, full_name text, phone text, vehicle text, plate text, last_seen timestamptz, joined timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Owners only.'; end if;
  return query
    select p.id, u.email::text, coalesce(a.full_name, p.full_name), coalesce(a.phone, p.phone), a.vehicle, a.plate, p.last_seen, a.created_at
    from public.profiles p join auth.users u on u.id = p.id left join public.rider_applications a on a.user_id = p.id
    where p.role = 'rider' order by p.last_seen desc nulls last;
end $$;

revoke all on function public.rider_heartbeat(), public.admin_list_riders() from public, anon;
grant execute on function public.rider_heartbeat(), public.admin_list_riders() to authenticated;

-- 7. Make the owner. Put the owner's account email here and run just this statement (once):
-- insert into public.profiles (id, role) select id, 'admin' from auth.users where email = 'OWNER_EMAIL_HERE'
--   on conflict (id) do update set role = 'admin';
