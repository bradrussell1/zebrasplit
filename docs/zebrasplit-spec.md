# Zebrasplit — product spec

**Supersedes `docs/archive/checkm8-v1-spec.md`**, which describes the app as it was
designed in September 2026 under the name Checkm8. That document is kept as history;
where the two disagree, this one is right.

Written from the code and the migrations rather than from intent, so it describes
what runs. Last reconciled 19 October 2026.

---

## 1. What it is

An app for splitting the cost of a group trip. Everyone logs what they paid as the
trip goes, taps Done when they have finished, and once everyone is done the group
settles with the smallest number of payments that clears all the debts — usually one
payment each.

Zebrasplit never holds, moves or processes money, and never asks for bank or card
details. Settling means opening Venmo, Cash App or PayPal with the amount filled in;
the payment happens in that app. This is a deliberate constraint, not an interim
measure: touching other people's funds would make the product a money transmitter.

### Vocabulary

The product uses its own words, consistently, in UI and in copy:

| Word | Means |
|---|---|
| **Dazzle** | A trip. (A group of zebras is called a dazzle.) |
| **Stripe** | One person having finished adding expenses. A Dazzle shows a zebra, and each member earns a stripe when they tap Done. |
| **Close out** | The settle-up stage, unlocked when every member has a stripe. |

Internal identifiers do **not** follow the vocabulary. The database says `trips` and
`trip_members`; several infrastructure names still say `checkm8` (the `checkm8.internal`
setting, the `checkm8_internal_secret` vault entry, the `x-checkm8-secret` header), and
the iOS/Android bundle id is `com.bunktab.app`. These are deliberate: renaming them
buys nothing and risks breaking live installs.

---

## 2. Surfaces

| Surface | Where | Who it is for |
|---|---|---|
| **Mobile app** | `apps/mobile`, Expo / React Native, iOS + Android | The product |
| **Web** | `apps/web`, Next.js, `app.zebrasplit.com` | Privacy, terms and the SMS disclosure; the guest trip view was retired 2026-10-27 |
| **Marketing site** | `apps/site`, Next.js, `zebrasplit.com` | Prospects, legal pages, invite landing, feedback, admin |

"The app" means the mobile app. Taking part in a Dazzle needs the app: an invitee
installs it, signs in with the number that got the text, and accepts the invite.

Shared code lives in `packages/core` (pure logic, no I/O, tested) and
`packages/theme` (design tokens). All three apps depend on both.

---

## 3. Accounts

Identity is a **phone number**. There are two routes in, and they do not share a path —
this matters for anything that measures onboarding:

**Text-code:** landing → phone → 6-digit code → profile (name, and a payment method if
the account has none) → home.

**Sign-up:** landing → sign-up form (name, email, password, phone, payment method) →
code screen in `phone_change` mode → home. **This route never touches the profile screen.**

Google and Apple sign-in are also available. Sign in with Apple is iOS-only and is
required by Apple because Google sign-in is offered.

A payment method is **required** at onboarding on both routes. A Dazzle cannot settle
to someone nobody can pay.

Accounts can be deleted in-app (Profile → Settings → Delete account), which anonymises
the user row and clears personal fields while leaving the row in place so other
members' totals stay correct.

---

## 4. Dazzles

Created in two steps: details (title, dates, base currency, optional cover photo),
then invites. The creator is the owner and the only person who can force a close-out
or remove a member.

A Dazzle is `open`, `settled` or `archived`. Inactive Dazzles move to Past
automatically after 14 days.

### Invites

Pick people from contacts or type a number. Two paths, decided by the server:

- **Already has an account** → added to the Dazzle directly, gets a push, no text.
- **No account** → one SMS with a link to `zebrasplit.com/join/<token>`.

The invite link previews the Dazzle (names and counts only — no phones, amounts or
ids), carries store badges, and opens the app directly when it is installed, through
Universal Links / App Links claimed on `/join/*`.

Nobody joins a Dazzle without accepting the invite in the app (2026-10-27). Someone who
already has the app gets a push with the link instead of a text, and the invite also
waits under Invitations on Home; sign-in never joins a Dazzle by itself.

**Consent:** before sending, the inviter must tick a box that carries the SMS consent
itself — who is texting, that it is one message, how to stop, and that rates apply.
The wording is identical to what is filed with Twilio as opt-in proof; the two must
be edited together.

---

## 5. Expenses

Money is **integer cents everywhere**. Decimals are parsed from strings, never from
floats. An expense records who paid (one payer), the amount, an optional tip, the
category, and how it splits.

