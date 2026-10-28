import type { ReactNode } from "react";
import { legalValue } from "@/content/site";
import { Ph } from "./Ph";

export type LegalSection = { id: string; title: string; body: ReactNode };

export const privacyIntro: ReactNode = (
  <p>This Privacy Policy explains how <Ph k="companyLegalName" /> ("Zebrasplit", "we", "us") collects, uses and shares information when you use the Zebrasplit mobile apps, the website at zebrasplit.com, and any related services (together, the "Service"). By using the Service, you agree to the practices described here.</p>
);

export const privacySections: LegalSection[] = [
  { id: "information-we-collect", title: "1. Information we collect", body: (<>
    <h3>Information you give us</h3>
    <ul>
      <li><b>Account information:</b> your phone number, name, and optional profile photo and the Venmo, Cash App or PayPal usernames you choose to share so trip mates can pay you.</li>
      <li><b>Trip and expense information:</b> trip names, dates, photos, expenses, amounts, who paid, how costs are split, nights stayed, notes and comments.</li>
      <li><b>Receipt photos:</b> images you upload so we can read the total and attach the receipt to an expense.</li>
      <li><b>Information about people you invite:</b> the name and phone number of anyone you add to a trip.</li>
      <li><b>Purchases:</b> if you buy an outfit for your zebra, we receive the product you bought, the price, the store's transaction identifier and the time of purchase. See section 5.</li>
      <li><b>Communications:</b> messages you send us, such as support requests and in-app feedback.</li>
    </ul>
    <h3>Contacts</h3>
    <p>If you allow access, the app reads your device contacts so you can pick people to invite. We don't upload or store your contact list. We only receive the contacts you choose to invite.</p>
    <h3>Information collected automatically</h3>
    <p>When you use the Service, we collect device and usage information such as device type, operating system, app version, IP address, crash reports, and which features you use. Usage events are counts and categories only (for example "expense added" or "receipt scanned"); they never include names, phone numbers, amounts or trip details. Before you sign in, these events are tied to a random identifier created on your device, not to you. We use cookies and similar technologies on our website for basic operation and analytics.</p>
    <h3>What we don't collect</h3>
    <p>We don't collect bank account numbers, card numbers or the passwords to your payment apps. When you settle up, the app opens Venmo, Cash App or PayPal with the recipient and amount filled in. The payment itself happens in that app and is governed by its own terms and privacy policy. In-app purchases are charged by Apple or Google; we never see your card.</p>
  </>) },
  { id: "how-we-use-information", title: "2. How we use information", body: (
    <ul>
      <li>To provide the Service: create trips, calculate balances, work out the payments that settle a group, and prepare payment links.</li>
      <li>To verify your phone number and keep your account secure.</li>
      <li>To send invites, reminders, nudges and other notifications you'd expect from the app.</li>
      <li>To read totals from receipt photos you upload.</li>
      <li>To deliver and restore the outfits you buy for your zebra.</li>
      <li>To respond to support requests and communicate with you about the Service.</li>
      <li>To understand how the Service is used, fix bugs, and improve features.</li>
      <li>To detect and prevent fraud, abuse and security incidents, and to comply with the law.</li>
    </ul>
  ) },
  { id: "how-information-is-shared", title: "3. How information is shared", body: (<>
    <p><b>We don't sell your personal information or share it for cross-context behavioral advertising.</b> We share information only as follows:</p>
    <ul>
      <li><b>With people in your trips:</b> members of a trip can see your name, profile photo, the payment usernames you've shared, the expenses you add, receipt photos on those expenses, your Done status, your balance in that trip, and the outfit your zebra is wearing.</li>
      <li><b>With service providers:</b> companies that help us run the Service, such as cloud hosting and database providers, SMS and notification providers, receipt-reading (AI) providers, in-app purchase processing, and crash reporting. They may use the information only to provide services to us.</li>
      <li><b>With your payment app, at your direction:</b> when you tap Pay or Request, we pass the recipient and amount (and, on Venmo, a note) to Venmo, Cash App or PayPal to start the transaction.</li>
      <li><b>With Apple, Google and RevenueCat, for purchases:</b> see section 5.</li>
      <li><b>For legal reasons:</b> if required by law, or to protect the rights, safety and property of our users, the public or Zebrasplit.</li>
      <li><b>In a business transfer:</b> as part of a merger, acquisition, financing or sale of assets, subject to this policy.</li>
      <li><b>With your consent:</b> in any other case where you ask us to share.</li>
    </ul>
  </>) },
  { id: "receipt-photos-and-ai", title: "4. Receipt photos and AI", body: <p>When you scan a receipt, the image is sent to a third-party AI provider to extract the total. We don't use your receipt photos to train AI models, and we don't permit our provider to do so. Receipt photos are stored privately, visible only to members of that trip, and deleted when the trip is deleted.</p> },
  { id: "purchases", title: "5. Purchases", body: (<>
    <p>The app sells outfits for your zebra. They're cosmetic, they have no cash value, and nothing about splitting or settling a trip is behind them. Payment is taken by the App Store or Google Play under your Apple or Google account, so we never receive your card or bank details. The store sends the purchase to RevenueCat, a service that verifies store receipts for us, and RevenueCat tells our servers which product your account bought, when, for how much, and the store's transaction identifier. That record is what makes the outfit appear on your zebra, and what lets you restore it on a new phone.</p>
    <p>Refunds are handled by Apple or Google under their policies; if a purchase is refunded, the outfit is removed. Your purchase records are deleted with your account.</p>
  </>) },
  { id: "how-long-we-keep-information", title: "6. How long we keep information", body: <p>We keep your information for as long as your account is active or as needed to provide the Service. Closed trips stay in your Past list so you can look back at them. When you delete a trip or your account, we delete the related information within <Ph k="deletionDays" /> days, except where we need to keep it for legal, security or fraud-prevention purposes. Expenses you added to a shared trip may remain visible to other members in anonymized form so their balances still add up.</p> },
  { id: "your-choices-and-rights", title: "7. Your choices and rights", body: (<>
    <ul>
      <li><b>Access and update:</b> you can view and edit your profile in the app.</li>
      <li><b>Delete:</b> you can delete your account from Settings in the app, or by emailing us.</li>
      <li><b>Contacts and notifications:</b> you can turn off contacts access and push notifications in your device settings at any time.</li>
      <li><b>Invitations:</b> being invited to a trip never adds you to it. You see the invitation and choose to accept or decline.</li>
      <li><b>Text messages:</b> reply STOP to opt out of non-essential texts. We'll still send login codes when you sign in.</li>
    </ul>
    <h3>California residents</h3>
    <p>If you live in California, you have the right to know what personal information we collect, use and disclose; to request deletion or correction; and not to be discriminated against for exercising these rights. We don't sell or share personal information as those terms are defined under California law. To make a request, email <Ph k="privacyEmail" />. We'll verify your request using your phone number.</p>
    <h3>Other regions</h3>
    <p>Depending on where you live, you may have additional rights, such as the right to object to or restrict certain processing, or to data portability. Contact us and we'll respond as required by applicable law.</p>
  </>) },
  { id: "security", title: "8. Security", body: <p>We use reasonable technical and organizational measures to protect your information, including encryption in transit and access controls. No method of transmission or storage is completely secure, so we can't guarantee absolute security.</p> },
  { id: "children", title: "9. Children", body: <p>The Service is for adults. You must be 18 or older to use it, and we don't knowingly collect personal information from anyone under 18. If you believe someone under 18 has given us information, contact us and we'll delete it.</p> },
  { id: "international-users", title: "10. International users", body: <p>We're based in the United States, and your information is processed and stored in the United States, where data protection laws may differ from those in your country.</p> },
  { id: "changes-to-this-policy", title: "11. Changes to this policy", body: <p>We may update this policy from time to time. If we make material changes, we'll let you know in the app or by other means before they take effect. The "Last updated" date at the top shows when it last changed.</p> },
  { id: "contact-us", title: "12. Contact us", body: <p>Questions about this policy or your information? Email <a href={`mailto:${legalValue("privacyEmail")}`}><b><Ph k="privacyEmail" /></b></a>. That address reaches <Ph k="companyLegalName" /> directly, and we answer every message.</p> },
];
