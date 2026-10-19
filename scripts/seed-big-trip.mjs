// Seed an 8-person test trip and give the test accounts a spread of payment
// handles (Venmo / Cash App / PayPal), so the close-out platform picker has
// something to pick between.
//
// The cast is the seven test numbers plus the owner's real account. Everyone
// but the owner is marked Done, so tapping "I'm done adding expenses" on the
// phone is the last stripe and close-out unlocks there.
//
// Idempotent: an existing trip with the same title owned by Sam is deleted first.
// Usage: node scripts/seed-big-trip.mjs
import fs from "node:fs";

// A preview only, for the console summary at the end: the same greedy pairing
// @bunktab/core uses (largest debtor pays largest creditor, repeat). The app
// itself always reads the plan the database writes through generate_settlements.
function previewPlan(ledger, members) {
  const nets = Object.fromEntries(members.map((m) => [m, 0]));
  for (const e of ledger) {
    for (const [id, c] of Object.entries(e.payers)) nets[id] = (nets[id] ?? 0) + c;
    for (const [id, c] of Object.entries(e.shares)) nets[id] = (nets[id] ?? 0) - c;
  }
  const debt = members.filter((m) => nets[m] < 0).map((m) => ({ id: m, v: -nets[m] })).sort((a, b) => b.v - a.v || a.id.localeCompare(b.id));
  const cred = members.filter((m) => nets[m] > 0).map((m) => ({ id: m, v: nets[m] })).sort((a, b) => b.v - a.v || a.id.localeCompare(b.id));
  const out = [];
  let i = 0, j = 0;
  while (i < debt.length && j < cred.length) {
    const amount = Math.min(debt[i].v, cred[j].v);
    if (amount > 0) out.push({ from: debt[i].id, to: cred[j].id, cents: amount });
    debt[i].v -= amount; cred[j].v -= amount;
    if (debt[i].v === 0) i++;
    if (cred[j].v === 0) j++;
  }
  return out;
}

const env = Object.fromEntries(fs.readFileSync("apps/mobile/.env", "utf8").trim().split("\n").map((l) => l.split(/=(.*)/s).slice(0, 2)));
const BASE = env.EXPO_PUBLIC_SUPABASE_URL, ANON = env.EXPO_PUBLIC_SUPABASE_ANON_KEY.trim();
const H = (jwt) => ({ apikey: ANON, "Content-Type": "application/json", Authorization: `Bearer ${jwt}` });

// the auth endpoints drop a connection now and then; retry rather than lose the run
async function post(path, body) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(BASE + path, { method: "POST", headers: H(ANON), body: JSON.stringify(body) });
      return await r.json();
    } catch (e) {
      if (i >= 4) throw e;
      await new Promise((res) => setTimeout(res, 800 * (i + 1)));
    }
  }
}
async function pw(phone) {
  const b = await post("/auth/v1/token?grant_type=password", { phone, password: "Bunktab-Test-2026" });
  return b.access_token ? { jwt: b.access_token, id: b.user.id } : null;
}
async function otp(phone) {
  for (let i = 0; i < 4; i++) {
    await post("/auth/v1/otp", { phone });
    const b = await post("/auth/v1/verify", { phone, token: "123456", type: "sms" });
    if (b.access_token) return { jwt: b.access_token, id: b.user.id };
    await new Promise((r) => setTimeout(r, 15000));
  }
  return null;
}
const signIn = async (phone) => (await pw(phone)) ?? (await otp(phone)) ?? (() => { throw new Error(`could not sign in ${phone}`); })();

const call = async (jwt, method, path, body, prefer) => {
  const h = H(jwt); if (prefer) h.Prefer = prefer;
  let r;
  for (let i = 0; ; i++) {
    try { r = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }); break; }
    catch (e) { if (i >= 3) throw e; await new Promise((res) => setTimeout(res, 400 * (i + 1))); }
  }
  const t = await r.text();
  let d = null; try { d = t ? JSON.parse(t) : null; } catch { d = t; }
  if (r.status >= 400) throw new Error(`${method} ${path} ${r.status} ${JSON.stringify(d).slice(0, 200)}`);
  return d;
};

// ---------------------------------------------------------------------------
// 1. the cast
// ---------------------------------------------------------------------------
const CAST = [
  { key: "sam",    phone: "+15555550103", name: "Sam Rivera" },
  { key: "priya",  phone: "+15555550104", name: "Priya Patel" },
  { key: "mike",   phone: "+15555550105", name: "Mike Chen" },
  { key: "jen",    phone: "+15555550106", name: "Jen Alvarez" },
  { key: "jordan", phone: "+15555550101", name: "Jordan Test" },
  { key: "bradt",  phone: "+15555550100", name: "Bradley Test" },
  { key: "alex",   phone: "+15555550102", name: "Alex Kim" },
];

