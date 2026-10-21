import { COSMETICS, OUTFIT_SLOTS, PACKS, SLOT_LABELS, cosmeticById, outfitDescription, type CosmeticDef, type PackDef } from "@bunktab/core";
import { color, layout, outfit as outfitArt, palette, radius, shadow, space, type TeamColor } from "@bunktab/theme";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, HeroCard, InsetPanel, Press, ScreenBackground, ScreenSkeleton, TopBar, Zebra, ZText, useToast } from "@/ui";
import { useWardrobe } from "@/lib/wardrobe";

/**
 * The Shop (design/reference/stories/Shop.dc.html): the whole catalogue in one grid,
 * with the packs above it, over a preview zebra wearing your current look.
 *
 * Buying is not open. The store products don't exist until the paid-app agreement,
 * tax and banking are done, so every paid tile here previews and says so rather than
 * offering a button that cannot work. Everything free, and everything earned, works —
 * and the try-on works on all 32, which is most of what a storefront is for.
 *
 * The Gift tab from the board is deliberately absent rather than disabled: gifting is
 * a purchase, so there is nothing behind it yet and a dead tab is worse than none.
 */
export default function ShopScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { owned, outfit, loading } = useWardrobe();
  const [preview, setPreview] = useState<string | null>(null);
  const [pack, setPack] = useState<string | null>(null);

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
    if (owned.has(c.id)) return "In your closet";
    if (c.status === "free") return "Free";
    if (c.status === "earned") return "Earn it";
    if (c.packs.length) return "Pack";
    return `$${c.price}`;
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
              {!packDef && item && owned.has(item.id) ? (
                // the Shop is a storefront, not a wardrobe: wearing happens in Your zebra
                <Button kind="secondary" onWhite height={40} label="In your closet · wear it there" onPress={() => router.push("/(app)/zebra")} />
              ) : !packDef && item && item.status === "earned" ? (
                <Button kind="locked" height={40} label={`Earn it: ${item.earnRule === "trips_5" ? "5 trips" : item.earnRule === "first_trip" ? "first trip" : "send a gift"}`} />
              ) : (
                <Button kind="locked" height={40} label={`${packDef ? `$${packDef.price}` : `$${item!.price}`} · opens with purchases`} />
              )}
              <Press onPress={() => { setPreview(null); setPack(null); }} scaleTo={0.97} accessibilityRole="button" accessibilityLabel="Clear the preview">
                <ZText variant="caption" color={color.textMuted}>Back to your look</ZText>
              </Press>
            </View>
          ) : null}
        </HeroCard>

        {/* packs: the four jersey colours are one card with a colour picker */}
        <View style={styles.section}>
          <ZText variant="overline" color={color.textMuted}>Packs</ZText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.packs}>
            {groupedPacks().map((group) => (
              <Press
                key={group.key}
                onPress={() => { setPreview(null); setPack(group.packs[0]!.id); }}
                scaleTo={0.97}
                accessibilityRole="button"
                accessibilityLabel={`${group.label}, $${group.packs[0]!.price}`}
                style={[styles.packCard, pack && group.packs.some((p) => p.id === pack) ? styles.packOn : null]}
              >
                <Zebra variant="full" size={92} striped mood="happy" outfit={lookFor(group.packs[0]!)} decorative />
                <ZText variant="bodyStrong" numberOfLines={1}>{group.label}</ZText>
                <ZText variant="caption" color={color.textMuted}>${group.packs[0]!.price}</ZText>
                {group.packs.length > 1 ? (
                  <View style={styles.swatches}>
                    {group.packs.map((p) => (
                      <Press
                        key={p.id}
                        onPress={() => { setPreview(null); setPack(p.id); }}
                        scaleTo={0.97}
                        accessibilityRole="button"
                        accessibilityLabel={p.name}
                        style={[styles.swatch, { backgroundColor: swatchColor(p) }, pack === p.id ? styles.swatchOn : null]}
                      />
                    ))}
                  </View>
                ) : null}
              </Press>
            ))}
          </ScrollView>
        </View>

        {/* the catalogue, a section per slot */}
        {OUTFIT_SLOTS.map((s) => {
          const items = COSMETICS.filter((c) => c.slot === s);
          return (
            <View key={s} style={styles.section}>
              <ZText variant="overline" color={color.textMuted}>{SLOT_LABELS[s]} · {items.length}</ZText>
              <View style={styles.grid}>
                {items.map((c) => {
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
                      <ZText variant="micro" color={tag === "Owned" ? color.text : color.textMuted}>{tag}</ZText>
                    </Press>
                  );
                })}
              </View>
            </View>
          );
        })}

        <InsetPanel style={styles.soon}>
          <ZText variant="caption" color={color.textSecondary}>
            Buying, packs and gifting open once in-app purchases are set up with Apple. Splitting, stripes and settling up always stay free.
          </ZText>
        </InsetPanel>
      </ScrollView>
    </View>
  );
}

/** The four Jersey packs are one card; everything else is its own. */
function groupedPacks(): { key: string; label: string; packs: PackDef[] }[] {
  const out: { key: string; label: string; packs: PackDef[] }[] = [];
  for (const p of PACKS) {
    const key = p.group ?? p.id;
    const found = out.find((g) => g.key === key);
    if (found) found.packs.push(p);
    else out.push({ key, label: p.group ? `${p.group[0]!.toUpperCase()}${p.group.slice(1)} pack` : p.name, packs: [p] });
  }
  return out;
}

function lookFor(p: PackDef) {
  const look: Record<string, string> = {};
  for (const id of p.items) { const c = cosmeticById(id); if (c) look[c.slot] = c.id; }
  return look;
}

/** The swatch is the team colour the pack's jersey is actually drawn in. */
function swatchColor(p: PackDef): string {
  const name = p.id.replace(/^jersey_/, "") as TeamColor;
  return outfitArt.team[name] ?? palette.pink;
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
  swatches: { flexDirection: "row", gap: 6, paddingTop: 4 },
  swatch: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: "transparent" },
  swatchOn: { borderColor: palette.ink },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space[8] },
  tile: {
    width: "31.5%", alignItems: "center", gap: 2, paddingVertical: space[8],
    backgroundColor: palette.white, borderRadius: radius.tile, ...shadow.hairline,
    borderWidth: 2, borderColor: "transparent",
  },
  tileOn: { borderColor: palette.volt },
  soon: { paddingVertical: space[10] },
});
