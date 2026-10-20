import { describe, expect, it } from "vitest";
import { HERD, herdLayout, herdPick, herdRows } from "../src/herd";

const FIELD = { w: 358, h: 250 }; // the board's field: 358 pt wide, ~250 pt tall

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
  it("reproduces the board's six-zebra geometry", () => {
    const slots = herdLayout(6, FIELD.w, FIELD.h);
    expect(slots).toHaveLength(6);
    const front = slots.filter((s) => s.row === 0);
    const back = slots.filter((s) => s.row === 1);
    // board: front row 104 pt wide on a 358 pt field
    expect(front[0]!.width).toBeCloseTo(104, 0);
    // board: back row is exactly 0.82 of the front
    expect(back[0]!.width / front[0]!.width).toBeCloseTo(HERD.depthScale, 5);
    // board: the back row sits 0.42 of a front-row height higher
    const lift = front[0]!.y + front[0]!.height - (back[0]!.y + back[0]!.height);
    expect(lift / front[0]!.height).toBeCloseTo(HERD.rowLift, 5);
  });

  it("stands the front row's feet on the bottom edge", () => {
    for (const n of [1, 4, 6, 9, 12]) {
      const front = herdLayout(n, FIELD.w, FIELD.h).filter((s) => s.row === 0);
      for (const s of front) expect(s.y + s.height).toBeCloseTo(FIELD.h, 5);
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

  it("offsets a back row half a step so nobody hides behind anybody", () => {
    const slots = herdLayout(6, FIELD.w, FIELD.h);
    const front = slots.filter((s) => s.row === 0).map((s) => s.x + s.width / 2);
    const back = slots.filter((s) => s.row === 1).map((s) => s.x + s.width / 2);
    for (const b of back) for (const f of front) expect(Math.abs(b - f)).toBeGreaterThan(8);
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
