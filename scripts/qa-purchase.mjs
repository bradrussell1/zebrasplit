// Watch a real purchase land. Run it, buy something on the device, and this prints
// each new row as it appears — the ledger first, then the outfit, because that is the
// order grant_purchase() writes them.
//
// This is the only part of the chain the server can see. StoreKit charging and
// RevenueCat verifying happen off-stage; if rows appear here, every link worked.
//
// Usage: SUPABASE_ACCESS_TOKEN=sbp_… node scripts/qa-purchase.mjs [minutes]
import fs from "node:fs";

const ref = fs.readFileSync("supabase/.temp/project-ref", "utf8").trim();
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN not set");
const minutes = Number(process.argv[2] ?? 15);

async function q(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${t}`);
  return JSON.parse(t);
}

const seen = new Set();
const started = Date.now();

console.log(`watching purchases for ${minutes} min — buy something now\n`);

// what was there before, so the first tick does not replay history as news
for (const row of await q(`select user_id, product_id from public.purchases`)) {
  seen.add(`${row.user_id}:${row.product_id}`);
}
const ownedBefore = new Map();
for (const row of await q(`select user_id, cosmetic_id from public.user_cosmetics where source = 'purchase'`)) {
  ownedBefore.set(`${row.user_id}:${row.cosmetic_id}`, true);
}

while (Date.now() - started < minutes * 60_000) {
  const rows = await q(`
    select p.user_id, p.product_id, p.acquired_at, coalesce(u.display_name, 'unnamed') as who,
           (select array_agg(c.cosmetic_id order by c.cosmetic_id)
              from public.user_cosmetics c
             where c.user_id = p.user_id and c.source = 'purchase'
               and c.cosmetic_id = any(coalesce(public.product_items(p.product_id), '{}'))) as granted,
           coalesce(public.product_items(p.product_id), '{}') as expected
      from public.purchases p
      left join public.users u on u.id = p.user_id
     order by p.acquired_at desc limit 20`);

  for (const r of rows.reverse()) {
    const key = `${r.user_id}:${r.product_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const got = r.granted ?? [];
    const want = r.expected ?? [];
    const fresh = got.filter((id) => !ownedBefore.has(`${r.user_id}:${id}`));
    const ok = want.every((id) => got.includes(id));
    console.log(`${ok ? "✓" : "✗"} ${r.who} bought ${r.product_id}`);
    console.log(`   unlocks ${want.length}: ${want.join(", ")}`);
    console.log(`   owns    ${got.length}: ${got.join(", ") || "(none)"}${fresh.length < got.length ? `  [${got.length - fresh.length} already owned before this]` : ""}`);
    if (!ok) console.log(`   MISSING: ${want.filter((id) => !got.includes(id)).join(", ")}`);
    console.log();
  }
  await new Promise((r) => setTimeout(r, 3000));
}
console.log("done watching");
