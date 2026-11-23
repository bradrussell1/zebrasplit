/**
 * The feature pages (/features/<slug>): one page per thing people search for by name
 * ("bill splitting app that scans receipts", "split rent by nights"). The same list fills the
 * Features dropdown in the nav. Plain data, no imports, so the Node test can read it.
 *
 * Rules for this file (the same as content/guides.ts):
 *  - Every product claim must already be true in the app and stated in packages/core/src/faq.ts.
 *  - title ≤ 60 characters, description 110 to 160 (test/features.test.ts).
 *  - Worked examples must match the mock on the page, which is computed by @bunktab/core.
 */
export type FeatureSection = { heading: string; paragraphs?: string[]; steps?: string[]; list?: string[] };
export type Feature = {
  slug: string;
  /** label in the nav dropdown and on the "More features" tiles */
  nav: string;
  /** one line under the label in the dropdown */
  blurb: string;
  /** <title> and the search result headline */
  title: string;
  h1: string;
  description: string;
  intro: string;
  /** which mock the hero shows, and whether the hero band is white or ink */
  visual: "receipt" | "nights" | "pay" | "currency";
  band: "white" | "ink";
  sections: FeatureSection[];
  /** ids from packages/core/src/faq.ts, shown as "Common questions" */
  faqIds: string[];
  /** slugs from content/guides.ts */
  guides: string[];
  /** ISO date the copy was last checked */
  updated: string;
};

