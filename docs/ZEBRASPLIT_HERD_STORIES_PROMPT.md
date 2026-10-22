# Zebrasplit: the herd, the wardrobe, Trip Story, sharing and Wrapped: one combined build prompt for Claude Code

**How to use:** copy this pack's `design/` folder into the repo root (it merges with the reskin and receipt packs), commit it, then paste everything below the line into Claude Code at the repo root.

This prompt **replaces `STORIES_BUILD_PROMPT.md`**. It merges that prompt with the herd and wardrobe design. Where the two disagreed, the decision is recorded in section A, and this prompt wins.

---

You're adding a large set of features to Zebrasplit, a group-trip expense app:
- Expo / React Native in `apps/mobile`
- web guest view in `apps/web`
- marketing site in `apps/site`
- shared logic in `packages/core`
- tokens in `packages/theme`
- Supabase backend

Read this whole prompt before writing code. Work on a new branch, `feat/herd-wardrobe-stories`, in the phases below, and commit per phase. Don't push or open a PR until asked.

**What you're building, in order:**
1. **Zebra system v2:** one zebra per member (a herd), an outfit layer system with 3 slots and a 32-item launch wardrobe, and the Pasture scene.
2. **Herd screens:** the trip page with the herd in a field, the herd page, the tap-a-zebra sheet, and herd cards on Home.
3. **Home and Account:** a new Home header and drop banner, a tabbed Account screen, the Zebra tab wardrobe, the Shop, in-app purchases, gifting and earned items.
4. **Trip Story:** five chapters, with awards and an animated tale.
5. **Share exports** (Instagram PNG, TikTok MP4) and the logo animation.
6. **Year-end Wrapped.**

---

## A. Decisions that override older docs (read first)

The design work moved on after the stories prompt and the reskin pack were written. These rules win over every older doc and board:

