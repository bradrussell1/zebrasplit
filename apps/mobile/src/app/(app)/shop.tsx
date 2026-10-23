import { COSMETICS, OUTFIT_SLOTS, PACKS, SLOT_LABELS, cosmeticById, outfitDescription, type CosmeticDef, type OutfitSlot, type PackDef } from "@bunktab/core";
import { color, layout, palette, radius, shadow, size, space } from "@bunktab/theme";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, HeroCard, InsetPanel, Press, ScreenBackground, ScreenSkeleton, SegmentedControl, TopBar, Zebra, ZText, haptic, useToast } from "@/ui";
import { buyProduct, purchasesEnabled, restorePurchases, storePrices, waitForGrant } from "@/lib/purchases";
import { useWardrobe } from "@/lib/wardrobe";

/**
 * The Shop (design/reference/stories/Shop.dc.html): the whole catalogue in one grid,
 * with the packs above it, over a preview zebra wearing your current look.
 *
 * Tapping a tile tries it on; the button under the stage buys it. Nothing here grants
 * anything — the store sells, RevenueCat verifies, the webhook writes user_cosmetics —
 * so the Shop's job is to preview, to price, and to wait for the grant before it says
 * the thing is yours. In a build with no RevenueCat key, buyProduct says so and the
 * try-on still works on all 33, which is most of what a storefront is for.
 *
 * The Gift tab from the board is deliberately absent rather than disabled: gifting is
 * a purchase, so there is nothing behind it yet and a dead tab is worse than none. It
 * grants nothing either: no item is earned by gifting, so none is out of reach at launch.
 */
/** One spelling, so the tile's emphasis test cannot drift from what the tag says. */
const OWNED = "In your closet";

