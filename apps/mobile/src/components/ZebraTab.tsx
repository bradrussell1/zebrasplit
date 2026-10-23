import {
  COSMETICS, EARN_RULES, SLOT_LABELS, OUTFIT_SLOTS, cosmeticById, hiddenByHood, hoodIsUp,
  outfitDescription, type CosmeticDef, type OutfitSlot, type ZebraMood,
} from "@bunktab/core";
import { color, palette, radius, shadow, size, space } from "@bunktab/theme";
import { useEffect, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, HeroCard, InsetPanel, Press, SegmentedControl, Zebra, ZText, haptic, useToast } from "@/ui";
import { earnProgress, useWardrobe } from "@/lib/wardrobe";

/**
 * The Zebra tab: the stage, the mood preview and the wardrobe.
 *
 * A component rather than a screen, because it is reached two ways — the Zebra tab on
 * Account, and its own route from Customize on the herd page — and both should be the
 * same thing rather than two that drift apart.
 *
 * It returns content only, with no ScrollView of its own: whichever host renders it owns
 * the scrolling, so this never ends up as a scroll view inside a scroll view.
 *
 * Tapping something you own equips it or takes it off; one item per slot, so equipping
 * replaces. Only things you own are here — everything else lives in the Shop, because a
 * wardrobe full of clothes you cannot wear reads as a shop with the prices taken off.
 *
 * Moods here are a preview and are never saved — a zebra's mood in a herd follows the
 * money and the Done gate, not a preference.
 */
/** The Closet board's order. */
const MOODS: ZebraMood[] = ["hi", "happy", "wink", "sleepy", "starry", "love", "worried"];

