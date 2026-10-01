-- Biyahe: safety check-in + auto-alert. Run AFTER route-watch.sql, trip-share.sql and trip-share-sos.sql. Safe to re-run.
-- When Route Watch flags a trip, the customer gets an "Are you okay?" prompt (90 s). "I need help" or no answer =>
-- the owner alert becomes HIGH and the SOS alert turns on for any trip link the customer already shared.

create table if not exists public.trip_checkins (
  id uuid primary key default gen_random_uuid(),
  booking_id text not null,
  customer_id uuid not null references auth.users(id) on delete cascade,
  alert_id uuid, kind text,
  status text not null default 'pending' check (status in ('pending','ok','escalated')),
  created_at timestamptz not null default now(),
  due_at timestamptz not null default now() + interval '90 seconds',
  answered_at timestamptz
);
create unique index if not exists trip_checkins_one_pending on public.trip_checkins (booking_id) where status = 'pending';
alter table public.trip_checkins enable row level security;
revoke all on public.trip_checkins from anon, authenticated;

-- 1. A new Route Watch flag opens a check-in (max one per trip per 10 minutes).
create or replace function public.checkin_on_alert() returns trigger language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if new.kind not in ('off_route','wrong_way','long_stop','detour','gps_silent') then return new; end if;
  select coalesce(to_jsonb(x)->>'user_id', to_jsonb(x)->>'customer_id')::uuid into cid from public.bookings x where x.id::text = new.booking_id;
  if cid is null then return new; end if;
  if exists (select 1 from public.trip_checkins where booking_id = new.booking_id and created_at > now() - interval '10 minutes') then return new; end if;
  insert into public.trip_checkins (booking_id, customer_id, alert_id, kind) values (new.booking_id, cid, new.id, new.kind) on conflict do nothing;
  return new;
end $$;
drop trigger if exists checkin_on_alert on public.route_alerts;
create trigger checkin_on_alert after insert on public.route_alerts for each row execute function public.checkin_on_alert();

-- 2. Escalate: owner alert -> high, SOS on for the customer's live trip link(s). Returns true if a link was alerted.
create or replace function public.checkin_do_escalate(p_id uuid, p_reason text) returns boolean language plpgsql security definer set search_path = public as $$
declare c record;
begin
  update public.trip_checkins set status = 'escalated', answered_at = now() where id = p_id and status = 'pending' returning * into c;
  if c.id is null then return false; end if;
  update public.route_alerts set severity = 'high', message = message || ' Customer check-in: ' || p_reason || '.' where id = c.alert_id;
  update public.trip_shares set sos_at = now() where booking_id = c.booking_id and stopped_at is null and expires_at > now();
  return found;
end $$;
revoke all on function public.checkin_do_escalate(uuid, text) from public, anon, authenticated;

-- 3. No answer: every rider GPS point sweeps overdue check-ins (no cron needed while a trip is moving).
create or replace function public.checkin_sweep() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in select id from public.trip_checkins where status = 'pending' and due_at < now() loop perform public.checkin_do_escalate(r.id, 'no answer'); end loop;
  return null;
end $$;
drop trigger if exists checkin_sweep on public.trip_track;
create trigger checkin_sweep after insert on public.trip_track for each statement execute function public.checkin_sweep();

-- 4. What the customer app calls.
create or replace function public.my_pending_checkin() returns table (id uuid, due_at timestamptz, kind text)
language sql security definer set search_path = public as $$
  select c.id, c.due_at, c.kind from public.trip_checkins c where c.customer_id = auth.uid() and c.status = 'pending' order by c.created_at desc limit 1
$$;
create or replace function public.answer_checkin(p_id uuid, p_help boolean) returns jsonb language plpgsql security definer set search_path = public as $$
declare c record; shared boolean;
begin
  select * into c from public.trip_checkins where id = p_id and customer_id = auth.uid();
  if c.id is null then raise exception 'Check-in not found.'; end if;
  if not p_help then
    update public.trip_checkins set status = 'ok', answered_at = now() where id = p_id and status = 'pending';
    return jsonb_build_object('ok', true);
  end if;
  perform public.checkin_do_escalate(p_id, 'customer asked for help');
  select exists (select 1 from public.trip_shares where booking_id = c.booking_id and stopped_at is null and expires_at > now() and sos_at is not null) into shared;
  return jsonb_build_object('escalated', true, 'shared', shared);
end $$;
revoke all on function public.my_pending_checkin(), public.answer_checkin(uuid, boolean) from public, anon;
grant execute on function public.my_pending_checkin(), public.answer_checkin(uuid, boolean) to authenticated;
