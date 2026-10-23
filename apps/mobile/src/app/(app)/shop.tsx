import { COSMETICS, OUTFIT_SLOTS, PACKS, SLOT_LABELS, cosmeticById, outfitDescription, type CosmeticDef, type OutfitSlot, type PackDef } from "@bunktab/core";
import { color, layout, palette, radius, shadow, space } from "@bunktab/theme";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, HeroCard, InsetPanel, Press, ScreenBackground, ScreenSkeleton, SegmentedControl, TopBar, Zebra, ZText, useToast } from "@/ui";
import { useWardrobe } from "@/lib/wardrobe";

/**
 * The Shop (design/reference/stories/Shop.dc.html): the whole catalogue in one grid,
 * with the packs above it, over a preview zebra wearing your current look.
 *
 * Buying is not open. The store products don't exist until the paid-app agreement,
 * tax and banking are done, so every paid tile here previews and says so rather than
 * offering a button that cannot work. Everything free, and everything earned, works —
 * and the try-on works on all 33, which is most of what a storefront is for.
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
  const { owned, outfit, loading } = useWardrobe();
  const [preview, setPreview] = useState<string | null>(null);
  const [pack, setPack] = useState<string | null>(null);
  const [slot, setSlot] = useState<OutfitSlot>("head");

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

  function tagFor(c: CosmeticDef): string {
    if (owned.has(c.id)) return OWNED;
    if (c.status === "free") return "Free";
    if (c.status === "earned") return "Earn it";
    if (c.packs.length) return "Pack";
    return `$${c.price}`;
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
   * and do. A pack-only item has no price of its own, so it points at the pack instead.
   */
  function cta() {
    if (packDef) {
      return <Button height={40} label={`Buy Now · $${packDef.price}`} onPress={() => buy(packDef.name)} />;
    }
    if (!item) return null;
    if (owned.has(item.id)) return <Button kind="locked" height={40} label="Owned" />;
    if (item.status === "free") return <Button kind="locked" height={40} label="Free · it's already yours" />;
    if (item.status === "earned") {
      return <Button kind="locked" height={40} label={`Redeem · ${taskFor(item.earnRule)}`} />;
    }
    if (item.status === "pack") {
      const home = PACKS.find((p) => p.id === item.packs[0]);
      return home
        ? <Button kind="secondary" onWhite height={40} label={`Only in the ${home.name} · $${home.price}`} onPress={() => { setPreview(null); setPack(home.id); }} />
        : <Button kind="locked" height={40} label="Only in a pack" />;
    }
    return <Button height={40} label={`Buy Now · $${item.price}`} onPress={() => buy(item.name)} />;
  }

  // Until StoreKit is wired the button is honest about why nothing happened; the label
  // is already the real one, so only this body changes when purchases land.
  function buy(what: string) {
    show({ message: `${what} isn't buyable yet — in-app purchases open with the next release.`, duration: 3500 });
  }

  function tapItem(c: CosmeticDef) {
    setPack(null);
    setPreview(c.id);
    if (!owned.has(c.id) && c.status === "paid") {
      show({ message: `Trying on the ${c.name.toLowerCase()}. Buying opens with in-app purchases.`, duration: 3500 });
    }
  }

  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar onBack={() => router.back()} />
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
                accessibilityLabel={`${p.name}, $${p.price}`}
                style={[styles.packCard, pack === p.id ? styles.packOn : null]}
              >
                <Zebra variant="full" size={92} striped mood="happy" outfit={lookFor(p)} decorative />
                <ZText variant="bodyStrong" numberOfLines={1}>{p.name}</ZText>
                <ZText variant="caption" color={color.textMuted}>${p.price}</ZText>
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
            {COSMETICS.filter((c) => c.slot === slot).map((c) => {
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

        <InsetPanel style={styles.soon}>
          <ZText variant="caption" color={color.textSecondary}>
            Buying, packs and gifting open once in-app purchases are set up with Apple. Splitting, stripes and settling up always stay free.
          </ZText>
        </InsetPanel>
      </ScrollView>
    </View>
  );
}

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
  soon: { paddingVertical: space[10] },
});
