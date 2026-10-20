import { describe, expect, it } from "vitest";
import {
  COSMETICS, EARN_RULES, PACKS, cosmeticById, cosmeticForEarnRule, cosmeticsForSlot,
  hiddenByHood, herdZebraLabel, hoodIsUp, normalizeOutfit, outfitDescription, outfitLayers,
  OUTFIT_SLOTS,
} from "../src/outfits";

describe("the launch wardrobe", () => {
  it("is the 32 decided items in three slots", () => {
    expect(COSMETICS).toHaveLength(32);
    expect(cosmeticsForSlot("head")).toHaveLength(12);
    expect(cosmeticsForSlot("faceneck")).toHaveLength(9);
    expect(cosmeticsForSlot("body")).toHaveLength(11);
  });

  it("is 6 free, 3 earned and 23 paid (B3)", () => {
    const by = (s: string) => COSMETICS.filter((c) => c.status === s).length;
    expect(by("free")).toBe(6);
    expect(by("earned")).toBe(3);
    expect(by("paid")).toBe(23);
  });

  it("prices every paid item at 0.99 and every pack at 2.99", () => {
    for (const c of COSMETICS) expect(c.price).toBe(c.status === "paid" ? "0.99" : null);
    for (const p of PACKS) expect(p.price).toBe("2.99");
  });

  it("never gives an earned item a price: you earn it or get it in a pack", () => {
    for (const c of COSMETICS.filter((c) => c.status === "earned")) expect(c.price).toBeNull();
  });

  it("has the three earn rules pointing at real items", () => {
    expect(Object.keys(EARN_RULES).sort()).toEqual(["first_gift", "first_trip", "trips_5"]);
    expect(cosmeticForEarnRule("first_trip")?.name).toBe("Yellow cap");
    expect(cosmeticForEarnRule("trips_5")?.name).toBe("Party hat");
    expect(cosmeticForEarnRule("first_gift")?.name).toBe("Tiara");
  });

  it("has five packs whose items all exist and agree about belonging", () => {
    expect(PACKS).toHaveLength(5);
    for (const p of PACKS) {
      for (const id of p.items) {
        const c = cosmeticById(id);
        expect(c, `${p.id} lists ${id}`).not.toBeNull();
        expect(c!.packs).toContain(p.id);
      }
    }
    for (const c of COSMETICS) for (const packId of c.packs) {
      expect(PACKS.map((p) => p.id)).toContain(packId);
    }
  });

  it("ties the four Jersey packs together as one card", () => {
    const jersey = PACKS.filter((p) => p.group === "jersey");
    expect(jersey).toHaveLength(4);
    for (const p of jersey) expect(p.items).toHaveLength(2); // a jersey and its matching cap
  });

  // Slot and layer are independent on purpose, and only two items use that freedom.
  it("keeps slot and layer independent only where the design says so", () => {
    const crossovers = COSMETICS
      .filter((c) => (c.slot === "faceneck") !== (c.layer === "face" || c.layer === "throat"))
      .map((c) => `${c.id}:${c.layer}`);
    // the sash is a face-and-neck item drawn on the torso so it goes over any top;
    // the scarf is a body item drawn at the throat
    expect(crossovers.sort()).toEqual(["sash:torso", "scarf:throat"]);
  });

  it("clips exactly the torso items", () => {
    for (const c of COSMETICS) expect(c.clipped).toBe(c.layer === "torso");
  });
});

describe("normalizeOutfit", () => {
  it("keeps a sound outfit", () => {
    expect(normalizeOutfit({ head: "tiara", faceneck: "hearts", body: "skirt" }))
      .toEqual({ head: "tiara", faceneck: "hearts", body: "skirt" });
  });

  it("drops items that don't exist", () => {
    expect(normalizeOutfit({ head: "sombrero" })).toEqual({});
  });

  it("drops a real item worn in the wrong slot", () => {
    expect(normalizeOutfit({ head: "hoodie", body: "tiara" })).toEqual({});
  });

  it("copes with null, undefined and empty", () => {
    expect(normalizeOutfit(null)).toEqual({});
    expect(normalizeOutfit(undefined)).toEqual({});
    expect(normalizeOutfit({ head: null })).toEqual({});
  });
});

