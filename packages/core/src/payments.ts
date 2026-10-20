import { centsToDecimalString, type Cents } from "./money";
import { venmoNote, venmoPayLink } from "./venmo";

/**
 * Paying someone at close-out (Venmo, Cash App or PayPal).
 *
 * Zebrasplit never moves money: every link below just opens the other app with
 * the amount filled in, and the person taps send there. None of these deep-link
 * formats is officially documented by its vendor, so they all live here, in one
 * place, the way the Venmo link always has.
 *
 * Zelle is deliberately absent: it has no public API, no developer programme and
 * no reliable deep link — it lives inside each bank's own app. Paying by Zelle,
 * cash or bank transfer is still fine; it is "Paid another way" in the UI, which
 * marks the settlement paid without opening anything.
 */
export type PayPlatform = "venmo" | "cashapp" | "paypal";

export const PAY_PLATFORMS: readonly PayPlatform[] = ["venmo", "cashapp", "paypal"] as const;

export type PayLink = {
  /** Opened first; falls back to `web` when the app isn't installed. */
  app: string;
  web: string;
  /** The memo, when the platform carries one (Venmo only). */
  note?: string;
};

export type PlatformSpec = {
  id: PayPlatform;
  /** For buttons and chips: "Venmo", "Cash App", "PayPal". */
  label: string;
  /** Shown in front of the input, e.g. "@" or "$". Empty when the handle is bare. */
  prefix: string;
  /** What to call the handle in copy: "username", "$Cashtag", "PayPal.me link". */
  handleLabel: string;
  /** Only Venmo carries the "<trip> - settled via Zebrasplit" memo. */
  supportsNote: boolean;
};

export const PLATFORM_SPECS: Record<PayPlatform, PlatformSpec> = {
  venmo:   { id: "venmo",   label: "Venmo",    prefix: "@", handleLabel: "username",      supportsNote: true },
  cashapp: { id: "cashapp", label: "Cash App", prefix: "$", handleLabel: "$Cashtag",      supportsNote: false },
  paypal:  { id: "paypal",  label: "PayPal",   prefix: "",  handleLabel: "PayPal.me name", supportsNote: false },
};

/** Strip the decoration people paste in: a leading @ or $, a full profile URL, spaces. */
export function normalizeHandle(platform: PayPlatform, raw: string): string {
  let h = raw.trim();
  // people paste whole profile links, with or without the scheme; keep the handle segment
  h = h.replace(/^(https?:\/\/)?(www\.)?(venmo\.com\/(u\/)?|cash\.app\/|paypal\.me\/)/i, "");
  h = h.split(/[/?#]/)[0] ?? "";
  h = h.replace(/^[@$]/, "");
  return h.trim();
}

const PATTERNS: Record<PayPlatform, RegExp> = {
  // Venmo usernames are 5-30 characters: letters, digits, hyphens, underscores.
  venmo: /^[A-Za-z0-9_-]{5,30}$/,
  // A $Cashtag is 1-20 characters, must start with a letter, letters and digits.
  cashapp: /^[A-Za-z][A-Za-z0-9]{0,19}$/,
  // PayPal.me names are 1-20 alphanumeric characters.
  paypal: /^[A-Za-z0-9]{1,20}$/,
};

export function isValidHandle(platform: PayPlatform, raw: string): boolean {
  return PATTERNS[platform].test(normalizeHandle(platform, raw));
}

/** How the handle reads back to the user: "@mike-chen", "$mikechen", "paypal.me/mikechen". */
export function formatHandle(platform: PayPlatform, raw: string): string {
  const h = normalizeHandle(platform, raw);
  if (!h) return "";
  return platform === "paypal" ? `paypal.me/${h}` : `${PLATFORM_SPECS[platform].prefix}${h}`;
}

/**
 * The link that settles one payment. `tripTitle` only reaches Venmo, which is the
 * one of the three whose link carries a memo.
 *
 * `currency` is the trip's base currency; only PayPal.me takes one in the URL.
 * Venmo and Cash App links are US-dollar products and carry a bare amount.
 */
export function payLink(platform: PayPlatform, handle: string, amountCents: Cents, tripTitle: string, currency = "USD"): PayLink {
  if (amountCents <= 0) throw new RangeError("A payment must be more than zero.");
  const h = normalizeHandle(platform, handle);
  if (!h) throw new RangeError("That payment handle is empty.");
  const amount = centsToDecimalString(amountCents);

  switch (platform) {
    case "venmo":
      return venmoPayLink(h, amountCents, tripTitle);
    case "cashapp": {
      // cash.app/$tag/12.34 is a universal link: it opens Cash App when installed,
      // and the web page when it isn't, so there is one URL rather than two.
      const url = `https://cash.app/$${encodeURIComponent(h)}/${amount}`;
      return { app: url, web: url };
    }
    case "paypal": {
      const suffix = currency.toUpperCase() === "USD" ? amount : `${amount}${currency.toUpperCase()}`;
      const url = `https://paypal.me/${encodeURIComponent(h)}/${suffix}`;
      return { app: url, web: url };
    }
  }
}

/** The memo Venmo will show, for previewing it in the UI. Empty for the others. */
export function payNote(platform: PayPlatform, tripTitle: string): string {
  return PLATFORM_SPECS[platform].supportsNote ? venmoNote(tripTitle) : "";
}

export type Handles = Partial<Record<PayPlatform, string>>;

/**
 * Which platform to use for a payment, given what the recipient has registered.
 * Preference order: what the payer last chose for this person, then the
 * recipient's own default, then their first registered handle. Null when they
 * have registered none, which is the "Paid another way" case.
 */
export function choosePlatform(handles: Handles, recipientDefault?: PayPlatform | null, payerPreference?: PayPlatform | null): PayPlatform | null {
  const has = (p?: PayPlatform | null): p is PayPlatform => !!p && !!handles[p];
  if (has(payerPreference)) return payerPreference;
  if (has(recipientDefault)) return recipientDefault;
  return PAY_PLATFORMS.find((p) => handles[p]) ?? null;
}

/** The platforms this person can actually be paid on, in display order. */
export function availablePlatforms(handles: Handles): PayPlatform[] {
  return PAY_PLATFORMS.filter((p) => !!handles[p]);
}

/**
 * A creditor's "Request from everyone" at close-out.
 *
 * Venmo's charge link carries several recipients but only ONE amount (see
 * venmoChargeLink), so batching several debts into one charge is only honest when
 * every debt is the identical figure. Anything else has to go one request at a
 * time, or somebody gets charged somebody else's balance.
 *
 * `coversAll` is false when at least one debtor has no Venmo username, so no label
 * built on this plan may say "everyone" when it doesn't mean everyone.
 */
export type VenmoRequestPlan<T> = {
  mode: "none" | "batch" | "each";
  /** The debts that can actually be requested, in the order given. */
  requests: T[];
  coversAll: boolean;
};

export function planVenmoRequests<T extends { recipient: string | null | undefined; amountCents: Cents }>(
  debts: readonly T[],
): VenmoRequestPlan<T> {
  const requests = debts.filter((d) => !!d.recipient && d.amountCents > 0);
  const coversAll = requests.length === debts.length;
  if (requests.length === 0) return { mode: "none", requests, coversAll };
  const same = requests.every((d) => d.amountCents === requests[0]!.amountCents);
  return { mode: same ? "batch" : "each", requests, coversAll };
}
