-- Security round 1 (2026-10-27): the invite and phone flows.
--
--  1. users.phone is server-owned. It mirrors auth.users.phone only once the number
--     is confirmed, and a signed-in client can update only its profile columns
--     (column-level grants). Before this, users_update let anyone set their own
--     phone to any number, and accept_invites_for_me then joined them to every
--     pending invite for it.
--  2. accept_invites_for_me / accept_invite_token read the confirmed auth phone,
--     not the users row.
--  3. Inviting needs a confirmed number. Texts go only to US/Canada numbers (the
--     toll-free number cannot reach anywhere else) and a number is texted at most
--     three times a day whoever is inviting. Other invites still exist with a
--     working join link; nothing is sent. No onboarding step changes: the app
--     already requires a confirmed number before the invite screen.
--  4. Forgot password: the full number never leaves the server. The app gets the
--     masked number and a one-hour ticket; the reset-otp Edge Function sends and
--     checks the code through Supabase Auth (the same Twilio path as sign-up).
--     Requests are also capped per caller IP.

-- ---------------------------------------------------------------------------
-- 1. users: profile columns only, from the app
-- ---------------------------------------------------------------------------
revoke update on table public.users from anon, authenticated;
grant update (first_name, last_name, display_name, photo_url, venmo_username, default_pay_platform)
  on table public.users to authenticated;
-- (a later migration that adds a user-editable column must grant update on it here too)

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_platform public.pay_platform; v_handle text; v_phone text;
begin
  -- only a confirmed number is copied: an unverified sign-up must never claim a
  -- number for invite matching
  v_phone := case when new.phone_confirmed_at is not null then nullif(new.phone, '') end;
  insert into public.users (id, phone, email, display_name, venmo_username)
  values (new.id, v_phone,
          coalesce(nullif(new.email, ''), nullif(new.raw_user_meta_data->>'email', '')),
          nullif(new.raw_user_meta_data->>'display_name', ''),
          nullif(new.raw_user_meta_data->>'venmo_username', ''))
  on conflict (id) do update set
    phone = coalesce(excluded.phone, public.users.phone),
    email = coalesce(excluded.email, public.users.email),
    display_name = coalesce(public.users.display_name, excluded.display_name),
    venmo_username = coalesce(public.users.venmo_username, excluded.venmo_username);

  v_handle := btrim(coalesce(new.raw_user_meta_data->>'pay_handle', new.raw_user_meta_data->>'venmo_username', ''));
  begin
    v_platform := coalesce(nullif(new.raw_user_meta_data->>'pay_platform', ''), 'venmo')::public.pay_platform;
  exception when invalid_text_representation then v_platform := 'venmo';
  end;

  if v_handle <> '' then
    insert into public.payment_handles (user_id, platform, handle)
    values (new.id, v_platform, v_handle)
    on conflict (user_id, platform) do nothing;
    update public.users set default_pay_platform = coalesce(default_pay_platform, v_platform) where id = new.id;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of phone, email, phone_confirmed_at on auth.users
  for each row execute function public.handle_new_auth_user();

-- one-time: drop any users.phone that is not the confirmed auth number, then fill
-- in confirmed numbers that were missing
update public.users u set phone = null
  from auth.users a
 where a.id = u.id and u.phone is not null
   and (a.phone_confirmed_at is null or a.phone is distinct from u.phone);
update public.users u set phone = a.phone
  from auth.users a
 where a.id = u.id and u.deleted_at is null and u.phone is null
   and a.phone_confirmed_at is not null and nullif(a.phone, '') is not null
   and not exists (select 1 from public.users x where x.phone = a.phone);

-- the confirmed number on an account, or null
create or replace function private.confirmed_phone(p_user uuid)
returns text language sql security definer stable set search_path = public as $$
  select nullif(phone, '') from auth.users where id = p_user and phone_confirmed_at is not null;
$$;
revoke all on function private.confirmed_phone(uuid) from public;

-- ---------------------------------------------------------------------------
-- 2. accepting invites: by the confirmed auth phone only
-- ---------------------------------------------------------------------------
create or replace function public.accept_invites_for_me(p_via public.joined_via default 'app')
returns setof uuid language plpgsql security definer set search_path = public, private as $$
declare v_phone text; r record;
begin
  v_phone := private.confirmed_phone(auth.uid());
  if v_phone is null then return; end if;
  for r in select * from public.invites where phone = v_phone and status = 'pending' and expires_at > now() loop
    insert into public.trip_members (trip_id, user_id, role, joined_via) values (r.trip_id, auth.uid(), 'member', p_via)
    on conflict (trip_id, user_id) do update set removed_at = null;
    update public.invites set status = 'accepted' where id = r.id;
    return next r.trip_id;
  end loop;
end $$;

create or replace function public.accept_invite_token(p_token text, p_via public.joined_via default 'web')
returns uuid language plpgsql security definer set search_path = public, private as $$
declare r record; v_phone text;
begin
  select * into r from public.invites where token = p_token;
  if r.id is null then raise exception 'invite not found' using errcode = 'P0002'; end if;
  if r.status <> 'pending' or r.expires_at <= now() then raise exception 'invite expired' using errcode = 'P0002'; end if;
  v_phone := private.confirmed_phone(auth.uid());
  if v_phone is null or v_phone is distinct from r.phone then
    raise exception 'this invite was sent to a different number' using errcode = '42501';
  end if;
  insert into public.trip_members (trip_id, user_id, role, joined_via) values (r.trip_id, auth.uid(), 'member', p_via)
  on conflict (trip_id, user_id) do update set removed_at = null;
  update public.invites set status = 'accepted' where id = r.id;
  return r.trip_id;
