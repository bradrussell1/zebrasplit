// Amend (or resubmit) the Twilio toll-free verification for +1 833 612 7553.
//
// Written after the 2026-09-29 rejection (30482 official-domain email, 30513
// consent), and needed again on 2026-10-23: the in-review submission still
// described the app as Checkm8, with check-m8.io disclosure links and a gmail
// notification address — the same 30482 ground it was rejected on before.
//
// It looks up the current verification for the number rather than assuming a
// SID, so it works whatever state the record is in: it updates in place when
// Twilio allows that, and files a fresh one when it doesn't.
//
// Usage. Put the Twilio credentials in ~/.config/zebrasplit/env beside the
// Supabase ones, so they never appear on a command line or in shell history:
//
//   TWILIO_ACCOUNT_SID=AC...
//   TWILIO_AUTH_TOKEN=...
//
// then, from the repo root:
//
//   set -a; . ~/.config/zebrasplit/env; set +a
//   NOTIFY_EMAIL=bradley@zebrasplit.com BUSINESS_EMAIL=support@zebrasplit.com \
//     node scripts/tollfree-resubmit.mjs
//
// BUSINESS_EMAIL must exist and receive mail, and should be the address the /sms
// disclosure page shows (support@zebrasplit.com today): a reviewer compares the
// contact in the submission against the one printed on that page. NOTIFY_EMAIL is
// where Twilio sends the outcome, so make it an address a person reads.
//
// It first tries to UPDATE the rejected request (HH8ad9…); if Twilio refuses
// (e.g. status no longer editable), it creates a new verification with the
// same fields and says which path it took. Never commit credentials.
// Rejected again 2026-10-26 on four grounds; what changed in answer to each:
//   30482 (business email on the official domain): NotificationEmail is checked too, not
//         just BusinessContactEmail — a gmail notify address fails the whole submission.
//   30484 (business name must match official records): there is no registered DBA, so the
//         business name is the sole proprietor's legal name, "Bradley Russell", with
//         "doing business as Zebrasplit" in the narrative and on the /sms page.
//   30508 (opt-in checkbox pre-selected): the proof screenshot must show the box unticked,
//         which is its real default — never pass ?consent=1 when taking it.
//   30513 (consent must not be a condition of service): creating the trip no longer waits
//         for the box; it only decides whether Zebrasplit sends the text (invites.text_ok).
// Rejected again 2026-10-27 on one ground, 30488 (DBA name must be accurately provided):
//   the legal name alone is not enough when the product goes by another name. The fix is the
//   DoingBusinessAs field, which this script had never sent: BusinessName stays the sole
//   proprietor's legal name and DoingBusinessAs carries "Zebrasplit", the name on the website
//   and the /sms page. The record stays editable until 2026-11-10 (edit_allowed).
const SID = process.env.TWILIO_ACCOUNT_SID, TOK = process.env.TWILIO_AUTH_TOKEN, EMAIL = process.env.BUSINESS_EMAIL;
if (!SID || !TOK || !EMAIL) { console.error("Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and BUSINESS_EMAIL"); process.exit(1); }
const official = (e) => /@(zebrasplit\.com|bunktab\.com|check-m8\.io)$/i.test(e);
if (!official(EMAIL)) { console.error(`BUSINESS_EMAIL must be on the official domain (got ${EMAIL}); Twilio rejects free-mail addresses (30482).`); process.exit(1); }
if (process.env.NOTIFY_EMAIL && !official(process.env.NOTIFY_EMAIL)) { console.error(`NOTIFY_EMAIL must be on the official domain too (got ${process.env.NOTIFY_EMAIL}); it is the address that failed 30482.`); process.exit(1); }

const OPT_IN_IMAGE = "https://zebrasplit.com/compliance/invite-opt-in.png";
// the apex redirects here, so cite the address that actually answers: a reviewer
// should never follow a hop (the check-m8.io links are exactly that bug)
const SMS_PAGE = "https://app.zebrasplit.com/sms";
const SAMPLE = "Zebrasplit: Bradley invited you to 'Tahoe long weekend' to split trip expenses. Open it: https://zebrasplit.com/join/3f9a1c2e\nReply STOP to opt out.";
const CONSENT = "I have these people's permission to send them one text from Zebrasplit about this trip. They can reply STOP to opt out. Msg & data rates may apply.";

