-- Invites need an acceptance (user decision 2026-10-27, reversing 2026-09-30).
--
-- Nobody joins a Dazzle without tapping Accept in the app:
--  * inviting someone who already has Zebrasplit no longer adds them; they get a push
--    carrying the join link (still no text to app users) and the invite stays pending
--  * signing in no longer joins every pending invite for the number
--    (accept_invites_for_me is gone); the app lists them under Invitations instead
--  * my_invites() lists the pending invites for my confirmed number; accept_invite_token
--    joins one; decline_invite turns one down
--  * the web guest view is retired: the join link opens the app or the store

-- known user: tell them, don't add them
create or replace function public.attach_known_user_invite()
returns trigger language plpgsql security definer set search_path = public, private as $$
declare v_user uuid; v_title text; v_who text;
begin
  -- phone is digits-only here (guard_invite_rate runs first: "invites_rate" < "invites_zknown")
  select id into v_user from public.users where phone = new.phone and display_name is not null and deleted_at is null limit 1;
  if v_user is null or v_user = new.invited_by then return new; end if;
  select title into v_title from public.trips where id = new.trip_id;
  v_who := public.first_name(new.invited_by);
  perform public.notify(v_user, 'trip.invited', coalesce(v_title, 'Zebrasplit'),
    v_who || ' invited you to this Dazzle. Tap to accept.',
    jsonb_build_object('token', new.token, 'url', 'zebrasplit://join/' || new.token),
    new.trip_id, 'invite:' || new.id::text);
  return new;
end $$;

-- no more joining by number at sign-in
drop function if exists public.accept_invites_for_me(public.joined_via);

-- accepting one invite, as the number it was sent to; an invite already accepted by
-- this same member just answers the trip
create or replace function public.accept_invite_token(p_token text, p_via public.joined_via default 'app')
returns uuid language plpgsql security definer set search_path = public, private as $$
declare r record; v_phone text;
begin
  select * into r from public.invites where token = p_token;
  if r.id is null then raise exception 'invite not found' using errcode = 'P0002'; end if;
  v_phone := private.confirmed_phone(auth.uid());
  if v_phone is null or v_phone is distinct from r.phone then
    raise exception 'this invite was sent to a different number' using errcode = '42501';
  end if;
  if r.status = 'accepted' and exists (select 1 from public.trip_members where trip_id = r.trip_id and user_id = auth.uid() and removed_at is null) then
    return r.trip_id;
  end if;
  if r.status <> 'pending' or r.expires_at <= now() then raise exception 'invite expired' using errcode = 'P0002'; end if;
  insert into public.trip_members (trip_id, user_id, role, joined_via) values (r.trip_id, auth.uid(), 'member', p_via)
  on conflict (trip_id, user_id) do update set removed_at = null;
  update public.invites set status = 'accepted' where id = r.id;
  return r.trip_id;
end $$;

-- the pending invites for my confirmed number, newest first
create or replace function public.my_invites()
returns table (id uuid, token text, trip_id uuid, title text, start_date date, end_date date, inviter text, member_count int, created_at timestamptz, expires_at timestamptz)
language sql security definer stable set search_path = public, private as $$
  select i.id, i.token, i.trip_id, t.title, t.start_date, t.end_date,
         coalesce(public.first_name(i.invited_by), 'A friend'),
         (select count(*)::int from public.trip_members m where m.trip_id = t.id and m.removed_at is null),
         i.created_at, i.expires_at
    from public.invites i
    join public.trips t on t.id = i.trip_id
   where i.status = 'pending' and i.expires_at > now() and t.status = 'open'
     and i.phone = private.confirmed_phone(auth.uid())
     and not exists (select 1 from public.trip_members m where m.trip_id = t.id and m.user_id = auth.uid() and m.removed_at is null)
   order by i.created_at desc;
$$;
revoke all on function public.my_invites() from public, anon;
grant execute on function public.my_invites() to authenticated;

create or replace function public.decline_invite(p_token text)
returns void language plpgsql security definer set search_path = public, private as $$
declare v_phone text;
begin
  v_phone := private.confirmed_phone(auth.uid());
  if v_phone is null then raise exception 'confirm your phone number first' using errcode = '42501'; end if;
  update public.invites set status = 'declined' where token = p_token and phone = v_phone and status = 'pending';
end $$;
revoke all on function public.decline_invite(text) from public, anon;
grant execute on function public.decline_invite(text) to authenticated;

-- the public preview now tells an accepted or declined invite apart from a live one
create or replace function public.get_invite_preview(code text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_inv public.invites%rowtype;
  v_trip public.trips%rowtype;
  v_state text;
  v_members jsonb;
  v_member_count int;
  v_done_count int;
  v_expense_count int;
  v_inviter text;
begin
  if code is null or length(code) > 128 then
    return jsonb_build_object('state', 'invalid');
  end if;

  select * into v_inv from public.invites i where i.token = code;
  if not found then return jsonb_build_object('state', 'invalid'); end if;

  select * into v_trip from public.trips t where t.id = v_inv.trip_id;
  if not found then return jsonb_build_object('state', 'invalid'); end if;

  if v_trip.status = 'settled' or v_trip.settled_at is not null then
    v_state := 'settled';
  elsif v_inv.status = 'accepted' then
    v_state := 'accepted';
  elsif v_inv.status in ('expired', 'revoked', 'declined') or v_inv.expires_at < now() then
    v_state := 'expired';
  else
    v_state := 'valid';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('name', m.name, 'done', m.done) order by m.joined_at), '[]'::jsonb),
         count(*)::int,
         count(*) filter (where m.done)::int
    into v_members, v_member_count, v_done_count
    from (
      select coalesce(nullif(trim(u.first_name), ''), nullif(split_part(trim(coalesce(u.display_name, '')), ' ', 1), ''), 'Friend') as name,
             tm.done_at is not null as done,
             tm.joined_at
        from public.trip_members tm
        left join public.users u on u.id = tm.user_id
       where tm.trip_id = v_trip.id and tm.removed_at is null
    ) m;

  select count(*)::int into v_expense_count
    from public.expenses e
   where e.trip_id = v_trip.id and e.deleted_at is null;

  select coalesce(nullif(trim(u.first_name), ''), nullif(split_part(trim(coalesce(u.display_name, '')), ' ', 1), ''), 'A friend')
    into v_inviter
    from public.users u where u.id = v_inv.invited_by;

  return jsonb_build_object(
    'state', v_state,
    'trip', jsonb_build_object('name', v_trip.title, 'start_date', v_trip.start_date, 'end_date', v_trip.end_date),
    'inviter', coalesce(v_inviter, 'A friend'),
    'members', v_members,
    'member_count', v_member_count,
    'done_count', v_done_count,
    'expense_count', v_expense_count
  );
end;
$$;

