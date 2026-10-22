# Zebrasplit design system

Version 1.0, October 14, 2026. This replaces the "Pretty Good" kit + Inter + Basalt & Spore system described in the V1 spec. Where the two disagree, this file wins on anything visual; the V1 spec still wins on features, data and logic.

The approved source is the Claude Design canvas. The original boards are in `design/reference/boards/`; the **herd and wardrobe** boards that supersede them for §7–8 are in `design/reference/herd/`, and the stories boards in `design/reference/stories/`. **Tokens live in `packages/theme/src/tokens.ts`** and nowhere else (`design/tokens.ts` is a re-export kept for the path). Zebra masters are in `design/zebra/svg/`; outfit masters and their manifest in `design/zebra/outfits/`.

---

## 1. The idea in one paragraph

A group trip is a **dazzle** (the real word for a group of zebras). Every person in the dazzle is a **stripe** on the zebra. You earn your stripe by tapping **Done** when you've finished adding expenses. When the zebra has all its stripes, the dazzle can settle up in Venmo. The product is **black and white**: two accent colors appear only when there's money or an action in play, so a screen with no color means you're square. A cute zebra mascot reacts to what's happening, and small animations reward each step.

## 2. Principles (apply these when something isn't specified)

1. **Black and white first.** Ink on white and cream. Color is earned, never decorative.
2. **Volt = money coming to you and the one next action. Pink = money you owe, nudges, attention.** Nothing else gets color. Settled means no color at all.
3. **Stripes mean Done, not money.** A filled stripe is a person who has tapped Done. Stripes never represent amounts paid or owed.
4. **Soft, never boxy.** Everything is rounded: pills, rounded cards, rounded-rectangle stripes. No sharp corners, no hard 1px boxes around content, no table grids.
5. **Light mode only.** Warm white-to-cream gradient background on every screen.
6. **The zebra has feelings, not a mouth.** Moods are shown only by the eyes and ears. Never draw a mouth or smile on the muzzle.
7. **Every state change moves a little.** Small, quick, springy, and never in the way. Respect Reduce Motion.
8. **Remove what doesn't help.** If a label, chip or number doesn't change what the user does, cut it (the old "+in / −out" chips were cut for this reason).
9. **One pun per screen, max.** The zebra wordplay (dazzle, stripes, "earn your stripes", "stripes are even") is seasoning, not the meal.

## 3. Color

### Palette

| Token | Hex | Use |
|---|---|---|
| ink | #1D1A17 | All primary text, icons, filled stripes, outlines, dark buttons, done pills |
| inkSoft | #3A3631 | Secondary text that still needs weight |
| muted | #6E6A63 | Captions, meta lines, inactive tabs, placeholders |
| white | #FFFFFF | Cards, controls |
| hide | #FFFBF2 | The zebra's hide; light chips on ink |
| cream | #FAF7F2 | Inset panels inside cards (meter rows, nudge rows) |
| sand | #F3EFE8 | Icon tiles, avatar fills, disabled and locked buttons |
| line | #F0EBE2 | Row dividers inside cards |
| hairline | #E8E2D8 | 1.5 px outlines on white pills and inputs |
| ghost | #E6E0D6 | Unfilled stripe in meters |
| ghostZebra | #EFE8DC | Unfilled stripe on the zebra body |
| dashed | #D3CDC3 | Dashed outlines (empty night cells, not-done avatars) |
| trackOff | #DDD8CE | Toggle track when off |
| **volt** | **#E2FF2B** | Owed to you; the primary CTA; success |
| **pink** | **#FF4FA3** | You owe; Nudge; live/attention dots; worried moments |
| blush | #FFE4F1 | Soft pink surface for "−$" amounts, warnings, speech bubbles |
| blushText | #A3195F | Text on blush; destructive and error text |
| blushTextDeep | #7A1347 | Text inside pink speech bubbles |
| pinkTint | #FFF3F8 | Disc behind a done zebra bust in pills |

### Background (every screen)

Three layers, top to bottom:

1. Radial wash, pink: center top-right corner (100%, 0%), ellipse 120% × 55% of the screen, `#FFE9F3` fading to transparent at 60%.
2. Radial wash, volt: center left edge at 22% height (0%, 22%), ellipse 100% × 45%, `#F6FFD3` fading to transparent at 55%.
3. Linear, vertical: `#FFFFFF` 0% → `#FBF8F2` 50% → `#F5F0E7` 100%.

