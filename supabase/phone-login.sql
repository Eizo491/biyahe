-- Biyahe: sign in with a mobile number. Run AFTER signup.sql. Safe to re-run.
-- (The number is matched on its last 10 digits, so 09171234567 / +639171234567 / 9171234567 are the same.)
do $$ begin
  create unique index if not exists profiles_phone_unique on public.profiles ((right(regexp_replace(phone, '\D', '', 'g'), 10))) where phone is not null and length(regexp_replace(phone, '\D', '', 'g')) >= 10;
exception when others then raise notice 'Some accounts already share a phone number; fix those, then re-run to enforce one account per number.';
end $$;

create or replace function public.login_email_for_phone(p_phone text) returns text language sql stable security definer set search_path = public, auth as $$
  select u.email::text from public.profiles p join auth.users u on u.id = p.id
   where p.phone is not null and length(regexp_replace(coalesce(p_phone,''), '\D', '', 'g')) >= 10
     and right(regexp_replace(p.phone, '\D', '', 'g'), 10) = right(regexp_replace(p_phone, '\D', '', 'g'), 10) limit 1
$$;
create or replace function public.phone_available(p_phone text) returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles p where p.phone is not null and right(regexp_replace(p.phone, '\D', '', 'g'), 10) = right(regexp_replace(coalesce(p_phone,''), '\D', '', 'g'), 10))
$$;
revoke all on function public.login_email_for_phone(text), public.phone_available(text) from public;
grant execute on function public.login_email_for_phone(text), public.phone_available(text) to anon, authenticated;