Tip is a separate field added on top of the amount, because receipts usually print
before the tip is written in.

### Categories

Travel (airfare, hotels, rentals) · Dining (restaurants, bars, delivery, catering) ·
Groceries · Alcohol · Transportation (rideshare, parking, misc) · Recreation · Other.

### Split types

| Type | Behaviour |
|---|---|
| `equal` | Evenly among the participants |
| `exact` | Hand-entered amounts that must sum to the total |
| `percent` | Percentages that must sum to 100 |
| `shares` | Weighted (a family counts as 2) |
| `nights` | Lodging: tap the nights each person stayed; each night is shared only by the people there, so late arrivals pay less |
| `itemized` | Line by line from a scanned receipt |

Leftover cents go to the payer, so the parts always sum to the whole.

Expenses can be added offline and sync when the connection returns. Any currency may
be used; the exchange rate is locked at save time and everything settles in the
Dazzle's base currency.

---

## 6. Receipt reading

Photograph a receipt and the line items, tax, tip and total are extracted, then split
item by item.

The model returns **data only — it never does arithmetic**. Every calculation lives in
`packages/core/src/receipt`, written test-first against a golden fixture and
fast-check properties.

The pipeline: upload → a database trigger calls `receipt-parse` through `pg_net` →
extraction with a first-choice model, retried once with a stronger model if the totals
do not reconcile → `ready`, `needs_review` or `failed`. Unreconciled reads land in
`needs_review` rather than being presented as correct.

Models are **configuration, not code**: `receipt_model` and `receipt_retry_model` live
in `private.config` and are swappable from the admin portal without a redeploy.
`RECEIPT_MODEL` / `RECEIPT_RETRY_MODEL` still override, for a setting that has gone
wrong. A kill switch (`receipt_ai_enabled`) and a per-person daily limit live beside
them.

Prompts and schemas are versioned files. Bump the version; never edit a shipped one.

---

## 7. Done, and closing out

Tapping Done earns a stripe and tells the group you have finished adding expenses.

**If someone adds an expense after you tapped Done, your stripe is withdrawn** and you
are asked to look again, so nobody signs off on numbers they have not seen.

Close-out unlocks when every member has a stripe. Before that the button is visible
but locked — it reads "Close out" in both states, with the count in the accessibility
label only.

Two escape hatches for a Dazzle that stalls:

- **Nudge** — one push per person per day, deduped in the database. Never a text.
- **Force close-out** — the owner only. Marks the remaining members Done, notifies
  them, and records the override on the Dazzle and in the history.

---

## 8. Settlement and payment

When the gate opens the database computes the plan with the greedy method: net every
member, largest debtor pays the largest creditor the smaller of the two amounts,
whoever reaches zero drops out, repeat. N people never need more than N−1 payments,
and one person usually owes exactly one other.

### Paying

Each payment opens **Venmo, Cash App or PayPal** with the amount pre-filled.

**The handle belongs to the recipient.** A payer is only ever offered the platforms the
person they owe has actually registered. The platform is chosen as: the payer's
recorded choice for that payment, then the recipient's own default, then their first
registered handle. The chip under a payment opens a picker listing only their
platforms, and the choice is stored so it survives a reopen.

Someone with no registered handle can only be marked **"Paid another way"** — which is
also how cash, bank transfer and Zelle are recorded.

**One link per payment.** Venmo's deep link carries several recipients but only one
amount, so differing debts cannot be batched into a single trip out to Venmo. Only
Venmo's link carries a memo; Cash App and PayPal links do not.

**Zelle is deliberately absent.** It has no public API, no developer programme and no
reliable deep link, because it lives inside each bank's own app.

A payment is marked paid by the payer and can be confirmed by the recipient. A Dazzle
is settled once every payment is marked.

---

## 9. Notifications

Push through Expo's service, with the database deciding who to notify and an Edge
Function sending. Covers: added to a Dazzle, a new expense, your stripe withdrawn,
nudges, a forced close-out, a payment marked or confirmed.

Deduped through `notification_log`. SMS is used **only** for invites to people with no
account, and for login codes through Twilio Verify.

---

## 10. After the trip

Settled Dazzles move to Past with a recap: total, cost per person, biggest expense and
who fronted the most. The recap exports as an image for the group chat.

Receipt photos are deleted when the Dazzle is deleted; media purging runs as a
scheduled Edge Function.

---

## 11. Feedback

Collected in two places, both writing through `submit_feedback` so neither caller can
set a status, attach another account or backdate a row:

- **In-app:** Settings → Send feedback. Title and description only; the address is read
  from the account server-side.
