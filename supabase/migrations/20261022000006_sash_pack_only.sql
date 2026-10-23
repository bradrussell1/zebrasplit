-- ---------------------------------------------------------------------------
-- The bride sash sells only inside the Bachelorette pack.
--
-- A sash on its own is a costume with nowhere to go; the pack is the occasion,
-- and the sash is what makes someone want the pack. The skirt stays buyable on
-- its own at $0.99 — it reads as an outfit rather than a role — so the pack now
-- holds one exclusive (the tiara), one upsell (the skirt) and the sash.
--
-- product_id has to clear in the same statement as status: the check constraint
-- from 20261022000003 says a product id exists exactly when status is 'paid'.
-- com.zebrasplit.cosmetic.sash is retired, not reused. Apple never releases a
-- product id, so it stays burned whether or not we delete the draft in ASC.
-- ---------------------------------------------------------------------------
update public.cosmetics
   set status = 'pack', price_usd = null, earn_rule = null, product_id = null
 where id = 'sash';
