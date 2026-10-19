import { color, layout, palette, size, space } from "@bunktab/theme";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Input, ScreenBackground, TopBar, ZText, Zebra, useToast } from "@/ui";
import { supabase } from "@/lib/supabase";

/**
 * Send feedback. Title and description only: submit_feedback reads the address
 * off the account server-side, so the screen never asks for one and a client
 * cannot attach somebody else's.
 */
function friendly(message: string): string {
  if (/title and a description/i.test(message)) return "Add a title and a description.";
  if (/network|fetch/i.test(message)) return "Connection lost. Check your signal and try again.";
  return message;
}

export default function FeedbackScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!title.trim() || !body.trim()) { setError("Add a title and a description."); return; }
    setBusy(true); setError(null);
    const { error: e } = await supabase.rpc("submit_feedback", {
      p_title: title,
      p_body: body,
      p_email: null, // the server uses the account's own address
      p_platform: Platform.OS,
      p_app_version: Constants.expoConfig?.version ?? null,
    });
    setBusy(false);
    if (e) { setError(friendly(e.message)); return; }
    show({ message: "Thank you — a real person reads these.", tone: "volt", duration: 3000, bust: <Zebra variant="bust" mood="happy" size={28} decorative /> });
    router.back();
  }

  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar onBack={() => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.flex}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[32] }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <ZText variant="title1" accessibilityRole="header" style={styles.title}>Send feedback</ZText>
          <ZText variant="body" color={color.textSecondary} style={styles.lead}>
            Something broke, something&apos;s missing, something would be better another way. We read all of it.
          </ZText>

          <Card style={styles.card}>
            <Input
              label="Title"
              placeholder="Receipt scan missed the tip"
              value={title}
              onChangeText={setTitle}
              maxLength={120}
              returnKeyType="next"
            />
            <Input
              label="Description"
              placeholder="What happened, and what you expected instead."
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={7}
              maxLength={4000}
              error={error ?? undefined}
              helper={error ? undefined : `${body.length} of 4000`}
            />
            <Button kind="primary" label="Send" height={size.buttonHeight} loading={busy} onPress={send} />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bgMid },
  flex: { flex: 1 },
  content: { paddingHorizontal: layout.screenGutter, gap: layout.listGap },
  title: { paddingHorizontal: space[4] },
  lead: { paddingHorizontal: space[4], marginBottom: space[4] },
  card: { gap: space[12] },
});
