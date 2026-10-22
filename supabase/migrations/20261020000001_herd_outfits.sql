-- ---------------------------------------------------------------------------
-- The herd's wardrobe: what exists, who owns what, and what each person wears.
--
-- Phase 2 needs this even though purchases are Phase 3, because without it every
-- zebra in every herd is bare and there is nothing to look at. So this migration
-- lands the catalogue, ownership and the equipped outfit; packs, gifts, drops and
-- the store receipts come later, on top of these tables.
--
-- Visibility rule (prompt, Phase 3 "Data"): members of a shared dazzle can read each
-- other's outfit, and nothing else about their wardrobe. What you own is yours alone.
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.outfit_slot as enum ('head', 'faceneck', 'body');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cosmetic_status as enum ('free', 'earned', 'paid');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.cosmetic_source as enum ('free', 'purchase', 'earned', 'gift');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 1. The catalogue
--
-- Generated from design/zebra/outfits/manifest.json, which is also what generates
-- the art and packages/core's copy. Prices live here rather than in code so a tier
-- can move without a release — but nothing here grants anything, and what a person
-- is actually charged comes from the store.
--
-- `slot` is which of the three a person equips it into; `layer` is where it draws,
-- and the two are deliberately independent: the bride sash is a face-and-neck item
-- drawn across the torso, and the scarf is a body item drawn at the throat.
-- ---------------------------------------------------------------------------
create table if not exists public.cosmetics (
  id text primary key,
  slot public.outfit_slot not null,
  name text not null,
  layer text not null,
  draw_order int not null,
  clipped boolean not null default false,
  hides_head_slot boolean not null default false,
  status public.cosmetic_status not null,
  price_usd numeric(5,2),
  earn_rule text,
  active boolean not null default true,
  released_at timestamptz,
  retired_at timestamptz,
  constraint cosmetics_price_matches_status check (
    (status = 'paid' and price_usd is not null) or (status <> 'paid' and price_usd is null)
  ),
  constraint cosmetics_earn_rule_matches_status check (
    (status = 'earned') = (earn_rule is not null)
  )
);

insert into public.cosmetics (id, slot, name, layer, draw_order, clipped, hides_head_slot, status, price_usd, earn_rule) values
  ('beanie', 'head', 'Pink beanie', 'head', 6, false, false, 'free', null, null),
  ('cap', 'head', 'Yellow cap', 'head', 6, false, false, 'earned', null, 'first_trip'),
  ('flatbrim', 'head', 'Flat brim hat', 'head', 6, false, false, 'paid', 0.99, null),
  ('joker', 'head', 'Joker hat', 'head', 6, false, false, 'free', null, null),
  ('mohawk', 'head', 'Mohawk', 'head', 6, false, false, 'paid', 0.99, null),
  ('tiara', 'head', 'Tiara', 'head', 6, false, false, 'earned', null, 'first_gift'),
  ('crown', 'head', 'Crown', 'head', 6, false, false, 'paid', 0.99, null),
  ('party', 'head', 'Party hat', 'head', 6, false, false, 'earned', null, 'trips_5'),
  ('cap_blue', 'head', 'Blue cap', 'head', 6, false, false, 'paid', 0.99, null),
  ('cap_green', 'head', 'Green cap', 'head', 6, false, false, 'paid', 0.99, null),
  ('cap_purple', 'head', 'Purple cap', 'head', 6, false, false, 'paid', 0.99, null),
  ('cap_red', 'head', 'Red cap', 'head', 6, false, false, 'paid', 0.99, null),
  ('specs', 'faceneck', 'Spectacles', 'face', 5, false, false, 'paid', 0.99, null),
  ('glasses', 'faceneck', 'Glasses', 'face', 5, false, false, 'free', null, null),
  ('shades', 'faceneck', 'Sunglasses', 'face', 5, false, false, 'free', null, null),
  ('stars', 'faceneck', 'Star shades', 'face', 5, false, false, 'paid', 0.99, null),
  ('goggles', 'faceneck', 'Ski goggles', 'face', 5, false, false, 'paid', 0.99, null),
  ('chain', 'faceneck', 'Gold chain', 'throat', 4, false, false, 'paid', 0.99, null),
  ('sash', 'faceneck', 'Bride sash', 'torso', 1, true, false, 'paid', 0.99, null),
  ('lei', 'faceneck', 'Lei', 'throat', 4, false, false, 'paid', 0.99, null),
  ('hearts', 'faceneck', 'Heart shades', 'face', 5, false, false, 'paid', 0.99, null),
  ('tee', 'body', 'Zebra tee', 'torso', 1, true, false, 'free', null, null),
  ('hoodie', 'body', 'Hoodie', 'torso', 1, true, true, 'paid', 0.99, null),
  ('scarf', 'body', 'Scarf', 'throat', 4, false, false, 'free', null, null),
  ('jersey', 'body', 'Jersey', 'torso', 1, true, false, 'paid', 0.99, null),
  ('suit', 'body', 'Suit and tie', 'torso', 1, true, false, 'paid', 0.99, null),
  ('flannel', 'body', 'Flannel', 'torso', 1, true, false, 'paid', 0.99, null),
  ('skirt', 'body', 'Skirt', 'skirt', 2, false, false, 'paid', 0.99, null),
  ('jersey_blue', 'body', 'Blue jersey', 'torso', 1, true, false, 'paid', 0.99, null),
  ('jersey_green', 'body', 'Green jersey', 'torso', 1, true, false, 'paid', 0.99, null),
  ('jersey_purple', 'body', 'Purple jersey', 'torso', 1, true, false, 'paid', 0.99, null),
  ('jersey_red', 'body', 'Red jersey', 'torso', 1, true, false, 'paid', 0.99, null)
