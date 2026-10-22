import { describe, expect, it } from "vitest";
import {
  availablePlatforms, choosePlatform, formatHandle, isValidHandle, normalizeHandle,
  PAY_PLATFORMS, payLink, payNote, planVenmoRequests, PLATFORM_SPECS, type PayPlatform,
} from "../src/payments";

describe("normalizeHandle", () => {
  it("strips the decoration people paste", () => {
    expect(normalizeHandle("venmo", "@mike-chen")).toBe("mike-chen");
    expect(normalizeHandle("cashapp", "$mikechen")).toBe("mikechen");
    expect(normalizeHandle("venmo", "  mike-chen  ")).toBe("mike-chen");
  });

  it("accepts a pasted profile URL", () => {
    expect(normalizeHandle("venmo", "https://venmo.com/u/mike-chen")).toBe("mike-chen");
    expect(normalizeHandle("venmo", "https://venmo.com/mike-chen")).toBe("mike-chen");
    expect(normalizeHandle("cashapp", "https://cash.app/$mikechen")).toBe("mikechen");
    expect(normalizeHandle("paypal", "https://paypal.me/mikechen")).toBe("mikechen");
    expect(normalizeHandle("paypal", "paypal.me/mikechen")).toBe("mikechen");
  });

  it("drops a query string or trailing path", () => {
    expect(normalizeHandle("cashapp", "https://cash.app/$mikechen/25")).toBe("mikechen");
    expect(normalizeHandle("venmo", "venmo.com/u/mike-chen?txn=pay")).toBe("mike-chen");
  });
});

describe("isValidHandle", () => {
  it("applies each platform's own rules", () => {
    expect(isValidHandle("venmo", "mike-chen")).toBe(true);
    expect(isValidHandle("venmo", "mike")).toBe(false);          // under 5 characters
    expect(isValidHandle("cashapp", "mikechen")).toBe(true);
    expect(isValidHandle("cashapp", "1mike")).toBe(false);        // must start with a letter
    expect(isValidHandle("paypal", "mikechen")).toBe(true);
    expect(isValidHandle("paypal", "mike-chen")).toBe(false);     // alphanumeric only
  });

  it("validates what the user pasted, not the decoration", () => {
    expect(isValidHandle("cashapp", "$mikechen")).toBe(true);
    expect(isValidHandle("venmo", "https://venmo.com/u/mike-chen")).toBe(true);
  });

  it("rejects an empty handle on every platform", () => {
    for (const p of PAY_PLATFORMS) expect(isValidHandle(p, "   ")).toBe(false);
  });
});

describe("formatHandle", () => {
  it("reads back the way each platform writes it", () => {
    expect(formatHandle("venmo", "mike-chen")).toBe("@mike-chen");
    expect(formatHandle("cashapp", "mikechen")).toBe("$mikechen");
    expect(formatHandle("paypal", "mikechen")).toBe("paypal.me/mikechen");
    expect(formatHandle("venmo", "")).toBe("");
  });
});

describe("payLink", () => {
  it("builds a Venmo link with the amount and the memo", () => {
    const l = payLink("venmo", "@mike-chen", 8450, "Cabo crew");
    expect(l.app).toContain("venmo://paycharge?");
    expect(l.app).toContain("txn=pay");
    expect(l.app).toContain("recipients=mike-chen");
    expect(l.app).toContain("amount=84.50");
    expect(l.note).toBe("Cabo crew - settled via Zebrasplit");
  });

  it("builds a Cash App universal link with the amount", () => {
    const l = payLink("cashapp", "$mikechen", 8450, "Cabo crew");
    expect(l.app).toBe("https://cash.app/$mikechen/84.50");
    expect(l.web).toBe(l.app);
    expect(l.note).toBeUndefined();
  });

  it("builds a PayPal.me link, with the currency only when it isn't dollars", () => {
    expect(payLink("paypal", "mikechen", 8450, "Cabo crew").app).toBe("https://paypal.me/mikechen/84.50");
    expect(payLink("paypal", "mikechen", 8450, "Cabo crew", "EUR").app).toBe("https://paypal.me/mikechen/84.50EUR");
  });

  it("refuses a zero, negative or empty payment", () => {
    for (const p of PAY_PLATFORMS) {
      expect(() => payLink(p, "mikechen", 0, "Cabo crew")).toThrow(RangeError);
      expect(() => payLink(p, "mikechen", -1, "Cabo crew")).toThrow(RangeError);
      expect(() => payLink(p, "  ", 100, "Cabo crew")).toThrow(RangeError);
    }
  });

  it("never leaves a dollar sign or @ in the built URL", () => {
    for (const p of PAY_PLATFORMS) {
      const l = payLink(p, p === "cashapp" ? "$mikechen" : "@mikechen", 1234, "Trip");
      expect(l.app).not.toContain("@mikechen");
      expect(l.app).not.toContain("$$");
    }
  });
});