export function ZebraTab({ loadingSlot }: { loadingSlot?: ReactNode }) {
  const { show } = useToast();
  const { owned, outfit, loading, equip } = useWardrobe();
  const [slot, setSlot] = useState<OutfitSlot>("head");
  const [mood, setMood] = useState<ZebraMood>("happy");
  const [tryOn, setTryOn] = useState<string | null>(null);
  const [settledTrips, setSettledTrips] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void earnProgress().then((p) => setSettledTrips(p.settledTrips)); }, []);

  if (loading) return <>{loadingSlot ?? null}</>;

  // what the stage shows: your outfit, with the item being tried on dropped in
  const previewed = cosmeticById(tryOn);
  const staged = previewed ? { ...outfit, [previewed.slot]: previewed.id } : outfit;
  const hooded = hoodIsUp(staged);
  const underHood = hiddenByHood(staged);

  /**
   * The tag on a tile, which is also what tapping it will do. Every tile here is
   * something you own, so there is no locked or priced state to describe: the grid is
   * filtered to your own items and the Shop carries everything else.
   */
  function tagFor(c: CosmeticDef): { label: string; tone: "wearing" | "own" } {
    if (staged[c.slot] === c.id) return { label: hooded && c.slot === "head" ? "Under the hood" : "Wearing", tone: "wearing" };
    return { label: c.status === "earned" ? "Earned · Wear" : "Wear", tone: "own" };
  }

  async function tap(c: CosmeticDef) {
    if (busy) return;
    const takingOff = outfit[c.slot] === c.id;
    setBusy(true);
    setTryOn(null);
    const err = await equip(c.slot, takingOff ? null : c.id);
    setBusy(false);
    if (err) { show({ message: err }); return; }
    haptic.light();
    show({ message: takingOff ? `${c.name} off.` : `${c.name} on. Your herd will see it.` });
  }

  const wearing = outfitDescription(staged);
  // Your closet is what you own. Everything else belongs in the Shop - a wardrobe
  // full of things you cannot wear reads as a shop with the prices taken off.
  const items = COSMETICS.filter((c) => c.slot === slot && owned.has(c.id));

  return (
    <>
        <View style={styles.head}>
          <ZText variant="title1" accessibilityRole="header">Your zebra</ZText>
          <ZText variant="body" color={color.textSecondary}>
            {wearing ? `Wearing ${wearing}.` : "Nothing on yet. Everyone in your dazzles sees what you wear."}
          </ZText>
        </View>

        {/* the stage */}
        <HeroCard style={styles.stage}>
          <Zebra
            variant="full"
            size={236}
            striped
            outfit={staged}
            mood={mood}
            animate={{ blink: true, swish: true, bob: true }}
            accessibilityLabel={`Your zebra${wearing ? `, wearing ${wearing}` : ""}, ${mood}`}
          />
          {tryOn ? (
            <InsetPanel tone="blush" style={styles.tryPanel}>
              <ZText variant="caption" color={color.youOweText}>Trying on {previewed?.name.toLowerCase()}</ZText>
              <Press onPress={() => setTryOn(null)} scaleTo={0.97} accessibilityRole="button" accessibilityLabel="Stop trying it on">
                <ZText variant="captionStrong" color={color.youOweText}>Take it off</ZText>
              </Press>
            </InsetPanel>
          ) : null}
        </HeroCard>

        {/* mood preview, never saved */}
        <View style={styles.moodRow}>
          <ZText variant="headline">Try a mood on</ZText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moods}>
            {MOODS.map((m) => (
              <Button key={m} label={`${m[0]!.toUpperCase()}${m.slice(1)}`} kind={mood === m ? "ink" : "secondary"} onWhite height={size.pillSmall} onPress={() => setMood(m)} accessibilityLabel={`Try the ${m} mood`} />
            ))}
          </ScrollView>
        </View>

        {/* slot tabs: the shared control, so this row matches every other tab row */}
        <SegmentedControl
          options={OUTFIT_SLOTS.map((s) => ({ key: s, label: SLOT_LABELS[s] }))}
          value={slot}
          onChange={(k) => setSlot(k as OutfitSlot)}
        />
        <ZText variant="caption" color={color.textMuted} style={styles.hint}>
          {slot === "head"
            ? hooded ? `A hoodie puts the hood up, so ${underHood ? underHood.name.toLowerCase() : "a hat"} is hidden while it's on.` : "One hat at a time."
            : slot === "faceneck" ? "Glasses or a chain, never both — they share a slot."
              : "One top at a time. A body item covers the chest only, so your stripes still show."}
        </ZText>

        {/* the grid: only what you own, so an empty slot says where to go */}
        {items.length === 0 ? (
          <InsetPanel style={styles.empty}>
            <ZText variant="caption" color={color.textSecondary}>
              Nothing for this slot yet. Free items are already yours — the rest are in the Shop.
            </ZText>
          </InsetPanel>
        ) : null}
        <View style={styles.grid}>
          {items.map((c) => {
            const tag = tagFor(c);
            return (
              <Press
                key={c.id}
                onPress={() => tap(c)}
                scaleTo={0.97}
                accessibilityRole="button"
                accessibilityLabel={`${c.name}, ${tag.label}`}
                style={[styles.tile, tag.tone === "wearing" ? styles.tileOn : null]}
              >
                <Zebra
                  variant={c.slot === "body" ? "full" : "bust"}
                  size={c.slot === "body" ? 76 : 72}
                  striped
                  mood="hi"
                  outfit={{ [c.slot]: c.id }}
                  decorative
                />
                <ZText variant="micro" numberOfLines={1}>{c.name}</ZText>
                <ZText variant="micro" color={tag.tone === "wearing" ? color.text : color.textSecondary} numberOfLines={1}>
                  {tag.label}
                </ZText>
              </Press>
            );
          })}
        </View>

        {/* how the earned items are earned */}
        <Card style={styles.earn}>
          <ZText variant="overline" color={color.textMuted}>Earned Outfits</ZText>
          {Object.entries(EARN_RULES).map(([rule, id]) => {
            const c = cosmeticById(id);
            if (!c) return null;
            const got = owned.has(c.id);
            return (
              <View key={rule} style={styles.earnRow}>
                <Zebra variant="bust" size={40} striped mood="happy" outfit={{ [c.slot]: c.id }} decorative />
                <View style={styles.flex}>
                  <ZText variant="bodyStrong">{c.name}</ZText>
                  <ZText variant="caption" color={color.textMuted}>
                    {rule === "first_trip" ? "Settle your first trip" : `Settle five trips · ${settledTrips} of 5`}
                  </ZText>
                </View>
                {got ? <ZText variant="captionStrong">Earned</ZText> : null}
              </View>
            );
          })}
        </Card>

        <InsetPanel style={styles.soon}>
          <ZText variant="caption" color={color.textSecondary}>
            More hats, chains and jerseys are in the Shop. Everything you earn is free and arrives on its own.
          </ZText>
        </InsetPanel>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { paddingHorizontal: space[4], gap: space[4] },
  stage: { alignItems: "center", gap: space[8], backgroundColor: color.surfaceTranslucentStrong },
  tryPanel: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[12], alignSelf: "stretch" },
  moodRow: { gap: space[6] },
  moods: { gap: space[8], paddingVertical: space[2], paddingHorizontal: space[2] },
  hint: { paddingHorizontal: space[4] },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space[8] },
  tile: {
    width: "31.5%", alignItems: "center", gap: 2, paddingVertical: space[8],
    backgroundColor: palette.white, borderRadius: radius.tile, ...shadow.hairline,
    borderWidth: 2, borderColor: "transparent",
  },
  tileOn: { borderColor: palette.volt },
  earn: { gap: space[10] },
  earnRow: { flexDirection: "row", alignItems: "center", gap: space[12] },
  soon: { paddingVertical: space[10] },
  empty: { marginTop: space[8] },
});
