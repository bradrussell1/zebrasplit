/**
 * The herd (pure): where each zebra stands in the Pasture, and which zebras get drawn
 * when a dazzle has more members than the field can hold.
 *
 * One zebra per member, not one stripe per member — see A1 in
 * docs/ZEBRASPLIT_HERD_STORIES_PROMPT.md. No React, no I/O; tests in test/herd.test.ts.
 *
 * The geometry is lifted from `design/reference/herd/Trip-Herd.dc.html`, which places a
 * six-zebra herd by hand in a 358 pt field: the front row draws at 104 pt wide on a
 * 115.3 pt step with an 11.7 pt margin, and the back row is 85.3 pt — exactly 0.82 of
 * the front — sitting 45.2 pt higher, which is 0.42 of a front-row zebra's height. Those
 * three ratios are what this reproduces at any width and any herd size; the board's own
 * back-row spacing is hand-nudged and is not a rule.
 */

export const HERD = {
  /** Never draw more than this many zebras, however big the dazzle (A10b). */
  maxDrawn: 12,
  /** Row counts: up to 4 in one row, 5–8 in two, 9–12 in three (A10). */
  rowBreaks: [4, 8, 12] as const,
  /** Each row back is this much smaller than the one in front of it. */
  depthScale: 0.82,
  /** ...and its feet sit this fraction of a front-row zebra's height higher. */
  rowLift: 0.6,
  /** Side margin and the gap between zebras, as a fraction of the field width. */
  gapFactor: 0.032,
  /** The front row's feet stand this far above the field's bottom edge, leaving room
   *  for the name tags that sit at them. The board: 22 pt in a 250 pt field. */
  bottomFactor: 0.088,
  /** A front-row zebra is never taller than this much of the field. Without it a herd
   *  of three on a wide screen sizes itself from the width alone and fills the sky. */
  maxFrontFactor: 0.44,
  /** The full zebra's master aspect ratio (viewBox 0 -8 320 330). */
  aspect: 330 / 320,
} as const;

export type HerdSlot = {
  /** Index into the ordered member list this slot draws. */
  index: number;
  /** 0 is the front row. */
  row: number;
  /** Top-left of the zebra box, in field points. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Front row reads first, so later rows must paint underneath. */
  z: number;
};

/** How many rows a herd of `n` needs, and how many zebras stand in each. */
export function herdRows(n: number): number[] {
  const count = Math.min(Math.max(0, Math.floor(n)), HERD.maxDrawn);
  if (count === 0) return [];
  const rows = count <= HERD.rowBreaks[0] ? 1 : count <= HERD.rowBreaks[1] ? 2 : 3;
  // Fill from the front: the front row is never shorter than the row behind it, so a
  // 5-herd is 3 + 2 and a 7-herd is 4 + 3 rather than the other way round.
  const base = Math.floor(count / rows);
  const extra = count % rows;
  return Array.from({ length: rows }, (_, r) => base + (r < extra ? 1 : 0));
}

/**
 * Where every zebra stands. `width` and `height` are the Pasture's drawable size in
 * points; the front row's feet land on the bottom edge. Slots come back front row first,
 * left to right, which is also the order they should be drawn in (z descends).
 *
 * Slot 0 is always the front row, far left: that is your own zebra (A10/B4).
 */
export function herdLayout(n: number, width: number, height: number): HerdSlot[] {
  const rows = herdRows(n);
  if (rows.length === 0 || width <= 0 || height <= 0) return [];

  // The front row sizes itself to fit across: width = c·size + (c+1)·gap.
  const gap = width * HERD.gapFactor;
  const frontCount = rows[0]!;
  let frontH = ((width - (frontCount + 1) * gap) / frontCount) * HERD.aspect;

  // ...but height has the final say. A herd stands on a band of fixed height, so a row
  // of three on a wide screen would otherwise size itself from the width alone and come
  // out enormous. Two bounds: the whole lifted stack has to fit above the tag margin,
  // and no single zebra may be taller than maxFrontFactor of the field.
  const bottom = height * HERD.bottomFactor;
  const stack = height - bottom;
  const back = Math.pow(HERD.depthScale, rows.length - 1);
  const fits = stack / (HERD.rowLift * (rows.length - 1) + back);
  frontH = Math.min(frontH, fits, height * HERD.maxFrontFactor);
  const frontW = frontH / HERD.aspect;

  const slots: HerdSlot[] = [];
  const frontStep = frontW + gap;
  let index = 0;
  for (let row = 0; row < rows.length; row++) {
    const count = rows[row]!;
    const scale = Math.pow(HERD.depthScale, row);
    const w = frontW * scale;
    const h = frontH * scale;
    // The front row is centred. Every row behind it starts half a front-row step to the
    // right, so no zebra stands directly behind another — and because a back row often
    // holds as many zebras as the front, that offset would otherwise push it off the
    // edge. Rather than give up the offset, the row closes its own gaps to fit, which is
    // exactly the squeeze the board makes by hand on its six-zebra field.
    const span = count * w + (count - 1) * gap;
    let left: number;
    let step: number;
    if (row === 0) {
      left = (width - span) / 2;
      step = w + gap;
    } else {
      left = gap + frontStep / 2;
      const room = width - gap - left - w;
      step = count > 1 ? Math.min(w + gap, room / (count - 1)) : 0;
      if (step < w * 0.55) { // no room to offset at all: fall back to centred
        left = (width - span) / 2;
        step = w + gap;
      }
    }
    // every row's feet, lifted a constant step back from the front row's
    const feet = height - bottom - frontH * HERD.rowLift * row;
    const y = feet - h;
    for (let i = 0; i < count; i++) {
      slots.push({ index: index++, row, x: left + i * step, y, width: w, height: h, z: rows.length - row });
    }
  }
  return slots;
}

/**
 * Which members get a zebra when the dazzle is bigger than the field (A10b).
 *
 * A dazzle can have any number of members; at most 12 are drawn. You are always one of
 * them and always first, so your own zebra never disappears; the other 11 are a reshuffle
 * that the caller re-rolls each time the app comes to the foreground. `seed` makes that
 * reshuffle reproducible, which is the only way to test it.
 *
 * The status row and the herd page still count and list everyone — this is a drawing
 * limit, not a membership limit.
 */
export function herdPick<T extends { user_id: string }>(
  members: readonly T[],
  meId: string,
  seed: number,
): { shown: T[]; more: number } {
  const me = members.find((m) => m.user_id === meId);
  const rest = members.filter((m) => m.user_id !== meId);
  const room = HERD.maxDrawn - (me ? 1 : 0);
  if (rest.length <= room) {
    return { shown: me ? [me, ...rest] : [...rest], more: 0 };
  }
  // Fisher–Yates from a small deterministic generator (mulberry32).
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool = [...rest];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  const picked = pool.slice(0, room);
  return { shown: me ? [me, ...picked] : picked, more: rest.length - room };
}
