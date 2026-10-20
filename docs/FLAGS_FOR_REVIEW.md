# Decisions log: herd and wardrobe × stories (v2, after review)

Everything is settled and written into `ZEBRASPLIT_HERD_STORIES_PROMPT.md`. Part C (the small calls made while applying your answers) is confirmed. Nothing is open.

## Part A: Settled by the latest design (unchanged)

| # | Topic | Resolution |
|---|---|---|
| A1 | Stripes | One zebra per member; the trip gets no stripe meter |
| A2 | Slots | 3 slots: Head / Face & neck / Body |
| A4 | Wardrobe tabs | Head / Face & neck / Body |
| A5 | Outfit art | Already drawn: masters and manifest in `design/zebra/outfits/` |
| A6 | Account tab | No "Edit your zebra" link; old boards are in `_superseded/` |
| A7 | Board sets | herd/ beats stories/ for Account and Zebra |
| A8 | Field rows | 1, 2 or 3 rows by herd size |
| A9 | Story boards | Use the real zebra, not the stand-ins |
| A10 | Earn your stripes | Merged into the trip herd |
| A11 | Hoodie | Hood up hides the hat |

## Part B: Your answers

| # | Topic | Decision |
|---|---|---|
| B1 | Two places to buy | Keep both: the Shop and the Zebra tab, sharing one PurchaseSheet |
| B2 | Gifting | Kept, and kept simple:<br>• Pick one or more members, or "Whole herd", and pay once.<br>• **Account holders only**; guests are greyed out.<br>• This is how groups buy packs for each other. |
| B3 | Home trip cards | Mini herd of busts |
| B4 | Party hat | Head slot |
| B5 | Crown | Back, as a Head item at $0.99. New art is on the canvas. |
| B6 | Free | Pink beanie, Joker hat, Glasses, Sunglasses, Zebra tee, Scarf |
| B6 | Earned | First trip → Yellow cap. Five trips → Party hat. First gift sent → Tiara. |
| B6 | Paid | $0.99 every individual item; $2.99 every pack |
| B7 | Packs | • **Bachelorette:** sash, skirt, tiara<br>• **Jersey:** jersey and cap in blue, green, purple or red |
| B8 | Drop banner | Built, switched off, no content |
| B9 | Chart colors | Charts only, nowhere else ever, enforced by a lint rule |
| B10 | Tokens | `packages/theme` is the single source; `src/theme` re-exports it |
| B11 | Outfit history | Yes |
| B12 | Tapping a zebra | Opens the member sheet; only the owner's own Done changes stripes |
| B13 | Over 12 members | Unlimited members, 12 drawn: you plus 11 reshuffled each time the app opens, plus "+N more" |
| B14 | TikTok video and logo animation | Fully built, behind flags that stay off |

## Part C: Small calls made while applying them (all confirmed 2026-10-20)

1. **"Pink hat" is the existing pink beanie and "Yellow hat" is the existing volt baseball cap.** I renamed them "Pink beanie" and "Yellow cap" so they line up with the Blue, Green, Purple and Red caps.
2. **Jersey pack is four separate $2.99 products, one per color**, shown as one card with a color picker. That way a group can all get red. *Alternative:* one $2.99 purchase unlocks all four colors.
3. **Team colors are new hues, used in outfit art only**: blue `#2F6BFF`, green `#1FA463`, purple `#7A4DFF`, red `#F0443A`. They are deliberately different from the chart palette, so the chart colors stay chart-only.
4. **Pack items also sell singly at $0.99** (sash, skirt, team jerseys and caps), following "$0.99 for every individual item". The **Tiara is the exception**: you earn it or get it in the Bachelorette pack, with no single purchase.
5. **Moved by your list:**
   - Lei: earned → $0.99
   - Flat brim, Spectacles, Flannel: free → $0.99
   - Festival and Ski week packs: dropped (Mohawk, Star shades and Ski goggles are now $0.99 singles; the Scarf is free)
   - Pink jersey: kept as a $0.99 single
6. **Gift payments** use consumable "gift" products at the same prices, quantity = number of recipients, verified on the server before anyone receives anything. Apple and Google require purchases on someone else's behalf to work this way.
7. **"Whole herd" gifting** skips anyone who already owns everything in the gift, and says so before you pay.

## Yours to do outside the code

- App Store Connect and Play Console:
  - **Products:** 32 items, 5 packs (Bachelorette plus four Jersey colors) and 2 gift products.
  - **Agreements:** the paid apps agreement, tax and banking, and the small-business program.
- Privacy Policy and store privacy labels: update them for purchases, gifting and AI-written stories.
- FAQ: wardrobe purchases go through Apple and Google, not Venmo.
