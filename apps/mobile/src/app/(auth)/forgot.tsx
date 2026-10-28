import { useRouter } from "expo-router";
import { useState } from "react";
import { AuthScreen } from "@/components/AuthScreen";
import { Button, Input } from "@/ui";
import { friendlyAuthError, parseIdentifier, resetOtp } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * Forgot password: a single "Email or phone" field and Continue. The reset
 * code always goes by text. request_password_reset_v2 (anon-callable) resolves
 * the identifier to the account and answers a masked number plus a one-hour
 * ticket, or null for anything it doesn't know. The number itself stays on the
 * server: the reset-otp function texts the code against the ticket, and the
 * code screen verifies it the same way. Then → "Enter your code" → "Reset password".
 */
export default function ForgotScreen() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function next() {
    const who = parseIdentifier(id);
    if (!who) { setError("Enter the email or phone number on your account."); return; }
    setBusy(true); setError(null);
    const identifier = "email" in who ? who.email : who.phone;
    const { data, error: e1 } = await supabase.rpc("request_password_reset_v2", { p_identifier: identifier });
    if (e1) { setBusy(false); setError(friendlyAuthError(e1.message)); return; }
    const d = (data ?? null) as { masked?: string; ticket?: string } | null;
    if (!d?.ticket) { setBusy(false); setError("We don't have an account with that " + ("email" in who ? "email." : "number.")); return; }
    const sent = await resetOtp({ action: "send", ticket: d.ticket });
    setBusy(false);
    if (sent.error) { setError(friendlyAuthError(sent.error)); return; }
    router.push({ pathname: "/(auth)/code", params: { mode: "reset", ticket: d.ticket, masked: d.masked ?? "" } });
  }

  return (
    <AuthScreen
      onBack={() => router.back()}
      title="Forgot your password?"
      lead="Enter the email or phone number on your account. We'll text a code to the number we have for you."
      footer={<Button label="Continue" onPress={next} loading={busy} />}
    >
      <Input label="Email or phone" placeholder="you@example.com or (555) 555-0100" value={id} onChangeText={setId} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="username" onSubmitEditing={next} returnKeyType="done" error={error} autoFocus />
    </AuthScreen>
  );
}
