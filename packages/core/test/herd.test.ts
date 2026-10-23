import { describe, expect, it } from "vitest";
import { HERD, herdLayout, herdPick, herdRows } from "../src/herd";

const FIELD = { w: 358, h: 300 }; // what the dazzle page gives the Pasture

describe("herdRows", () => {
  it("puts up to 4 in one row, 5-8 in two, 9-12 in three", () => {
    for (const n of [1, 2, 3, 4]) expect(herdRows(n)).toHaveLength(1);
    for (const n of [5, 6, 7, 8]) expect(herdRows(n)).toHaveLength(2);
    for (const n of [9, 10, 11, 12]) expect(herdRows(n)).toHaveLength(3);
  });

  it("never leaves the front row shorter than the row behind it", () => {
    for (let n = 1; n <= 12; n++) {
      const rows = herdRows(n);
      for (let r = 1; r < rows.length; r++) expect(rows[r]!).toBeLessThanOrEqual(rows[r - 1]!);
      expect(rows.reduce((a, b) => a + b, 0)).toBe(n);
    }
  });

  it("matches the board: 6 zebras are 3 and 3", () => {
    expect(herdRows(6)).toEqual([3, 3]);
  });

  it("caps at 12 however big the dazzle", () => {
    expect(herdRows(40).reduce((a, b) => a + b, 0)).toBe(12);
  });

  it("is empty for an empty herd", () => {
    expect(herdRows(0)).toEqual([]);
    expect(herdRows(-3)).toEqual([]);
  });
});

describe("herdLayout", () => {
  /**
   * The board hand-places six zebras shoulder to shoulder in a 358 x 250 field. Its
   * proportions — each row 0.82 of the one in front, feet clear of the bottom edge —
   * still hold, but its SIZE no longer does: the herd was made bigger and more spread
   * out after review, so zebras now overlap rather than queue. What stays true is the
   * shape of a row, not the board's exact widths.
   */
  it("draws every zebra the same size, whatever row it stands in", () => {
    // A dazzle is a group of equals, so perspective is gone: the front row no longer
    // reads as the important one. Depth comes from the lift and the overlap instead.
    for (const n of [2, 5, 6, 8, 9, 10, 11, 12]) {
      const slots = herdLayout(n, FIELD.w, FIELD.h);
      const widths = new Set(slots.map((s) => s.width.toFixed(6)));
      const heights = new Set(slots.map((s) => s.height.toFixed(6)));
      expect(widths.size, `${n} zebras`).toBe(1);
      expect(heights.size, `${n} zebras`).toBe(1);
    }
  });

  it("sizes everyone to what the back row used to be", () => {
    const slots = herdLayout(6, FIELD.w, FIELD.h);
    expect(slots).toHaveLength(6);
    const front = slots.filter((s) => s.row === 0);
    expect(front.every((s) => s.y + s.height === front[0]!.y + front[0]!.height)).toBe(true);
    // two rows, so one step back: everyone is drawn at depthScale of the old front row
    const widest = ((FIELD.w - 4 * FIELD.w * HERD.gapFactor) / 3) * HERD.aspect * HERD.crowdFactor;
    expect(front[0]!.width).toBeCloseTo((widest * HERD.depthScale) / HERD.aspect, 4);
    // evenly spaced, and the step is the room a name tag has to itself
    const gaps = front.slice(1).map((s, i) => s.x - front[i]!.x);
    for (const g of gaps) expect(g).toBeCloseTo(front[0]!.step, 5);
  });

  it("draws a herd big enough to read, overlapping rather than shrinking to fit", () => {
    // the complaint this answers: four zebras across a 358 pt field came out 71 pt wide.
    // The bar is lower than it was now that nobody is drawn at the old front-row size.
    for (const n of [6, 8, 12]) {
      const s = herdLayout(n, FIELD.w, FIELD.h);
      expect(s[0]!.width, `${n} zebras`).toBeGreaterThan(60);
      // ...and a tag gets a whole step, so two names never collide side by side
      expect(s[0]!.step).toBeGreaterThan(55);
    }
  });

  it("stands each row clear of the one in front, so no tag lands on another zebra", () => {
    // a tag sits at its own zebra's feet, so the lift has to be at least a zebra tall
    for (const n of [6, 8, 9, 12]) {
      const slots = herdLayout(n, FIELD.w, FIELD.h);
      for (const s of slots.filter((x) => x.row > 0)) {
        const front = slots.find((x) => x.row === s.row - 1)!;
        expect(s.y + s.height, `${n} zebras, row ${s.row}`).toBeLessThanOrEqual(front.y + 1);
      }
    }
  });

  it("leaves the board's margin under the front row, for the name tags at their feet", () => {
    for (const n of [1, 4, 6, 9, 12]) {
      const front = herdLayout(n, FIELD.w, FIELD.h).filter((s) => s.row === 0);
      for (const s of front) expect(s.y + s.height).toBeCloseTo(FIELD.h * (1 - HERD.bottomFactor), 5);
    }
    // enough room under the feet for a tag to straddle the ground line
    expect(FIELD.h * HERD.bottomFactor).toBeGreaterThan(20);
  });

  it("never lets a row of three on a wide field size itself from the width alone", () => {
    // the bug this replaces: a 3-wide row on a 424 pt field came out 131 pt tall in a
    // 250 pt band, filling the sky and clipping its own name tags
    for (const w of [358, 424, 500, 744]) {
      for (const s of herdLayout(6, w, FIELD.h)) {
        expect(s.height, `${w} wide`).toBeLessThanOrEqual(FIELD.h * HERD.maxFrontFactor + 0.001);
      }
    }
  });

  it("keeps every zebra inside the field at every size", () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 30]) {
      for (const w of [300, 358, 430, 744]) {
        for (const s of herdLayout(n, w, FIELD.h)) {
          expect(s.x).toBeGreaterThanOrEqual(-0.001);
          expect(s.x + s.width).toBeLessThanOrEqual(w + 0.001);
          expect(s.y).toBeGreaterThanOrEqual(-0.001);
          expect(s.y + s.height).toBeLessThanOrEqual(FIELD.h + 0.001);
        }
      }
    }
  });

  it("stands nobody directly behind anybody, at every herd size and width", () => {
    // Equal sizes took away the thing that used to hide this: when the back row was
    // narrower, its centres moved a few points even where the rows lined up exactly.
    // The row offset now has to carry it alone, so check every n rather than just six.
    for (const w of [320, 358, 390, 430]) {
      for (let n = 2; n <= 12; n++) {
        const slots = herdLayout(n, w, FIELD.h);
        for (const a of slots) for (const b of slots) {
          if (a.row === b.row) continue;
          const apart = Math.abs(a.x + a.width / 2 - (b.x + b.width / 2));
          expect(apart, `${n} zebras at ${w}: rows ${a.row} and ${b.row}`).toBeGreaterThan(8);
        }
      }
    }
  });

  it("draws the front row over the rows behind it", () => {
    const slots = herdLayout(12, FIELD.w, FIELD.h);
    const z = (row: number) => slots.find((s) => s.row === row)!.z;
    expect(z(0)).toBeGreaterThan(z(1));
    expect(z(1)).toBeGreaterThan(z(2));
  });

  it("shrinks three rows rather than letting them climb out of a short field", () => {
    const tall = herdLayout(12, FIELD.w, 250);
    const squat = herdLayout(12, FIELD.w, 140);
    expect(squat[0]!.width).toBeLessThan(tall[0]!.width);
    for (const s of squat) expect(s.y).toBeGreaterThanOrEqual(-0.001);
  });

  it("lifts each row back by a constant step measured at the feet, not the tops", () => {
    // tops drift apart as rows shrink, so measuring the lift there understates it
    const slots = herdLayout(9, FIELD.w, FIELD.h);
    const feet = (row: number) => { const s = slots.find((x) => x.row === row)!; return s.y + s.height; };
    const step = feet(0) - feet(1);
    expect(feet(1) - feet(2)).toBeCloseTo(step, 5);
    expect(step / slots[0]!.height).toBeCloseTo(HERD.rowLift, 5);
  });

  it("gives nothing back for an empty or collapsed field", () => {
    expect(herdLayout(0, FIELD.w, FIELD.h)).toEqual([]);
    expect(herdLayout(6, 0, FIELD.h)).toEqual([]);
    expect(herdLayout(6, FIELD.w, 0)).toEqual([]);
  });
});

