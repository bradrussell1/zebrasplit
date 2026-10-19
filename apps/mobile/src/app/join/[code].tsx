import { color, layout, palette, space } from "@bunktab/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, ErrorPanel, ScreenBackground, ZText, Zebra } from "@/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * Invite landing in the app: zebrasplit.com/join/<token> opens here through the
 * universal link (apple-app-site-association on the site allows /join/*), and
 * zebrasplit://join/<token> does the same.
 *
 * Signed in  → accept_invite_token adds the member and we replace to the dazzle.
 * Signed out → show the public preview (get_invite_preview: no phones, amounts
 *              or ids) and send them to log in. The number that got the text
 *              picks the invite up automatically on sign-in, because
 *              AuthProvider calls accept_invites_for_me.
 */
type Preview = {
  state: "valid" | "expired" | "invalid" | "accepted";
  inviter?: string | null;
  trip?: { name?: string | null } | null;
  memberCount?: number;
  doneCount?: number;
  expenseCount?: number;
};

const MESSAGES: Record<string, string> = {
  expired: "This invite link has expired or was already used. Ask the organizer for a new one.",
  invalid: "This invite link isn't working. Ask the organizer to send a new one.",
};

export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const accept = useCallback(async () => {
    if (!code) return;
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("accept_invite_token", { p_token: code, p_via: "app" });
    if (err) {
      // already linked by number? that path adds the member too, so try it before giving up
      await supabase.rpc("accept_invites_for_me", { p_via: "app" }).then(() => undefined, () => undefined);
      setBusy(false);
      setError(
        err.message.includes("different number")
          ? "This invite was sent to a different phone number. Sign in with the number that got the text, or ask the organizer to invite this one."
          : err.message.includes("expired") || err.message.includes("not found")
            ? MESSAGES.expired
            : err.message,
      );
      return;
    }
    router.replace(`/trip/${String(data)}`);
  }, [code, router]);

  useEffect(() => {
    if (authLoading || !code) return;
    if (session) { accept(); return; }
    let alive = true;
    supabase.rpc("get_invite_preview", { code }).then(
      ({ data }) => { if (alive) setPreview((data as Preview) ?? { state: "invalid" }); },
      () => { if (alive) setPreview({ state: "invalid" }); },
    );
    return () => { alive = false; };
  }, [authLoading, code, session, accept]);

  const bad = preview && preview.state !== "valid";
  const title = error || bad
    ? "Couldn't open this invite"
    : session
      ? "Opening your invite…"
      : preview?.trip?.name
        ? `${preview.inviter ?? "A friend"} invited you to ${preview.trip.name}`
        : "You're invited to a Dazzle";

  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <View style={styles.body}>
        <Zebra variant="bust" mood={error || bad ? "worried" : "wink"} size={132} animate={{ blink: !error && !bad }} decorative />
        <ZText variant="title1" accessibilityRole="header" style={styles.title}>{title}</ZText>

        {error ? <ErrorPanel message={error} /> : null}
        {!error && bad ? <ErrorPanel message={MESSAGES[preview!.state] ?? MESSAGES.invalid} /> : null}

        {!session && !error && !bad && preview?.state === "valid" ? (
          <Card style={styles.card}>
            <ZText variant="body" color={color.textSecondary}>
              Log in with the phone number that got the text and this Dazzle will be waiting for you.
            </ZText>
            <ZText variant="caption" color={color.textSecondary}>
              {[
                preview.memberCount ? `${preview.memberCount} ${preview.memberCount === 1 ? "person" : "people"}` : null,
                preview.expenseCount ? `${preview.expenseCount} ${preview.expenseCount === 1 ? "expense" : "expenses"} so far` : null,
              ].filter(Boolean).join(" · ")}
            </ZText>
          </Card>
        ) : null}

        {!session ? (
          <Button kind="primary" label="Log in to join" onPress={() => router.replace("/(auth)/login")} />
        ) : error ? (
          <Button kind="secondary" label="Try again" loading={busy} onPress={accept} />
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
});
