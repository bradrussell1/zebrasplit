-- ---------------------------------------------------------------------------
-- The wardrobe, repriced: three packs, a Viking helmet, and gifting out of the
-- earn rules.
--
-- Why: every pack cost more than its contents. Four jersey packs sold two $0.99
-- items for $2.99, and the Shop shows both prices on the same screen, so the
-- bundle read as a penalty. They collapse into one Jersey pack and one Hat pack
-- of four colours each - $3.96 of items for $2.99 - and the Bachelorette pack
-- keeps its price because the tiara is only available inside it.
--
-- Gifting no longer grants anything. It ships after launch, and an item nobody
-- can reach is worse than an item that is simply for sale, so the Viking helmet
-- arrives as an ordinary $0.99 item rather than a reward for a feature that does
-- not exist yet.
--
-- Catalogue config only. No user_cosmetics row is touched, so nothing anyone
-- owns is taken away.
-- ---------------------------------------------------------------------------

-- 1. The Viking helmet: a normal paid head item.
insert into public.cosmetics (id, slot, name, layer, draw_order, clipped, hides_head_slot, status, price_usd, earn_rule)
values ('viking', 'head', 'Viking helmet', 'head', 6, false, false, 'paid', 0.99, null)
on conflict (id) do update set
  name = excluded.name, slot = excluded.slot, layer = excluded.layer, draw_order = excluded.draw_order,
  status = excluded.status, price_usd = excluded.price_usd, earn_rule = excluded.earn_rule;

-- 2. The tiara stops being earned and becomes the Bachelorette pack's exclusive.
--    earn_rule has to clear in the same statement or the status constraint trips.
update public.cosmetics
   set status = 'pack', price_usd = null, earn_rule = null
 where id = 'tiara';

-- 3. The four per-colour jersey packs retire. Deactivated rather than deleted:
--    they are config, and keeping the rows keeps the history honest.
update public.cosmetic_packs set active = false
 where id in ('jersey_blue', 'jersey_green', 'jersey_purple', 'jersey_red');

-- 4. Three packs, each $2.99. pack_group is null now: there is no family of
--    colour variants left to collapse behind one card.
insert into public.cosmetic_packs (id, name, price_usd, pack_group, item_ids) values
  ('bachelorette', 'Bachelorette pack', 2.99, null, array['sash', 'skirt', 'tiara']),
  ('jersey', 'Jersey pack', 2.99, null, array['jersey_blue', 'jersey_green', 'jersey_purple', 'jersey_red']),
  ('hat', 'Hat pack', 2.99, null, array['cap_blue', 'cap_green', 'cap_purple', 'cap_red'])
on conflict (id) do update set
  name = excluded.name, price_usd = excluded.price_usd,
  pack_group = excluded.pack_group, item_ids = excluded.item_ids, active = true;

-- 5. Same guard the original pack migration used: every listed item must exist.
do $$
declare bad text;
begin
  select string_agg(distinct i, ', ') into bad
    from public.cosmetic_packs p, unnest(p.item_ids) as i
   where p.active and not exists (select 1 from public.cosmetics c where c.id = i);
  if bad is not null then raise exception 'pack lists unknown cosmetics: %', bad; end if;
end $$;

-- 6. A pack-only item must not be reachable any other way, and nothing may be
--    priced unless it is actually for sale on its own.
do $$
declare bad text;
begin
  select string_agg(id, ', ') into bad from public.cosmetics
   where (status = 'pack' and (price_usd is not null or earn_rule is not null))
      or (status = 'paid' and price_usd is null);
  if bad is not null then raise exception 'cosmetics with a status that disagrees with their price: %', bad; end if;
end $$;
