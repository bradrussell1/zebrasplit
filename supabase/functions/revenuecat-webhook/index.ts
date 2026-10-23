// revenuecat-webhook: a purchase that RevenueCat has verified with Apple or Google
// becomes rows in user_cosmetics, and nothing else does.
//
// The client never grants itself anything. It asks StoreKit to buy, StoreKit tells
// RevenueCat, RevenueCat verifies the receipt with the store and posts here; only then
// does the outfit exist for that user. A client that lies about owning the crown is
// talking to a table it has no write policy on.
//
// RevenueCat retries a failed webhook for up to 72 hours, and replays events on restore
// and reinstall, so every path through this has to be safe to run twice. grant_purchase()
// is idempotent; the rest is bookkeeping.
//
// Setup: RevenueCat dashboard → Integrations → Webhooks, URL
// https://<ref>.supabase.co/functions/v1/revenuecat-webhook with an Authorization header
// matching REVENUECAT_WEBHOOK_SECRET. Deploy with --no-verify-jwt: the caller is
// RevenueCat, not a signed-in user, and the shared secret is what authenticates it.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { withSentry } from "../_shared/sentry.ts";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

/** Events that mean "this person owns this now". */
const GRANTING = new Set(["INITIAL_PURCHASE", "NON_RENEWING_PURCHASE", "PRODUCT_CHANGE", "RENEWAL", "UNCANCELLATION", "TRANSFER"]);
/** Events that take it away again. A refunded outfit comes off the zebra. */
const REVOKING = new Set(["CANCELLATION", "EXPIRATION", "REFUND", "REFUND_REVERSED"]);

Deno.serve(withSentry("revenuecat-webhook", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // 1. It is RevenueCat, or it is nobody.
  const want = Deno.env.get("REVENUECAT_WEBHOOK_SECRET");
  if (!want) { console.error("REVENUECAT_WEBHOOK_SECRET not set"); return json({ error: "not configured" }, 500); }
  if (req.headers.get("Authorization") !== want) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => null);
  const event = body?.event;
  if (!event?.type) return json({ error: "no event" }, 400);

  // 2. Who, and what. app_user_id is the Supabase user id, set by Purchases.logIn().
  //    An anonymous RevenueCat id ($RCAnonymousID:…) means the buy happened before we
  //    identified the user; the TRANSFER event that follows the login carries the real
  //    one, so there is nothing to do here but wait for it.
  const userId: string | undefined = event.app_user_id;
  const productId: string | undefined = event.product_id;
  const type: string = event.type;
  if (!userId || userId.startsWith("$RCAnonymousID:")) {
    console.log(JSON.stringify({ event: type, skipped: "anonymous app_user_id" }));
    return json({ ok: true, skipped: "anonymous" });
  }
  if (!/^[0-9a-f-]{36}$/i.test(userId)) {
    console.log(JSON.stringify({ event: type, skipped: "app_user_id is not a uuid" }));
    return json({ ok: true, skipped: "not a uuid" });
  }
  if (!productId) return json({ ok: true, skipped: "no product" });

  // 3. Grant or revoke. Anything else (a test ping, a billing issue) is acknowledged
  //    and ignored, because a non-200 makes RevenueCat retry it for three days.
  if (GRANTING.has(type)) {
    const { data, error } = await admin.rpc("grant_purchase", { p_user_id: userId, p_product_id: productId });
    if (error) { console.error(JSON.stringify({ event: type, product: productId, error: error.message })); return json({ error: "grant failed" }, 500); }
    console.log(JSON.stringify({ event: type, product: productId, granted: data }));
    if (data === 0) console.error(JSON.stringify({ event: type, product: productId, note: "store sold a product this deploy does not know" }));
    return json({ ok: true, granted: data });
  }

  if (REVOKING.has(type)) {
    const { data, error } = await admin.rpc("revoke_purchase", { p_user_id: userId, p_product_id: productId });
    if (error) { console.error(JSON.stringify({ event: type, product: productId, error: error.message })); return json({ error: "revoke failed" }, 500); }
    console.log(JSON.stringify({ event: type, product: productId, revoked: data }));
    return json({ ok: true, revoked: data });
  }

  console.log(JSON.stringify({ event: type, ignored: true }));
  return json({ ok: true, ignored: type });
}));
