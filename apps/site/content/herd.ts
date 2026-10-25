/**
 * The six friends who appear all over the homepage: the herd demo, the receipt mock and
 * the final CTA. One list, so the same person reads as the same zebra everywhere.
 * Outfit ids are catalogue ids from @bunktab/core (design/zebra/outfits/manifest.json).
 */
import type { Outfit } from "@bunktab/core";

export type Friend = { id: string; name: string; look: string; outfit: Outfit };

export const FRIENDS: readonly Friend[] = [
  { id: "you", name: "You", look: "Shades + cap", outfit: { faceneck: "shades", head: "cap" } },
  { id: "priya", name: "Priya", look: "Heart shades + crown", outfit: { faceneck: "hearts", head: "crown" } },
  { id: "mike", name: "Mike", look: "Pom beanie", outfit: { head: "beanie" } },
  { id: "jess", name: "Jess", look: "Shades + scarf", outfit: { faceneck: "specs", body: "scarf" } },
  { id: "jordan", name: "Jordan", look: "Party hat + chain", outfit: { head: "party", faceneck: "chain" } },
  // the hoodie puts its hood up: the ink band over the head plus the strings on the chest
  { id: "bradley", name: "Bradley", look: "Headphones + hoodie", outfit: { body: "hoodie" } },
] as const;

export const friend = (id: string): Friend => FRIENDS.find((f) => f.id === id)!;

/** The herd demo's starting state: You, Priya and Mike have tapped Done. */
export const HERD_START: readonly boolean[] = [true, true, true, false, false, false];

/** What the herd collects when every zebra is striped (the hero balance on the board). */
export const HERD_COLLECT = "$2,193.10";

/**
 * The receipt mock (Mariscos El Faro). Amounts are decimal strings, never floats; the
 * total line is checked against the items in test/receipt.test.ts.
 */
export type ReceiptLine = { item: string; amount: string; who: readonly string[] };

export const RECEIPT = {
  merchant: "MARISCOS EL FARO",
  meta: "MAR 13 · TABLE 7",
  lines: [
    { item: "Pescado zarandeado", amount: "96.00", who: ["you", "priya"] },
    { item: "Shrimp tacos x2", amount: "38.00", who: ["mike"] },
    { item: "Ceviche (shared)", amount: "42.00", who: ["you", "priya", "jordan"] },
    { item: "Margarita x3", amount: "54.00", who: ["jordan", "priya"] },
    { item: "Agua fresca", amount: "6.00", who: ["bradley"] },
    { item: "Churros", amount: "24.00", who: ["jordan"] },
  ] as readonly ReceiptLine[],
  tax: "23.40",
  tip: "52.00",
  total: "$335.40",
} as const;

/** Decimal string → integer cents, with no float arithmetic (the rule in CLAUDE.md). */
export function toCents(amount: string): number {
  const m = /^\$?(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!m) throw new Error(`not a money string: ${amount}`);
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

export const formatCents = (cents: number) => `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