on conflict (id) do update set
  slot = excluded.slot, name = excluded.name, layer = excluded.layer,
  draw_order = excluded.draw_order, clipped = excluded.clipped,
  hides_head_slot = excluded.hides_head_slot, status = excluded.status,
  price_usd = excluded.price_usd, earn_rule = excluded.earn_rule;

alter table public.cosmetics enable row level security;
drop policy if exists cosmetics_read on public.cosmetics;
create policy cosmetics_read on public.cosmetics for select to authenticated using (active);

-- ---------------------------------------------------------------------------
-- 2. What a person owns
--
-- One row per item per person, carrying where it came from. `gift_from` is set
-- only for source 'gift' and is the one place a gift is attributed, so the
-- recipient can say thanks.
-- ---------------------------------------------------------------------------
create table if not exists public.user_cosmetics (
  user_id uuid not null references public.users (id) on delete cascade,
  cosmetic_id text not null references public.cosmetics (id) on delete cascade,
  source public.cosmetic_source not null,
  acquired_at timestamptz not null default now(),
  gift_from uuid references public.users (id) on delete set null,
  primary key (user_id, cosmetic_id),
  constraint user_cosmetics_gift_has_sender check ((source = 'gift') = (gift_from is not null))
);
create index if not exists user_cosmetics_user on public.user_cosmetics (user_id);

alter table public.user_cosmetics enable row level security;
-- what you own is yours alone: a dazzle-mate sees what you WEAR, never your closet
drop policy if exists user_cosmetics_own on public.user_cosmetics;
create policy user_cosmetics_own on public.user_cosmetics for select using (user_id = auth.uid());
-- no insert policy on purpose: ownership is only ever written by a security-definer
-- function, so a client can never grant itself an item