export const features: Feature[] = [
  {
    slug: "receipt-scanning",
    nav: "Receipt scanning",
    blurb: "Snap the bill and split it by item",
    title: "Receipt scanner app: split a bill by item",
    h1: "Scan the receipt and split it by item",
    description: "Snap a photo of the bill and Zebrasplit reads every item, the tax and the total. Everyone taps what they ordered, and tax and tip are shared to match.",
    intro: "Take a photo of the bill. Zebrasplit reads each item, everyone taps what they ordered, and the tax and tip follow each person's order.",
    visual: "receipt",
    band: "white",
    sections: [
      {
        heading: "How it works",
        steps: [
          "Snap a photo of the receipt. Zebrasplit reads every item, the tax and the total.",
          "Everyone taps what they ordered. A shared plate is split between the people who had it.",
          "Add the tip in its own field, because receipts print before you write it in.",
          "Save it. The bill becomes one expense in the trip, with each person's share worked out.",
        ],
      },
      {
        heading: "How tax and tip are shared",
        paragraphs: [
          "Each person pays the same fraction of the tax and the tip as they did of the food and drink. Someone who ordered half the bill covers half the tax and half the tip.",
          "Take three people with a $100 subtotal, $8 tax and a $20 tip. The person who ordered $50 pays $64, the person who ordered $30 pays $38.40, and the person who ordered $20 pays $25.60.",
        ],
      },
      {
        heading: "When the numbers don't add up",
        paragraphs: [
          "Photos of receipts are not always clean. If the items, tax and total don't agree, Zebrasplit flags the receipt for a quick check instead of guessing, and you fix the line before anyone is charged for it.",
        ],
      },
      {
        heading: "Where it helps most",
        list: [
          "Group dinners where one person had a salad and another had the steak",
          "Bar tabs where not everyone was drinking",
          "Grocery runs where a few items were for one person",
        ],
      },
    ],
    faqIds: ["how-does-the-receipt-scan-work", "why-do-i-add-the-tip-separately", "does-the-ai-keep-my-receipt-photos", "who-can-see-my-trip-and-receipts"],
    guides: ["how-to-split-a-restaurant-bill", "split-bachelorette-party-costs"],
    updated: "2026-11-23",
  },
  {
    slug: "split-by-nights",
    nav: "Split by nights stayed",
    blurb: "Late arrivals pay for the nights they were there",
    title: "Split a vacation rental by nights stayed",
    h1: "Split the rental by who slept where",
    description: "Tap the nights each person stayed and Zebrasplit shares each night among the people who were there. Late arrivals and early leavers pay less.",
    intro: "Splitting a rental evenly stops being fair when someone arrives a day late. Tap the nights each person stayed and each night is shared by the people who slept there.",
    visual: "nights",
    band: "white",
    sections: [
      {
        heading: "How it works",
        steps: [
          "Add the rental as one expense and choose “By nights stayed”.",
          "Tap the nights each person was there.",
          "Zebrasplit divides the total across the nights, then shares each night among the people there that night.",
          "Leftover cents are handled for you, so the shares always add up to the total.",
        ],
      },
      {
        heading: "A worked example",
        paragraphs: [
          "Four friends rent a cabin for three nights at $1,200 in total, which is $400 a night. Three of them stay all three nights. The fourth arrives on the second day and stays two.",
        ],
        list: [
          "Night one: $400 between three people, $133.33 each, with the odd cent going to whoever paid for the rental",
          "Nights two and three: $400 between four people, $100 each per night",
          "The three who stayed throughout pay about $333.33 each",
          "The late arrival pays $200",
        ],
      },
      {
        heading: "Fees, deposits and the big bedroom",
        list: [
          "Cleaning and service fees cover the whole stay. Fold them into the total, or add them as their own expense if the group would rather split them evenly.",
          "If the big bedroom should cost more, split that rental by exact amounts or by shares instead of by nights.",
          "Log the full cost of the stay once, not the deposit and the balance as two separate guesses.",
        ],
      },
    ],
    faqIds: ["how-does-who-slept-where-work", "ways-to-split-a-cost", "why-only-one-or-two-payments"],
    guides: ["how-to-split-an-airbnb", "split-ski-trip-costs", "split-group-vacation-costs"],
    updated: "2026-11-23",
  },
  {
    slug: "settle-up",
    nav: "Settle up in one payment",
    blurb: "The fewest payments, in the app they use",
    title: "Settle up a group trip in one payment each",
    h1: "Settle up once, with the fewest payments",
    description: "Zebrasplit nets out every expense and works out the fewest payments that settle the group. Pay in Venmo, Cash App or PayPal with the amount filled in.",
    intro: "Zebrasplit nets out everything the group spent and works out the smallest number of payments that squares everyone. Most people pay one person, once.",
    visual: "pay",
    band: "ink",
    sections: [
      {
        heading: "How it works",
        steps: [
          "Everyone adds what they paid for during the trip.",
          "Each person taps Done when they've finished adding expenses.",
          "When everyone is done, close-out unlocks and Zebrasplit works out who pays whom.",
          "Tap a payment and it opens Venmo, Cash App or PayPal with the amount filled in.",
          "Mark it paid. The other person confirms with “Got it”, and the trip shows as settled once every payment is marked.",
        ],
      },
      {
        heading: "Why there are fewer payments",
        paragraphs: [
          "Paying back each expense on its own means money moves in circles. Say Ana owes Ben $30 for dinner and Ben owes Cal $30 for gas. Netted out, Ana pays Cal $30 and Ben pays nobody: one payment instead of two.",
          "Zebrasplit does that across the whole trip, so a week of dinners, groceries and gas usually comes down to one payment per person.",
        ],
      },
      {
        heading: "Zebrasplit never holds your money",
        paragraphs: [
          "Zebrasplit does the math and your payment app moves the money. It never holds funds and never asks for bank or card details.",
          "You only see the apps the person you owe has set up. If you paid in cash or by Zelle, mark the payment as paid another way.",
        ],
      },
    ],
    faqIds: ["why-only-one-or-two-payments", "which-payment-apps-work", "does-zebrasplit-handle-my-money", "how-do-i-know-someone-paid", "what-if-someone-never-taps-done"],
    guides: ["settle-up-with-venmo-cash-app-paypal", "splitwise-alternative", "split-group-vacation-costs"],
    updated: "2026-11-23",
  },
  {
    slug: "multi-currency",
    nav: "Any currency",
    blurb: "Add in pesos, settle in dollars",
    title: "Split trip expenses in different currencies",
    h1: "Add in pesos, settle in dollars",
    description: "Log each expense in the currency you paid in. Zebrasplit locks the exchange rate when you save and settles the whole trip in one main currency.",
    intro: "Log each expense in the currency you paid in. The exchange rate locks when you save, and the whole trip settles in one main currency.",
    visual: "currency",
    band: "white",
    sections: [
      {
        heading: "How it works",
        steps: [
          "Every trip has a main currency, which is the one the group settles in.",
          "When you add an expense, enter it in the currency you paid in.",
          "Zebrasplit locks the exchange rate when you save.",
          "Each person's share is converted to the main currency, and the trip settles up as usual.",
        ],
      },
      {
        heading: "Why the rate locks",
        paragraphs: [
          "Exchange rates move every day. If an expense kept following the rate, what each person owed would change after they had already looked at it. Locking the rate when the expense is saved means the amount you saw is the amount you settle.",
        ],
      },
      {
        heading: "A worked example",
        paragraphs: [
          "Dinner in Mexico comes to 1,840 pesos and the trip settles in US dollars. At a rate of 1 MXN = 0.0543 USD, the dinner goes into the trip as $99.91. Split four ways, that is about $24.98 each.",
        ],
      },
      {
        heading: "Where it helps most",
        list: [
          "A trip abroad where dinners are in the local currency and the flights were paid in dollars",
          "A route that crosses countries with different currencies",
          "A rental with the deposit charged in one currency and the balance in another",
        ],
      },
    ],
    faqIds: ["can-we-use-different-currencies", "ways-to-split-a-cost", "why-only-one-or-two-payments"],
    guides: ["split-group-vacation-costs", "split-bachelorette-party-costs"],
    updated: "2026-11-23",
  },
];

export const featureBySlug = (slug: string) => features.find((f) => f.slug === slug);