On wide layouts (System board, web) the washes are 70% × 50% and 60% × 45%. In React Native, build this once as `<ScreenBackground />` with react-native-svg (`RadialGradient` + `LinearGradient` in one absolutely-filled `<Svg>`), and put it behind every screen.

### Color rules

- Text on volt and on pink is **always ink**. White on pink fails contrast (3.0:1); white on volt is invisible.
- Volt text is allowed only on ink surfaces (done pills: "Done · stripe 3 earned").
- Amount pills: owed to you = volt bg + ink text "+$2,193.10"; you owe = blush bg + blushText "−$142.50"; settled = no pill, plain ink "$0.00".
- Errors and destructive actions use blushText (on white or blush). There is no red, green, amber or blue anywhere.
- Success is volt + ink (e.g. "Paid, nice" button turns volt).
- Ink only: older boards used `#171512` (Dazzle, Who slept where); normalize it to `#1D1A17`.

#### The two exceptions, and they are the only two

**The category palette** (`theme.chart.*`): Travel ink, Dining `#FF4FA3`, Alcohol `#FF9F43`, Recreation `#9B7BFF`, Transportation `#4DA3FF`, Groceries `#4CCB8F`, Other `#9B9590`. Seven colours mapping 1:1 onto the top-level categories in `packages/core`, with ink text legible on every one.

This is the only place in Zebrasplit where a colour carries meaning rather than brand, so it is allowed on **charts and nowhere else, ever**: bars, segments and their legend swatches in Trip Story, Wrapped and the dazzle Summary tab. Never on buttons, pills, text, backgrounds or outfits. `scripts/check-chart-tokens.mjs` fails the build if `chart` is imported or read outside a `ui/charts/` directory.

**The Jersey team colours** (`theme.zebra.outfits.team`): blue `#2F6BFF`, green `#1FA463`, purple `#7A4DFF`, red `#F0443A`. Outfit art only. They are deliberately different hues from the chart palette, and neither set may ever be used where the other belongs. The one piece of UI allowed to show them is the Jersey pack's colour picker, because the swatch *is* a preview of the art.


### Contrast (WCAG AA, measured)

| Pairing | Ratio | Verdict |
|---|---|---|
| ink on hide / white | 16.8 / 17.3 | Pass |
| ink on volt, volt on ink | 15.3 | Pass |
| ink on pink | 5.7 | Pass |
| white on pink | 3.0 | **Fail for text.** Never do it |
| muted on white / hide | 5.4 / 5.2 | Pass |
| muted on sand (disabled label) | 4.7 | Pass |
| blushText on blush | 6.2 | Pass |
| blushText on white | 7.3 | Pass |
| `#8A857D` on white | 3.7 | **Fail.** The Earn-your-stripes board used it for "Still adding expenses"; use `muted` instead |
| volt / pink as text on white | 1.1 / 3.0 | Fail. Never use them as text on light surfaces |

## 4. Typography

**Figtree** for everything (weights 400, 600, 700, 800). **IBM Plex Mono** only inside the receipt read-out. No other fonts. Load with `@expo-google-fonts/figtree` and `@expo-google-fonts/ibm-plex-mono`; on web use Google Fonts.

| Style | Size / line | Weight | Tracking | Used for |
|---|---|---|---|---|
| wordmark | 20 / 24 | 800 | −0.03em | "zebrasplit", always lowercase, top-left on Home |
| display | 46 / 46 | 800 | −0.03em | Hero balance on Home |
| amountL | 36 / 36 | 800 | −0.03em | "Your check" on a dazzle |
| title1 | 32 / 34 | 800 | −0.03em | Screen titles |
| title2 | 26 / 30 | 800 | −0.02em | Section headers ("Your dazzles") |
| headline | 18 / 22 | 800 | −0.01em | Card titles ("Cabo crew: Casa Azul") |
| button | 17 / 20 | 800 | 0 | Large CTA labels |
| buttonS | 14 / 18 | 800 | 0 | Pill buttons, Nudge, segments |
| body | 15 / 21 | 400 | 0 | Descriptions, sentences |
| bodyStrong / amountRow | 15 / 20 | 700 | 0 | Row titles, amounts in lists |
| label | 14 / 18 | 700 | 0 | Segment labels, chips |
| caption | 13 / 17 | 400 | 0 | Meta lines ("You paid · split by nights stayed") |
| captionStrong | 13 / 17 | 700 | 0 | Pill text, "3 of 8 striped" |
| small | 12 / 16 | 600 | 0 | Secondary meta, "still adding" |
| micro | 11 / 14 | 800 | 0 | Night column heads |
| overline | 13 / 16 | 800 | +0.08em, caps | Section labels on system screens |
| receipt | 12 / 18 | Plex Mono 400/700 | 0 | The receipt read-out only |

