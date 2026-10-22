import { color, motion, palette, radius, size, space } from "@bunktab/theme";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from "react-native-reanimated";
import { Confetti, haptic } from "../motion";
import { useReducedMotion } from "../motion/useReducedMotion";
import { SpeechBubble } from "../Overlays";
import { Press } from "../Press";
import { ZText } from "../Text";
import { Zebra } from "./Zebra";

/**
 * The two zebra moments in the close-out flow (feedback round 2, items 3 and 8).
 *
 * Both animate the *view* transform of an Animated.View wrapping a <Zebra>, never a
 * `transform` string on an animated SVG prop — react-native-svg bakes those into a
 * matrix during render and the native view never sees them, which is why the tail and
 * eyes sat still in an earlier TestFlight build (see the note in Zebra.tsx).
 *
 * The zebra artwork faces left (head near x=120, tail root at x=270), so anything
 * running to the right is mirrored with scaleX: -1 on its wrapper.
 */

const runEase = Easing.bezier(...(motion.paidRun.bezier as [number, number, number, number]));
const popEase = Easing.bezier(...(motion.springPop.bezier as [number, number, number, number]));
const F = motion.farewell;

/** Gallop: a bob that lifts on each stride. Worklet-safe. */
function hop(p: number, hops: number, px: number): number {
  "worklet";
  return -Math.abs(Math.sin(p * Math.PI * hops)) * px;
}

/**
 * PayZipButton: the one payment button.
 *
 *  - idle      ink pill, "Pay Mike $84.50"
 *  - opening   moving diagonal stripes, "Opening Cash App…" (the other app has the user now)
 *  - paid      a zebra gallops in from the left dragging the volt fill and "Paid, nice!"
 *              behind it, then carries on off the side of the screen
 *
 * The volt panel is a full-width layer translated from −width to 0, with the label
 * centred *inside* it, so the yellow and the words are literally pulled across rather
 * than cross-fading in place. Its right edge tracks the zebra's hindquarters.
 */