const people = {};
for (const c of CAST) { people[c.key] = await signIn(c.phone); console.log("signed in", c.name); }

// make sure everyone has a name (0102 may never have finished sign-up)
for (const c of CAST) {
  const [row] = await call(people[c.key].jwt, "GET", `/rest/v1/users?select=display_name&id=eq.${people[c.key].id}`);
  if (!row?.display_name) {
    const [first, ...rest] = c.name.split(" ");
    await call(people[c.key].jwt, "PATCH", `/rest/v1/users?id=eq.${people[c.key].id}`, { first_name: first, last_name: rest.join(" "), display_name: c.name });
    console.log("named", c.name);
  }
}

// ---------------------------------------------------------------------------
// 2. payment handles — a deliberate spread, so the picker has real choices
// ---------------------------------------------------------------------------
const HANDLES = {
  sam:    { venmo: "sam-rivera-c8", cashapp: "samrivera", paypal: "samrivera", def: "venmo" },
  priya:  { cashapp: "priyapatel", paypal: "priyapatel", def: "cashapp" },
  mike:   { venmo: "mike-chen-c8", paypal: "mikechen", def: "paypal" },
  jen:    { venmo: "jen-alvarez-c8", cashapp: "jenalvarez", def: "cashapp" },
  jordan: { venmo: "jordan-test", cashapp: "jordantest", def: "venmo" },
  bradt:  { venmo: "bradley-test", paypal: "bradleytest", def: "venmo" },
  alex:   { venmo: "alex-kim-c8", cashapp: "alexkim", paypal: "alexkim", def: "paypal" },
};
for (const [key, spec] of Object.entries(HANDLES)) {
  const { def, ...rest } = spec;
  for (const [platform, handle] of Object.entries(rest)) {
    await call(people[key].jwt, "POST", "/rest/v1/payment_handles", { user_id: people[key].id, platform, handle }, "resolution=merge-duplicates");
  }
  await call(people[key].jwt, "PATCH", `/rest/v1/users?id=eq.${people[key].id}`, { default_pay_platform: def });
  console.log("handles", key, Object.keys(rest).join("+"), "default", def);
}

// ---------------------------------------------------------------------------
// 3. the owner's real account (a member, so the trip shows on their phone)
// ---------------------------------------------------------------------------
const sam = people.sam;
const visible = await call(sam.jwt, "GET", "/rest/v1/users?select=id,display_name,phone");
const brad = visible.find((u) => u.phone && !CAST.some((c) => c.phone.replace("+", "") === u.phone));
if (!brad) throw new Error("the owner's real account isn't visible to Sam; run seed-demo-trip first");
console.log("owner account:", brad.display_name);

const ids = Object.fromEntries(Object.entries(people).map(([k, v]) => [k, v.id]));
ids.brad = brad.id;
const KEYS = [...CAST.map((c) => c.key), "brad"];
const all = KEYS.map((k) => ids[k]);
console.log("members:", all.length);

// ---------------------------------------------------------------------------
// 4. the trip
// ---------------------------------------------------------------------------
const TITLE = "Tahoe ski house";
for (const t of await call(sam.jwt, "GET", `/rest/v1/trips?select=id&title=eq.${encodeURIComponent(TITLE)}`)) {
  await call(sam.jwt, "DELETE", `/rest/v1/trips?id=eq.${t.id}`);
  console.log("removed the previous", TITLE);
}
const [trip] = await call(sam.jwt, "POST", "/rest/v1/trips", {
  title: TITLE,
  description: "Eight of us, four nights, one very cold hot tub. Lifts Friday to Sunday.",
  start_date: "2026-12-11", end_date: "2026-12-15", base_currency: "USD", created_by: sam.id,
}, "return=representation");
const T = trip.id;
for (const k of KEYS) if (k !== "sam") await call(sam.jwt, "POST", "/rest/v1/trip_members", { trip_id: T, user_id: ids[k], role: "member" });
console.log("trip", T);

