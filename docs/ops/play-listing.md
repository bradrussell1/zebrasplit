# Google Play store listing

Copy for the Play Console listing, adapted from the App Store text in
`apps/mobile/store.config.json`. Play's limits differ from Apple's: a short
description of 80 characters, a full description of 4000, and no keyword field
(Play indexes the descriptions instead, so the terms have to appear in the prose).

## App name (30 max)

```
Zebrasplit
```

## Short description (80 max)

```
Split the trip, see who paid, then settle up in one payment each.
```

65 characters.

## Full description (4000 max)

```
Zebrasplit is the expense sharing app without the confusion and hassle of leading competitors.

Split the trip or expense, track who paid for what, know exactly when everyone is done, then settle the whole thing with a single payment each.

HOW IT WORKS

1. Start a trip and invite your people from your contacts or by phone number.
2. Everyone logs what they paid as they go.
3. Each person taps Done when they've finished adding expenses.
4. Once everyone is Done, Zebrasplit works out the fewest payments that settle the group and opens Venmo, Cash App or PayPal with the amount already filled in.

SPLIT IT HOWEVER IT ACTUALLY HAPPENED

• Evenly, by exact amounts, by percentage or by shares
• By nights stayed, so people who arrive late pay less automatically
• Item by item from a photo of the receipt
• In any currency, with the exchange rate locked in when you save

NO MORE "IS EVERYONE DONE?"

Every trip shows a zebra, and each person earns a stripe when they've finished adding their expenses. When the zebra has all its stripes, the group settles up. Nudge anyone who's holding things up, and if someone never responds, the trip owner can close it out anyway.

ONE PAYMENT EACH, NOT FIVE

Instead of six people paying six people, Zebrasplit works out the smallest set of payments that settles everyone, so you usually pay one person once. Tap Pay and Venmo, Cash App or PayPal opens with the amount ready to send.

Zebrasplit never touches your money. It never holds funds, never processes a payment and never asks for bank or card details. Paying another way — cash, Zelle, a bank transfer — works fine too; just mark the payment as paid.

FRIENDS DON'T NEED THE APP

Anyone you invite gets a text with a link. They can open it in a browser, verify their number, add expenses and tap Done without installing anything.

AFTER THE TRIP

Settled trips move to Past with a recap: the total, cost per person, the biggest expense and who fronted the most. Export it as an image for the group chat.

FREE

Everything described here is free.
```

Play renders `•` bullets but not Markdown, hence the plain characters.

## Graphics

| Asset | Size | File |
|---|---|---|
| App icon | 512 × 512 | `design/play/icon-512.png` |
| Feature graphic | 1024 × 500 | `design/play/feature-1024x500.png` |
| Phone screenshots | 2–8, min 320px, 16:9 or 9:16 | reuse `apps/mobile/screenshots/en-US/` (1320 × 2868 is accepted) |

The feature graphic's wordmark is **not** set in Figtree — see the note in
`scripts/make-play-assets.mjs`. Reset those two lines before publishing.

## Other listing fields

- **Category:** Finance
- **Tags:** budgeting, expense tracking
- **Contact email:** support@zebrasplit.com
- **Website:** https://zebrasplit.com
- **Privacy policy:** https://zebrasplit.com/privacy

## Data safety

Play's Data safety form asks the same questions as Apple's App Privacy labels,
in a different shape. Use `docs/ops/app-privacy-labels.md` as the source, with
these mappings:

| Apple label | Play Data safety |
|---|---|
| Name, Email, Phone Number | Personal info → Name, Email address, Phone number |
| Other User Contact Info (payment handle) | Personal info → Other info |
| Other Financial Info | Financial info → Other financial info |
| Contacts | Contacts → Contacts |
| Photos or Videos | Photos and videos → Photos |
| Other User Content | App info and performance → Other user-generated content |
| User ID, Device ID | Personal info → User IDs; Device or other IDs |
| Crash Data, Performance Data | App info and performance → Crash logs, Diagnostics |

Answer, for every type: **collected = yes**, **shared = no**, **processed
ephemerally = no**, **user can request deletion = yes** (Profile → Settings →
Delete account). Play also asks whether collection is **required or optional**;
email, contacts and photos are optional, the rest are required.

**Say no to Payment info.** Zebrasplit never collects card or bank details; the
Pay button hands off to another app.

## Content rating

An IARC questionnaire, not a free-text form. Zebrasplit is a utility with no
violence, no user-to-user messaging beyond expense comments, no gambling and no
ads. That lands it at **Everyone / PEGI 3**. Answer the "does your app let users
communicate?" question honestly: expenses carry comments, which is user-to-user
text, so declare it.