const auth = "Basic " + Buffer.from(`${SID}:${TOK}`).toString("base64");
async function twilio(method, path, form) {
  const r = await fetch(`https://messaging.twilio.com/v1${path}`, { method, headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" }, body: form ? new URLSearchParams(form) : undefined });
  return [r.status, await r.json().catch(() => ({}))];
}

const [numStatus, nums] = await (async () => { const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/IncomingPhoneNumbers.json?PhoneNumber=%2B18336127553`, { headers: { Authorization: auth } }); return [r.status, await r.json()]; })();
// distinguish "wrong credentials" from "right account, no such number": they look
// identical if you only check whether a number came back
if (numStatus === 401) { console.error("Twilio rejected the credentials (401). Check TWILIO_ACCOUNT_SID (starts AC) and TWILIO_AUTH_TOKEN - placeholders like AC... will do this."); process.exit(1); }
if (numStatus >= 400) { console.error(`Twilio returned ${numStatus}: ${nums.message ?? JSON.stringify(nums).slice(0, 200)}`); process.exit(1); }
const pn = nums.incoming_phone_numbers?.[0];
if (!pn) {
  const [, all] = await (async () => { const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${SID}/IncomingPhoneNumbers.json?PageSize=50`, { headers: { Authorization: auth } }); return [r.status, await r.json()]; })();
  const have = (all.incoming_phone_numbers ?? []).map((n) => n.phone_number);
  console.error(`+1 833 612 7553 is not on this account. Numbers here: ${have.join(", ") || "(none)"}`);
  console.error("If the list is empty or missing it, the number is probably on a different Twilio (sub)account.");
  process.exit(1);
}

const fields = {
  BusinessType: "SOLE_PROPRIETOR",
  // the name on official records (30484): a sole proprietor with no registered DBA is the person
  BusinessName: "Bradley Russell",
  // the trade name (30488): what the website, the /sms page and the texts themselves say
  DoingBusinessAs: "Zebrasplit",
  BusinessWebsite: "https://www.zebrasplit.com",
  // the outcome notice goes to a person; the public contact matches the /sms page
  NotificationEmail: process.env.NOTIFY_EMAIL || EMAIL,
  BusinessContactEmail: EMAIL,
  BusinessContactFirstName: "Bradley",
  BusinessContactLastName: "Russell",
  BusinessContactPhone: "+16124236230",
  BusinessStreetAddress: "1801 Broadway Apt 402",
  BusinessCity: "San Francisco",
  BusinessStateProvinceRegion: "CA",
  BusinessPostalCode: "94109",
  BusinessCountry: "US",
  UseCaseCategories: "ACCOUNT_NOTIFICATIONS",
  MessageVolume: "1,000",
  OptInType: "WEB_FORM",
  // the same pages AdditionalInformation cites, as fields a reviewer can click without a hop
  PrivacyPolicyUrl: "https://app.zebrasplit.com/privacy",
  TermsAndConditionsUrl: "https://app.zebrasplit.com/terms",
  OptInImageUrls: `${OPT_IN_IMAGE},${SMS_PAGE}`,
  ProductionMessageSample: SAMPLE,
  TollfreePhoneNumberSid: pn.sid,
  // Twilio caps this field at 500 characters ("Invalid use case summary" above that); the detail lives in AdditionalInformation
  UseCaseSummary:
    "Zebrasplit (Bradley Russell dba Zebrasplit) is a trip expense-splitting app. When a user adds a friend to a trip by phone number, the friend gets one transactional invitation text with a link, sent only if the inviter ticks an optional consent box (unticked by default). Texting is never required to use the app: unticked, no text is sent. No recurring or marketing texts; max 50 invites per user per day. STOP/HELP honoured; every text ends with Reply STOP to opt out.",
  AdditionalInformation:
    "Consent flow: (1) a signed-in Zebrasplit user starts a trip -> step 2 'Invite the crew' and picks friends from contacts or types numbers; " +
    "(2) an optional checkbox appears, unticked by default: \"" + CONSENT + "\" with a link 'How Zebrasplit texts work' to " + SMS_PAGE + "; " +
    "(3) the Start button works whether or not the box is ticked: unticked, the trip is created, no text is sent, and the inviter is handed the invitation link to share however they like; " +
    "(4) ticked, one invitation text per person is sent from the Messaging Service with STOP instructions. " +
    "Business name: Bradley Russell is the sole proprietor's legal name (BusinessName); Zebrasplit is the trade name (DoingBusinessAs) under which the website, the /sms page and every text are presented. No separate registered entity. " +
    "Program disclosure (sender, frequency, opt-out, rates, sample message): " + SMS_PAGE + ". Privacy policy with the SMS section: https://zebrasplit.com/privacy. " +
    "Contact: " + EMAIL + ".",
};

// whatever verification this number already has, in whatever state
const [, list] = await twilio("GET", `/Tollfree/Verifications?TollfreePhoneNumberSid=${pn.sid}`);
const current = (list.verifications ?? [])[0];
console.log(current ? `current verification ${current.sid} is ${current.status}` : "no existing verification for this number");

let st = 400, body = {}, how = "updated the existing request";
if (current) [st, body] = await twilio("POST", `/Tollfree/Verifications/${current.sid}`, { ...fields, EditReason: "Added DoingBusinessAs (Zebrasplit) and policy URLs in answer to 30488" });
if (st >= 400) {
  console.log(current ? `update refused (${st}: ${body.message ?? ""}); filing a new verification instead` : "filing a new verification");
  [st, body] = await twilio("POST", "/Tollfree/Verifications", fields);
  how = "filed a new verification";
}
if (st >= 400) { console.error(`failed (${st})`, body.message ?? body, body.rejection_reason ?? ""); process.exit(1); }
console.log(`${how}: ${body.sid} -> ${body.status}`);