| # | Topic | Old (don't build) | Build this |
|---|---|---|---|
| A1 | Stripes | One zebra per trip with one stripe per member (DESIGN_SYSTEM §7–8, `Stripes.dc.html`) | **One zebra per member.** Each starts plain (ghost stripes) and becomes fully striped (body, neck and legs) when that person taps Done. When the whole herd is striped, close-out unlocks. |
| A2 | Outfit slots | 4 slots: eyewear, head, top, neck | **3 slots, one item each: `head`, `faceneck`, `body`.** Glasses OR a chain, never both. |
| A3 | Outfit prop | `outfit={{eyewear, head, top, neck}}` | `outfit={{ head?, faceneck?, body? }}` |
| A4 | Catalog | 16 items (bucket hat, veil, round glasses…) | **The 32-item launch wardrobe** in B3 (your 23, plus the Crown, plus the Jersey pack's 4 jerseys and 4 caps) |
| A5 | Wardrobe tabs | Eyewear / Clothing / Accessories | **Head / Face & neck / Body** |
| A6 | Outfit art | "Redraw each item on the master geometry" | **Already drawn:** port `design/zebra/outfits/*.svg` and follow `manifest.json` |
| A7 | Hoodie | Not specified | **Wearing the hoodie puts the hood up and hides the head-slot item.** Ears poke out. The hat comes back when the hoodie comes off. |
| A8 | Account tab | Profile card has an "Edit your zebra" link | **No link.** The Zebra tab covers it. |
| A9 | Account boards | `stories/_superseded/Account.dc.html`, `AccountZebra.dc.html` | `herd/Account.dc.html` (Account tab) and `herd/Closet.dc.html` (Zebra tab) |
| A10 | Pasture rows | "Two rows" | **Up to 4 zebras: 1 row. 5–8: 2 rows. 9–12: 3 rows.** Back rows are smaller and higher, offset half a step. Colors from the stories tokens (section 9). |
| A10b | Herds over 12 | "Show 12 + more" | A dazzle can have any number of members, but **at most 12 zebras are drawn**: you, plus 11 others **reshuffled every time the app comes to the foreground** (cold start or return from background), plus a "+N more" chip. The status row and the herd page always count and list everyone. |
| A11 | Home trip cards | Stripe meter (reskin) | **Mini herd:** a row of member busts in their outfits. Members not done are faded to 40% with a dashed ring; done members are full opacity with a small ink check. Busts can't show body stripes, so the fade carries "not done". |
| A12 | Earn your stripes screen | A separate single-zebra screen | **Merged into the trip herd.** The herd field is the Done gate. Close-out opens the payments list (existing close-out logic and Venmo flow are unchanged). |
| A13 | Token location | `src/theme` (reskin) | `packages/theme`. Keep one source; re-export it if the app imports from elsewhere. |
| A14 | Charts | Ink bars only (reskin and receipt Summary tab) | The category palette (section 9) is allowed **on charts and nowhere else, ever**: chart bars, segments and their legend swatches in Story, Wrapped and the dazzle Summary tab. Never on buttons, pills, text, backgrounds or outfits. Add a lint rule that fails if a `theme.chart.*` token is used outside `src/ui/charts/`. Document it in DESIGN_SYSTEM.md. |
| A15 | Buying | Shop only (stories) vs. inside the Zebra tab (herd) | **Both, with one shared `PurchaseSheet`.** The Zebra tab is your wardrobe (everything, owned or not, with try-on and equip). The Shop is the storefront (drops, packs, gifting, full catalog). Either one opens the same sheet. |
| A16 | Gifting | Missing from the stories prompt text (but the Shop board has a Gift tab) | **In scope, kept simple:** "Gift it" in the PurchaseSheet, then pick **one or more** members of your dazzles (or "Whole herd"), then pay once, then each recipient gets an unwrap moment. **Only members with a Zebrasplit account can receive gifts**; guests show greyed out with "Can get gifts after they join". This is how packs get bought for a whole group. |
| A17 | Drops | Drop banner with "cocoa mug" copy | **Build the banner and `drops` table, ship it switched off.** No drop content at launch. |
| A18 | TikTok MP4 and logo animation | Build now vs. wait on cost approval | **Build both fully, keep them reserved:** behind remote flags `share_tiktok_mp4` and `logo_animation`, both off. Nothing user-visible until turned on. |

## B. Sources of truth

**Precedence, highest first:**
1. Section A of this prompt.
2. `design/zebra/` masters, `design/zebra/outfits/*.svg` and `manifest.json`.
3. `design/reference/herd/*.dc.html`.
4. `design/reference/stories/*.dc.html`.
5. `design/DESIGN_SYSTEM.md` and `design/tokens.ts` (update these in Phase 1).
6. The product spec in `docs/`.

**Reading the boards.** The boards come from a design tool. They're readable HTML with inline styles, but their `{{holes}}`, `<sc-for>`, `<sc-if>`, `<x-dc>`, `<dc-import>` and `<script type="text/x-dc">` are tool syntax. Read them for layout, copy, interaction and timing, then translate them to React Native. Each board's `Component` class shows the intended state logic. Map every color to a token; no raw hex.

**Stand-in zebras.** The stories boards draw zebras through `<dc-import name="Zebra">` (`stories/Zebra.dc.html`, `ZebraFull.dc.html`). **Don't port them.** Use the real Zebra component everywhere.

### B1. Board → screen map

| Board | Screen |
|---|---|
| `herd/Herd-System.dc.html` | Rules sheet: herd, layouts 2–12, slots, launch wardrobe, mood check (not a screen) |
| `herd/Trip-Herd.dc.html` | Dazzle page with the herd field |
| `herd/Herd.dc.html` | The herd page |
| `herd/Account.dc.html` | Account, Account tab |
| `herd/Closet.dc.html` | Account, Zebra tab (wardrobe, try-on, buy, gift) |
| `stories/Main.dc.html` | Home (header, drop banner, cards; use A11 for cards) |
| `stories/Shop.dc.html` | Shop (catalog per B3) |
| `stories/Story1`–`Story5.dc.html` | Trip Story chapters 1–5 |
| `stories/ShareIG.dc.html`, `ShareTikTok.dc.html` | Share exports |
| `stories/LogoAnim.dc.html` | Logo animation |
| `stories/Wrapped1`–`4.dc.html`, `WrappedShare.dc.html` | Wrapped |
| `stories/_superseded/*`, `stories/Zebra*.dc.html` | **Don't port** |

### B2. The zebra

Extend the existing `<Zebra>` component (`src/ui/zebra/`); don't fork it.
- **Forms:** `variant="full"` wherever there's room (herd field, closet stage, logo animation, tale, Wrapped hero, Pasture). `variant="bust"` where it's tight (Home cards, award cards, payment rows, wardrobe tiles, badges, avatars).
- **New props:** `striped: boolean` (replaces members/done for a single zebra; animate the change), `outfit={{head, faceneck, body}}`, and `mood` (unchanged, 7 moods).
- **Mood rule per zebra:**
  - **Your zebra:** worried when you owe on this dazzle, happy when you're owed, hi otherwise.
  - **Others:** hi while adding, happy once Done.
  - **Herd complete:** everyone starry.
  - **Payment lands:** payer and payee are love for 2 s.
  - Put all of this in `zebraMoodFor()` with tests.
- **Stripes still mean Done, never money.** In story, Wrapped and logo scenes every zebra is striped.
- **Outfit layers:** port each `design/zebra/outfits/<id>.svg` as a layer component in master coordinates (full viewBox `0 -8 320 330`; the bust is the same space cropped to `30 -8 200 208`). Draw order, from `manifest.json`:
  1. body fill and stripes
  2. **torso items**, clipped to the body path (full) or the neck path (bust)
  3. body outline
  4. skirt
  5. head and mood
  6. **hood** (hoodie only)
  7. throat items
  8. face items
  9. head items (skipped while the hoodie is worn)
- **Outfit rules** (enforce in code and in review):
  - Lens tint is 55% at most, so the eyes (the mood) read.
  - Torso items cover the chest only, so the striped barrel always shows.
  - Mood extras (z's, sweat drop, sparkles) draw above outfits.
  - Brand palette only.
  - Outline stroke scales up at small sizes (3.5 at 320 px, 5–8 at herd size).
- **Accessibility label:** "Priya's zebra, done, wearing a tiara and heart shades, happy".

### B3. Launch wardrobe (32 items, decided)

Prices are final but **live in config** (the `cosmetics` and `cosmetic_packs` rows), never in code.

| Slot | Free (6) | Earned (3) | $0.99 each |
|---|---|---|---|
| **Head (12)** | Pink beanie (`beanie`), Joker hat | Yellow cap (`cap`), Party hat, Tiara | Crown, Flat brim hat, Mohawk, Blue / Green / Purple / Red cap |
| **Face & neck (9)** | Glasses, Sunglasses | | Spectacles, Star shades, Heart shades, Ski goggles, Gold chain, Lei, Bride sash |
| **Body (11)** | Zebra tee, Scarf | | Hoodie, Flannel, Suit and tie, Skirt, Jersey (pink), Blue / Green / Purple / Red jersey |

- **Every individual paid item is $0.99**, including items that are also in a pack.
- **Free items** are owned by every new account.
- **Earned items** cannot be bought on their own:

  | Rule id | Earns | Trigger |
  |---|---|---|
  | `first_trip` | **Yellow cap** | The first dazzle or group expense the user is part of gets settled |
  | `trips_5` | **Party hat** | Five settled dazzles or group expenses |
  | `first_gift` | **Tiara** | The user's first gift is delivered (server-verified). The tiara also comes in the Bachelorette pack. |

  Evaluate earn rules server-side on settle and on gift delivery.
- **Packs, $2.99 each:**
  - **Bachelorette pack:** Bride sash, Skirt, Tiara.
  - **Jersey pack:** a jersey and a matching cap in one color. **Four products: blue, green, purple, red.** The Shop and Zebra tab show one "Jersey pack" card; the PurchaseSheet has a color picker and the try-on updates live.
- **Art:** every item, including the Crown and the 8 team variants, is in `design/zebra/outfits/<id>.svg`, with previews in `preview/` and slot, layer, status, pack and earn rule in `manifest.json`.
- **Team colors** (`TEAM` in the manifest: blue `#2F6BFF`, green `#1FA463`, purple `#7A4DFF`, red `#F0443A`) are **outfit art only**. They are deliberately not the chart palette; never use either set anywhere else.

### B4. Pasture

A reusable `Pasture` scene:
- a pale meadow with a wavy horizon and a lighter second band
- grass tufts and small pink flowers
- herd layout per A10

Each zebra loops its own small idle so the herd never moves in lockstep:
- roam ±6–14 pt over 5.5–9.5 s
- trot bob −3 pt every 0.95 s, or graze (tilt −4°) every 6.5 s
- a per-zebra delay

Your zebra is always front row, left. Over 12 members: see A10b. Name tags sit at each zebra's feet on a top layer, so they're never hidden: ink when done, white when adding.

Add every outfit (both forms, all 7 moods) and the Pasture (1, 2, 4, 6, 9 and 12 zebras) to the hidden `/design` route.

---

## Phase 1: Zebra system v2 and design-system update

1. Implement B2, B3 and B4. Add a pure `herdLayout(n, width, height)` helper with tests (rows, scales and offsets per A10).
2. **Update `design/DESIGN_SYSTEM.md`:**
   - §7 and §8: the herd model (A1), the 3 outfit slots and rules, the hoodie rule and the Pasture
   - the mood rules from B2
   - the herd moments in Phase 2
   - the chart palette exception (A14)
   - the new tokens (section 9)

   Remove the single-zebra-with-N-stripes rules.
3. **Performance:** at most 12 animated zebras per screen. Pause zebras that are off-screen or inside a backgrounded tab. Render small herds with one shared animation clock (Reanimated shared values) rather than per-zebra JS timers. With Reduce Motion on, the herd stands still and mood changes cut instead of crossfading.
4. **Optional:** if layered SVG can't hold 60 fps with 12 outfitted zebras on a mid-range Android, report it and propose Rive (runtime-swappable outfit layers). Don't switch without approval.

## Phase 2: Herd screens and herd moments

**Dazzle page** (`herd/Trip-Herd.dc.html`). Replaces the old balance card and the separate Earn your stripes screen.
- **Hero card, top section:**
  - "Your balance", the amount, and the "owed to you" (volt) or "you owe" (blush) pill
  - "The herd →" chip
  - a status row: "**N of M zebras still adding.** Names." with a pink **Nudge** button, or, when complete, a volt row "**Every zebra has its stripes.** Time to settle."
- **Hero card, bottom section:** a full-width **Pasture**, about 250 pt tall, with the herd.
  - Tapping a zebra opens its member sheet.
  - The board's "tap to mark done" is a **design demo only**. In the app, a zebra's stripes change only when its owner taps Done.
- **Below the card:** Expenses / People / Summary segments and the expense rows, as before.
- **Docked footer:** "Add expense" (volt), plus "Close out · N to go" (locked style) that becomes an ink **"Close out"** when the herd is complete.

**The herd page** (`herd/Herd.dc.html`):
- a card per member with a full zebra doing a subtle idle
- name, a **Striped** or **Adding** pill, their balance with you, and what they're wearing
- **Nudge** for members still adding
- your own card is full width and first, with a **Customize** button that opens the Zebra tab

**Member sheet** (new, no board; build it from system parts):
- a bust in their outfit, name, done status and balance with you
- what they're wearing
- **Nudge** (if adding) and **Gift an item** (opens the Shop's gift flow with them preselected)

**Home trip cards:** a mini herd per A11, up to 8 busts, then "+N". Over 8 members, pick the visible busts the same way as A10b (you plus a reshuffle on each foreground).

**Herd moments.** These animations use the existing motion tokens:

| Moment | Animation |
|---|---|
| Tap Done | Your zebra's stripes grow down from the top (520 ms spring-pop), then one hop. Light haptic. |
| Done undone (late expense) | Stripes fade back to plain over 400 ms. Toast explains why. |
| Herd complete | All zebras go starry and hop in a wave (staggered 120 ms, 1.3 s), confetti, success haptic, close-out unlocks with a rise-in. |
| Payment lands | Payer and payee zebras go love for 2 s, in both people's apps. |
| Nudge | The boop uses the **nudger's** outfitted zebra, with the speech bubble. |
| Someone joins | Their zebra trots in from the field edge (900 ms) and takes its slot; the others shuffle with a 300 ms ease. |
| Member removed | Their zebra trots out. |
| Equip an item | The item drops on with a small squash (scale 1.15→1, 260 ms). |

## Phase 3: Home, Account, Zebra tab, Shop, purchases

**Home** (`stories/Main.dc.html`):
- **Header:** the `zebrasplit` wordmark on the left. On the right, three 44 pt white circular buttons: **Search**, **Shop** (bag icon, with a pink dot when a drop is unseen) and **Account** (person icon). No zebra avatar in the header.
- **Balance card:** keep it as it is.
- **New Drop banner:** an ink pill **directly below the balance card and above "Your Dazzles"**. It has the outfit bust, title, subtitle and a volt "Shop" chip. Show it only when a drop is active and unseen; it can be dismissed. It's driven by the `drops` table (title, subtitle, item ids, start/end). **Build it and seed nothing:** with no active drop it never renders, and the Shop icon has no dot. Ignore the board's placeholder copy.
- **Your Dazzles:** Open / Past, with cards per A11.

**Account** (`herd/Account.dc.html`). The person icon opens it.
- **Tabs:** **Account | Zebra**.
- **Account tab:**
  - profile card: your zebra bust in a pink-tint circle, name and masked phone (**no "Edit your zebra" link**)
  - Payments (existing handles)
  - Notifications toggles (Nudges, Payments, New expenses)
  - the ZEBRASPLIT PRO card ("Extras for the herd… Splitting, stripes and settling up always stay free." with "See Pro" opening a placeholder)
  - Purchases: Gifts (received) and **Restore purchases**
  - Help: FAQ, support@zebrasplit.com, privacy@zebrasplit.com, Terms
  - Sign out (blush text)
  - version string

**Zebra tab** (`herd/Closet.dc.html`):
- **Stage:**
  - a large **full** zebra in your current outfit, gently trotting and blinking
  - a "Seen in N dazzles" chip
  - a **Try a mood** chip row that previews moods without saving
- **Wardrobe:**
  - tabs **Head / Face & neck / Body**, with a one-line hint per tab (the Head hint says the hood is up when the hoodie is worn)
  - a 3-column tile grid; each tile has a preview (bust for head and face items, full for body items and the sash), the name and a tag: **Wearing**, **Wear**, **Earned · Wear**, **🔒 rule** (e.g. "🔒 5 trips · 3 of 5", "🔒 Send a gift") or **$0.99**
  - a "Wearing: …" summary
- **Tile behavior:**
  - Tapping an owned item equips it or takes it off (one per slot). A toast says "Tiara on. Your herd will see it."
  - Tapping a locked earned item shows a toast with progress ("Finish 5 trips to earn the party hat. You're at 3." / "Send any gift to earn the tiara. It's also in the Bachelorette pack.").
  - Tapping an unowned paid or pack item opens the **PurchaseSheet** and **tries it on the stage immediately**.
  - While the hoodie is worn, the equipped head item's tile reads "Under the hood".
- **Below the grid:**
  - **Packs** carousel: Bachelorette, and one Jersey card with the four color swatches
  - **Earn outfits** list with progress: First trip · Yellow cap, 5 trips · Party hat, Send a gift · Tiara
  - **Restore purchases**
  - a volt **Shop** button

**PurchaseSheet** (shared by the Zebra tab and the Shop):
- Shows the item or pack, with try-on. Pack contents are listed by name.
- **"Buy for $0.99"** (volt), **"Gift it"** (ink) and **"Not now"**, plus the line "Paid with your Apple ID. Shows on your zebra in every dazzle."
- **Jersey pack:** a row of four color swatches; the stage tries on that color's jersey and cap; the title reads "Jersey pack: Red".
- **Gift step:** "Who's it for? Pick one or the whole herd." Chips for members of your dazzles, multi-select, plus a "Whole herd" chip per open dazzle. Guests without an account are greyed and can't be picked. The button reads "Send to Priya · $0.99" or "Send to 4 zebras · $11.96" (price × recipients). If a recipient already owns everything in the gift, skip them and say so before paying.
- **On success:** owned, auto-equipped (for buys) and a toast.
- **Pending, failed and refunded states** need clear copy and no zebra change until the purchase is verified.

**Shop** (`stories/Shop.dc.html`):
- No Closet tab. One grid of the full catalog (B3), with a **Gift** tab.
- Tags: **Owned**, **Free**, **$0.99**, **Pack** or **Earn it**.
- Tapping an item tries it on the large preview zebra over your current look. The main button changes with the item:
  - "Get it · Free"
  - "Buy … · $0.99"
  - "Get the Bachelorette pack · $2.99"
  - "Wear it"
  - a disabled "Earn it: …"

**How gift payments work (keep it simple):** gifts are bought with **consumable** gift products at the same tiers (`gift_item_099`, `gift_pack_299`), quantity = number of recipients (split into several transactions if the store's quantity limit is lower). After server verification, the Edge Function writes one `gifts` row and one `user_cosmetics` row per recipient. The buyer gets nothing but the `first_gift` check. Refunds revoke the gifts from that transaction.

**Gifts received:** a push notification ("Priya sent you a Tiara"). On next open, an unwrap moment: the box bursts (600 ms), the item drops onto your zebra, and you get "Wear it" / "Later" and a "Say thanks" quick reply. The gift is listed in Account → Gifts.

**Earned items:**
- Rules are config-driven: `first_trip` → Yellow cap, `trips_5` → Party hat, `first_gift` → Tiara (B3).
- Evaluate them server-side when a dazzle settles and when a gift is delivered.
- Unlock moment: a badge shine, then your zebra tries the item on, with "Wear it".

**Purchases.** Use **in-app purchases only** (StoreKit / Play Billing; RevenueCat recommended).
- Each item is a non-consumable product, and each pack unlocks several items.
- Free items are claimed without payment.
- Restore purchases is required.
- **Verify on the server** (RevenueCat webhook, or a receipt check in an Edge Function) before writing ownership. Never trust the client.

**Data** (Supabase migrations; row-level security scoped to the user; reads through security-definer RPCs as elsewhere):

| Table | Columns / purpose |
|---|---|
| `cosmetics` | id, slot (head / faceneck / body), name, layer, price_tier, pack_id, earn_rule, hides_slot (`head` for the hoodie), active, release window |
| `cosmetic_packs` | id, name, price_tier, item ids, group (e.g. `jersey` ties the four color packs into one card) |
| `user_cosmetics` | user_id, cosmetic_id, source (free / purchase / earned / gift), acquired_at, gift_from |
| `user_outfit` | user_id, head, faceneck, body: the currently equipped item per slot |
| `outfit_history` | user_id, trip_id, head, faceneck, body, recorded_at. Record on every equip change while a member of an open trip, and once at settle. Needed for The Fashionista award and Wrapped's most-worn outfit and best dressed. |
| `gifts` | id, from_user, to_user (must be an account), cosmetic_id or pack_id, purchase_ref, status, opened_at |
| `drops` | id, title, subtitle, item ids, starts_at, ends_at |
| `iap_events` | raw verified store events, for audit |

**Visibility:** members of a shared dazzle can read each other's `user_outfit`. Subscribe via Realtime so outfits update live in herds.

## Phase 4: Trip Story

Build the story as specified in `STORIES_BUILD_PROMPT.md` section 3, kept here in full.

A full-screen story you tap through, opened from a settled Dazzle's recap. It has a five-segment progress bar and a close button.

| # | Board | Content | Button |
|---|---|---|---|
| 1 | Story1 | "The dazzle": a herd card for each member (bust **in their trip outfit from `outfit_history`**, name, one fact) and a chip "**X of X Zebras earned their stripes**" | **See the Damage** |
| 2 | Story2 | "The damage": total, per zebra, per day; a stacked bar by category; category rows that **expand** into top line items and who paid; the **Drink Index** card | **See Awards** |
| 3 | Story3 | "**And the Stripes go to…**": six award cards (bust, award, winner, stat, caption) | **See Payments** |
| 4 | Story4 | "**Payment summary. Settled up in N days.**": each member's paid, share and net, then the payments list | **Read the Tale of [trip, truncated]** |
| 5 | Story5 | "The Ballad of [trip]": the animated tale, then "Share the story" (volt) and **"Back to Home"** | |

**Computation:**
- **Story numbers:** all computed in `packages/core` as pure, tested functions, written test-first with fixtures. The AI never does arithmetic.
- **Drink Index:** the highest-spend drink type among Tequila, Vodka, Whiskey, Beer, Seltzer and Wine, from receipt line items or else the Alcohol category. The card reads "The [Drink] Index: X% of the trip went to alcohol. 0% went to museums" (or the lowest culture category). A quirky activity that outspends every drink may replace it ("The Jet Ski Index"). The model classifies; the core does the math.
- **Category palette:** the bar, swatches and selected-row outline use the category tokens. Tapping a category dims the other segments to 30% and outlines the row in ink.

**Awards** (`packages/core/src/awards`). Each catalog entry has an id, title, scoring function, minimum-evidence threshold and caption templates.

| Group | Awards |
|---|---|
| Trip facts (chapter 2, not award slots) | Biggest Expense, Smallest Expense, Top Category |
| Money | The Treasurer, The Navigator, The High Roller, The Sommelier |
| Paying up | The Early Bird, The Houdini, The Amnesiac, The Window Shopper |
| Logging | Receipt Royalty, The Auditor, The Nickel & Dimer, The Detail Oriented, The Debt Collector, The Vampire |
| Ordering | The "Just a Water", The Soloist, The Snack Goblin, The Photosynthesizer, The Meat Sweats, The Culture Critic |
| Barely there | The Outsider |
| Also | The Party Starter, The Closer, The Tipper, The Currency Trader, The Late Arrival, **The Fashionista** (most distinct looks in `outfit_history` for the trip) |

- **Data sources:** wire each award to real data: `expenses`, `receipt_items`, `expense_history`, `settlements` and timestamps, `notification_log`, `client_events`, `comments` and notes, `trip_members` nights, and `outfit_history`. If an award's data doesn't exist, mark it unavailable and list it in your report. Don't invent proxies.
- **Selection:** compute every eligible award with a score. Give **at most one award per member**, prefer distinct and surprising awards over plain facts, and show **6** (or the member count, if smaller).
- **Captions:** one slightly spicy house voice, roasting trip behavior only. Never mock health or diet; the Sober and Vegetarian exclusions stay private. **Any member can hide an award or caption about themselves** before sharing. Store this; exports respect it.

**The animated tale** (chapter 5):
- **Playback:** scenes self-play at about 3.2 s each, with pause/play and progress ticks.
- **Scenes:** a fixed library: arrival (plane), lodging (villa), drinks, boat or water, receipts, food, nightlife and finale.
- **Each scene:** a background tint, an animated prop, **full zebras on the Pasture in their trip outfits**, and one caption.
- **Generation:** an Edge Function sends the computed trip facts to the model. The model returns JSON only: 5–6 captions with a scene id each, plus the share headline.
  - Same model config and kill switch as receipt reading (`private.config`).
  - Versioned prompt and schema files.
  - Schema validation, and **every number in a caption must match the facts payload**; reject and retry once otherwise.
  - Cached per trip.

## Phase 5: Share exports and the logo animation

**Instagram Story PNG** (`ShareIG.dc.html`): 1080×1920, rendered off-screen and shared to Instagram Stories.
- The AI headline ("Six zebras. One villa. Zero museums."), then the trip name, dates and nights.
- Total and per-zebra tiles, the category bar and the Drink Index.
- **All awarded badges**, two per row, each with the winner's bust in their trip outfit.
- The stacked tagline "Split the trip / Not the friendship" (no periods), then `zebrasplit.com`.
- **Safe zones:** keep content out of the top 250 px and bottom 340 px.

**TikTok MP4** (`ShareTikTok.dc.html`): about 20 s, looping, 1080×1920.

| Time | Scene |
|---|---|
| 0–3 s | Trip chip and headline |
| 3–6 s | "The damage": total counts up (ease-out cubic, ~1.3 s), plus the per-zebra pill |
| 6–9.5 s | Three highlight pills, 450 ms apart (biggest item, Drink Index, the 0% item) |
| 9.5–12 s | "Everyone paid once. Nobody's mad.", the **herd on the Pasture in outfits**, and three award chips |
| 12–20 s | The logo animation as outro |

- **Safe area:** keep the top 130 px, right 120 px and bottom 480 px clear.
- **Rendering:** build the in-app player and the full MP4 export path: a render worker (Remotion or similar) fed by the same scene data, saving to Storage and returning a signed URL. Make it work end to end in dev and staging. **Keep it reserved:** the `share_tiktok_mp4` flag is off in production, and the share sheet shows only the PNG until it's on. Report the monthly cost estimate before any paid worker is deployed to production.

**Logo animation** (`LogoAnim.dc.html`): a reusable component, using the **full** master zebra.

| Time | What happens |
|---|---|
| 0–0.3 s | Volt background |
| 0.3–1.5 s | Six rounded ink stripes (tilted 10°) rise, staggered 70 ms, 900 ms each, spring-pop |
| 1.5–2.7 s | The stripes swirl into the center (540°+, scale 0.05, fade) as the full zebra spins in (−360°→0, scale 0.05→1) |
| 2.7–3.7 s | The zebra winks (eyes only) |
| 3.7–4.6 s | Outbound swirl (360°, scale 7, fade) reveals the **Pasture**: six full zebras in outfits, in two rows, bobbing, with sun and clouds |
| 4.6–8 s | The wordmark and stacked tagline fade up; hold, then loop |

Also export it as a Lottie or MP4 asset for the site. **Build it fully but keep it reserved:** it plays only on `/design` and inside the TikTok outro (itself flagged), behind the `logo_animation` flag, which is off. Don't wire it into the splash screen.

## Phase 6: Wrapped

Available from December 1, built from **settled** Dazzles in that calendar year.

1. **"Your year in stripes"** (ink background):
   - the **full** zebra, starry, in your **most-worn outfit** (from `outfit_history`), with sparkles
   - stats tiles: dazzles, nights away, "**14 Zebras**"
   - button: **The Money**
2. **The money:**
   - total trip spend and a bar per trip
   - You paid vs. Your share, and the fronted-difference card
   - top category and priciest day
   - button: **The Herd**
3. **The herd** (volt background):
   - **Your top herd:** the top 3 people by trips shared, ties broken by nights shared
   - **Most-worn outfit:** the slot combination worn on the most dazzles
   - **Your closet:** count of items you own
   - **Best dressed in your herd:** the member with the most distinct looks across the dazzles you shared (looks worn, not items bought)
   - button: **Your Zebra Type**
4. **Zebra type** (ink background):
   - the award you won most often (ties go to the most recent)
   - a trophy shelf with counts, the fastest close-out, receipts scanned
   - buttons: "Share your Wrapped" and "Plan 2027's first dazzle"
5. **Share card** (1080×1920):
   - your type with your zebra in its most-worn outfit
   - three stats, total spend and top category
   - "YOUR TOP HERD" with three busts in outfits
   - the stacked tagline with no periods

Compute all stats in `packages/core` with tests. Hide any tile that can't be computed; never show zero as a stand-in.

## 7. Animation style (everything above)

- **Library:** React Native Reanimated plus react-native-svg, driven by the `motion` tokens. No new animation library unless Phase 1 step 4 is approved.
- **Feel:** small, quick and springy, never in the way.
  - Entrances: `cubic-bezier(.2,.8,.2,1)`.
  - Big exits (swirl-out): `(.6,0,.4,1)`.
  - Stripes and equip: spring-pop `(.3,1.5,.5,1)`.
- **Ambient loops:**
  - herd idles per B4
  - story and logo bob: −6 to −8 pt, 1.4–1.6 s
  - graze: 2.2–2.6 s, offset per zebra
  - sparkles twinkle
- **Scene changes:** 500 ms crossfade, incoming scene scales 1.06→1 over 700 ms.
- **Mood changes:** crossfade eyes, ears and extras only, 250 ms.
- **Reduced motion** (one shared hook):
  - loops stop and the herd stands still
  - scenes cut instead of crossfading
  - count-ups show the final value
  - the logo animation shows its last frame

## 8. (reserved)

## 9. Tokens to add (`packages/theme`)

**Category data-viz palette.** Use it on charts only, and nowhere else, ever (A14). Put it under `theme.chart.*`; ink text on every color:

| Category | Color |
|---|---|
| Travel | ink `#1D1A17` |
| Dining | `#FF4FA3` |
| Alcohol | `#FF9F43` |
| Recreation | `#9B7BFF` |
| Transportation | `#4DA3FF` |
| Groceries | `#4CCB8F` |
| Other | `#9B9590` |

**Other tokens:**
- **Pasture:** field `#EEF5D4`, field-front `#E6F0C6`, grass `#B9CF8C`, flower `#F7A8BC`. Name-tag ink and white come from the existing tokens.
- **Story scene tints:** `#F6FFD3`, `#FFE9F3`, `#FFF1E2`, `#EAF4FF`, `#FAF7F2`.
- **Outfits:** use only the colors in `design/zebra/outfits/*.svg` (ink, hide, volt, pink, blush, `#3A3631`, `#5C5852`), under `theme.zebra.outfits`. The Jersey pack team colors go under `theme.zebra.team.*`, used only by outfit art.
- **Token home (decided):** `packages/theme` is the single source. If the app still has `src/theme` from the reskin, make it re-export `packages/theme` and delete its duplicate values.
- **Locked button:** `#E6DFD3` background, `#D3CDC3` border, `#5C5852` text. This comes from the receipt pack; add it if it isn't there yet.

## 10. Analytics and privacy

**Events:** first-party only (`client_events`), keeping the no-third-party-tracker rule.

| Area | Events |
|---|---|
| Herd | `herd_zebra_tapped`, `herd_complete_viewed` |
| Wardrobe | `wardrobe_opened`, `item_tried_on`, `item_equipped`, `mood_previewed`, `item_earned` |
| Shop | `shop_opened`, `item_previewed`, `purchase_started`, `purchase_completed`, `purchase_restored`, `gift_sent` (recipient count), `gift_opened` |
| Drops | `drop_banner_tapped`, `drop_banner_dismissed` |
| Story | `story_opened`, `story_chapter_viewed`, `category_expanded`, `award_hidden` |
| Sharing | `share_exported` (format: ig_png or tiktok_mp4) |
| Wrapped | `wrapped_opened`, `wrapped_shared` |

**Privacy:**
- Captions and tales use trip facts only. Never send phone numbers or payment handles to the model.
- Hide choices are respected everywhere, including exports.
- Outfits are visible only to people who share a dazzle with you.
- **Legal:** update the Privacy Policy and the store privacy answers for in-app purchases, gifting and AI-generated stories.

## 11. Verify, then report

**Checks:**
1. Typecheck, lint and tests pass, including:
   - `herdLayout`
   - `zebraMoodFor`
   - the outfit draw-order and hoodie rules
   - the over-12 herd pick (you always shown, reshuffle per foreground)
   - earn rules (`first_trip`, `trips_5`, `first_gift`) and gift fan-out, including guest exclusion and refunds
   - the chart-token lint rule
   - the award engine and the story and Wrapped math (fixtures cover ties, 2-person trips, 12-person trips and missing data)
2. The no-raw-hex check passes.
3. `/design` shows all 32 outfits × 7 moods × both forms, each Jersey pack color, and the Pasture at 1, 2, 4, 6, 9, 12 and 20 members (20 shows 12 plus the chip).
4. Screenshot every new screen on iOS and Android and compare with its board. Zebra artwork differences against the **stories** boards are expected (they use stand-ins). Against the **herd** boards they should match closely (same masters).
5. Profile a 12-zebra herd with outfits on a mid-range Android and report the fps.
6. Run IAP in sandbox: single item, each Jersey pack color, the Bachelorette pack, a gift to one member and to a whole herd, restore and server verification.
7. Generate a Story and a Wrapped from the seeded Cabo fixture. Export the IG PNG, and with the flag on in staging, the MP4.
8. Do a full pass with Reduce Motion on.

**Report back with:**
- the file tree and screenshots
- unavailable awards and why
- the MP4 render setup and its monthly cost estimate
- fps results
- IAP setup steps for App Store Connect and Play Console (products, agreements, tax and bank)
- open questions

**Don't decide these yourself:**
- price, free/earned/pack changes beyond B3
- new packs, drop content and the drop schedule
- earned-item rules beyond the three in B3
- turning on `share_tiktok_mp4` or `logo_animation`, or using the logo animation as the splash
