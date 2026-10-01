-- Biyahe: "Become a rider" (one login, role decides the dashboard)
-- Run once in Supabase > SQL Editor. Safe to re-run.

-- 1. Extra profile details collected by the application form.
alter table public.profiles
  add column if not exists full_name text,
  add column if not exists phone text;

-- 2. One application per user (the users can only READ their own; they cannot write it directly).
create table if not exists public.rider_applications (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null,
  phone      text not null,
  vehicle    text not null check (vehicle in ('Motorcycle', 'Tricycle', 'Car')),
  plate      text not null,
  status     text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);
alter table public.rider_applications enable row level security;

drop policy if exists "read own rider application" on public.rider_applications;
create policy "read own rider application" on public.rider_applications
  for select using (auth.uid() = user_id);

-- 3. The only way to become a rider. It runs with the function owner's rights, so the browser never
--    edits profiles.role itself.
--
--    auto_approve = true   -> applying switches the account to rider immediately.
--    auto_approve = false  -> the application waits as 'pending' until you approve it, with:
--        update public.profiles set role = 'rider' where id = '<user id>';
--        update public.rider_applications set status = 'approved' where user_id = '<user id>';
create or replace function public.apply_as_rider(p_name text, p_phone text, p_vehicle text, p_plate text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  auto_approve constant boolean := false;
  uid uuid := auth.uid();
  current_status text;
  new_status text := case when auto_approve then 'approved' else 'pending' end;
begin
  if uid is null then raise exception 'Please sign in first.'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_phone, ''))) < 10
     or length(trim(coalesce(p_plate, ''))) < 3 then
    raise exception 'Please fill in all fields.';
  end if;
  if p_vehicle not in ('Motorcycle', 'Tricycle', 'Car') then
    raise exception 'Please choose a vehicle.';
  end if;

  select status into current_status from public.rider_applications where user_id = uid;
  if current_status = 'rejected' then
    raise exception 'Your previous application was not approved. Please contact support.';
  end if;

  insert into public.rider_applications (user_id, full_name, phone, vehicle, plate, status)
  values (uid, trim(p_name), trim(p_phone), p_vehicle, upper(trim(p_plate)), new_status)
  on conflict (user_id) do update
    set full_name = excluded.full_name,
        phone     = excluded.phone,
        vehicle   = excluded.vehicle,
        plate     = excluded.plate,
        status    = case when rider_applications.status = 'approved' then 'approved' else excluded.status end;

  if new_status = 'approved' or current_status = 'approved' then
    update public.profiles set role = 'rider', full_name = trim(p_name), phone = trim(p_phone) where id = uid;
    if not found then
      insert into public.profiles (id, role, full_name, phone) values (uid, 'rider', trim(p_name), trim(p_phone));
    end if;
    return 'rider';
  end if;

  return 'pending';
end;
$$;

revoke all on function public.apply_as_rider(text, text, text, text) from public, anon;
grant execute on function public.apply_as_rider(text, text, text, text) to authenticated;