// ---------------------------------------------------------------------------
// 5. expenses — the owner fronts nothing, so they owe several people at once
//    and the close-out picker has more than one row to play with.
// ---------------------------------------------------------------------------
const EVERYONE = KEYS;
// Tuned so the owner fronts nothing and owes more than any single creditor is
// owed: the greedy settlement then hands them three payments, to three people
// whose defaults are Venmo, Cash App and PayPal — one of each, all switchable.
const E = [
  ["sam",    "Slopeside house (4 nights)",    "travel", "rentals", 90000, 0, EVERYONE, "nights"],
  ["sam",    "Hot tub service and firewood",  "other", null, 20000],
  ["sam",    "Parking at the resort",         "transportation", "parking", 15000],
  ["priya",  "Lift tickets, three days",      "recreation", null, 100000],
  ["priya",  "Après-ski at Gar Woods",        "dining", "bars", 19400, 3600],
  ["mike",   "Ski and board rentals",         "recreation", null, 96000],
  ["mike",   "Pizza night, two rounds",       "dining", "delivery", 19800, 2200],
  ["jen",    "Mountain cabin add-on night",   "travel", "rentals", 70000],
  ["jen",    "Costco run: breakfast + snacks", "groceries", null, 20000],
  ["jordan", "Big grocery shop",              "groceries", null, 60000],
  ["jordan", "Gas and chains for the drive",  "transportation", "misc", 25000],
  ["bradt",  "Lesson for the beginners",      "recreation", null, 50000],
  ["bradt",  "Thai takeaway, Saturday",       "dining", "delivery", 30000, 2000],
  ["alex",   "Sunday brunch",                 "dining", "restaurants", 41000, 4000],
  ["alex",   "Coffee and pastries",           "dining", "restaurants", 36000],
];

const split = (total, n) => { const base = Math.floor(total / n), rem = total - base * n; return Array.from({ length: n }, (_, i) => base + (i < rem ? 1 : 0)); };
const ledger = [];
let count = 0;
for (const [who, description, category, subcategory, amount, tip = 0, among = EVERYONE, kind] of E) {
  const parts = among.map((k) => ids[k]);
  const total = amount + tip;
  const payerId = ids[who];
  let shares;
  if (kind === "nights") {
    const nights = 4;
    const presence = Object.fromEntries(parts.map((p) => [p, [true, true, true, true]]));
    presence[ids.jordan] = [false, true, true, true];   // drove up a day late
    presence[ids.alex] = [true, true, true, false];     // left early
    const perNight = Math.round(total / nights);
    const acc = Object.fromEntries(parts.map((p) => [p, 0]));
    for (let n = 0; n < nights; n++) {
      const here = parts.filter((p) => presence[p][n]);
      const s = split(n === nights - 1 ? total - perNight * (nights - 1) : perNight, here.length);
      here.forEach((p, i) => (acc[p] += s[i]));
    }
    shares = parts.map((p) => ({ user_id: p, share_cents: acc[p], base_share_cents: acc[p], nights: presence[p].filter(Boolean).length, night_presence: presence[p] }));
    const drift = total - shares.reduce((a, s) => a + s.share_cents, 0);
    shares[0].share_cents += drift; shares[0].base_share_cents += drift;
  } else {
    const s = split(total, parts.length);
    shares = parts.map((p, i) => ({ user_id: p, share_cents: s[i], base_share_cents: s[i] }));
  }
  const p = {
    trip_id: T, description, category, subcategory,
    amount_cents: amount, tip_cents: tip, currency: "USD", fx_rate: 1, base_amount_cents: total,
    split_type: kind === "nights" ? "nights" : "equal", nights: kind === "nights" ? 4 : null,
    payers: [{ user_id: payerId, amount_cents: total, base_amount_cents: total }],
    shares,
  };
  // the owner's own expenses are logged by Sam on their behalf (we can't sign in as them)
  const actor = people[who] ?? sam;
  await call(actor.jwt, "POST", "/rest/v1/rpc/save_expense", { p });
  ledger.push({ id: String(count), payers: { [payerId]: total }, shares: Object.fromEntries(shares.map((s) => [s.user_id, s.share_cents])) });
  count++;
}
console.log("expenses", count);

// ---------------------------------------------------------------------------
// 6. every test account taps Done; the owner's stripe is the one left
// ---------------------------------------------------------------------------
for (const c of CAST) await call(people[c.key].jwt, "POST", "/rest/v1/rpc/set_done", { p_trip: T, p_done: true });
console.log(`done: ${CAST.length} of ${all.length} — the owner's Done tap is the last stripe`);

// ---------------------------------------------------------------------------
// 7. preview what the owner will owe, so we know the picker has work to do
// ---------------------------------------------------------------------------
const name = Object.fromEntries(KEYS.map((k) => [ids[k], k === "brad" ? (brad.display_name ?? "you") : CAST.find((c) => c.key === k).name]));
const plan = previewPlan(ledger, all);
const total = ledger.reduce((a, e) => a + Object.values(e.payers)[0], 0);
console.log(`\ntrip total $${(total / 100).toFixed(2)}`);
console.log("settlement plan:");
for (const p of plan) console.log(`  ${name[p.from]} → ${name[p.to]} $${(p.cents / 100).toFixed(2)}`);
const owner = plan.filter((p) => p.from === ids.brad);
console.log(`\nthe owner pays ${owner.length} ${owner.length === 1 ? "person" : "people"}: ${owner.map((p) => `${name[p.to]} (${HANDLES[KEYS.find((k) => ids[k] === p.to)]?.def ?? "—"})`).join(", ")}`);
