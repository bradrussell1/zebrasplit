/**
 * The wardrobe (pure): what a zebra is wearing, in what order it draws, and how to say
 * it out loud. No React, no I/O; the catalogue itself is generated from
 * design/zebra/outfits/manifest.json into outfits.generated.ts.
 *
 * Three slots, one item each (A2): `head`, `faceneck`, `body`. Face and neck share a
 * slot deliberately, so it is glasses OR a chain, never both — the bride sash lives
 * there too so it can go over any top.
 *
 * The one rule that isn't just "one per slot" is the hoodie (A7/A11): wearing it puts
 * the hood up, which hides whatever is in the head slot. The hat is not removed — it
 * comes back the moment the hoodie comes off — so this is a drawing rule, never a write.
 */
import { COSMETICS, EARN_RULES, PACKS, type CosmeticDef, type OutfitLayerName, type OutfitStatus, type PackDef } from "./outfits.generated";

export { COSMETICS, EARN_RULES, PACKS };
export type { CosmeticDef, OutfitLayerName, OutfitStatus, PackDef };

export type OutfitSlot = "head" | "faceneck" | "body";
export const OUTFIT_SLOTS: readonly OutfitSlot[] = ["head", "faceneck", "body"] as const;

/** What tab the slot is, in the wardrobe (A5). */
export const SLOT_LABELS: Readonly<Record<OutfitSlot, string>> = {
  head: "Head",
  faceneck: "Face & neck",
  body: "Body",
};

/** The equipped item per slot. An absent or null slot is bare. */
export type Outfit = Partial<Record<OutfitSlot, string | null>>;

const BY_ID = new Map(COSMETICS.map((c) => [c.id, c]));

export function cosmeticById(id: string | null | undefined): CosmeticDef | null {
  return (id && BY_ID.get(id)) || null;
}

export function cosmeticsForSlot(slot: OutfitSlot): CosmeticDef[] {
  return COSMETICS.filter((c) => c.slot === slot);
}

export function packById(id: string | null | undefined): PackDef | null {
  return PACKS.find((p) => p.id === id) ?? null;
}

/** The item a rule grants, e.g. `first_trip` → the yellow cap. */
export function cosmeticForEarnRule(rule: string): CosmeticDef | null {
  return cosmeticById(EARN_RULES[rule]);
}

/**
 * Drop anything that isn't a real item, or is a real item in the wrong slot. A client
 * can send whatever it likes and an old row can name an item that has since been
 * retired, so everything that draws an outfit goes through here first.
 */
export function normalizeOutfit(outfit: Outfit | null | undefined): Outfit {
  const clean: Outfit = {};
  if (!outfit) return clean;
  for (const slot of OUTFIT_SLOTS) {
    const c = cosmeticById(outfit[slot]);
    if (c && c.slot === slot) clean[slot] = c.id;
  }
  return clean;
}

/** True when the body item puts a hood up over the head slot. */
export function hoodIsUp(outfit: Outfit | null | undefined): boolean {
  return !!cosmeticById(normalizeOutfit(outfit).body)?.hidesHeadSlot;
}

/**
 * The head item that is equipped but not being drawn, because the hood is up. The
 * wardrobe tile for this item reads "Under the hood" rather than "Wearing".
 */
export function hiddenByHood(outfit: Outfit | null | undefined): CosmeticDef | null {
  const clean = normalizeOutfit(outfit);
  return hoodIsUp(clean) ? cosmeticById(clean.head) : null;
}

export type OutfitLayerSpec = {
  /** The art to draw. `hood` is synthetic: it has no slot and is never owned. */
  id: string;
  layer: OutfitLayerName;
  drawOrder: number;
  /** Torso items are held to the body path on a full zebra, the neck path on a bust. */
  clipped: boolean;
};

/**
 * Slot and layer are deliberately independent: the bride sash is a face-and-neck item
 * drawn across the torso (so it can go over any top), and the scarf is a body item drawn
 * at the throat. That means two equipped items can want the same depth — a tee and a
 * sash are both `torso`, a scarf and a gold chain are both `throat` — so depth alone
 * doesn't decide what covers what.
 *
 * The tiebreak is what a person would expect: clothing first, then the accessory over
 * it. A sash lies over the tee, a chain over the scarf, never the other way round.
 */
const SLOT_DEPTH: Record<OutfitSlot, number> = { body: 0, faceneck: 1, head: 2 };

/** The hood is drawn by the hoodie, not owned separately, so it isn't in the catalogue. */
export const HOOD_LAYER: OutfitLayerSpec = { id: "hood", layer: "hood", drawOrder: 3, clipped: false };

/**
 * Everything to draw for an outfit, in paint order:
 *   torso → skirt → [body outline, head and mood, drawn by the zebra itself] → hood →
 *   throat → face → head
 *
 * The head item is omitted entirely while the hood is up, and the hood is added in its
 * place. Mood extras (the z's, the sweat drop, sparkles) draw above everything here —
 * that is the zebra's business, not the wardrobe's.
 */
export function outfitLayers(outfit: Outfit | null | undefined): OutfitLayerSpec[] {
  const clean = normalizeOutfit(outfit);
  const hooded = hoodIsUp(clean);
  const layers: (OutfitLayerSpec & { tie: number })[] = [];
  for (const slot of OUTFIT_SLOTS) {
    if (slot === "head" && hooded) continue;
    const c = cosmeticById(clean[slot]);
    if (c) layers.push({ id: c.id, layer: c.layer, drawOrder: c.drawOrder, clipped: c.clipped, tie: SLOT_DEPTH[slot] });
  }
  if (hooded) layers.push({ ...HOOD_LAYER, tie: SLOT_DEPTH.head });
  return layers
    .sort((a, b) => a.drawOrder - b.drawOrder || a.tie - b.tie)
    .map(({ tie: _tie, ...l }) => l);
}

/** "a tiara", "heart shades", "an orange cap" — plural-looking names take no article. */
function withArticle(name: string): string {
  const lower = name.toLowerCase();
  if (/(s|shades|glasses|goggles)$/.test(lower)) return lower;
  return `${/^[aeiou]/.test(lower) ? "an" : "a"} ${lower}`;
}

/** "a tiara and heart shades", or "" when the zebra is bare. */
export function outfitDescription(outfit: Outfit | null | undefined): string {
  // described in the order a person would notice: head first, then face, then body
  const clean = normalizeOutfit(outfit);
  const names: string[] = [];
  if (!hoodIsUp(clean)) {
    const head = cosmeticById(clean.head);
    if (head) names.push(withArticle(head.name));
  }
  for (const slot of ["faceneck", "body"] as const) {
    const c = cosmeticById(clean[slot]);
    if (c) names.push(withArticle(c.name));
  }
  if (hoodIsUp(clean)) names.push("the hood up");
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/**
 * What a screen reader says about one zebra in a herd:
 * "Priya's zebra, done, wearing a tiara and heart shades, happy" (B2).
 */
export function herdZebraLabel(z: {
  name: string;
  isMe?: boolean;
  done: boolean;
  mood: string;
  outfit?: Outfit | null;
}): string {
  const who = z.isMe ? "Your zebra" : `${z.name}'s zebra`;
  const wearing = outfitDescription(z.outfit);
  return [who, z.done ? "done" : "still adding", wearing ? `wearing ${wearing}` : null, z.mood]
    .filter(Boolean)
    .join(", ");
}
