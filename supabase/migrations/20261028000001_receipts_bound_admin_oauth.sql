-- Security round 2 (2026-10-28): receipt photos stay inside their trip, AI reads are
-- bounded per receipt, and the admin portal needs a Google sign-in.

-- ---------------------------------------------------------------------------
-- 1. a receipt row can only name a photo under its own trip
--    (receipt-parse downloads the path with the service role)
-- ---------------------------------------------------------------------------
create or replace function public.guard_receipt_path()
returns trigger language plpgsql as $$
begin
  if new.storage_path is null
     or position('..' in new.storage_path) > 0
     or new.storage_path !~ ('^' || new.trip_id::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'receipt photo must live under its trip' using errcode = '22023';
  end if;
  return new;
end $$;
drop trigger if exists receipts_path on public.receipts;
create trigger receipts_path before insert or update of storage_path, trip_id on public.receipts
  for each row execute function public.guard_receipt_path();

-- ---------------------------------------------------------------------------
-- 2. three reads per receipt, then it's manual entry
--    (receipt-parse enforces the same cap, whoever calls it)
-- ---------------------------------------------------------------------------
create or replace function public.requeue_receipt(p_receipt uuid)
returns void language plpgsql security definer set search_path = public, private as $$
declare v_trip uuid; v_attempts int;
begin
  select trip_id, attempts into v_trip, v_attempts from public.receipts where id = p_receipt;
  if v_trip is null then raise exception 'receipt not found' using errcode = 'P0002'; end if;
  if not public.is_trip_member(v_trip) then raise exception 'not a member of this trip' using errcode = '42501'; end if;
  if coalesce(v_attempts, 0) >= 3 then
    raise exception 'this receipt has been read 3 times; add the expense by hand' using errcode = '54000';
  end if;
  update public.receipts set status = 'queued', error = null where id = p_receipt;
  perform private.call_function('receipt-parse', jsonb_build_object('receipt_id', p_receipt));
end $$;

-- ---------------------------------------------------------------------------
-- 3. admin = on the admin list AND signed in through an OAuth provider
--    (the Google account's 2-step verification is the second factor; a
--    password session, even for an admin, sees an empty portal)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = private, public as $$
  select exists (select 1 from private.admins a where a.user_id = auth.uid())
     and exists (select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr', '[]'::jsonb)) m where m->>'method' = 'oauth');
$$;
comment on function public.is_admin() is
  'True when the caller is in private.admins and the session was opened through an OAuth provider (Google). The admin portal gates every read on this, so the database enforces it rather than the page.';
