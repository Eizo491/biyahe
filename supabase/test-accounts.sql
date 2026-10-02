-- Biyahe: test accounts skip the "add your mobile number" step after login. Safe to re-run.
-- The list is kept in the database and cannot be edited by app users, so nobody can exempt themselves.

create table if not exists public.test_accounts (email text primary key);
alter table public.test_accounts enable row level security;   -- no policies = the app can't read or change it
revoke all on public.test_accounts from anon, authenticated;

create or replace function public.is_test_account() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from public.test_accounts t
    join auth.users u on lower(u.email) = lower(t.email)
    where u.id = auth.uid()
  )
$$;
revoke all on function public.is_test_account() from public, anon;
grant execute on function public.is_test_account() to authenticated;

-- >>> Put your test accounts' emails here (one row each), then run this file in the Supabase SQL Editor:
insert into public.test_accounts (email) values
  ('test1@example.com'),
  ('test2@example.com')
on conflict do nothing;

-- Later, to add or remove one:
--   insert into public.test_accounts (email) values ('new.test@example.com') on conflict do nothing;
--   delete from public.test_accounts where email = 'old.test@example.com';
