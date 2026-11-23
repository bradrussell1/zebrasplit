/**
 * The numbers behind the two feature-page mocks that have no homepage twin. The mocks run these
 * through @bunktab/core and throw at build time if the result differs from `expected`;
 * test/features.test.ts checks the page copy against `expected`. So the worked example, the
 * picture and the app can't drift apart. Plain data, no imports.
 * Ids are friend ids from content/herd.ts. Money is integer cents.
 */
export const NIGHTS_EXAMPLE = {
  label: "Cabin rental",
  amountCents: 120000,
  nights: 3,
  nightLabels: ["Fri", "Sat", "Sun"],
  payer: "you",
  people: [
    { id: "you", stayed: [true, true, true] },
    { id: "priya", stayed: [true, true, true] },
    { id: "mike", stayed: [true, true, true] },
    { id: "jess", stayed: [false, true, true] },
  ],
  /** what the lodging engine must return; the mock throws at build time if it doesn't */
  expected: { you: 33334, priya: 33333, mike: 33333, jess: 20000 },
} as const;

export const CURRENCY_EXAMPLE = {
  label: "Dinner, Mariscos El Faro",
  /** 1,840.00 pesos */
  amountCents: 184000,
  currency: "MXN",
  base: "USD",
  /** an example rate, base per one unit of the expense currency */
  rate: 0.0543,
  people: ["you", "priya", "mike", "jess"],
  /** what the conversion must return; the mock throws at build time if it doesn't */
  expected: { baseCents: 9991, shares: [2498, 2498, 2498, 2497] },
} as const;
