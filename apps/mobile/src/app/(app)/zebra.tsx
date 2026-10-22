import { layout, space } from "@bunktab/theme";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScreenBackground, ScreenSkeleton, TopBar } from "@/ui";
import { ZebraTab } from "@/components/ZebraTab";

/**
 * Your zebra on its own route, which is where Customize on the herd page lands. The
 * same content is the Zebra tab on Account; both render ZebraTab so they can't drift.
 */
export default function ZebraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[32] }]} showsVerticalScrollIndicator={false}>
        <ZebraTab loadingSlot={<ScreenSkeleton rows={3} />} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: layout.screenGutter, gap: space[12] },
});
