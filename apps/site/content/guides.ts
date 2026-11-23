/**
 * The guides: pages written for what people search before a group trip ("how to split an
 * Airbnb", "Splitwise alternative"). Plain data, no imports, so the Node test can read it.
 *
 * Rules for this file:
 *  - Every product claim must already be true in the app and stated in packages/core/src/faq.ts.
 *  - Claims about another app are limited to what its own pricing page states, dated, and never
 *    a specific number that goes stale.
 *  - title ≤ 60 characters, description 110 to 160 (test/guides.test.ts).
 */
export type GuideSection = { heading: string; paragraphs?: string[]; steps?: string[]; list?: string[] };
export type Guide = {
  slug: string;
  kind: "How-to" | "Trip guide" | "Compare";
  /** <title> and the search result headline */
  title: string;
  h1: string;
  description: string;
  intro: string;
  sections: GuideSection[];
  /** ids from packages/core/src/faq.ts, shown as "Common questions" */
  faqIds: string[];
  related: string[];
  /** ISO date the copy was last checked */
  updated: string;
};

export const guides: Guide[] = [
  {
    slug: "how-to-split-an-airbnb",
    kind: "How-to",
    title: "How to split an Airbnb when people stay different nights",
    h1: "How to split an Airbnb fairly",
    description: "Split a rental by nights stayed so late arrivals and early leavers pay for the nights they were there. A worked example and the quick way to do it.",
    intro: "Splitting a rental evenly is easy until someone arrives Saturday or leaves a day early. The fair answer is to split each night among the people who slept there that night.",
    sections: [
      {
        heading: "The fair method: split by night",
        paragraphs: [
          "Divide the total by the number of nights to get the cost of one night. Then share each night among the people who stayed that night. Add up each person's nights and you have their share.",
          "Cleaning and service fees are for the whole stay, so most groups fold them into the total before dividing. If your group would rather split those evenly, enter them as their own expense.",
        ],
      },
      {
        heading: "A worked example",
        paragraphs: [
          "Four friends rent a cabin for three nights at $1,200 in total, which is $400 a night. Three of them stay all three nights. The fourth arrives on the second day and stays two.",
        ],
        list: [
          "Night one: $400 between three people, $133.33 each (the odd cent goes to one person)",
          "Nights two and three: $400 between four people, $100 each per night",
          "The three who stayed throughout pay about $333.33 each",
          "The late arrival pays $200",
        ],
      },
      {
        heading: "The quick way in Zebrasplit",
        steps: [
          "Add the rental as one expense and choose “By nights stayed”.",
          "Tap the nights each person was there.",
          "Zebrasplit shares each night among the people there that night and handles the leftover cents.",
          "When everyone has tapped Done, settle up in Venmo, Cash App or PayPal.",
        ],
      },
      {
        heading: "Things groups argue about",
        list: [
          "The big bedroom: agree up front whether it costs more. If it does, use exact amounts or shares instead of nights.",
          "Couples sharing a room: count each person, not each room, unless the group agrees otherwise.",
          "The deposit: whoever booked fronted it. Log the full cost once the stay is over, not the deposit and the balance as two guesses.",
        ],
      },
    ],
    faqIds: ["how-does-who-slept-where-work", "ways-to-split-a-cost", "why-only-one-or-two-payments"],
    related: ["split-group-vacation-costs", "split-ski-trip-costs", "how-to-split-a-restaurant-bill"],
    updated: "2026-11-23",
  },
  {
    slug: "how-to-split-a-restaurant-bill",
    kind: "How-to",
    title: "How to split a restaurant bill by item, with tax and tip",
    h1: "How to split a restaurant bill by item",
    description: "Split a group dinner by what each person ordered, with tax and tip shared in proportion. The maths, a worked example, and how to do it from a photo.",
    intro: "Splitting evenly is fine when everyone ordered about the same. When one person had a salad and another had the steak and three cocktails, split by item.",
    sections: [
      {
        heading: "The maths",
        steps: [
          "Add up what each person ordered. Shared plates are divided among the people who shared them.",
          "Work out each person's fraction of the food and drink subtotal.",
          "Give each person that same fraction of the tax and of the tip.",
        ],
        paragraphs: ["Sharing tax and tip in proportion means the person who spent more also covers more of both, which is what most groups consider fair."],
      },
      {
        heading: "A worked example",
        paragraphs: ["Three people, a $100 subtotal, $8 tax and a $20 tip, so $128 in total."],
        list: [
          "Ana ordered $50 of the $100, so she pays half of everything: $64",
          "Ben ordered $30, so he pays 30%: $38.40",
          "Cal ordered $20, so he pays 20%: $25.60",
        ],
      },
      {
        heading: "The quick way in Zebrasplit",
        steps: [
          "Snap a photo of the receipt. Zebrasplit reads every item, the tax and the total.",
          "Add the tip in its own field, since receipts usually print before the tip is written in.",
          "Everyone taps what they ordered.",
          "Tax and tip are shared to match, and anything that doesn't add up is flagged for a quick check.",
        ],
      },
      {
        heading: "When an even split is the better call",
        paragraphs: ["If the orders were close, or the group agreed to split evenly before ordering, don't itemize. The point is that nobody feels short-changed, not that every cent is traced."],
      },
    ],
    faqIds: ["how-does-the-receipt-scan-work", "why-do-i-add-the-tip-separately", "ways-to-split-a-cost"],
    related: ["how-to-split-an-airbnb", "split-bachelorette-party-costs", "split-group-vacation-costs"],
    updated: "2026-11-23",
  },
  {
    slug: "split-group-vacation-costs",
    kind: "Trip guide",
    title: "How to split group vacation costs without the awkwardness",
    h1: "How to split group vacation costs",
    description: "A simple system for group trip money: agree the rules first, log every expense as it happens, and settle once at the end with the fewest payments.",
    intro: "Group trips go wrong on money for two reasons: nobody agreed the rules, and nobody knows when the tab is final. Fix both and the rest is arithmetic.",
    sections: [
      {
        heading: "Before the trip: agree three things",
        list: [
          "What is shared (lodging, groceries, the rental car) and what is personal (souvenirs, a solo spa day).",
          "How lodging is split: evenly, or by nights stayed if people arrive and leave on different days.",
          "How you will settle: once at the end, not a stream of small requests during the trip.",
        ],
      },
      {
        heading: "During the trip: log it when you pay",
        paragraphs: [
          "Whoever pays logs the expense on the spot, with who it was for. Leaving it to the flight home is how receipts get lost and totals get disputed.",
          "Not every cost is for everyone. Split dinner by item if orders were uneven, and leave people off an activity they skipped.",
        ],
      },
      {
        heading: "After the trip: settle once",
        paragraphs: [
          "Wait until everyone has added their expenses, then net everything out. Netting means that if you owe Sam $40 and Sam owes you $25, one $15 payment covers it. Done across a whole group, most people end up paying one person, once.",
        ],
      },
      {
        heading: "How Zebrasplit handles it",
        steps: [
          "Create the trip and invite the group by text.",
          "Everyone logs what they paid: evenly, by item from a receipt photo, by exact amounts, percentages, shares or nights stayed.",
          "Each person taps Done when they've finished, and their zebra earns its stripes. One glance shows who the group is waiting on.",
          "When every zebra is striped, Zebrasplit works out the smallest number of payments and opens Venmo, Cash App or PayPal for each one.",
        ],
      },
    ],
    faqIds: ["what-does-tapping-done-do", "what-if-someone-never-taps-done", "can-we-use-different-currencies", "is-zebrasplit-free"],
    related: ["how-to-split-an-airbnb", "how-to-split-a-restaurant-bill", "splitwise-alternative"],
    updated: "2026-11-23",
  },
  {
    slug: "split-bachelorette-party-costs",
    kind: "Trip guide",
    title: "How to split bachelorette party costs (and cover the bride)",
    h1: "How to split bachelorette party costs",
    description: "Who pays for what on a bachelorette trip, how to cover the bride's share fairly, and how to settle the whole weekend in one payment each.",
    intro: "A bachelorette weekend has a house, a dozen dinners, matching outfits and one person who usually isn't paying. Decide how the bride's share is covered before anyone books anything.",
    sections: [
      {
        heading: "Who usually pays for what",
        list: [
          "Each guest pays their own travel.",
          "Lodging, groceries, decorations and group activities are shared.",
          "The bride's share of the shared costs is often covered by the group. That is a custom, not a rule, so ask the group rather than assume.",
        ],
      },
      {
        heading: "How to cover the bride's share",
        paragraphs: [
          "The clean way is to leave the bride out of the split on the costs the group is covering. Her share is then spread across everyone else automatically, and nobody has to calculate a top-up.",
          "If the group is only covering some things, such as dinner on the last night but not the house, leave her out of just those expenses.",
        ],
      },
      {
        heading: "Set a budget before booking",
        paragraphs: ["Share a rough per-person number before the house is booked. People have very different budgets, and it is far easier to say so before a deposit is paid than after."],
      },
      {
        heading: "Settling the weekend in Zebrasplit",
        steps: [
          "Create the trip and text the invite to the group.",
          "Log each expense as it happens, and leave the bride off the ones the group is covering.",
          "Split the house by nights stayed if some guests come for one night only.",
          "When everyone has tapped Done, each person makes one payment in Venmo, Cash App or PayPal.",
        ],
      },
    ],
    faqIds: ["ways-to-split-a-cost", "how-does-who-slept-where-work", "which-payment-apps-work"],
    related: ["how-to-split-a-restaurant-bill", "how-to-split-an-airbnb", "split-group-vacation-costs"],
    updated: "2026-11-23",
  },
  {
    slug: "split-ski-trip-costs",
    kind: "Trip guide",
    title: "How to split ski trip costs: cabin, gas, groceries, gear",
    h1: "How to split ski trip costs",
    description: "Ski trips have a shared cabin, carpools and people who arrive on different days. How to split each cost fairly, even with no signal on the mountain.",
    intro: "A ski weekend mixes costs that are for everyone with costs that are for a few. Split each one among the people it was actually for.",
    sections: [
      {
        heading: "Split each cost its own way",
        list: [
          "Cabin: by nights stayed, since someone always drives up a day late.",
          "Gas and parking: among the people in that car, not the whole group.",
          "Groceries: evenly among everyone eating at the cabin.",
          "Lift tickets, rentals and lessons: personal. If one person bought them for the group, log each ticket to the person who used it.",
        ],
      },
      {
        heading: "No signal is normal",
        paragraphs: ["Mountain towns and cabins often have no service. Log expenses anyway. In Zebrasplit they are saved on your phone and sync when you are back online."],
      },
      {
        heading: "Crossing a border",
        paragraphs: ["Skiing in Canada or Europe means two currencies. Log each expense in the currency you paid in. The exchange rate locks when you save it, and everything settles in the trip's main currency."],
      },
      {
        heading: "Settle on the drive home",
        steps: [
          "Everyone finishes adding expenses and taps Done.",
          "Zebrasplit nets the whole trip out to the fewest payments.",
          "Each person pays in Venmo, Cash App or PayPal, usually once.",
        ],
      },
    ],
    faqIds: ["can-i-add-expenses-with-no-signal", "can-we-use-different-currencies", "how-does-who-slept-where-work"],
    related: ["how-to-split-an-airbnb", "split-group-vacation-costs", "how-to-split-a-restaurant-bill"],
    updated: "2026-11-23",
  },
  {
    slug: "splitwise-alternative",
    kind: "Compare",
    title: "A free Splitwise alternative for trips, with no daily limit",
    h1: "A free Splitwise alternative, built for trips",
    description: "Zebrasplit is a free Splitwise alternative for group trips: no daily expense limit, receipt scanning and currencies included, one payment each at the end.",
    intro: "Splitwise is a good general-purpose ledger. If what you need is to get one trip logged and settled without hitting a limit on day one, Zebrasplit is built for exactly that.",
    sections: [
      {
        heading: "Why people look for an alternative",
        paragraphs: [
          "At the time of writing, Splitwise's free plan limits how many expenses you can add in a day, and its pricing page lists receipt scanning, itemization and currency conversion as Pro features. A normal travel day is tacos, a rideshare, a boat rental, groceries and dinner, so a trip runs into that limit quickly.",
          "Check Splitwise's own pricing page for the current details, since plans change.",
        ],
      },
      {
        heading: "What is free in Zebrasplit",
        list: [
          "Unlimited expenses, with no daily cap",
          "Receipt scanning and splitting by item, with tax and tip shared to match",
          "Any currency, with the exchange rate locked when you save",
          "Splitting lodging by nights stayed",
          "Offline entry that syncs when you are back online",
          "Settling up with the fewest payments, in Venmo, Cash App or PayPal",
          "The only purchases are optional outfits for your zebra avatar, which are decoration and change nothing about the split",
        ],
      },
      {
        heading: "What is different about how it works",
        paragraphs: [
          "Zebrasplit is organized around a trip with an end. Each person taps Done when they have finished adding expenses, and their zebra earns its stripes. When every zebra is striped, the group settles once, so nobody pays early and then gets a second request.",
          "Zebrasplit never holds your money. It does the maths and opens your payment app with the amount filled in.",
        ],
      },
      {
        heading: "When Splitwise is the better fit",
        paragraphs: ["Zebrasplit is made for trips and events, not for a household ledger that runs for years. For ongoing rent and utilities with roommates, a running-balance app such as Splitwise suits that better."],
      },
    ],
    faqIds: ["is-there-a-limit", "is-zebrasplit-free", "does-zebrasplit-handle-my-money", "do-outfits-cost-real-money"],
    related: ["split-group-vacation-costs", "how-to-split-a-restaurant-bill", "how-to-split-an-airbnb"],
    updated: "2026-11-23",
  },
  {
    slug: "settle-up-with-venmo-cash-app-paypal",
    kind: "How-to",
    title: "How to settle up a group trip in Venmo, Cash App or PayPal",
    h1: "How to settle up a group trip",
    description: "Turn a trip's worth of expenses into the fewest payments, then pay each one in Venmo, Cash App or PayPal. How netting works, with an example.",
    intro: "Paying back every expense one by one means dozens of small transfers. Net the trip out first and most people pay one person, once.",
    sections: [
      {
        heading: "Net first, then pay",
        paragraphs: [
          "Add up what each person paid and what each person's share was. The difference is their balance: positive means they are owed, negative means they owe. Then match the people who owe with the people who are owed.",
        ],
      },
      {
        heading: "A worked example",
        paragraphs: ["Three friends spend $600 between them, so each share is $200."],
        list: [
          "Ana paid $350, so she is owed $150",
          "Ben paid $200, so he is square",
          "Cal paid $50, so he owes $150",
          "One payment settles the trip: Cal pays Ana $150",
        ],
      },
      {
        heading: "Wait until the tab is final",
        paragraphs: ["Settling before everyone has added their expenses means a second round of payments. Agree that nobody pays until everyone says they are done."],
      },
      {
        heading: "How it works in Zebrasplit",
        steps: [
          "Everyone taps Done when they have finished adding expenses.",
          "Zebrasplit works out the smallest number of payments that settles the group.",
          "Each payment opens Venmo, Cash App or PayPal, whichever the person you owe has set up.",
          "Paid in cash or Zelle? Mark it paid another way. The trip shows as settled once every payment is marked.",
        ],
      },
    ],
    faqIds: ["why-only-one-or-two-payments", "which-payment-apps-work", "can-i-pay-people-on-different-apps", "how-do-i-know-someone-paid"],
    related: ["split-group-vacation-costs", "how-to-split-a-restaurant-bill", "splitwise-alternative"],
    updated: "2026-11-23",
  },
];

export const guideBySlug = (slug: string) => guides.find((g) => g.slug === slug);
