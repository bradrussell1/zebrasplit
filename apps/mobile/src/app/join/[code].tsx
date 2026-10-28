import { color, layout, palette, space } from "@bunktab/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, ErrorPanel, ScreenBackground, ZText, Zebra } from "@/ui";
import { useAuth } from "@/lib/auth";
import { acceptInvite, declineInvite, rememberJoin } from "@/lib/invites";
import { supabase } from "@/lib/supabase";

/**
 * Invite landing in the app: zebrasplit.com/join/<token> opens here through the
 * universal link (apple-app-site-association on the site allows /join/*), and
 * zebrasplit://join/<token> does the same (the push to an existing user carries it).
 *
 * Nobody joins without tapping Accept (user decision 2026-10-27).
 * Signed in  → the preview, then Accept (accept_invite_token: the invite must have
 *              been sent to this account's confirmed number) or Not now.
 * Signed out → the public preview (get_invite_preview: no phones, amounts or ids)
 *              and Log in; the code is kept on the device and this screen reopens
 *              once the account is in. Home also lists the invite under Invitations.
 */
type Preview = {
  state: "valid" | "expired" | "invalid" | "accepted" | "settled";
  inviter?: string | null;
  trip?: { name?: string | null } | null;
  member_count?: number;
  expense_count?: number;
};

const MESSAGES: Record<string, string> = {
  expired: "This invite link has expired or was already used. Ask the organizer for a new one.",
  invalid: "This invite link isn't working. Ask the organizer to send a new one.",
  accepted: "This invite was already accepted. The Dazzle is on your home screen.",
  settled: "This Dazzle is all settled. Nothing left to join.",
};

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);

  useEffect(() => {
    if (authLoading || !code) return;
    let alive = true;
    supabase.rpc("get_invite_preview", { code }).then(
      ({ data }) => { if (alive) setPreview((data as Preview) ?? { state: "invalid" }); },
      () => { if (alive) setPreview({ state: "invalid" }); },
    );
    return () => { alive = false; };
  }, [authLoading, code]);

  async function accept() {
    if (!code) return;
    setBusy("accept"); setError(null);
    const r = await acceptInvite(code);
    setBusy(null);
    if ("error" in r) { setError(r.error); return; }
    router.replace(`/trip/${r.tripId}`);
  }
  async function decline() {
    if (!code) return;
    setBusy("decline"); setError(null);
    const e = await declineInvite(code);
    setBusy(null);
    if (e) { setError(e); return; }
    router.replace("/home");
  }
  async function logIn() {
    if (code) await rememberJoin(code);
    router.replace("/(auth)/login");
  }

  const bad = !!preview && preview.state !== "valid";
  const title = error || bad
    ? "Couldn't open this invite"
    : preview?.trip?.name
      ? `${preview.inviter ?? "A friend"} invited you to ${preview.trip.name}`
      : "You're invited to a Dazzle";
  const counts = preview?.state === "valid"
    ? [
        preview.member_count ? `${preview.member_count} ${preview.member_count === 1 ? "person" : "people"}` : null,
        preview.expense_count ? `${preview.expense_count} ${preview.expense_count === 1 ? "expense" : "expenses"} so far` : null,
      ].filter(Boolean).join(" · ")
    : "";

  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <View style={styles.body}>
        <Zebra variant="bust" mood={error || bad ? "worried" : "wink"} size={132} animate={{ blink: !error && !bad }} decorative />
        <ZText variant="title1" accessibilityRole="header" style={styles.title}>{title}</ZText>

        {error ? <ErrorPanel message={error} /> : null}
        {!error && bad ? <ErrorPanel message={MESSAGES[preview!.state] ?? MESSAGES.invalid} /> : null}

        {!error && preview?.state === "valid" ? (
          <Card style={styles.card}>
            <ZText variant="body" color={color.textSecondary}>
              {session
                ? "Accept and you're in: log what you paid, tap Done to earn your stripe, and settle up when everyone's done."
                : "Log in with the phone number that got the text, then accept the invite."}
            </ZText>
            {counts ? <ZText variant="caption" color={color.textSecondary}>{counts}</ZText> : null}
          </Card>
        ) : null}

        {!session && preview?.state === "valid" ? (
          <Button kind="primary" label="Log in to join" onPress={logIn} />
        ) : null}
        {session && !error && preview?.state === "valid" ? (
          <View style={styles.actions}>
            <Button kind="primary" label="Accept invite" loading={busy === "accept"} disabled={busy === "decline"} onPress={accept} />
            <Button kind="secondary" label="Not now" loading={busy === "decline"} disabled={busy === "accept"} onPress={decline} />
          </View>
        ) : null}
        {session && error ? (
          <Button kind="secondary" label="Try again" loading={busy === "accept"} onPress={accept} />
        ) : null}
        {session && (error || bad) ? (
          <Button kind="secondary" label="Go to my Dazzles" onPress={() => router.replace("/home")} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bgMid },
  body: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: layout.textGutter, gap: space[16] },
  title: { textAlign: "center" },
  card: { gap: space[8], alignSelf: "stretch" },
  actions: { alignSelf: "stretch", gap: space[12] },
});