Rules: every money figure uses tabular numbers. Minus signs are the real minus (−), not a hyphen. Amounts always show cents ($2,193.10). Sentence case everywhere; the wordmark is lowercase. Titles may wrap to two lines but never truncate; names in tight rows truncate with no ellipsis-induced jitter (fixed column widths).

## 5. Spacing, layout and shape

- Spacing steps: 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40 (6 and 10 only for tight inline gaps).
- Screen gutter for cards: **16**. Gutter for headings and loose text: **20**.
- Card padding: list cards 16 × 18; hero cards 22 × 20; zebra-stage cards 18.
- Gap between stacked cards: 10. Gap inside a card between groups: 12.
- Top bar: safe-area inset + 8; it holds round 44 px icon buttons (white, control shadow) and/or the wordmark.
- Bottom CTA: full-width pill, 58 tall, 16 side gutter, 30 below (above the home indicator).
- Minimum tap target 44 × 44 everywhere.

| Radius token | Value | Used for |
|---|---|---|
| stripe / pill | full | Every stripe, button, chip, amount pill, segmented control, input, toggle |
| tile | 14 | Icon tiles, night cells |
| inset | 16 | Inset panels inside cards |
| row | 22 | Single list-row cards (expenses) |
| card | 24 | Standard cards (dazzle cards on Home) |
| hero | 30 | Hero cards (balance, zebra stage), bottom-sheet top corners |
| bubble | 16 / 16 / 16 / 4 | Speech bubble (tail corner bottom-left) |

### Elevation

All shadows are ink-colored, soft and warm. See `shadow` in tokens. Hero cards sit at 86–90% white opacity so the gradient glows through. The primary volt CTA gets a volt glow (`#8CA000` at 25%). Cards never get borders; separation comes from white-on-gradient plus shadow. White pills that sit on white get a 1.5 px hairline outline instead of a shadow.

## 6. Components

Build these once in `src/ui/` and use them everywhere. Names are suggestions; match the repo's conventions.

| Component | Spec |
|---|---|
| **ScreenBackground** | The 3-layer gradient. Behind every screen, including modals and sheets (sheets themselves are white). |
| **TopBar** | Round 44 px white icon buttons (back chevron, profile, "⋯" menu) with control shadow; optional centered or right-aligned context pill (e.g. "Casa Azul villa · $3,000", 13/700, white pill). Home shows the wordmark at left. |
| **HeroCard** | 86% white, radius 30, hero shadow, padding 22 × 20, `overflow: hidden` so the zebra can tuck into a corner. |
| **Card** | White, radius 24, card shadow, padding 16 × 18. Pressable cards scale to 0.98 on press. |
| **RowCard** | White, radius 22, hairline shadow, padding 12 × 14, 42 px sand icon tile (radius 14) on the left, title 15/700 + caption 12 muted, amount right-aligned 15/700 with an amount pill under it. |
| **InsetPanel** | Cream, radius 16, padding 8 × 12. Holds stripe meters and nudge lines inside cards. |
| **Button.Primary** | Volt pill, ink label 17/800, height 58, volt glow. One per screen. |
| **Button.Ink** | Ink pill, white label (volt icon allowed). Strong secondary actions: "Close out" once unlocked, "Snap a receipt". |
| **Button.Secondary** | White pill, ink label, control shadow (or hairline when on white). |
| **Button.Locked** | Sand pill, muted label, no shadow, states why: "Close out · 3 to go". Never just greyed out without a reason. |
| **Button.Nudge** | Pink pill, ink label 13/800, height 32. |
| **IconButton** | 44 px white circle, control shadow, ink icon 1.8–2.4 stroke. |
| **AmountPill** | Volt (+), blush (−) or none (settled); 13–15/800, tabular; padding 3–5 × 10–11. |
| **StatusPill** | Small white or volt pill for counts ("3 of 8 striped" → volt when all done: "All 8 striped"). |
| **SegmentedControl** | Track `rgba(29,26,23,0.06)`, radius full, padding 4; active segment white with a tiny shadow, 14/700 ink; inactive 14/600 muted; height 34–36. |
| **Toggle** | 52 × 32 track (ink when on, trackOff when off), 26 px knob (volt when on, white when off). Spring the knob. |
| **StripeMeter** | *Retired in the app* (see §8); kept for the marketing site and the design sheet. Row of rounded stripes, each 8 × 22, radius 4, gap 5, rotated 10°; ink = done, ghost = not done. |
| **PersonPill** | Full-width pill (stacked, scrollable list). **Done:** ink fill, happy zebra bust in a pink-tint disc, name in white 15/700, "Done · stripe N earned" in volt 12/700, a white rotated rounded-rect mark on the right. **Not done:** white fill, 1.5 px hairline, dashed initials circle, name ink, "Still adding expenses" in muted, a ghost mark on the right. Tapping toggles (where the user is allowed to). |
| **Avatar** | 40 px circle, sand fill, initials 13/800. Done state: ink fill with a volt stripe swiped across it (see motion). Not done: dashed outline. |
| **NightCell** | 34 × 56 button, radius 14; a 16 × 46 rounded stripe rotated 7°: dashed outline when empty, ink fill grows from the top when on; cream bg when on. |
| **Toast / Snackbar** | Ink pill, white text, optional volt action label, bottom above the CTA, rise in, auto-dismiss 3 s. |
| **ActionSheet / BottomSheet** | White, top radius 30, sheet shadow, grabber 36 × 5 sand pill; destructive items in blushText. |
| **SpeechBubble** | Blush bg, blushTextDeep 13/700, radius 16/16/16/4, pops in. |
| **Input** | White pill (single line) or radius-22 white field (multi-line), 1.5 px hairline, 15/400 ink text, muted placeholder; focus = ink 1.5 px outline. Labels above in 13/700. Errors below in blushText 13/600. |
| **Receipt** | Thermal-receipt card: white, IBM Plex Mono, dotted rule before TOTAL, torn zig-zag bottom edge; the total sits in a volt highlight. Used only for the AI receipt read-out. |
| **Zebra** | See section 7. |