- **Web:** `zebrasplit.com/feedback`. Asks for an email, because there is no session.

---

## 12. Admin portal

`zebrasplit.com/admin`, linked quietly in the site footer.

Signing in is ordinary Supabase Auth. Being an admin is a row in `private.admins`,
checked by `public.is_admin()`. **Every read goes through a security-definer function
whose first act is that check**, so the page holds no privileges of its own — a
non-admin who signs in sees an empty portal, not a leak. There is no second credential
system and no password in the repository.

Tabs: Overview · Users · Welcome wizard (onboarding funnel with drop-off) · Models
(swap the receipt models, see cost and correction rate) · Integrations · Feedback ·
Data (Dazzles, categories, split types).

### Analytics

First-party only, in `client_events`. No third-party tracker, which is what keeps the
App Store privacy labels and Play Data safety answers true as written.

Onboarding events carry an `anon_id` — one random id per install, not derived from the
device, never attached to a signed-in event, and cleared when an account is deleted —
because onboarding happens before there is a session.

---

## 13. Data model

`users` · `trips` · `trip_members` · `invites` · `expenses` · `expense_payers` ·
`expense_shares` · `expense_history` · `comments` · `settlements` · `payment_handles` ·
`receipts` · `receipt_items` · `receipt_charges` · `receipt_item_claims` · `devices` ·
`notification_log` · `client_events` · `feedback`

Private schema: `private.config` (settings), `private.admins`.

Notes worth knowing:

- `users.first_name` / `last_name` are the source; `display_name` is kept composed by a
  trigger, so readers use `display_name`.
- `users.venmo_username` is a legacy mirror kept in step with the `venmo` row in
  `payment_handles` by a trigger, for older readers.
- `expense_history` holds trip-level events too, so `expense_id` is nullable.

### Security

Row-level security on every table, scoped to Dazzle membership. Money-changing writes
that need cross-row checks go through RPCs rather than direct inserts. An RLS audit
harness lives at `scripts/rls-audit.mjs`.

---

## 14. Infrastructure

| Piece | Where |
|---|---|
| Database, auth, storage, Edge Functions | Supabase (`qywowvkkkxldgxoatdsh`) |
| Mobile builds and submissions | EAS / Expo |
| Web and site | Vercel |
| SMS — login codes | Twilio Verify |
| SMS — invites | Twilio Messaging Service, toll-free |
| Receipt reading | Anthropic API, from Edge Functions only |
| Errors | Sentry, `sendDefaultPii: false`, scrubbing numbers and amounts |

Edge Functions: `send-invite` · `push` · `receipt-parse` · `receipt-save` ·
`reset-otp` · `purge-trip-media` · `revenuecat-webhook`.

Secrets live in Supabase secrets and CI secrets — never in the repository and never in
the app bundle.

---

## 15. What changed since the v1 spec

Recorded because the old document is still internally consistent, which makes it
easy to trust by accident.

| Area | v1 said | Now |
|---|---|---|
| Name | Checkm8, `check-m8.io` | Zebrasplit, `zebrasplit.com` |
| Vocabulary | Trip, Done | Dazzle, stripes |
| Design | Basalt & Spore, then Dusk & Pastel, then Gold & Navy | Zebrasplit design system, light only, volt + pink on ink |
| Settling | Venmo only | Venmo, Cash App or PayPal, chosen per recipient |
| Splits | Five types | Six — `itemized` added with receipt reading |
| Receipts | Total extraction only | Full line-item extraction and item-by-item splitting |
| Invite links | `/i/<token>` to the guest view | `/join/<token>`, which opens the app through Universal Links |
| Feedback | — | In-app and web |
| Admin | — | Portal at `/admin` |
| Analytics | — | First-party `client_events` with an onboarding funnel |
| Entity | — | Sole proprietor: Bradley Russell, doing business as Zebrasplit |

---

## 16. Known gaps

Honest list, current as of this writing:

- **Android push does not work.** There is no `google-services.json` and no FCM V1
  credential on EAS, so nudges and close-out notifications silently do nothing there.
- **`assetlinks.json` carries only the upload key.** Play App Signing re-signs with
  Google's certificate, so App Links will not verify for a Play-installed app until
  that fingerprint is added.
- **Twilio toll-free verification is not yet approved.** Until it is, US carriers block
  invite texts to people without an account.
- **The onboarding funnel records nothing until a build ships with the instrumentation.**
- **The close-out payment flow has never been exercised on real hardware** — only on a
  simulator.
- The guest view's expense tiles still show two-letter category codes.
