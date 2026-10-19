import { faqSections, type FaqItem } from "@bunktab/core";
import { color, layout, palette, radius, space } from "@bunktab/theme";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Icon, Press, ScreenBackground, TopBar, ZText } from "@/ui";

const SUPPORT_EMAIL = "support@zebrasplit.com";

/** One question. Collapsed to the question alone; tapping reveals the answer (an
 *  instant state change, so there is nothing to suppress under Reduce Motion). */
function QuestionRow({ item, open, onToggle }: { item: FaqItem; open: boolean; onToggle: () => void }) {
  return (
    <Card style={styles.card}>
      <Press
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={item.question}
        accessibilityHint={open ? "Hides the answer" : "Shows the answer"}
        style={styles.qRow}
      >
        <ZText variant="headline" style={styles.q}>{item.question}</ZText>
        <Icon name={open ? "chevronUp" : "chevronDown"} size={18} color={color.textSecondary} />
      </Press>
      {open ? (
        <View style={styles.answer}>
          <ZText variant="body" color={color.textSecondary}>{item.answer}</ZText>
          {item.list ? (
            <View style={styles.list}>
              {item.list.map((line) => (
                <View key={line} style={styles.bullet}>
                  <View style={styles.dot} />
                  <ZText variant="body" color={color.textSecondary} style={styles.bulletText}>{line}</ZText>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

export default function FaqScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // The first question of the first section starts open, as it does on the site.
  const [open, setOpen] = useState<string | null>(faqSections[0]?.items[0]?.id ?? null);

  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[32] }]} showsVerticalScrollIndicator={false}>
        <ZText variant="title1" accessibilityRole="header" style={styles.title}>FAQ</ZText>
        {faqSections.map((section) => (
          <View key={section.id} style={styles.section}>
            <ZText variant="overline" color={color.textSecondary} style={styles.sectionTitle}>{section.title}</ZText>
            {section.items.map((item) => (
              <QuestionRow
                key={item.id}
                item={item}
                open={open === item.id}
                onToggle={() => setOpen((cur) => (cur === item.id ? null : item.id))}
              />
            ))}
          </View>
        ))}
        <Card style={styles.support}>
          <ZText variant="headline">Still have a question?</ZText>
          <ZText variant="body" color={color.textSecondary}>Send it our way and a real person will get back to you.</ZText>
          <Button
            kind="primary"
            label="Email support"
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {})}
          />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bgMid },
  content: { paddingHorizontal: layout.screenGutter, gap: layout.listGap },
  title: { paddingHorizontal: space[4], marginBottom: space[2] },
  section: { gap: space[8] },
  sectionTitle: { paddingHorizontal: space[4] },
  card: { gap: space[6] },
  qRow: { flexDirection: "row", alignItems: "center", gap: space[12] },
  q: { flex: 1 },
  answer: { gap: space[8] },
  list: { gap: space[4] },
  bullet: { flexDirection: "row", alignItems: "flex-start", gap: space[8] },
  dot: { width: 5, height: 5, borderRadius: radius.pill, backgroundColor: palette.volt, marginTop: 8 },
  bulletText: { flex: 1 },
  support: { gap: space[8], marginTop: space[8] },
});
