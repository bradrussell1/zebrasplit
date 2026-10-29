import { color } from "@bunktab/theme";
import { track } from "@/lib/analytics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { AuthScreen } from "@/components/AuthScreen";
import { Button, CodeCells, TextLink, ZText } from "@/ui";
import { friendlyAuthError, resetOtp, useAuth } from "@/lib/auth";
import { useCaptcha } from "@/lib/captcha";
import { supabase } from "@/lib/supabase";

/**
 * "Enter your code": six 48 px cells, auto-submits, resend after 30 s. Callers:
 *  - phone_change: sign-up (or add-phone) attached a number to a signed-in
 *    account; the code confirms it. The root layout then lets them in.
 *  - otp: a plain text-code login for accounts without a password.
 *  - reset: forgot password; the app holds a ticket, not the number. The
 *    reset-otp function checks the code and hands back a session, and the root
 *    layout keeps them on "Reset password" (pendingPasswordReset) until saved.
 * Success flips the protected routes on its own.
 */
type Mode = "phone_change" | "otp" | "reset";

export default function CodeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string; mode?: Mode; onboarding?: string; ticket?: string; masked?: string }>();
  const { phone, mode = "otp", ticket } = params;
  const { setPendingPasswordReset, signOut, session } = useAuth();
  const getCaptcha = useCaptcha();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(30);
  const submitted = useRef(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const verify = useCallback(async (digits: string) => {
    if (submitted.current) return;
    submitted.current = true;
    setBusy(true); setError(null);
    let failed: string | null = null;
    if (mode === "reset") {
      const r = await resetOtp({ action: "verify", ticket: ticket ?? "", code: digits });
      if (r.error || !r.access_token || !r.refresh_token) failed = r.error ?? "That code isn't right. Check the text and try again.";
      else {
        setPendingPasswordReset(true); // before the session flips
        const { error: e } = await supabase.auth.setSession({ access_token: r.access_token, refresh_token: r.refresh_token });
        if (e) { setPendingPasswordReset(false); failed = e.message; }
      }
    } else {
      const { error: e } = await supabase.auth.verifyOtp({ phone: phone!, token: digits, type: mode === "phone_change" ? "phone_change" : "sms" });
      if (e) failed = e.message;
    }
    if (failed) {
      setBusy(false); submitted.current = false;
      setError(friendlyAuthError(failed));
      return;
    }
    if (mode === "phone_change") await supabase.auth.refreshSession().then(() => undefined, () => undefined); // pick up phone_confirmed_at
    // "otp" is someone signing in or signing up by code; the other modes are an
    // existing account resetting a password or swapping a number, not onboarding
    // either route into an account: a code login, or the phone step of signing up
    if (mode === "otp" || params.onboarding === "1") track("onboarding_code_verified");
    if (mode === "otp") track("login_succeeded");
    setBusy(false);
  }, [mode, phone, ticket, setPendingPasswordReset]);

  async function resend() {
    setError(null);
    // a phone change is an authenticated request and needs no captcha; the other two send a text to a stranger
    const e = mode === "reset"
      ? (await resetOtp({ action: "send", ticket: ticket ?? "", captcha_token: await getCaptcha() })).error ?? null
      : mode === "phone_change"
        ? (await supabase.auth.updateUser({ phone: phone! })).error?.message ?? null
        : (await supabase.auth.signInWithOtp({ phone: phone!, options: { shouldCreateUser: mode === "otp", captchaToken: await getCaptcha() } })).error?.message ?? null;
    if (e) { setError(friendlyAuthError(e)); return; }
    setWait(30); setCode(""); submitted.current = false;
  }

  const title = mode === "phone_change" ? "Enter the code we just sent you" : "Enter your code";
  // mid sign-up the account already exists; "back" means change the number, not abandon it
  const back = () => (mode === "phone_change" && session ? router.replace("/(auth)/add-phone") : router.back());
  // reset mode never sees the number: the server sends the masked form
  const masked = params.masked || (phone ? phone.replace(/^(\+\d)(\d+)(\d{4})$/, (_, a, b, c) => `${a} ${"•".repeat(Math.max(0, b.length))} ${c}`) : "your number");

  return (
    <AuthScreen
      onBack={back}
      title={title}
      lead={`We texted a 6-digit code to ${mode === "reset" ? masked : phone}.${mode === "phone_change" ? " Entering it confirms your number and you're in." : ""}`}
      footer={
        <>
          <Button label={mode === "phone_change" ? "Confirm and continue" : "Continue"} onPress={() => verify(code)} loading={busy} disabled={code.length < 6} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <TextLink label={mode === "reset" ? "Wrong account?" : "Wrong number?"} muted onPress={back} />
            {wait > 0
              ? <ZText variant="small" color={color.textMuted} tabular>Resend in {wait}s</ZText>
              : <TextLink label="Resend code" onPress={resend} />}
          </View>
          {mode === "phone_change" && session ? <TextLink label="Sign out" muted style={{ alignSelf: "center" }} onPress={signOut} /> : null}
        </>
      }
    >
      <CodeCells value={code} onChange={(d) => { setCode(d); if (error) setError(null); }} onComplete={verify} error={error} autoFocus />
    </AuthScreen>
  );
}
