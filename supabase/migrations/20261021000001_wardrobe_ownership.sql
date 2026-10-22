-- ---------------------------------------------------------------------------
-- Three holes in the wardrobe, found by review before the store exists.
-- ---------------------------------------------------------------------------

-- 1. user_outfit could be written directly, which skipped the ownership check.
--
-- The policy said `for all using (user_id = auth.uid())`, so a client could upsert
-- its own row naming any cosmetic in the catalogue. set_outfit checks that you own
-- the item; a direct write didn't, so every paid item was wearable for free — the
-- whole gate Phase 3's store is being built on. It also skipped the outfit_history
-- write, so those looks would never reach the Fashionista award or Wrapped.
--
-- Dropped, with no write policy at all, exactly like user_cosmetics. set_outfit is
-- security definer so it still writes; nothing else can.
drop policy if exists user_outfit_write on public.user_outfit;

-- 2. outfit_history was readable across trips you don't share.
--
-- `shares_trip_with(user_id)` ignores trip_id, so sharing one dazzle with someone
-- exposed every row they have, including the ids of dazzles you aren't on. The
-- migration that added it says "members of a shared dazzle can read each other's
-- outfit, and nothing else", so scope it to the trip it belongs to.
drop policy if exists outfit_history_read on public.outfit_history;
create policy outfit_history_read on public.outfit_history for select
  using (user_id = auth.uid() or public.is_trip_member(trip_id));

-- 3. Nobody was ever granted the free items.
--
-- grant_free_cosmetics had no caller anywhere, and the backfill at the end of the
-- original migration was one-shot. Every account created since owned nothing: the
-- six free items rendered as "$null" in the wardrobe and could not be worn, while
-- the copy promised "everything free works".
--
-- A trigger on public.users covers every path that creates an account rather than
-- relying on one signup route remembering to ask.
create or replace function private.grant_free_cosmetics_on_signup()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin
  insert into public.user_cosmetics (user_id, cosmetic_id, source)
  select new.id, c.id, 'free' from public.cosmetics c where c.status = 'free' and c.active
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists users_grant_free_cosmetics on public.users;
create trigger users_grant_free_cosmetics
  after insert on public.users
  for each row execute function private.grant_free_cosmetics_on_signup();

-- ...and catch up anyone created between the first migration and this one.
insert into public.user_cosmetics (user_id, cosmetic_id, source)
select u.id, c.id, 'free'
  from public.users u cross join public.cosmetics c
 where c.status = 'free' and c.active and u.deleted_at is null
on conflict do nothing;

-- 4. The guard in grant_free_cosmetics leant on a NULL comparison.
--
-- `p_user <> auth.uid()` is NULL when auth.uid() is null, so `NULL and false` is
-- NULL and the `if` never fired. Only the revoke from anon kept it unreachable.
create or replace function public.grant_free_cosmetics(p_user uuid default auth.uid())
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_user is null or (p_user is distinct from auth.uid() and not public.is_admin()) then
    raise exception 'not yours' using errcode = '42501';
  end if;
  insert into public.user_cosmetics (user_id, cosmetic_id, source)
  select p_user, c.id, 'free' from public.cosmetics c where c.status = 'free' and c.active
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.grant_free_cosmetics(uuid) from public, anon;
grant execute on function public.grant_free_cosmetics(uuid) to authenticated;
