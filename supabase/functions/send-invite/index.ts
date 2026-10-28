// send-invite: text an invitee their link (spec: Create trip → Invite; Push
// notifications → "Invited to a trip": text message if not on the app).
// Called by Postgres (invites insert trigger → pg_net) with the shared secret,
// or by the app with the user's JWT (then only for invites they sent).
// Body: { invite_id }
// Twilio secrets: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (a
// Messaging Service SID "MG…" or an E.164 number). Missing secrets fail soft:
// the attempt is logged in notification_log with the error, nothing throws.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, internalOk, json } from "../_shared/cors.ts";
import { withSentry } from "../_shared/sentry.ts";

/** One line of plain text from something a user typed: links and domains out, whitespace collapsed, cut to `max`. */
function clean(s: string | null | undefined, max: number): string {
  return (s ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, "")
    .replace(/\S+\.(?:com|net|org|io|app|co|me|link|xyz|info|ly|gg|tv|dev|us|ca)(?:\/\S*)?\b/gi, "")
    .replace(/['`"]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
}

Deno.serve(withSentry("send-invite", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const { invite_id } = await req.json().catch(() => ({}));
  if (!invite_id) return json({ error: "invite_id required" }, 400);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let callerId: string | null = null;
  if (!internalOk(req)) {
    const auth = req.headers.get("Authorization") ?? "";
    const { data: { user } } = await createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } }).auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    callerId = user.id;
  }

  const { data: inv } = await admin.from("invites").select("id, trip_id, phone, token, status, invited_by, text_ok, trips(title), users!invites_invited_by_fkey(display_name)").eq("id", invite_id).maybeSingle();
  if (!inv) return json({ error: "invite not found" }, 404);
  if (callerId && inv.invited_by !== callerId) return json({ error: "forbidden" }, 403);
  if (inv.status !== "pending") return json({ skipped: inv.status });
  // the inviter did not tick the consent box: the invite exists, nothing is texted (toll-free 30513)
  if (inv.text_ok === false) return json({ skipped: "no consent to text" });

  // one text per invite per day: a successful send is recorded under this dedupe key
  const { data: prior } = await admin.from("notification_log").select("id, sent_at, payload").eq("dedupe_key", `invite.sms:${inv.id}`).maybeSingle();
  const priorSid = (prior?.payload as { sid?: string } | null)?.sid;
  if (priorSid && prior?.sent_at && Date.now() - new Date(prior.sent_at).getTime() < 24 * 3600 * 1000) {
    return json({ skipped: "already sent", sid: priorSid, sent_at: prior.sent_at });
  }

  // already on the app? the insert trigger pushed them the join link and the invite stays pending
  // until they accept. A phone-only account with no display name (never finished sign-up) still gets the text.
  const { data: existing } = await admin.from("users").select("id, display_name").eq("phone", inv.phone).maybeSingle();
  const trip = (inv as unknown as { trips: { title: string } | null }).trips;
  const inviter = (inv as unknown as { users: { display_name: string | null } | null }).users;
  // both strings are user-typed: no links, no line breaks, short, so the text cannot be made
  // to carry anything but the invite
  const who = clean(inviter?.display_name?.split(" ")[0], 24) || "A friend";
  const title = clean(trip?.title, 40) || "a trip";
  // zebrasplit.com/join/<token> is the invite landing page: it previews the Dazzle, carries the
  // store badges, and is the path claimed by the apple-app-site-association file, so on a phone
  // with the app installed the link opens the app instead of the browser. The apex is deliberate:
  // www 308-redirects to it and iOS does not follow redirects when fetching the AASA.
  const base = Deno.env.get("INVITE_BASE_URL") ?? "https://zebrasplit.com/join/";
  // one-time invitation; the Messaging Service handles STOP/HELP automatically
  const text = `Zebrasplit: ${who} added you to '${title}' to split trip expenses. Open it: ${base}${inv.token}\nReply STOP to opt out.`;
  const to = inv.phone.startsWith("+") ? inv.phone : `+${inv.phone}`;

  // texts go to US/Canada numbers only (the toll-free number reaches nowhere else), at most
  // three a day to one number whoever invites, and at most INVITE_SMS_DAILY_CAP a day in all.
  // The invite trigger applies the first two before the row exists; this is the backstop for
  // calls that reach the function another way. A capped invite keeps its join link.
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const sentTexts = () => admin.from("notification_log").select("id", { count: "exact", head: true }).eq("kind", "invite.sms").gte("sent_at", since).not("payload->>sid", "is", null);
  const dailyCap = Number(Deno.env.get("INVITE_SMS_DAILY_CAP") ?? "500") || 500;
  let capped: string | null = null;
  if (!/^\+1[2-9]\d{2}[2-9]\d{6}$/.test(to)) capped = "outside US/Canada";
  else if (((await sentTexts().eq("payload->>to", to)).count ?? 0) >= 3) capped = "three texts a day to one number";
  else if (((await sentTexts()).count ?? 0) >= dailyCap) capped = "daily text cap";

  const sid = Deno.env.get("TWILIO_ACCOUNT_SID"), tok = Deno.env.get("TWILIO_AUTH_TOKEN"), from = Deno.env.get("TWILIO_FROM");
  let result: Record<string, unknown>;
  if (existing?.display_name) {
    result = { skipped: "has account" };  // no text to people who already use Zebrasplit (user decision 2026-09-30)
  } else if (capped) {
    result = { skipped: capped };
  } else if (!sid || !tok || !from) {
    result = { error: "twilio not configured", missing: [!sid && "TWILIO_ACCOUNT_SID", !tok && "TWILIO_AUTH_TOKEN", !from && "TWILIO_FROM"].filter(Boolean) };
  } else {
    const form = new URLSearchParams({ To: to, Body: text });
    if (from.startsWith("MG")) form.set("MessagingServiceSid", from); else form.set("From", from);
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST", headers: { Authorization: "Basic " + btoa(`${sid}:${tok}`), "Content-Type": "application/x-www-form-urlencoded" }, body: form,
    });
    const j = await r.json().catch(() => ({}));
    result = r.ok ? { sid: j.sid, status: j.status } : { error: j.message ?? `twilio ${r.status}`, code: j.code };
  }
  if (existing?.id) {
    // they have the app: a push carries the join link; joining is theirs to accept
    // (the insert trigger already sent this for named accounts; the dedupe key keeps it to one)
    const body = `${who} invited you to this Dazzle. Tap to accept.`;
    await admin.from("notification_log").insert({ user_id: existing.id, trip_id: inv.trip_id, kind: "invite.push", payload: { title: trip?.title ?? "Zebrasplit", body } });
    await admin.rpc("notify", { p_user: existing.id, p_kind: "trip.invited", p_title: trip?.title ?? "Zebrasplit", p_body: body, p_data: { token: inv.token, url: `zebrasplit://join/${inv.token}` }, p_trip: inv.trip_id, p_dedupe: `invite:${inv.id}` }).then(() => undefined, () => undefined);
  }
  await admin.from("notification_log").upsert({ user_id: inv.invited_by, trip_id: inv.trip_id, kind: "invite.sms", dedupe_key: `invite.sms:${inv.id}`, payload: { to, text, ...result }, sent_at: new Date().toISOString() }, { onConflict: "dedupe_key" });
  return json({ ok: !("error" in result), ...result });
}));
