-- Biyahe: sign-up. Creates the customer profile (name + phone from the Create account form) for every new user.
-- Safe to re-run. Role is always 'customer'; riders still apply in the app, admins via create-admin.sql.
alter table public.profiles add column if not exists full_name text, add column if not exists phone text;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into public.profiles (id, role, full_name, phone)
    values (new.id, 'customer', nullif(trim(new.raw_user_meta_data->>'full_name'), ''), nullif(trim(new.raw_user_meta_data->>'phone'), ''))
    on conflict (id) do nothing;
  exception when others then null;   -- never block a sign-up because of the profile row
  end;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