end $$;

-- ---------------------------------------------------------------------------
-- 3. inviting: confirmed inviter, US/Canada texts, three texts a day per number
-- ---------------------------------------------------------------------------
create or replace function public.guard_invite_rate()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare n int; v_mine text; v_recent int;
begin
  v_mine := private.confirmed_phone(new.invited_by);
  if v_mine is null then
    raise exception 'confirm your phone number before inviting people' using errcode = '42501';
  end if;
  select count(*) into n from public.invites where invited_by = new.invited_by and created_at > now() - interval '24 hours';
  if n >= 50 then
    raise exception 'invite limit reached: 50 invites a day. Try again tomorrow.' using errcode = '54000';
  end if;
  -- digits only (users.phone is stored without "+"); a bare 10-digit number is US/Canada
  new.phone := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
  if length(new.phone) = 10 then new.phone := '1' || new.phone; end if;
  if new.phone = '' then raise exception 'a phone number is required' using errcode = '23514'; end if;
  if v_mine = new.phone then
    raise exception 'that is your own number' using errcode = '23514';
  end if;
  -- the toll-free number reaches US/Canada only: anything else keeps its invite
  -- and join link, but no text is sent
  if new.phone !~ '^1[2-9]\d{2}[2-9]\d{6}$' then new.text_ok := false; end if;
  -- a number is texted at most three times a day, whoever is inviting
  if new.text_ok then
    select count(*) into v_recent from public.invites
     where phone = new.phone and text_ok and created_at > now() - interval '24 hours';
    if v_recent >= 3 then new.text_ok := false; end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- 4. forgot password: the number stays server-side
-- ---------------------------------------------------------------------------
alter table private.reset_requests
  add column if not exists ip text,
  add column if not exists sends int not null default 0,
  add column if not exists checks int not null default 0;
create index if not exists reset_requests_ip_idx on private.reset_requests (ip, created_at);

-- the caller's address as the API gateway reports it (best effort; null when unknown)
create or replace function private.request_ip()
returns text language plpgsql stable as $$
declare h jsonb;
begin
  begin
    h := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    return null;
  end;
  if h is null then return null; end if;
  return coalesce(nullif(h->>'cf-connecting-ip', ''),
                  nullif(btrim(split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)), ''),
                  nullif(h->>'x-real-ip', ''));
end $$;

create or replace function public.request_password_reset_v2(p_identifier text)
returns jsonb language plpgsql security definer set search_path = public, private as $$
declare v_phone text; v_key text := lower(trim(coalesce(p_identifier, ''))); v_ticket uuid; v_ip text;
begin
  if v_key = '' then return null; end if;
  v_ip := private.request_ip();
  if (select count(*) from private.reset_requests where identifier = v_key and created_at > now() - interval '1 hour') >= 5
     or (v_ip is not null and (select count(*) from private.reset_requests where ip = v_ip and created_at > now() - interval '1 hour') >= 20) then
    raise exception 'too many reset attempts; try again in an hour' using errcode = '54000';
  end if;
  v_phone := private.lookup_reset_phone(p_identifier);
  insert into private.reset_requests (identifier, phone, ip) values (v_key, v_phone, v_ip) returning ticket into v_ticket;
  if v_phone is null then return null; end if;
  return jsonb_build_object('masked', '•••• ••• ' || right(v_phone, 4), 'ticket', v_ticket);
end $$;

-- the old one-shot read of the full number is no longer for clients
revoke execute on function public.reset_phone_for_ticket(uuid) from public, anon, authenticated;

-- for the reset-otp function only (service role): the number behind a live ticket.
--   send   → counts a code sent (three per ticket)
--   check  → counts a code tried (ten per ticket)
--   finish → the code matched; the ticket is spent
create or replace function public.reset_ticket_phone(p_ticket uuid, p_action text)
returns text language plpgsql security definer set search_path = public, private as $$
declare r private.reset_requests%rowtype;
begin
  select * into r from private.reset_requests
   where ticket = p_ticket and phone is not null and used_at is null and created_at > now() - interval '1 hour'
   for update;
  if r.ticket is null then return null; end if;
  if p_action = 'send' then
    if r.sends >= 3 then raise exception 'too many codes sent; start over' using errcode = '54000'; end if;
    update private.reset_requests set sends = sends + 1 where ticket = p_ticket;
  elsif p_action = 'check' then
    if r.checks >= 10 then raise exception 'too many attempts; start over' using errcode = '54000'; end if;
    update private.reset_requests set checks = checks + 1 where ticket = p_ticket;
  elsif p_action = 'finish' then
    update private.reset_requests set used_at = now() where ticket = p_ticket;
  else
    raise exception 'unknown action' using errcode = '22023';
  end if;
  return '+' || r.phone;
end $$;
revoke all on function public.reset_ticket_phone(uuid, text) from public, anon, authenticated;
grant execute on function public.reset_ticket_phone(uuid, text) to service_role;
