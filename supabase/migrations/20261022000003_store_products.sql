-- ---------------------------------------------------------------------------
-- Store product ids, and the one place a purchase turns into ownership.
--
-- A product id is permanent: neither store ever releases one for reuse. They are
-- derived from the catalogue id by a rule rather than typed in, so the column
-- cannot drift from docs/ops/iap-products.md or from what the app asks StoreKit
-- for. Pack-only, free and earned items have no product because nothing sells
-- them on their own.
--
-- grant_purchase() is the only way a purchase becomes a row in user_cosmetics.
-- It is security definer and takes a product id, not a cosmetic id, so a client
-- cannot name the thing it wants: it can only present something the store sold,
-- and the function decides what that unlocks. It is idempotent, because stores
-- replay receipts on restore, on reinstall and on every webhook retry.
-- ---------------------------------------------------------------------------

alter table public.cosmetics add column if not exists product_id text;
alter table public.cosmetic_packs add column if not exists product_id text;

create unique index if not exists cosmetics_product_id on public.cosmetics (product_id) where product_id is not null;
create unique index if not exists cosmetic_packs_product_id on public.cosmetic_packs (product_id) where product_id is not null;

-- The rule, applied: only an individually purchasable item has one.
update public.cosmetics
   set product_id = case when status = 'paid' then 'com.zebrasplit.cosmetic.' || id end
 where product_id is distinct from (case when status = 'paid' then 'com.zebrasplit.cosmetic.' || id end);

update public.cosmetic_packs
   set product_id = case when active then 'com.zebrasplit.pack.' || id end
 where product_id is distinct from (case when active then 'com.zebrasplit.pack.' || id end);

do $$
declare bad text;
begin
  select string_agg(id, ', ') into bad from public.cosmetics
   where (status = 'paid') <> (product_id is not null);
  if bad is not null then raise exception 'paid items without a product, or a product on something not for sale: %', bad; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Granting
-- ---------------------------------------------------------------------------
create or replace function public.grant_purchase(p_user_id uuid, p_product_id text)
returns int language plpgsql security definer set search_path = public as $$
declare v_ids text[]; v_n int;
begin
  if p_user_id is null or btrim(coalesce(p_product_id, '')) = '' then
    raise exception 'grant_purchase needs a user and a product' using errcode = '22023';
  end if;

  -- a pack grants everything in it; an item grants itself
  select p.item_ids into v_ids from public.cosmetic_packs p where p.product_id = p_product_id;
  if v_ids is null then
    select array[c.id] into v_ids from public.cosmetics c where c.product_id = p_product_id;
  end if;
  -- An unknown product is not an error worth failing a webhook over: it means the
  -- store sold something this deploy does not know about yet, and the retry after the
  -- next deploy should succeed. Say nothing was granted and let the caller log it.
  if v_ids is null then return 0; end if;

  insert into public.user_cosmetics (user_id, cosmetic_id, source)
  select p_user_id, unnest(v_ids), 'purchase'
  on conflict (user_id, cosmetic_id) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.grant_purchase(uuid, text) from public, anon, authenticated;
grant execute on function public.grant_purchase(uuid, text) to service_role;

comment on function public.grant_purchase(uuid, text) is
  'Turns a store product id into user_cosmetics rows. service_role only: the receipt is verified off-platform and the client never calls this. Idempotent, because stores replay receipts.';
