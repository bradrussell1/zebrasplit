import { formatCents, herdZebraLabel, outfitDescription } from "@bunktab/core";
import { color, layout, radius, space } from "@bunktab/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Press, ScreenBackground, ScreenSkeleton, StatusPill, TopBar, Zebra, ZText, useToast } from "@/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { activeMembers, memberName, previewPayments, useTrip } from "@/lib/trips";

/**
 * The herd page (design/reference/herd/Herd.dc.html).
 *
 * Everyone in the dazzle, one card each: their zebra in what it's wearing, whether it
 * has earned its stripes, what it owes or is owed *with you*, and a Nudge for anyone
 * still adding. Your own card comes first and runs full width.
 *
 * This is the page that always lists EVERYONE. The field on the dazzle page draws at
 * most twelve (A10b); the limit is on the drawing, never on the dazzle.
 */
export default function HerdScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { session } = useAuth();
  const me = session!.user.id;
  const { data, loading, reload } = useTrip(id);
  const [nudging, setNudging] = useState<string | null>(null);
  const [nudged, setNudged] = useState<Record<string, boolean>>({});

  if (loading || !data) {
    return <View style={styles.screen}><ScreenBackground /><TopBar onBack={() => router.back()} /><ScreenSkeleton rows={3} /></View>;
  }
  const { trip } = data;
  const members = activeMembers(data);
  const done = members.filter((m) => m.done_at).length;
  const isOwner = members.find((m) => m.user_id === me)?.role === "owner";
  const closed = trip.status !== "open";
  const cur = trip.base_currency;
  const plan = previewPayments(data);
  // you first, then everyone else in the usual order
  const ordered = [...members].sort((a, b) => (a.user_id === me ? -1 : b.user_id === me ? 1 : 0));

  /** What stands between the two of you, in the Final Split as it looks right now. */
  function withYou(uid: string): { label: string; tone: "volt" | "blush" | "muted" } {
    if (uid === me) return { label: "This is you", tone: "muted" };
    const owesYou = plan.find((p) => p.from === uid && p.to === me);
    if (owesYou) return { label: `Owes you ${formatCents(owesYou.cents, cur)}`, tone: "volt" };
    const youOwe = plan.find((p) => p.from === me && p.to === uid);
    if (youOwe) return { label: `You owe ${formatCents(youOwe.cents, cur)}`, tone: "blush" };
    return { label: "Square with you", tone: "muted" };
  }

  async function nudge(uid: string, name: string) {
    setNudging(uid);
    const { data: sent, error } = await supabase.rpc("send_nudge", { p_trip: trip.id, p_user: uid });
    setNudging(null);
    if (error) { show({ message: error.message }); return; }
    setNudged((n) => ({ ...n, [uid]: true }));
    show({
      message: sent ? `Nudged ${name}. They'll get a push and see it next time they open the app.` : `${name} was already nudged today. One a day keeps it friendly.`,
      duration: 3500,
      bust: <Zebra variant="bust" mood="wink" size={28} decorative />,
    });
    reload();
  }

  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar onBack={() => router.back()} right={<StatusPill label={`${done} of ${members.length} striped`} complete={done === members.length} />} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[32] }]} showsVerticalScrollIndicator={false}>
        <View style={styles.head}>
          <ZText variant="title1" accessibilityRole="header">The herd</ZText>
          <ZText variant="body" color={color.textSecondary}>
            {done === members.length
              ? "Every zebra has its stripes."
              : `${members.length - done} still adding expenses. A zebra earns its stripes when its owner taps Done.`}
          </ZText>
        </View>

        {ordered.map((m) => {
          const isMe = m.user_id === me;
          const name = memberName(data, m.user_id, me);
          const wearing = outfitDescription(m.outfit);
          const bal = withYou(m.user_id);
          return (
            <Card key={m.user_id} style={[styles.card, isMe ? styles.mine : null]}>
              <View style={styles.row}>
                <Press
                  onPress={() => router.push(`/(app)/trip/${trip.id}/members?user=${m.user_id}`)}
                  scaleTo={0.97}
                  accessibilityRole="button"
                  accessibilityLabel={herdZebraLabel({ name, isMe, done: !!m.done_at, mood: m.done_at ? "happy" : "hi", outfit: m.outfit })}
                >
                  <Zebra
                    variant="full"
                    size={isMe ? 132 : 104}
                    striped={!!m.done_at}
                    outfit={m.outfit}
                    mood={m.done_at ? "happy" : "hi"}
                    animate={{ blink: true, swish: true }}
                    decorative
                  />
                </Press>
                <View style={styles.text}>
                  <View style={styles.nameRow}>
                    <ZText variant="headline" numberOfLines={1} style={styles.flex}>{isMe ? "You" : name}</ZText>
                    <StatusPill label={m.done_at ? "Striped" : "Adding"} complete={!!m.done_at} />
                  </View>
                  <ZText variant="caption" color={bal.tone === "volt" ? color.text : bal.tone === "blush" ? color.youOweText : color.textMuted}>
                    {bal.label}
                  </ZText>
                  <ZText variant="caption" color={color.textMuted} numberOfLines={2}>
                    {wearing ? `Wearing ${wearing}` : "Not wearing anything yet"}
                  </ZText>
                  {!m.done_at && !isMe && isOwner && !closed ? (
                    <Button
                      kind="nudge"
                      label={nudged[m.user_id] ? "Nudged" : "Nudge"}
                      loading={nudging === m.user_id}
                      disabled={!!nudged[m.user_id] || !!nudging}
                      onPress={() => nudge(m.user_id, name.split(/\s+/)[0]!)}
                      accessibilityLabel={`Nudge ${name} to add their expenses`}
                      style={styles.nudge}
                    />
                  ) : null}
                </View>
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: layout.screenGutter, gap: layout.listGap },
  head: { paddingHorizontal: space[4], paddingBottom: space[4], gap: space[4] },
  card: { paddingVertical: space[12] },
  mine: { borderWidth: 2, borderColor: color.owedToYou, borderRadius: radius.card },
  row: { flexDirection: "row", alignItems: "center", gap: space[12] },
  text: { flex: 1, gap: space[4] },
  nameRow: { flexDirection: "row", alignItems: "center", gap: space[8] },
  nudge: { alignSelf: "flex-start", marginTop: space[4] },
});
