-- ---------------------------------------------------------------------------
-- What was bought, so that what is owned can be worked out again.
--
-- user_cosmetics says you own the blue jersey. It does not say why, and a refund
-- needs to know why: buy the Jersey pack, buy the blue jersey on its own, then
-- refund the pack, and deleting everything the pack contained takes away a jersey
-- that was paid for separately. The ledger is the missing fact. Ownership from
-- purchases is derived from it, so a revoke removes exactly what no remaining
-- purchase still covers, and nothing else.
--
-- Free, earned and gifted items are not in here and are never touched by a refund.
-- ---------------------------------------------------------------------------
create table if not exists public.purchases (
  user_id uuid not null references public.users (id) on delete cascade,
  product_id text not null,
  store text,
  acquired_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

alter table public.purchases enable row level security;
-- You may read what you bought. Nobody writes through the API: the only writer is
-- grant_purchase(), after RevenueCat has verified the receipt with the store.
drop policy if exists purchases_read_own on public.purchases;
create policy purchases_read_own on public.purchases for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Everything a product unlocks: a pack's contents, or the item itself.
-- ---------------------------------------------------------------------------
create or replace function public.product_items(p_product_id text)
returns text[] language sql stable set search_path = public as $$
  select coalesce(
    (select p.item_ids from public.cosmetic_packs p where p.product_id = p_product_id),
    (select array[c.id] from public.cosmetics c where c.product_id = p_product_id)
  );
$$;

create or replace function public.grant_purchase(p_user_id uuid, p_product_id text)
returns int language plpgsql security definer set search_path = public as $$
declare v_ids text[]; v_n int;
begin
  if p_user_id is null or btrim(coalesce(p_product_id, '')) = '' then
    raise exception 'grant_purchase needs a user and a product' using errcode = '22023';
  end if;

  v_ids := public.product_items(p_product_id);
  -- An unknown product is not worth failing a webhook over: the store sold something
  -- this deploy does not know about yet, and RevenueCat's retry after the next deploy
  -- should succeed. Say nothing was granted and let the caller log it.
  if v_ids is null then return 0; end if;

  insert into public.purchases (user_id, product_id)
  values (p_user_id, p_product_id)
  on conflict (user_id, product_id) do nothing;

  insert into public.user_cosmetics (user_id, cosmetic_id, source)
  select p_user_id, unnest(v_ids), 'purchase'
  on conflict (user_id, cosmetic_id) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------------------------------------------------------------------------
-- Refunds
-- ---------------------------------------------------------------------------
create or replace function public.revoke_purchase(p_user_id uuid, p_product_id text)
returns int language plpgsql security definer set search_path = public as $$
declare v_gone text[]; v_n int;
begin
  if p_user_id is null or btrim(coalesce(p_product_id, '')) = '' then
    raise exception 'revoke_purchase needs a user and a product' using errcode = '22023';
  end if;

  delete from public.purchases where user_id = p_user_id and product_id = p_product_id;
  if not found then return 0; end if;

  -- what this product gave, minus anything another purchase still covers
  select coalesce(array_agg(distinct i), '{}') into v_gone
    from unnest(coalesce(public.product_items(p_product_id), '{}')) as i
   where not exists (
     select 1 from public.purchases pu, unnest(coalesce(public.product_items(pu.product_id), '{}')) as still
      where pu.user_id = p_user_id and still = i
   );

  delete from public.user_cosmetics
   where user_id = p_user_id and source = 'purchase' and cosmetic_id = any(v_gone);
  get diagnostics v_n = row_count;

  -- a refunded outfit comes off the zebra rather than staying on it unowned
  update public.user_outfit
     set head = case when head = any(v_gone) then null else head end,
         faceneck = case when faceneck = any(v_gone) then null else faceneck end,
         body = case when body = any(v_gone) then null else body end,
         updated_at = now()
   where user_id = p_user_id
     and (head = any(v_gone) or faceneck = any(v_gone) or body = any(v_gone));

  return v_n;
end $$;

revoke all on function public.grant_purchase(uuid, text) from public, anon, authenticated;
revoke all on function public.revoke_purchase(uuid, text) from public, anon, authenticated;
revoke all on function public.product_items(text) from public, anon;
grant execute on function public.grant_purchase(uuid, text) to service_role;
grant execute on function public.revoke_purchase(uuid, text) to service_role;
grant execute on function public.product_items(text) to authenticated, service_role;

comment on function public.revoke_purchase(uuid, text) is
  'Undoes a refunded purchase: drops the ledger row, removes only the items no remaining purchase covers, and takes them off the zebra. service_role only.';