describe("herdPick", () => {
  const herd = (n: number) => Array.from({ length: n }, (_, i) => ({ user_id: i === 0 ? "me" : `u${i}` }));

  it("shows everyone when the dazzle fits", () => {
    const { shown, more } = herdPick(herd(12), "me", 1);
    expect(shown).toHaveLength(12);
    expect(more).toBe(0);
  });

  it("draws 12 and counts the rest when it doesn't", () => {
    const { shown, more } = herdPick(herd(20), "me", 1);
    expect(shown).toHaveLength(12);
    expect(more).toBe(8);
  });

  it("always puts you first, whatever the seed", () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(herdPick(herd(40), "me", seed).shown[0]!.user_id).toBe("me");
    }
  });

  it("never draws the same person twice", () => {
    for (let seed = 0; seed < 25; seed++) {
      const ids = herdPick(herd(40), "me", seed).shown.map((m) => m.user_id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("reshuffles: a different seed gives a different eleven", () => {
    const a = herdPick(herd(40), "me", 1).shown.map((m) => m.user_id).join();
    const b = herdPick(herd(40), "me", 2).shown.map((m) => m.user_id).join();
    expect(a).not.toBe(b);
  });

  it("is stable for one seed, so a re-render doesn't reshuffle the field", () => {
    const a = herdPick(herd(40), "me", 7).shown.map((m) => m.user_id);
    const b = herdPick(herd(40), "me", 7).shown.map((m) => m.user_id);
    expect(a).toEqual(b);
  });

  it("copes with a viewer who isn't a member (a read-only guest)", () => {
    const { shown, more } = herdPick(herd(20), "nobody", 3);
    expect(shown).toHaveLength(12);
    expect(more).toBe(8);
    expect(shown.map((m) => m.user_id)).not.toContain("me_only_sentinel");
  });
});