## 7. The zebra

### Anatomy (locked; do not redesign)

Front-facing, kawaii head on a side-on body. Big round head (ellipse 60 × 54) with a grey muzzle (#9B9590) across the lower face that has a soft sheen and **two small comma-shaped nostrils and nothing else**. Large glossy eyes (ink ovals with two white highlights). Pink cheeks either side. Pointed ears with pink inners, tilted out 24°. Curly black tuft between the ears; spiky solid mane down the neck. Rounded body, 4 striped legs with dark hooves, tufted tail. Ink outline 3.5 px at the 320 px master size (thicker at small sizes: 4–6 px so it stays crisp).

Masters: `design/zebra/svg/`. Ported by hand into `react-native-svg` components in `apps/mobile/src/ui/zebra/parts.tsx` (geometry exact; hex replaced with `theme.zebra`). Two forms, one coordinate space:

- **Full zebra** — `viewBox 0 -8 320 330`.
- **Bust** — `viewBox 30 -8 200 184`. The same space, cropped, so one outfit drawing serves both forms.

### One zebra per member

**Every person in a dazzle is their own zebra.** A zebra starts plain (ghost stripes) and becomes fully striped when that person taps Done. When the whole herd is striped, close-out unlocks.

**Stripes mean Done. Stripes never mean money.** A zebra is striped or it isn't — there is no partial state and no per-member count on a single body. Money is carried by the volt/blush pills and the balance, never by the artwork.

This replaces the earlier model, where one zebra per *trip* wore one stripe per member. Any board, screenshot or doc still showing a single zebra with N stripes predates it.

- Stripes are rounded rectangles, rotated 10° about (cx, 214), clipped to the torso (rect x 112, y 168, w 162, h 90, r 45). Six of them: cx = 152, 175, 198, 221, 244, 265; width 13, height 104.
- Ink when striped, `ghostZebra` underneath always. Stripes grow down from the top with spring-pop (460 ms) and the zebra hops once.

### Outfits: three slots, one item each

`head`, `faceneck`, `body`. Glasses **or** a chain, never both — face and neck share a slot deliberately, which is also why the bride sash lives there and can go over any top.

Art: `design/zebra/outfits/*.svg`, all in the full-zebra space, with `manifest.json` carrying slot, layer, draw order, clip and status. `scripts/make-outfits.mjs` generates both the React Native layers (`ui/zebra/outfits.generated.tsx`) and the catalogue data (`packages/core/src/outfits.generated.ts`) from them — **never hand-edit either; re-run the script.**

**Draw order**, lowest first:

1. body fill and stripes
2. **torso items**, clipped to the body path (full) or the neck path (bust)
3. body outline
4. skirt
5. head and mood
6. **hood** (hoodie only)
7. throat items
8. face items
9. head items — *skipped entirely while the hood is up*

**Slot and layer are independent**, and two items use it: the bride sash is a face-and-neck item drawn across the *torso*, and the scarf is a body item drawn at the *throat*. That means two equipped items can want the same depth. The tiebreak is clothing first, then the accessory over it — a sash lies over the tee, a chain over the scarf.

**The hoodie rule.** Wearing the hoodie puts its hood up, which **hides whatever is in the head slot**. The hat is not removed: it is still equipped, its wardrobe tile reads "Under the hood", and it comes back the moment the hoodie comes off. This is a drawing rule and must never be written to the database. The ears are drawn **again, over the hood**, because the band passes straight across where they sit.

**Rules for the art itself:** brand palette only, with the four jersey and cap team colours as the single exception and outfit-art-only. Lens tint at most 55 % so the eyes (the mood) still read. Torso items cover the chest only, so the striped barrel stays visible and Done is never hidden. Mood extras (z's, sweat drop, sparkles) draw **above** outfits. Outline weight scales up at herd size.

### The launch wardrobe (33 items)

6 free · 2 earned · 24 at $0.99 · 1 pack-only · packs at $2.99. Prices live in `public.cosmetics`, never in code.

| Slot | Free | Earned | Paid |
|---|---|---|---|
| **Head** (13) | Pink beanie, Joker hat | Yellow cap (first trip), Party hat (5 trips) | Crown, Flat brim, Mohawk, Viking helmet, Blue/Green/Purple/Red cap |
| **Face & neck** (9) | Glasses, Sunglasses | | Spectacles, Star shades, Heart shades, Ski goggles, Gold chain, Lei, Bride sash |
| **Body** (11) | Zebra tee, Scarf | | Hoodie, Flannel, Suit and tie, Skirt, Jersey, Blue/Green/Purple/Red jersey |

Three packs, each $2.99: **Bachelorette** (sash, skirt, tiara), **Jersey** (all four colours) and **Hat** (all four caps).

**A pack must undercut its contents.** Four packs once sold two $0.99 items for $2.99 while the Shop
showed both prices on the same screen, which read as a penalty rather than a bundle. The Jersey and Hat
packs now hold four items each, and a test in `packages/core/test/outfits.test.ts` fails if any pack
costs more than buying it piece by piece.

**Pack-only is its own status.** The tiara is `status: "pack"` — no price of its own, no earn rule, and
no store product behind it. It exists only inside the Bachelorette pack, which is what justifies that
pack's price when two of its three items are sold separately. Earned items still cannot be bought alone.

**Gifting grants nothing.** It ships after launch, and an item nobody can reach is worse than an item
that is simply for sale, so the Viking helmet is an ordinary $0.99 item rather than a reward for a
feature that does not exist yet. The earn rules are `first_trip` and `trips_5`, both reachable on day one.

### The Pasture

The field the herd stands in. Geometry is `herdLayout` in `packages/core/src/herd.ts`; the scene is `ui/zebra/Pasture.tsx`.

- **Rows:** up to 4 in one, 5–8 in two, 9–12 in three, filled from the front (5 is 3 + 2).
- Each row back is **0.82** the size of the one in front, and its feet sit **1.05 of a front-row zebra's height** higher. Just over 1 on purpose: a name tag sits at its own zebra's feet, so anything less puts the back row's names across the front row's bodies.
- Rows **spread** across the full width rather than packing, so every tag owns a whole step; a row behind the front starts half a front-row step right, so nobody stands directly behind anybody.
- Zebras are drawn **1.3× their share of the row** and overlap their neighbours. A herd stands close together; sizing each to fit shoulder to shoulder makes a row of four look like a row of stamps.
- The front row's feet stand clear of the bottom edge (0.088 of the height) to leave the tags ground to sit on, and no zebra is taller than 0.44 of the field.
- The **top edge is a wave**, not a straight line, so the field reads as ground rather than a green box. A second, closer wave divides far band from near.
- **Name tags** sit at each zebra's feet on a top layer, so they are never hidden: ink with a volt stripe when striped, white with a dashed stripe while adding.
- **You are always front row, left.** Over 12 members: you plus 11 others, reshuffled each time the app comes to the foreground, plus a "+N more" chip. The herd page always lists everyone — the limit is on the drawing, never on the dazzle.

**Idles.** Every zebra loops its own small idle so the herd never moves in lockstep — a roam of ±14–26 pt over 5.5–9.4 s, plus a trot (−3 pt, 0.95 s) or a graze (−4°, 6.5 s), every third zebra grazing. All of them read **one shared Reanimated clock**, each deriving its phase from its own period; twelve JS timers would be twelve things to drift and tear down. Each zebra's idle is keyed on a hash of its **user id**, so the same person moves the same way in every dazzle.

### Mood, per zebra

| Who | Rule |
|---|---|
| **Your zebra** | worried when you owe on this dazzle, happy when you're owed, hi otherwise |
| **Everyone else** | hi while adding, happy once Done |
| **Herd complete** | all starry |
| **Payment lands** | payer and payee love for 2 s, in both people's apps |

All of it lives in `zebraMoodFor()`, with tests.

### Component API

```tsx
<Zebra
  variant="full" | "bust"
  mood="hi" | "happy" | "wink" | "sleepy" | "starry" | "love" | "worried"
  striped={true}                        // one zebra in a herd: all stripes or none
  outfit={{ head, faceneck, body }}     // ids from the catalogue; unknown ids are dropped
  size={244}                            // rendered width; height follows the viewBox
  animate={{ blink, bob, swish, dance, sparkles }}   // each optional, all off under Reduce Motion
  decorative                            // hides it from screen readers
  accessibilityLabel="Priya's zebra, done, wearing a tiara and heart shades, happy"
/>
```

`members` / `done` still exist for the few places that haven't moved to the herd; `striped` wins where both are given.

**Why the zebra is built in layers.** `react-native-svg` turns `rotation` / `scaleY` / `translateY` into a transform matrix *during render*, and the native view never sees those names — so driving them from a Reanimated animated prop does nothing after the first frame. The tail, the blinking eyes and the z's are therefore their own tiny `<Svg>` layers inside `Animated.View`s whose **view** transform moves them. A stripe animates its `height`, a genuine native prop. **Never put a `transform` string in a Reanimated animated prop on an SVG element.**

### Herd moments

| Moment | Animation |
|---|---|
| Tap Done | Stripes grow down (spring-pop), then one hop. Light haptic. Fired from the tap, not from watching `done_at` — a Done cleared by a late expense is not a celebration. |
| Done undone | Stripes fade back to plain over 400 ms; a toast says why. |
| Herd complete | Every zebra goes starry and hops in a wave (staggered 120 ms), confetti, success haptic. Only when it happens while you're watching. |
| Payment lands | Payer and payee go love for 2 s. |
| Nudge | The boop uses the **nudger's** outfitted zebra, with the speech bubble. |
| Equip an item | The item drops on with a small squash (1.15 → 1, 260 ms). |

### Where the zebra appears

| Place | Form, size | Mood |
|---|---|---|
| **Home: balance hero** | Bust ~112, bottom-right of the card, **wearing your head and face** (a bust is cropped at the shoulder, so a body item would be clipped) | Net > 0 happy, < 0 worried, nothing open sleepy |
| **Home: dazzle card** | Mini herd of busts, up to 8, in their outfits. Still-adding faded to 40 % with a dashed ring; done at full opacity with a small ink check | Per member |
| **Dazzle page** | The **Pasture**, full width, 300 pt, under a "THE HERD" overline | Per member |
| **Herd page** | Full zebra per member, yours first and larger | Per member |
| **Member screen** | Full, 168, in their outfit | happy if done, else hi |
| **Your zebra / the wardrobe** | Full, 236, on the stage, in your outfit | Previewed only; never saved |
| **Shop** | Full, 210, wearing your look with the previewed item over it | happy |
| **Close out** | Full, 244, **in your outfit** | Progress / payment rules |
| **Nudge, invites, empty states, errors** | Bust, small | happy / wink / hi / sleepy / worried as before |
| **Trip recap / share** | Full, starry, sparkles, tail up | starry |

Never use the zebra as decoration with no meaning, and never change its anatomy, proportions or colours per screen. A herd of twelve on one screen is correct; **twelve animated zebras is the cap**, and off-screen ones should not animate.

## 8. Stripes as a language

- **On a zebra's body:** that person is Done.
- **Name tags in the field:** a small volt stripe when striped, dashed when still adding.
- **Who slept where:** one stripe per person per night stayed (cells 7°).
- **Category chart (Story, Wrapped, the dazzle Summary tab):** horizontal rounded bars on a ghost track, one per top-level category, largest first, amounts right-aligned. These bars are the **one** place the category palette may be used — see §3.
- **Loading skeletons:** ghost rounded bars (radius full) that shimmer from ghost to cream.
- **Pay "zip":** while the payment app opens, the button fills with moving diagonal ink/white stripes; marking it paid sends a zebra galloping across, dragging the volt fill behind it.
- **Confetti:** rounded 8 × 22 stripes in ink, volt and pink.

Stripes are always rounded rectangles. Never triangles, tapers, hatching or sharp bars.

The **stripe meter** (8 × 22 bars counting how many members are done) is retired. Home cards carry a mini herd instead; `StripeMeter` survives only on the marketing site and the design sheet.

## 9. Motion

Implement with `react-native-reanimated` (v3) and `react-native-svg` animated props. Use `expo-haptics` where noted (an addition; it was not on the boards). **Reduce Motion** (`AccessibilityInfo.isReduceMotionEnabled` / `useReducedMotion`, one shared hook): stop all looping animations (blink, bob, swish, twinkle, z's, live dot), replace dance/confetti/boop with a 250 ms fade, keep instant state changes. For the herd specifically: **the field stands still** — the shared clock never starts — nothing hops, mood changes **cut** instead of crossfading, and count-ups show their final value.

| Name | Where | Spec |
|---|---|---|
| Blink | Zebra eyes (hi, worried) | Loop 3.8 s; eyes scaleY to 0.1 about their own center at 94% of the cycle, back by 100% |
| Bob | Home hero zebra | Loop 3.4 s ease-in-out; translateY 0 → −5 → 0, rotate −2° ↔ 2°, origin bottom center |
| Tail swish | Full zebra | Loop 2.2 s ease-in-out; rotate −8° ↔ 14° about the tail root |
| Stripe earned | Zebra body, meters, pills | Stripe scaleY 0 → 1 from its top edge, 460 ms, bezier (.3, 1.5, .5, 1). Haptic: light impact |
| Done swipe | Avatar when you tap Done | A volt stripe swipes across the avatar (translateX −100% → 0, 460 ms spring) while the Done toggle's knob slides and the track turns ink; label "Still adding" → "Done adding" |
| Dance | Zebra when the last stripe lands | Once, 1.5 s, bezier (.3, .7, .3, 1): hops −18, −11, −4 px with rotations −5°, 4°, −3°, 2° |
| Confetti | Same moment | 16 rounded stripes (8 × 22, radius 4) in ink/volt/pink from the zebra, 8 fixed trajectories (±150 × −110, etc.), rotate up to ±220°, scale 0.3 → 1, fade out; 1.5 s; second wave 220 ms later. Haptic: success |
| Rise | Settle card, toasts, newly shown cards | translateY 14 → 0 + fade in, 550 ms, bezier (.2, .8, .2, 1) |
| Receipt prints in | After a receipt photo is read | Receipt slides down from behind a black "printer slot" bar (translateY −100% → 0), then the TOTAL counts up over 900 ms (ease-out cubic) inside a volt highlight |
| Check ticks up | Opening a dazzle, Home hero | Balance counts up from 0 over 1.3 s (ease-out cubic); a volt underline stripe grows with it |
| Paint your nights | Who slept where | Tapped cells fill (stripe grows from top, 460 ms spring); that night's moon pops (scale 1 → 1.4 → 1, 450 ms); per-night cost pills update instantly |
| Stripes zip to Venmo | Any Pay button | On tap: label "Opening Venmo…", button fills with diagonal ink/white stripes (14 px, 115°) moving 56 px every 0.5 s. On return/mark paid: volt fill, "Paid, nice", zebra goes love and springs to 1.12. Haptic: success |
| Boop | Nudge | Zebra bust rises from 46 px below the avatar with a wobble (−8°, 8°, −4°), 900 ms, bezier (.3, 1.4, .5, 1); bubble pops in after 350 ms (scale .6 → 1.05 → 1, 450 ms). Haptic: light |
| Mood crossfade | Zebra | Eye groups crossfade, 250 ms |
| Twinkle | Moons on night headers | Loop 2.6 s, opacity 1 ↔ 0.45 |
| Z's float | Sleepy zebra | Loop 2.4 s, translateY 0 ↔ −6, opacity 1 ↔ 0.5 |
| Live dot | Anything "live" (realtime, looping) | Pink dot, loop 1.4 s, opacity 1 ↔ 0.35 |
| Color/background changes | Pills, cells, check line | 200–250 ms ease |
| Press | All pressables | Scale 0.97–0.98, 120 ms; release springs back |

The "Moments of delight" board auto-loops these for review only. In the app, each plays once when its real event happens.

## 10. Words

- **dazzle** = trip in the UI ("Your dazzles", "Start a dazzle", "6 in the dazzle"). The code and database keep `trip`.
- **stripe** = a member who's Done. A zebra is **striped** or **still adding**; a dazzle is a **herd**. "Zebras not closed out: Jess, Jordan.", "Every zebra has closed out.", "All 8 striped".
- Approved lines: "Every zebra has closed out. Time to settle.", "We earned our stripes. Share the recap?", "Who slept where?", "Every night you stayed is a stripe.", "Save the stripes", "Paid, nice!", "psst, add your receipts", "Tiara on. Your herd will see it."
- Retired with the old model: "Earn your stripes" as a screen name, and "Stripes are even" (money language applied to stripes).
- One pun per screen, max. Error messages and money confirmations are always plain English, never punny.
- Money phrasing: "owed to you", "you owe", "Mike pays you", "Pay Mike $84.50".

## 11. Accessibility

- All text meets AA (see section 3); minimum text size 11, and 11 only for night headers.
- Every zebra has an `accessibilityLabel` describing the state — in a herd, `herdZebraLabel` gives "Priya's zebra, done, wearing a tiara and heart shades, happy". Decorative busts in pills and tiles pass `decorative`, which sets **both** `accessibilityElementsHidden` (iOS) and `importantForAccessibility="no-hide-descendants"` (Android); one without the other leaves it announced on the other platform.
- Stripe meters expose "3 of 6 people are done adding expenses".
- Night cells are buttons with `accessibilityState={{ selected }}` and labels like "Jordan, Sun Oct 11, stayed".
- Color is never the only signal: amounts carry +/−, locked buttons say why, done pills say "Done".
- Dynamic Type: allow scaling up to 1.3× on body text; balance displays cap at 1.15×.

## 12. Gaps found in the audit (historical)

*Kept as a record of what was decided and why. The reskin shipped; every item below is resolved, and several have since been superseded again by the herd (§7).*

1. The V1 spec's design-system section (Inter, Basalt & Spore, the blue-themed "Pretty Good" kit, its radius scale 4/8/12/16/24) is obsolete. Remove that theme from the code.
2. Ink was `#171512` on two boards and `#1D1A17` elsewhere; shadows used two ink tints. Use `#1D1A17` everywhere.
3. "Still adding expenses" used `#8A857D` (fails contrast). Use `muted`.
4. Name: the app is **Zebrasplit** (was Checkm8). Update the display name, splash, wordmark and copy. Bundle IDs and store listings are out of scope unless the owner says otherwise.
5. Dazzle-page tabs: the board says **Mine · All · Summary**; the spec says **Expenses · Per person · Summary**. Default: keep the spec's three views and label them **Expenses · People · Summary** in the new style, unless the owner prefers the board's labels.
6. Home in the spec has **search** and a **Current / Past** split; the board has **Open / Past** and no search. Default: "Open / Past" labels, plus a 44 px search icon button in the top bar that expands into a pill search field.
7. The spec's **"Who hasn't logged yet"** line and the **member avatar row with Done badges** are not on the Dazzle board. Add both: the avatar row under the title (done = ink avatar with volt stripe), and a caption under the balance card ("Jordan hasn't added anything yet") in muted text with a small pink dot.
8. **Settlement preview accordion** (spec) is not drawn. Use an InsetPanel under the balance card: "See who pays who" with a chevron; expands (rise) into payment rows like the settle card.
9. **Disabled/locked** look: the earlier A direction hatched locked buttons; the final boards use a sand pill with the reason. Use the sand version.
10. Screens never drawn: login + profile, create dazzle (details, invite), add/edit expense, close-out and pay, recap, web guest view, comments, action sheets, toasts, empty, loading, error, offline. Build them from these components and rules (see the reskin prompt for each).
11. **Wink** mood was defined but unused. It's now assigned to invites, joins and sharing.
12. Group size varies; the boards only show 4 and 6. **Superseded:** stripes are no longer per member — see §7. Group size is now handled by `herdLayout` (rows for 1–12) and `herdPick` (you plus 11, reshuffled, over 12).