export default function ShopScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { owned, outfit, loading, reload } = useWardrobe();
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [pack, setPack] = useState<string | null>(null);
  const [slot, setSlot] = useState<OutfitSlot>("head");
  const [prices, setPrices] = useState<Record<string, string>>({});

  // What the store will actually charge, in the buyer's own currency. We sell in 175
  // countries; the catalogue's "0.99" is a US number, so quoting it to someone in Tokyo
  // is quoting a price they will never see. The catalogue is the fallback for the moment
  // before the store answers, and for a build with no RevenueCat key.
  useEffect(() => {
    let alive = true;
    const ids = [
      ...PACKS.map((p) => packProduct(p.id)),
      ...COSMETICS.filter((c) => c.status === "paid").map((c) => cosmeticProduct(c.id)),
    ];
    // the SDK may still be configuring when the Shop opens, and an empty answer is
    // indistinguishable from a slow store, so ask again a couple of times before
    // settling for the catalogue's dollars
    void (async () => {
      for (let i = 0; i < 3; i++) {
        const got = await storePrices(ids);
        if (!alive) return;
        if (Object.keys(got).length > 0) { setPrices(got); return; }
        await new Promise((r) => setTimeout(r, 600 + i * 600));
      }
    })();
    return () => { alive = false; };
  }, []);

  if (loading) {
    return <View style={styles.screen}><ScreenBackground /><TopBar onBack={() => router.back()} /><ScreenSkeleton rows={3} /></View>;
  }

  // the stage wears your look, with whatever is being previewed dropped over it
  const item = cosmeticById(preview);
  const packDef = PACKS.find((p) => p.id === pack) ?? null;
  const packItems = (packDef?.items ?? []).map((id) => cosmeticById(id)).filter((c): c is CosmeticDef => !!c);
  const staged = { ...outfit };
  for (const c of packItems) staged[c.slot] = c.id;
  if (item) staged[item.slot] = item.id;

  /** The store's price string, or the catalogue's dollars until the store answers. */
  function priceOf(productId: string, fallback: string | null): string {
    return prices[productId] ?? `$${fallback}`;
  }

  /**
   * Being in a pack is not a reason to hide a price. Every cap and every jersey can
   * be bought on its own for $0.99; the pack is the discount for wanting all four,
   * and a shelf of "Pack" tags hid the cheaper way in. Only a true pack exclusive —
   * status "pack", with no product of its own — has no price to show.
   */
  function tagFor(c: CosmeticDef): string {
    if (owned.has(c.id)) return OWNED;
    if (c.status === "free") return "Free";
    if (c.status === "earned") return "Earn it";
    if (c.status === "pack") return "Pack";
    return priceOf(cosmeticProduct(c.id), c.price);
  }

  /** What the task reads as on a Redeem button, in the second person. */
  function taskFor(rule: string | null): string {
    if (rule === "trips_5") return "settle 5 trips";
    if (rule === "first_trip") return "settle your first trip";
    return "keep using Zebrasplit";
  }

  /**
   * One button, one state. Owned and Redeem are both dead buttons on purpose: owning a
   * thing twice is not a purchase, and an earned item is granted the moment the task is
   * done rather than claimed, so Redeem can only ever be the sign that says what to go
   * and do. A free item reads "Owned" like any other: people find out it was free by
   * already having it, which is the nicest way to learn it. A pack-only item has no
   * price of its own, so it points at the pack instead.
   */
  function cta() {
    // a build with no RevenueCat key (Android, until Play is open) says so where a Buy
    // button would be, rather than offering one whose only outcome is an error. Owned,
    // Earn it and pack-only still read normally: none of them is a purchase.
    if (packDef) {
      if (!purchasesEnabled) return <Button kind="locked" height={40} label="Not on sale yet" />;
      const product = packProduct(packDef.id);
      return <Button height={40} label={`Buy Now · ${priceOf(product, packDef.price)}`} loading={busy} onPress={() => buy(product, packDef.name, [...packDef.items])} />;
    }
    if (!item) return null;
    // a free item is granted on sign-up, so it reads the same as anything else you have
    if (owned.has(item.id) || item.status === "free") return <Button kind="locked" height={40} label="Owned" />;
    if (item.status === "earned") {
      return <Button kind="locked" height={40} label={`Redeem · ${taskFor(item.earnRule)}`} />;
    }
    if (item.status === "pack") {
      const home = PACKS.find((p) => p.id === item.packs[0]);
      return home
        ? <Button kind="secondary" onWhite height={40} label={`Only in ${home.name}`} onPress={() => { setPreview(null); setPack(home.id); }} />
        : <Button kind="locked" height={40} label="Only in a pack" />;
    }
    if (!purchasesEnabled) return <Button kind="locked" height={40} label="Not on sale yet" />;
    const product = cosmeticProduct(item.id);
    return <Button height={40} label={`Buy Now · ${priceOf(product, item.price)}`} loading={busy} onPress={() => buy(product, item.name, [item.id])} />;
  }

  /**
   * Buy one product. The app does not grant anything: the store sells it, RevenueCat
   * verifies the receipt, the webhook writes user_cosmetics, and only then is it yours.
   * So this waits for the grant to land before saying so, and reloads the wardrobe from
   * the database rather than guessing. A slow webhook is not a failure, just a wait that
   * outlived the button.
   */
  async function buy(productId: string, what: string, grants: string[]) {
    if (busy) return;
    setBusy(true);
    const res = await buyProduct(productId);
    if (!res.ok) {
      setBusy(false);
      if (!res.cancelled) show({ message: res.message, duration: 4000 });
      return;
    }
    const landed = await waitForGrant(grants);
    await reload();
    setBusy(false);
    haptic.light();
    show({
      message: landed ? `${what} is yours. Wear it from your closet.` : `${what} is paid for. It'll appear in a moment.`,
      duration: 4000,
    });
  }

  async function restore() {
    if (busy) return;
    setBusy(true);
    const res = await restorePurchases();
    await reload();
    setBusy(false);
    show({ message: res.ok ? "Anything you've bought is back." : res.cancelled ? "" : res.message, duration: 4000 });
  }

  function tapItem(c: CosmeticDef) {
    setPack(null);
    setPreview(c.id);
    if (!owned.has(c.id) && c.status === "paid") {
      show({
        message: purchasesEnabled
          ? `Trying on the ${c.name.toLowerCase()}. Buy it below to keep it.`
          : `Trying on the ${c.name.toLowerCase()}. Not on sale here yet.`,
        duration: 3500,
      });
    }
  }

  /**
   * What you can act on, first. An unearned item and a pack exclusive are the two
   * tiles a tap cannot buy, so they go to the end of their slot rather than sitting
   * among the prices looking like something priced wrong. Everything else keeps the
   * catalogue's order, and an earned item you already own keeps its place too.
   */
  const shelf = COSMETICS
    .filter((c) => c.slot === slot)
    .map((c, i) => ({ c, i, rank: c.status === "pack" ? 2 : c.status === "earned" && !owned.has(c.id) ? 1 : 0 }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map((x) => x.c);

  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar
        onBack={() => router.back()}
        right={<Button kind="secondary" onWhite height={size.pillSmall} label="My Zebra" onPress={() => router.push("/(app)/zebra")} accessibilityLabel="Go to your zebra" />}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[32] }]} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <ZText variant="title1" accessibilityRole="header">Shop</ZText>
          <ZText variant="body" color={color.textSecondary}>Tap anything to try it on. Your zebra keeps whatever you put on it, in every Dazzle.</ZText>
        </View>

        <HeroCard style={styles.stage}>
          <Zebra
            variant="full"
            size={210}
            striped
            outfit={staged}
            mood="happy"
            animate={{ blink: true, swish: true }}
            accessibilityLabel={`Preview zebra${outfitDescription(staged) ? `, wearing ${outfitDescription(staged)}` : ""}`}
          />
          {item || packDef ? (
            <View style={styles.cta}>
              <ZText variant="headline" numberOfLines={1}>{packDef ? packDef.name : item!.name}</ZText>
              {packDef ? (
                <ZText variant="caption" color={color.textMuted} numberOfLines={2}>
                  {packItems.map((c) => c.name).join(" · ")}
                </ZText>
              ) : null}
              {cta()}
              <Press onPress={() => { setPreview(null); setPack(null); }} scaleTo={0.97} accessibilityRole="button" accessibilityLabel="Clear the preview">
                <ZText variant="caption" color={color.textMuted}>Back to your look</ZText>
              </Press>
            </View>
          ) : null}
        </HeroCard>

        {/* packs: one card each, and every pack undercuts its contents */}
        <View style={styles.section}>
          <ZText variant="overline" color={color.textMuted}>Packs</ZText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.packs}>
            {PACKS.map((p) => (
              <Press
                key={p.id}
                onPress={() => { setPreview(null); setPack(p.id); }}
                scaleTo={0.97}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}, ${priceOf(packProduct(p.id), p.price)}`}
                style={[styles.packCard, pack === p.id ? styles.packOn : null]}
              >
                <Zebra variant="full" size={92} striped mood="happy" outfit={lookFor(p)} decorative />
                <ZText variant="bodyStrong" numberOfLines={1}>{p.name}</ZText>
                <ZText variant="caption" color={color.textMuted}>{priceOf(packProduct(p.id), p.price)}</ZText>
              </Press>
            ))}
          </ScrollView>
        </View>

        {/* the catalogue: one slot at a time, on the same control the closet uses */}
        <View style={styles.section}>
          <SegmentedControl
            options={OUTFIT_SLOTS.map((s) => ({ key: s, label: SLOT_LABELS[s] }))}
            value={slot}
            onChange={(s) => { setPreview(null); setPack(null); setSlot(s); }}
          />
          <View style={styles.grid}>
            {shelf.map((c) => {
              const tag = tagFor(c);
              return (
                <Press
                  key={c.id}
                  onPress={() => tapItem(c)}
                  scaleTo={0.97}
                  accessibilityRole="button"
                  accessibilityLabel={`${c.name}, ${tag}`}
                  style={[styles.tile, preview === c.id ? styles.tileOn : null]}
                >
                  <Zebra variant={c.slot === "body" ? "full" : "bust"} size={c.slot === "body" ? 70 : 66} striped mood="hi" outfit={{ [c.slot]: c.id }} decorative />
                  <ZText variant="micro" numberOfLines={1}>{c.name}</ZText>
                  <ZText variant="micro" color={tag === OWNED ? color.text : color.textMuted}>{tag}</ZText>
                </Press>
              );
            })}
          </View>
        </View>

        {purchasesEnabled ? (
        <View style={styles.restore}>
          <Button
            kind="secondary"
            onWhite
            height={40}
            label="Restore Purchases"
            loading={busy}
            onPress={restore}
            accessibilityLabel="Restore purchases you've already made"
          />
        </View>
        ) : null}

        <InsetPanel style={styles.soon}>
          <ZText variant="caption" color={color.textSecondary}>
            Outfits are the only thing we sell. Splitting, stripes and settling up are free, and always will be.
          </ZText>
        </InsetPanel>
      </ScrollView>
    </View>
  );
}

/** The store product behind a cosmetic or a pack. Derived, never typed, so these
 *  cannot drift from docs/ops/iap-products.md or from what the store was told. */
function cosmeticProduct(id: string) { return `com.zebrasplit.cosmetic.${id}`; }
function packProduct(id: string) { return `com.zebrasplit.pack.${id}`; }

function lookFor(p: PackDef) {
  const look: Record<string, string> = {};
  // a pack can hold four of one slot (every jersey); show the first, not whichever sorted last
  for (const id of p.items) { const c = cosmeticById(id); if (c && !look[c.slot]) look[c.slot] = c.id; }
  return look;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: layout.screenGutter, gap: space[16] },
  head: { paddingHorizontal: space[4], gap: space[4] },
  stage: { alignItems: "center", gap: space[10], backgroundColor: color.surfaceTranslucentStrong },
  cta: { alignSelf: "stretch", alignItems: "center", gap: space[6] },
  section: { gap: space[8] },
  packs: { gap: space[10], paddingVertical: space[2], paddingHorizontal: space[2] },
  packCard: {
    width: 150, alignItems: "center", gap: 2, paddingVertical: space[10], paddingHorizontal: space[8],
    backgroundColor: palette.white, borderRadius: radius.card, ...shadow.card,
    borderWidth: 2, borderColor: "transparent",
  },
  packOn: { borderColor: palette.volt },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space[8] },
  tile: {
    width: "31.5%", alignItems: "center", gap: 2, paddingVertical: space[8],
    backgroundColor: palette.white, borderRadius: radius.tile, ...shadow.hairline,
    borderWidth: 2, borderColor: "transparent",
  },
  tileOn: { borderColor: palette.volt },
  restore: { marginTop: space[8] },
  soon: { paddingVertical: space[10] },
});