describe("the hoodie rule (A7)", () => {
  const hooded = { head: "cap", faceneck: "shades", body: "hoodie" };

  it("puts the hood up only for the hoodie", () => {
    expect(hoodIsUp(hooded)).toBe(true);
    expect(hoodIsUp({ body: "tee" })).toBe(false);
    expect(hoodIsUp({})).toBe(false);
  });

  it("hides the head item without taking it off", () => {
    expect(hiddenByHood(hooded)?.name).toBe("Yellow cap");
    // the equipped item is untouched: this is a drawing rule, not a write
    expect(normalizeOutfit(hooded).head).toBe("cap");
  });

  it("draws the hood in the hat's place and leaves the face alone", () => {
    const ids = outfitLayers(hooded).map((l) => l.id);
    expect(ids).toContain("hood");
    expect(ids).not.toContain("cap");
    expect(ids).toContain("shades");
  });

  it("gives the hat back when the hoodie comes off", () => {
    const ids = outfitLayers({ ...hooded, body: "tee" }).map((l) => l.id);
    expect(ids).toContain("cap");
    expect(ids).not.toContain("hood");
  });

  it("says the hood is up out loud", () => {
    expect(outfitDescription(hooded)).toBe("sunglasses, a hoodie and the hood up");
  });
});

describe("outfitLayers draw order", () => {
  it("paints torso, then skirt, then throat, then face, then head", () => {
    const order = outfitLayers({ head: "crown", faceneck: "chain", body: "skirt" }).map((l) => l.layer);
    expect(order).toEqual(["skirt", "throat", "head"]);
    const order2 = outfitLayers({ head: "crown", faceneck: "glasses", body: "tee" }).map((l) => l.layer);
    expect(order2).toEqual(["torso", "face", "head"]);
  });

  it("is sorted by drawOrder for every combination the wardrobe allows", () => {
    for (const head of [null, "cap", "tiara"]) {
      for (const faceneck of [null, "glasses", "chain", "sash", "lei"]) {
        for (const body of [null, "tee", "hoodie", "skirt", "scarf", "suit"]) {
          const d = outfitLayers({ head, faceneck, body }).map((l) => l.drawOrder);
          expect(d, `${head}/${faceneck}/${body}`).toEqual([...d].sort((a, b) => a - b));
        }
      }
    }
  });

  // Two items can want the same depth, because slot and layer are independent.
  it("lays an accessory over the clothing it shares a depth with", () => {
    // sash (faceneck, torso) over tee (body, torso)
    const a = outfitLayers({ faceneck: "sash", body: "tee" });
    expect(a.map((l) => l.id)).toEqual(["tee", "sash"]);
    expect(a[0]!.drawOrder).toBe(a[1]!.drawOrder);
    // chain (faceneck, throat) over scarf (body, throat)
    expect(outfitLayers({ faceneck: "chain", body: "scarf" }).map((l) => l.id)).toEqual(["scarf", "chain"]);
  });

  it("orders a tie the same way every time, whatever order the slots came in", () => {
    const once = outfitLayers({ body: "tee", faceneck: "sash" }).map((l) => l.id);
    const again = outfitLayers({ faceneck: "sash", body: "tee" }).map((l) => l.id);
    expect(once).toEqual(again);
  });

  it("gives nothing for a bare zebra", () => {
    expect(outfitLayers({})).toEqual([]);
    expect(outfitLayers(null)).toEqual([]);
  });
});

describe("outfitDescription", () => {
  it("names one item", () => {
    expect(outfitDescription({ head: "tiara" })).toBe("a tiara");
  });

  it("leaves plural-looking names without an article", () => {
    expect(outfitDescription({ faceneck: "hearts" })).toBe("heart shades");
    expect(outfitDescription({ faceneck: "glasses" })).toBe("glasses");
    expect(outfitDescription({ faceneck: "goggles" })).toBe("ski goggles");
  });

  it("joins two and three the way a person would", () => {
    expect(outfitDescription({ head: "tiara", faceneck: "hearts" })).toBe("a tiara and heart shades");
    expect(outfitDescription({ head: "tiara", faceneck: "hearts", body: "skirt" }))
      .toBe("a tiara, heart shades and a skirt");
  });

  it("is empty for a bare zebra", () => {
    expect(outfitDescription({})).toBe("");
  });
});

describe("herdZebraLabel", () => {
  it("reads the way the spec writes it", () => {
    expect(herdZebraLabel({ name: "Priya", done: true, mood: "happy", outfit: { head: "tiara", faceneck: "hearts" } }))
      .toBe("Priya's zebra, done, wearing a tiara and heart shades, happy");
  });

  it("calls your own zebra yours", () => {
    expect(herdZebraLabel({ name: "Brad", isMe: true, done: false, mood: "worried" }))
      .toBe("Your zebra, still adding, worried");
  });

  it("skips the wardrobe clause when the zebra is bare", () => {
    expect(herdZebraLabel({ name: "Mike", done: true, mood: "hi" })).toBe("Mike's zebra, done, hi");
  });
});

describe("the slots themselves", () => {
  it("are the three decided ones, in paint order", () => {
    expect(OUTFIT_SLOTS).toEqual(["head", "faceneck", "body"]);
  });
});