-- ---------------------------------------------------------------------------
-- 3. What a person is wearing
--
-- One row per person, three nullable slots. This is the only wardrobe table a
-- dazzle-mate can read, and only for people they share a dazzle with.
-- ---------------------------------------------------------------------------
create table if not exists public.user_outfit (
  user_id uuid primary key references public.users (id) on delete cascade,
  head text references public.cosmetics (id) on delete set null,
  faceneck text references public.cosmetics (id) on delete set null,
  body text references public.cosmetics (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.user_outfit enable row level security;
drop policy if exists user_outfit_read on public.user_outfit;
create policy user_outfit_read on public.user_outfit for select
  using (user_id = auth.uid() or public.shares_trip_with(user_id));
-- writes go through set_outfit(), which checks ownership and the slot
drop policy if exists user_outfit_write on public.user_outfit;
create policy user_outfit_write on public.user_outfit for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. What a person wore on a trip
--
-- The Fashionista award and Wrapped's most-worn outfit both need looks over time,
-- not the current one. Recorded on every equip while a member of an open trip, and
-- once more when the trip settles.
-- ---------------------------------------------------------------------------
create table if not exists public.outfit_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  head text, faceneck text, body text,
  recorded_at timestamptz not null default now()
);
create index if not exists outfit_history_trip on public.outfit_history (trip_id, user_id, recorded_at desc);

alter table public.outfit_history enable row level security;
drop policy if exists outfit_history_read on public.outfit_history;
create policy outfit_history_read on public.outfit_history for select
  using (user_id = auth.uid() or public.shares_trip_with(user_id));

-- ---------------------------------------------------------------------------
-- 5. Granting and equipping
-- ---------------------------------------------------------------------------

-- Every new account owns the free items. Called from the signup path and safe to
-- re-run; it is also how an account created before this migration catches up.
create or replace function public.grant_free_cosmetics(p_user uuid default auth.uid())
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_user is null or (p_user <> auth.uid() and not public.is_admin()) then
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

/**
 * Equip, or take off with null. Each slot is checked twice: the item has to exist in
 * that slot, and the caller has to own it. A client that asks for an item it has not
 * got is refused rather than quietly ignored, because silently dropping it would look
 * like the tap didn't register.
 *
 * The hoodie's hood rule is NOT applied here. Hiding the head item is a drawing rule,
 * so the hat stays equipped and comes back the moment the hoodie comes off.
 */
create or replace function public.set_outfit(p_head text default null, p_faceneck text default null, p_body text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); s text; v_id text;
begin
  if v_uid is null then raise exception 'sign in first' using errcode = '42501'; end if;

  foreach s in array array['head', 'faceneck', 'body'] loop
    v_id := case s when 'head' then p_head when 'faceneck' then p_faceneck else p_body end;
    if v_id is not null then
      if not exists (select 1 from public.cosmetics c where c.id = v_id and c.slot::text = s and c.active) then
        raise exception '% is not a % item', v_id, s using errcode = '22023';
      end if;
      if not exists (select 1 from public.user_cosmetics u where u.user_id = v_uid and u.cosmetic_id = v_id) then
        raise exception 'you do not own %', v_id using errcode = '42501';
      end if;
    end if;
  end loop;

  insert into public.user_outfit (user_id, head, faceneck, body, updated_at)
  values (v_uid, p_head, p_faceneck, p_body, now())
  on conflict (user_id) do update
    set head = excluded.head, faceneck = excluded.faceneck, body = excluded.body, updated_at = now();

  -- a look only counts as worn on a trip that is still running
  insert into public.outfit_history (user_id, trip_id, head, faceneck, body)
  select v_uid, m.trip_id, p_head, p_faceneck, p_body
    from public.trip_members m join public.trips t on t.id = m.trip_id
   where m.user_id = v_uid and m.removed_at is null and t.status = 'open';
end $$;
revoke all on function public.set_outfit(text, text, text) from public, anon;
grant execute on function public.set_outfit(text, text, text) to authenticated;

-- Backfill: everyone who already has an account owns the free items.
insert into public.user_cosmetics (user_id, cosmetic_id, source)
select u.id, c.id, 'free'
  from public.users u cross join public.cosmetics c
 where c.status = 'free' and c.active and u.deleted_at is null
on conflict do nothing;
