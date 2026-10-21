/**
 * The product FAQ, in one place: the marketing site (/faq and the homepage preview),
 * the FAQPage JSON-LD and the in-app FAQ screen all read from here, so an answer is
 * only ever written once. Wording is the site copy (design/reference/site/FAQ.dc.html).
 */
export type FaqItem = { section: string; id: string; question: string; answer: string; list?: readonly string[] };
export type FaqSection = { id: string; title: string; items: FaqItem[] };

const S = (id: string, title: string, items: [string, string, string, (readonly string[])?][]): FaqSection => ({
  id,
  title,
  items: items.map(([qid, question, answer, list]) => ({ section: id, id: qid, question, answer, ...(list ? { list } : {}) })),
});

export const faqSections: FaqSection[] = [
  S("start", "Getting started", [
    ["what-is-zebrasplit", "What is Zebrasplit?", "An app for splitting group trip costs. Everyone logs what they paid, taps Done when they’re finished, and the group settles up in Venmo, Cash App or PayPal with the fewest payments possible."],
    ["what-is-a-dazzle", "What’s a “Dazzle”?", "A group of zebras is called a Dazzle. In Zebrasplit, it’s your trip: the people, the expenses and the herd."],
    ["what-is-the-herd", "What’s the herd?", "Everyone in the Dazzle is their own zebra, standing in a field on the trip page. A zebra is plain until its owner has finished adding expenses, then it earns its stripes. When every zebra is striped, the group can settle up."],
    ["what-do-the-stripes-mean", "What do the stripes mean?", "That person has finished adding their expenses. Stripes never mean money — what you owe or are owed is always shown as a number."],
    ["how-do-i-invite-people", "How do I invite people?", "Pick them from your contacts or type a phone number. They get a text with a link and can join from the app or straight from their browser."],
    ["do-my-friends-need-to-download-the-app", "Do my friends need to download the app?", "No. They can open the invite link in a browser, verify their phone number, add expenses and tap Done. The app adds nudges and the one-tap payments."],
  ]),
  S("adding", "Adding expenses", [
    ["is-there-a-limit", "Is there a limit on how many expenses I can add?", "No. Log as many as the trip needs."],
    ["ways-to-split-a-cost", "What are the ways to split a cost?", "Five ways:", ["Evenly", "Exact amounts", "Percentages", "Shares (e.g. a family counts as 2)", "By nights stayed, for lodging"]],
    ["how-does-the-receipt-scan-work", "How does the receipt scan work?", "Snap a photo and Zebrasplit reads the total and fills it in. You can always correct it, and the photo stays on the expense as proof."],
    ["why-do-i-add-the-tip-separately", "Why do I add the tip separately?", "Receipts usually print before you write in the tip, so the tip gets its own field and is added on top of the total."],
    ["how-does-who-slept-where-work", "How does “Who slept where” work?", "Tap the nights each person stayed. Each night’s cost is shared only by the people there that night, so late arrivals pay less automatically."],
    ["can-we-use-different-currencies", "Can we use different currencies?", "Yes. Log in any currency. The exchange rate locks when you save, and everything settles in the trip’s main currency."],
    ["can-i-add-expenses-with-no-signal", "Can I add expenses with no signal?", "Yes. They’re saved on your phone and sync when you’re back online."],
  ]),
  S("done", "Done and closing out", [
    ["what-does-tapping-done-do", "What does tapping “Done” do?", "It tells the group you’ve finished adding expenses, and your zebra earns its stripes. Close-out unlocks when every zebra is striped."],
    ["why-did-my-stripes-disappear", "Someone added an expense after I tapped Done. Why did my zebra lose its stripes?", "The totals changed, so Zebrasplit asks you to take another look before signing off. That way nobody agrees to numbers they haven’t seen."],
    ["what-if-someone-never-taps-done", "What if someone never taps Done?", "Send a nudge, and Zebrasplit sends gentle reminders too. If they still don’t respond, the trip owner can close out anyway."],
    ["why-only-one-or-two-payments", "Why do I only have one or two payments to make?", "Zebrasplit works out the smallest number of payments that settles everyone up, so you usually pay one person instead of five."],
  ]),
  S("money", "Money and payments", [
    ["does-zebrasplit-handle-my-money", "Does Zebrasplit handle my money?", "No. Zebrasplit never touches or holds money and never asks for bank or card details. The Pay button opens Venmo, Cash App or PayPal with the amount already filled in, and you send it there."],
    ["which-apps-can-i-get-paid-on", "Which apps can I get paid on?", "Venmo, Cash App or PayPal. Add at least one when you sign up, and as many as you like in Settings — the more you add, the easier you are to pay. Whoever owes you picks from the ones you've added."],
    ["can-i-pay-people-on-different-apps", "Can I pay different people on different apps?", "Yes. Each payment shows the app it will open, and you can switch it to any other app that person has added. If someone has nothing listed, or you paid by cash, Zelle or bank transfer, just mark the payment as paid."],
    ["how-do-i-know-someone-paid", "How do I know someone actually paid me?", "They mark the payment as paid, and you can confirm with “Got it”. The trip shows as settled once every payment is marked."],
  ]),
  S("privacy", "Privacy and security", [
    ["who-can-see-my-trip-and-receipts", "Who can see my trip and receipts?", "Only the people in that trip. Receipt photos are stored privately and deleted when the trip is deleted."],
    ["does-the-ai-keep-my-receipt-photos", "Does the AI keep my receipt photos?", "The photo is read to pull out the total and isn’t used to train AI models."],
    ["do-you-sell-my-data-or-contacts", "Do you sell my data or contacts?", "No. Contacts are used only to invite people you choose."],
  ]),
  S("zebra", "Your zebra", [
    ["can-i-customise-my-zebra", "Can I change how my zebra looks?", "Yes. Open Account → Zebra and pick one item for the head, one for the face and neck, and one for the body. Everyone in your Dazzles sees what you’re wearing."],
    ["how-do-i-get-outfits", "How do I get outfits?", "Some are free from the start, some you earn, and the rest are small one-off purchases. You earn the yellow cap by settling your first trip, the party hat at five, and the tiara by sending your first gift."],
    ["do-outfits-cost-real-money", "Do outfits cost real money?", "The paid ones do, and they’re bought through the App Store or Google Play like any other in-app purchase — never through Venmo, Cash App or PayPal. Those are only ever used to pay the people you travelled with, and Zebrasplit never touches that money."],
    ["does-an-outfit-change-my-split", "Does what I wear affect my share?", "No. Outfits are decoration. They change nothing about who owes what."],
  ]),
  S("pricing", "Pricing", [
    ["is-zebrasplit-free", "Is Zebrasplit free?", "Splitting, stripes and settling up are free, and always will be. Outfits for your zebra are optional extras you can buy or earn; nothing about sharing costs with your group is behind them."],
  ]),
  S("after", "After the trip", [
    ["what-happens-when-the-trip-is-over", "What happens when the trip is over?", "Once everyone’s settled, the trip moves to Past and you get a recap: total, cost per person, biggest expense and who fronted the most. Inactive trips also move to Past automatically after 14 days."],
    ["can-i-share-the-recap", "Can I share the recap?", "Yes. Export it as an image and send it to the group chat."],
  ]),
];

export const faqItems: FaqItem[] = faqSections.flatMap((s) => s.items);
export const faqById = (id: string) => faqItems.find((f) => f.id === id);

/** The five questions the marketing homepage preview shows, in this order. */
export const homepageFaqIds = ["is-zebrasplit-free", "does-zebrasplit-handle-my-money", "do-my-friends-need-to-download-the-app", "what-if-someone-never-taps-done", "how-does-who-slept-where-work"] as const;
export const homepageFaq = (): FaqItem[] => homepageFaqIds.map((id) => faqById(id)!).filter(Boolean);

/** Answer text with its bullet list folded in — for JSON-LD and anywhere plain text is needed. */
export const faqPlainAnswer = (f: FaqItem): string => (f.list ? `${f.answer} ${f.list.join(", ")}.` : f.answer);
