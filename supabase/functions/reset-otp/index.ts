// reset-otp: forgot password without handing the phone number to the client.
// The app calls request_password_reset_v2 (masked number + one-hour ticket), then:
//   { action: "send",   ticket }        → texts a code to the number behind the ticket
//   { action: "verify", ticket, code }  → checks the code; answers the session tokens
// The number lives only here and in private.reset_requests. The code itself goes out
// through Supabase Auth, the same Twilio path as sign-up, so delivery is unchanged.
// Called by the app with the anon key (the user is signed out).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/cors.ts";
import { withSentry } from "../_shared/sentry.ts";

type Body = { action?: string; ticket?: string; code?: string };

Deno.serve(withSentry("reset-otp", async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const { action, ticket, code } = await req.json().catch(() => ({})) as Body;
  if (!ticket || !/^[0-9a-f-]{36}$/i.test(ticket)) return json({ error: "ticket required" }, 400);

  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const auth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const expired = "That reset has expired. Start over from Forgot password.";

  if (action === "send") {
    const { data: phone, error } = await admin.rpc("reset_ticket_phone", { p_ticket: ticket, p_action: "send" });
    if (error) return json({ error: error.message }, 429);
    if (typeof phone !== "string") return json({ error: expired }, 400);
    const { error: e } = await auth.auth.signInWithOtp({ phone, options: { shouldCreateUser: false } });
    if (e) return json({ error: e.message }, e.status ?? 400);
    return json({ ok: true });
  }

  if (action === "verify") {
    if (!code || !/^\d{6}$/.test(code)) return json({ error: "Enter the 6-digit code." }, 400);
    const { data: phone, error } = await admin.rpc("reset_ticket_phone", { p_ticket: ticket, p_action: "check" });
    if (error) return json({ error: error.message }, 429);
    if (typeof phone !== "string") return json({ error: expired }, 400);
    const { data, error: e } = await auth.auth.verifyOtp({ phone, token: code, type: "sms" });
    if (e || !data.session) return json({ error: e?.message ?? "That code isn't right." }, e?.status ?? 400);
    await admin.rpc("reset_ticket_phone", { p_ticket: ticket, p_action: "finish" }).then(() => undefined, () => undefined);
    return json({ ok: true, access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  }

  return json({ error: "action must be send or verify" }, 400);
}));
