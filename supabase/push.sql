-- Biyahe: phone push notifications (works when the app is closed). Run once in the SQL editor. Safe to re-run.
-- Setup order:
--  1. Terminal:  npx web-push generate-vapid-keys        (gives a public + private key)
--  2. Put the PUBLIC key in js/config.js (VAPID_PUBLIC_KEY).
--  3. Deploy the function and set its secrets (see supabase/functions/push/index.ts header).
--  4. Replace CHANGE_ME below with the same value as the PUSH_SECRET secret, then run this file.
--  (No Database Webhooks needed: this file uses the pg_net extension directly.)

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'customer',
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;   -- no policies: only the functions below and the Edge Function touch it

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_role text default 'customer')
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  insert into public.push_subscriptions (endpoint, user_id, role, p256dh, auth) values (p_endpoint, auth.uid(), coalesce(p_role, 'customer'), p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = auth.uid(), role = excluded.role, p256dh = excluded.p256dh, auth = excluded.auth;
end $$;
create or replace function public.remove_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;
revoke all on function public.save_push_subscription(text, text, text, text), public.remove_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text), public.remove_push_subscription(text) to authenticated;

-- Every booking insert/update calls the Edge Function, which decides who to notify.
-- Uses pg_net (built into Supabase) instead of the Database Webhooks schema, so nothing has to be enabled first.
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_push_on_booking()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://vnnvebciwuzudqchuimc.supabase.co/functions/v1/push',
    body := jsonb_build_object('type', tg_op, 'table', tg_table_name, 'schema', tg_table_schema,
                               'record', to_jsonb(new), 'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) else null end),
    headers := '{"Content-Type":"application/json","x-push-secret":"CHANGE_ME"}'::jsonb,
    timeout_milliseconds := 5000);
  return new;
exception when others then
  return new;   -- a push problem must never block a booking
end $$;

drop trigger if exists push_on_booking on public.bookings;
create trigger push_on_booking after insert or update on public.bookings
  for each row execute function public.notify_push_on_booking();