describe("payNote", () => {
  it("is the memo on Venmo and empty elsewhere", () => {
    expect(payNote("venmo", "Cabo crew")).toBe("Cabo crew - settled via Zebrasplit");
    expect(payNote("cashapp", "Cabo crew")).toBe("");
    expect(payNote("paypal", "Cabo crew")).toBe("");
    expect(PLATFORM_SPECS.venmo.supportsNote).toBe(true);
  });
});

describe("choosePlatform", () => {
  const all = { venmo: "a-venmo", cashapp: "acash", paypal: "apaypal" };

  it("prefers what the payer last chose for this person", () => {
    expect(choosePlatform(all, "venmo", "paypal")).toBe("paypal");
  });

  it("falls back to the recipient's default", () => {
    expect(choosePlatform(all, "cashapp", null)).toBe("cashapp");
  });

  it("ignores a preference the recipient cannot be paid on", () => {
    expect(choosePlatform({ venmo: "a-venmo" }, "cashapp", "paypal")).toBe("venmo");
  });

  it("is null when the recipient has registered nothing", () => {
    expect(choosePlatform({}, "venmo", "venmo")).toBeNull();
  });

  it("takes the first registered platform when there is no default", () => {
    expect(choosePlatform({ cashapp: "acash", paypal: "apaypal" }, null, null)).toBe("cashapp");
  });
});

describe("availablePlatforms", () => {
  it("lists only what the person registered, in display order", () => {
    expect(availablePlatforms({ paypal: "p", venmo: "v-enmo" })).toEqual<PayPlatform[]>(["venmo", "paypal"]);
    expect(availablePlatforms({})).toEqual([]);
  });
});

describe("planVenmoRequests", () => {
  const d = (recipient: string | null, amountCents: number) => ({ recipient, amountCents });

  it("batches when every debt is the same amount", () => {
    const plan = planVenmoRequests([d("mike-c", 5000), d("priya-p", 5000), d("jen-a", 5000)]);
    expect(plan.mode).toBe("batch");
    expect(plan.requests).toHaveLength(3);
    expect(plan.coversAll).toBe(true);
  });

  // the bug this replaces: one charge for several people used the FIRST debt's amount,
  // so Priya's $33.28 was requested as Mike's $457.25
  it("never batches debts of different amounts", () => {
    const plan = planVenmoRequests([d("mike-c", 45725), d("priya-p", 3328)]);
    expect(plan.mode).toBe("each");
    expect(plan.requests.map((r) => r.amountCents)).toEqual([45725, 3328]);
  });

  it("treats a single debt as a batch of one", () => {
    expect(planVenmoRequests([d("mike-c", 1200)]).mode).toBe("batch");
  });

  it("drops debtors with no Venmo username and says it isn't everyone", () => {
    const plan = planVenmoRequests([d("mike-c", 5000), d(null, 5000)]);
    expect(plan.mode).toBe("batch");
    expect(plan.requests).toHaveLength(1);
    expect(plan.coversAll).toBe(false);
  });

  it("is none when nobody can be requested", () => {
    expect(planVenmoRequests([d(null, 5000), d("", 100)]).mode).toBe("none");
    expect(planVenmoRequests([]).mode).toBe("none");
  });

  it("ignores debts that are not worth requesting", () => {
    const plan = planVenmoRequests([d("mike-c", 0), d("priya-p", 900)]);
    expect(plan.requests).toEqual([d("priya-p", 900)]);
    expect(plan.coversAll).toBe(false);
  });
});
