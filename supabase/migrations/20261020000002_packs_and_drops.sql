-- ---------------------------------------------------------------------------
-- Packs and drops.
--
-- Both are storefront furniture, so neither grants anything on its own: a pack is a
-- name and a list of item ids, and buying one is still a purchase that Phase 3's
-- store path will verify server-side before writing user_cosmetics.
--
-- Drops ship switched OFF (A17): the table and the banner exist, and with no active
-- row the banner never renders and the Shop icon carries no dot. There is deliberately
-- no drop content at launch.
-- ---------------------------------------------------------------------------

create table if not exists public.cosmetic_packs (
  id text primary key,
  name text not null,
  price_usd numeric(5,2) not null,
  -- packs that are one card with a colour picker share a group (the four Jersey packs)
  pack_group text,
  item_ids text[] not null,
  active boolean not null default true,
  constraint cosmetic_packs_has_items check (array_length(item_ids, 1) > 0)
);

insert into public.cosmetic_packs (id, name, price_usd, pack_group, item_ids) values
  ('bachelorette', 'Bachelorette pack', 2.99, null, array['sash', 'skirt', 'tiara']),
  ('jersey_blue', 'Jersey pack: Blue', 2.99, 'jersey', array['jersey_blue', 'cap_blue']),
  ('jersey_green', 'Jersey pack: Green', 2.99, 'jersey', array['jersey_green', 'cap_green']),
  ('jersey_purple', 'Jersey pack: Purple', 2.99, 'jersey', array['jersey_purple', 'cap_purple']),
  ('jersey_red', 'Jersey pack: Red', 2.99, 'jersey', array['jersey_red', 'cap_red'])
on conflict (id) do update set
  name = excluded.name, price_usd = excluded.price_usd,
  pack_group = excluded.pack_group, item_ids = excluded.item_ids;

-- every pack's items have to be real, checked here rather than trusted
do $$
declare bad text;
begin
  select string_agg(i, ', ') into bad
    from public.cosmetic_packs p, unnest(p.item_ids) as i
   where not exists (select 1 from public.cosmetics c where c.id = i);
  if bad is not null then raise exception 'pack lists unknown cosmetics: %', bad; end if;
end $$;

alter table public.cosmetic_packs enable row level security;
drop policy if exists cosmetic_packs_read on public.cosmetic_packs;
create policy cosmetic_packs_read on public.cosmetic_packs for select to authenticated using (active);

-- ---------------------------------------------------------------------------
-- Drops: a timed window pointing at items that already exist.
-- ---------------------------------------------------------------------------
create table if not exists public.drops (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  item_ids text[] not null default '{}',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint drops_window check (ends_at > starts_at)
);
create index if not exists drops_window_idx on public.drops (starts_at, ends_at);

alter table public.drops enable row level security;
drop policy if exists drops_read on public.drops;
create policy drops_read on public.drops for select to authenticated
  using (now() >= starts_at and now() < ends_at);

-- which drops this person has already dismissed, so the banner stays dismissed
create table if not exists public.drop_seen (
  user_id uuid not null references public.users (id) on delete cascade,
  drop_id uuid not null references public.drops (id) on delete cascade,
  seen_at timestamptz not null default now(),
  primary key (user_id, drop_id)
);
alter table public.drop_seen enable row level security;
drop policy if exists drop_seen_own on public.drop_seen;
create policy drop_seen_own on public.drop_seen for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

/**
 * The drop to show, or nothing. Returns at most one row: the newest live drop this
 * person hasn't dismissed. With no rows in `drops` — which is launch — this always
 * returns nothing, the banner never renders and the Shop icon has no dot.
 */
create or replace function public.active_drop()
returns table (id uuid, title text, subtitle text, item_ids text[], ends_at timestamptz)
language sql stable security definer set search_path = public as $$
  select d.id, d.title, d.subtitle, d.item_ids, d.ends_at
    from public.drops d
   where now() >= d.starts_at and now() < d.ends_at
     and not exists (select 1 from public.drop_seen s where s.drop_id = d.id and s.user_id = auth.uid())
   order by d.starts_at desc
   limit 1;
$$;
revoke all on function public.active_drop() from public, anon;
grant execute on function public.active_drop() to authenticated;
