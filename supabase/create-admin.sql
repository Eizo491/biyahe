-- Biyahe: built-in owner account. Run ONCE in Supabase > SQL Editor, AFTER supabase/admin-dashboard.sql.
-- Change the two values below if you want, then run. Re-running resets this account's password.
--
--   Sign in on the normal Biyahe screen with this email + password -> you land on the Owner console.

create extension if not exists pgcrypto;

do $$
declare
  v_email text := 'admin@biyahe.com';   -- <- owner email
  v_pass  text := 'Admin@12345';        -- <- owner password (6+ characters)
  v_id    uuid;
begin
  if not exists (select 1 from pg_proc where proname = 'admin_review_application') then
    raise exception 'Run supabase/admin-dashboard.sql first, then run this again.';
  end if;

  select id into v_id from auth.users where email = v_email;

  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
            crypt(v_pass, gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text,
            jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
            'email', now(), now(), now());
  else
    update auth.users set encrypted_password = crypt(v_pass, gen_salt('bf')),
           email_confirmed_at = coalesce(email_confirmed_at, now()) where id = v_id;
  end if;

  insert into public.profiles (id, role) values (v_id, 'admin')
  on conflict (id) do update set role = 'admin';
end $$;

-- Check: this should show your owner email with role = admin.
select u.email, p.role from auth.users u join public.profiles p on p.id = u.id where p.role = 'admin';