export function PayZipButton({
  label,
  openingLabel = "Opening Venmo…",
  paidLabel = "Paid, nice!",
  paid,
  onPress,
  style,
}: {
  label: string;
  openingLabel?: string;
  paidLabel?: string;
  paid: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const [opening, setOpening] = useState(false);
  // the runner only exists while it is on screen; `paid` on mount means no run at all
  const [running, setRunning] = useState(false);
  const wasPaid = useRef(paid);
  const shift = useSharedValue(0);
  const run = useSharedValue(paid ? 1 : 0);
  const w = useSharedValue(0);
  const zs = motion.paidRun.zebraSize;

  // opening: the diagonal stripes loop until the payment is marked or the wait times out
  useEffect(() => {
    if (!opening || paid || reduced) { cancelAnimation(shift); shift.value = 0; return; }
    shift.value = withRepeat(withTiming(motion.venmoZip.travelPx, { duration: motion.venmoZip.loopMs, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(shift);
  }, [opening, paid, reduced, shift]);
  useEffect(() => { if (!opening || paid) return; const t = setTimeout(() => setOpening(false), motion.venmoZip.landDelay * 3); return () => clearTimeout(t); }, [opening, paid]);

  // the run itself, only on the pending → paid edge
  useEffect(() => {
    const became = paid && !wasPaid.current;
    wasPaid.current = paid;
    if (!paid) { run.value = 0; setRunning(false); return; }
    setOpening(false);
    haptic.success();
    if (!became || reduced) { run.value = 1; return; }
    setRunning(true);
    run.value = 0;
    run.value = withTiming(1, { duration: motion.paidRun.duration, easing: runEase });
    const t = setTimeout(() => setRunning(false), motion.paidRun.duration + 60);
    return () => clearTimeout(t);
  }, [paid, reduced, run]);

  const stripes = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value - motion.venmoZip.travelPx }] }));
  // −1.1 → +1.1 zebra-widths beyond each edge, so it enters and leaves fully off-pill
  const runX = (p: number, width: number) => { "worklet"; return -zs * 1.1 + p * (width + zs * 2.2); };
  const volt = useAnimatedStyle(() => {
    const width = w.value;
    if (width === 0) return { transform: [{ translateX: -9999 }] };
    const edge = runX(run.value, width) + zs * 0.5; // the yellow ends where the zebra's rump is
    const p = Math.max(0, Math.min(1, edge / width));
    return { transform: [{ translateX: (p - 1) * width }] };
  });
  const runner = useAnimatedStyle(() => ({
    transform: [
      { translateX: runX(run.value, w.value) },
      { translateY: hop(run.value, motion.paidRun.gallopHops, motion.paidRun.gallopPx) },
      { rotate: `${motion.paidRun.leanDeg}deg` },
      { scaleX: -1 }, // the artwork faces left; mirror it to run right
    ],
  }));

  const text = paid ? paidLabel : opening ? openingLabel : label;
  return (
    <View style={styles.runHost} onLayout={(e) => { w.value = e.nativeEvent.layout.width; }}>
      <Press
        onPress={() => { if (paid) return; setOpening(true); onPress(); }}
        scaleTo={0.97}
        accessibilityRole="button"
        accessibilityLabel={text}
        accessibilityState={{ disabled: paid, busy: opening && !paid }}
        style={[styles.zip, { backgroundColor: palette.ink }, style]}
      >
        {opening && !paid ? (
          <Animated.View pointerEvents="none" style={[styles.zipStripes, stripes]}>
            {Array.from({ length: 24 }, (_, i) => <View key={i} style={[styles.zipStripe, { left: i * motion.venmoZip.stripePx * 2 }]} />)}
          </Animated.View>
        ) : null}
        <ZText variant="button" color={color.textOnInk}>{opening && !paid ? openingLabel : label}</ZText>
        {/* the volt layer rides in over the top, carrying its own label */}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.voltFill, volt]}>
          <ZText variant="button" color={color.textOnVolt}>{paidLabel}</ZText>
        </Animated.View>
      </Press>
      {running ? (
        <Animated.View pointerEvents="none" style={[styles.runner, runner]}>
          <Zebra variant="full" mood="happy" members={1} done={1} size={zs} animate={{ swish: true }} decorative />
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * ZebraFarewell: the send-off when you turn on Settled up. Rears onto its hind legs,
 * neighs, spins, then gallops off the side of the screen; `onDone` fires once the
 * stage is empty and the caller takes you Home.
 *
 * Rearing pivots on the hind hooves and spinning pivots on the middle of the stage, so
 * the two live on nested views with different transform origins.
 */
export function ZebraFarewell({ play, onDone }: { play: number; onDone: () => void }) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const scrim = useSharedValue(0);
  const rear = useSharedValue(0);
  const spin = useSharedValue(0);
  const dip = useSharedValue(1);
  const exit = useSharedValue(0);
  const fade = useSharedValue(0);
  const [neighing, setNeighing] = useState(false);
  const [burst, setBurst] = useState(0);
  const done = useRef(0);

  useEffect(() => {
    if (play === 0 || done.current === play) return;
    done.current = play;
    scrim.value = withTiming(1, { duration: F.scrimIn });
    fade.value = withTiming(1, { duration: F.scrimIn });
    if (reduced) {
      const q = setTimeout(() => { fade.value = withTiming(0, { duration: motion.moodCrossfade }); scrim.value = withTiming(0, { duration: motion.moodCrossfade }); }, F.reducedTotal - motion.moodCrossfade);
      const r = setTimeout(onDone, F.reducedTotal);
      return () => { clearTimeout(q); clearTimeout(r); };
    }
    // 1. rear, 2. neigh, 3. spin back down, 4. gallop out
    rear.value = withDelay(F.rear.at, withTiming(1, { duration: F.rear.duration, easing: popEase }));
    spin.value = withDelay(F.spin.at, withTiming(1, { duration: F.spin.duration, easing: Easing.inOut(Easing.cubic) }));
    dip.value = withDelay(F.spin.at, withSequence(
      withTiming(F.spin.dipScale, { duration: F.spin.duration / 2, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: F.spin.duration / 2, easing: Easing.in(Easing.quad) }),
    ));
    exit.value = withDelay(F.exit.at, withTiming(1, { duration: F.exit.duration, easing: Easing.in(Easing.quad) }));

    const a = setTimeout(() => { setNeighing(true); setBurst((b) => b + 1); haptic.success(); }, F.neigh.at);
    const b = setTimeout(() => setNeighing(false), F.neigh.at + F.neigh.duration);
    const c = setTimeout(() => { scrim.value = withTiming(0, { duration: motion.colorChange }); }, F.exit.at + F.exit.duration - motion.colorChange);
    const d = setTimeout(onDone, F.total);
    return () => { [a, b, c, d].forEach(clearTimeout); };
  }, [play, reduced, onDone, scrim, rear, spin, dip, exit, fade]);

  const scrimStyle = useAnimatedStyle(() => ({ opacity: scrim.value * 0.9 }));
  const stage = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [
      { translateX: exit.value * (width + 260) },
      { translateY: hop(exit.value, 4, 12) },
      { rotate: `${spin.value * F.spin.deg}deg` },
      { scale: dip.value },
    ],
  }));
  // the rear pivots on the hind hooves, which sit low and right of centre
  const body = useAnimatedStyle(() => ({
    transform: [
      { translateY: rear.value * F.rear.liftPx * (1 - spin.value) },
      { rotate: `${rear.value * F.rear.deg * (1 - spin.value)}deg` },
    ],
  }));

  if (play === 0) return null;
  return (
    <View pointerEvents="box-none" style={styles.farewell} accessibilityViewIsModal accessibilityLabel="Settled up. The zebra takes a bow.">
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.farewellScrim, scrimStyle]} />
      <Animated.View pointerEvents="none" style={[styles.farewellStage, stage]}>
        <Animated.View style={[styles.farewellBody, body]}>
          <Zebra variant="full" mood="love" members={1} done={1} size={236} tailUp animate={{ swish: true, sparkles: true }} decorative />
        </Animated.View>
        {neighing ? <SpeechBubble tone="white" style={styles.neigh}>NEIGHHH!!</SpeechBubble> : null}
        <Confetti play={burst} style={StyleSheet.absoluteFill} />
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.farewellCaption, scrimStyle]}>
        <ZText variant="title2" color={palette.white}>Settled up.</ZText>
        <ZText variant="body" color={palette.hide}>Nice work. Taking you home…</ZText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // the runner has to escape the pill's clip, so the pill and the zebra are siblings
  runHost: { alignSelf: "stretch", justifyContent: "center" },
  zip: { height: size.ctaHeight, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", overflow: "hidden", alignSelf: "stretch" },
  zipStripes: { position: "absolute", top: -20, bottom: -20, left: 0, right: -200, flexDirection: "row" },
  zipStripe: { position: "absolute", top: 0, bottom: 0, width: 14, backgroundColor: color.glassOnInk, transform: [{ rotate: "25deg" }] },
  voltFill: { backgroundColor: palette.volt, alignItems: "center", justifyContent: "center" },
  runner: { position: "absolute", left: 0, bottom: -6, zIndex: 2 },

  farewell: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 40 },
  farewellScrim: { backgroundColor: palette.ink },
  farewellStage: { alignItems: "center", justifyContent: "center" },
  farewellBody: { transformOrigin: ["68%", "100%", 0] },
  neigh: { position: "absolute", left: "58%", bottom: "72%" },
  farewellCaption: { position: "absolute", bottom: space[40] * 2, alignItems: "center", gap: space[4], paddingHorizontal: space[24] },
});
