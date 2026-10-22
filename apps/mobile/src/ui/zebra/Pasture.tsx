import { herdLayout, herdZebraLabel, type HerdSlot, type Outfit, type ZebraMood } from "@bunktab/core";
import { color, palette, pasture as p, radius, space } from "@bunktab/theme";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";
import { Confetti } from "../motion";
import { useReducedMotion } from "../motion/useReducedMotion";
import { Press } from "../Press";
import { ZText } from "../Text";
import { Zebra } from "./Zebra";

/**
 * The Pasture: the field the herd stands in (B4).
 *
 * Every zebra loops its own small idle so the herd never moves in lockstep — but all of
 * them read ONE shared clock rather than keeping a timer each. Twelve zebras with twelve
 * JS intervals is twelve chances to drift and twelve things to tear down; a single
 * Reanimated value ticking 0 → 1 over a minute, with each zebra deriving its own phase
 * from its own period, runs entirely on the UI thread and costs the same at 12 as at 1.
 *
 * Under Reduce Motion the clock never starts and the herd stands still.
 */

/** One revolution of the shared clock. Long enough that every idle period divides into it. */
const CLOCK_SECONDS = 60;
/**
 * Roam amplitudes and periods, cycled per zebra. The periods are the board's own `--d`
 * values; the amplitudes are deliberately about double its `--r` (6/9/12), because the
 * herd read as static at the board's figures on a real screen and more movement was
 * asked for. Push them much further and the herd drifts rather than mills.
 */
const ROAM_PX = [14, 20, 26];
const ROAM_SECS = [5.5, 6.8, 8.1, 9.4, 6.7, 8.0];
const TROT_SECS = 0.95;
const TROT_PX = -3;
const GRAZE_SECS = 6.5;
const GRAZE_DEG = -4;
/** The graze dip runs over this slice of its cycle, eased in and out. */
const GRAZE_FROM = 0.62;
const GRAZE_TO = 0.9;
/** The celebration hop: one zebra, or the whole herd in a wave. */
const HOP_PX = -22;
const HOP_MS = 420;
/** Each zebra in the wave starts this long after the one in front of it. */
const WAVE_STAGGER = 120;

export type PastureMember = {
  user_id: string;
  name: string;
  isMe?: boolean;
  /** Striped means this person has tapped Done. Stripes never mean money. */
  done: boolean;
  mood?: ZebraMood;
  outfit?: Outfit | null;
};

/**
 * A moment the herd plays: `key` bumps to fire it. Without `only` the whole herd hops
 * in a wave, 120 ms apart; with it, just that one zebra — which is what tapping Done
 * does to yours.
 */
export type PastureCheer = { key: number; only?: string; confetti?: boolean };

export type PastureProps = {
  /** Already picked and ordered — you first. Use `herdPick` for herds over 12. */
  members: PastureMember[];
  /** How many members aren't drawn, for the "+N more" chip. */
  more?: number;
  height?: number;
  onPressMember?: (m: PastureMember) => void;
  /** Tapping anywhere else in the field. The dazzle page sends this to the herd page. */
  onPressField?: () => void;
  /** Tags cost a view each and read as clutter on a small card. */
  showTags?: boolean;
  /** Bump to make the herd hop: the whole field in a wave, or one zebra. */
  cheer?: PastureCheer;
  style?: StyleProp<ViewStyle>;
};

export function Pasture({ members, more = 0, height = 250, onPressMember, onPressField, showTags = true, cheer, style }: PastureProps) {
  const reduced = useReducedMotion();
  const [width, setWidth] = useState(0);
  const clock = useSharedValue(0);

  useEffect(() => {
    if (reduced) { cancelAnimation(clock); clock.value = 0; return; }
    clock.value = withRepeat(withTiming(1, { duration: CLOCK_SECONDS * 1000, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(clock);
  }, [reduced, clock]);

  const slots = useMemo(() => herdLayout(members.length, width, height), [members.length, width, height]);
  const scenery = useMemo(() => makeScenery(width, height), [width, height]);

  return (
    <Press
      onPress={onPressField}
      disabled={!onPressField}
      scaleTo={0.98}
      accessibilityRole={onPressField ? "button" : undefined}
      accessibilityLabel={onPressField ? `The herd: ${members.length} zebras${more ? ` and ${more} more` : ""}. Opens the herd` : undefined}
      style={[styles.field, { height }, style]}
      onLayout={(e) => { const next = e.nativeEvent.layout.width; setWidth((cur) => (Math.abs(cur - next) > 0.5 ? next : cur)); }}>
      {width > 0 ? (
        <>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            {/* the top of the field IS the wave: everything above it is left clear */}
            <Path d={scenery.field} fill={p.field} />
            <Path d={scenery.horizon} fill={p.fieldFront} />
            {scenery.tufts.map((d, i) => <Path key={`t${i}`} d={d} stroke={p.grass} strokeWidth={3} fill="none" strokeLinecap="round" />)}
            {scenery.flowers.map((f, i) => <Circle key={`f${i}`} cx={f.x} cy={f.y} r={f.r} fill={p.flower} />)}
          </Svg>

          {/* back rows first, so the front row covers them */}
          {[...slots].reverse().map((slot) => {
            const m = members[slot.index];
            if (!m) return null;
            return (
              <Grazer
                key={m.user_id}
                slot={slot}
                clock={clock}
                index={idleSeed(m.user_id)}
                hop={cheer && (!cheer.only || cheer.only === m.user_id) ? cheer.key : 0}
                hopDelay={cheer?.only ? 0 : slot.index * WAVE_STAGGER}
              >
                <Pressable
                  onPress={onPressMember ? () => onPressMember(m) : undefined}
                  disabled={!onPressMember}
                  accessibilityRole={onPressMember ? "button" : "image"}
                  accessibilityLabel={herdZebraLabel({ name: m.name, isMe: m.isMe, done: m.done, mood: m.mood ?? "hi", outfit: m.outfit })}
                >
                  <Zebra
                    variant="full"
                    size={slot.width}
                    striped={m.done}
                    outfit={m.outfit}
                    mood={m.mood ?? "hi"}
                    animate={{ blink: true }}
                    decorative
                  />
                </Pressable>
              </Grazer>
            );
          })}

          {/* tags ride on top of everything, so a zebra in front never hides a name */}
          {showTags
            ? slots.map((slot) => {
              const m = members[slot.index];
              if (!m) return null;
              return (
                <View
                  key={`tag-${m.user_id}`}
                  pointerEvents="none"
                  style={[styles.tag, m.done ? styles.tagDone : styles.tagAdding, {
                    // a tag gets its own step and no more, so it can never cover a neighbour
                    maxWidth: Math.max(48, slot.step - 6),
                    left: slot.x + slot.width / 2 - Math.max(48, slot.step - 6) / 2,
                    top: slot.y + slot.height - TAG_H / 2,
                    zIndex: 20 + slot.z,
                  }]}
                >
                  <View style={[styles.tagStripe, { backgroundColor: m.done ? palette.volt : color.outlineDashed }]} />
                  <ZText variant="micro" numberOfLines={1} color={m.done ? color.textOnInk : color.textMuted}>
                    {m.isMe ? "You" : firstName(m.name)}
                  </ZText>
                </View>
              );
            })
            : null}

          {cheer?.confetti ? <Confetti play={cheer.key} style={StyleSheet.absoluteFill} /> : null}

          {more > 0 ? (
            <View style={styles.more} pointerEvents="none">
              <ZText variant="captionStrong" color={color.textSecondary}>+{more} more</ZText>
            </View>
          ) : null}
        </>
      ) : null}
    </Press>
  );
}

/**
 * A stable number per person, so the same zebra roams and grazes the same way in every
 * dazzle. Keying the idle on the slot index instead made someone trot in one trip and
 * graze in another purely because the member list came back in a different order.
 */
function idleSeed(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return h % 180;
}

/**
 * One zebra's idle: a roam across the field, plus a trot or a graze. Every value is
 * derived from the shared clock inside a worklet, so nothing here touches the JS thread
 * once it's mounted.
 */
function Grazer({ slot, clock, index, hop, hopDelay, children }: { slot: HerdSlot; clock: SharedValue<number>; index: number; hop: number; hopDelay: number; children: ReactNode }) {
  const r = ROAM_PX[index % ROAM_PX.length]!;
  const d = ROAM_SECS[index % ROAM_SECS.length]!;
  const off = ((index * 0.37) % 1);
  const grazes = index % 3 === 1; // the board's rule: every third zebra grazes, the rest trot
  const reduced = useReducedMotion();

  // the celebration hop rides on top of the idle rather than replacing it
  const cheer = useSharedValue(0);
  // Remember which cheer has already played rather than "is this the first render".
  // The old flag was cleared inside the effect body, but the effect returns early while
  // `hop` is still 0 — which it is on mount — so the flag survived and ate the first
  // real cheer. ZebraFarewell gets this right by keying on the play count; same here.
  const played = useRef(0);
  useEffect(() => {
    if (hop === 0 || played.current === hop) return;
    played.current = hop;
    if (reduced) return;
    cheer.value = withDelay(hopDelay, withSequence(
      withTiming(1, { duration: HOP_MS * 0.45, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: HOP_MS * 0.55, easing: Easing.in(Easing.quad) }),
    ));
  }, [hop, hopDelay, reduced, cheer]);

  const anim = useAnimatedStyle(() => {
    const secs = clock.value * CLOCK_SECONDS;
    const roam = r * Math.sin((((secs / d) + off) % 1) * 2 * Math.PI);
    let y = 0;
    let rot = 0;
    if (grazes) {
      const ph = ((secs / GRAZE_SECS) + off) % 1;
      const w = ph > GRAZE_FROM && ph < GRAZE_TO
        ? 0.5 - 0.5 * Math.cos(((ph - GRAZE_FROM) / (GRAZE_TO - GRAZE_FROM)) * 2 * Math.PI)
        : 0;
      rot = GRAZE_DEG * w;
      y = 2 * w;
    } else {
      const ph = ((secs / TROT_SECS) + off) % 1;
      y = TROT_PX * (0.5 - 0.5 * Math.cos(ph * 2 * Math.PI));
    }
    return { transform: [{ translateX: roam }, { translateY: y + cheer.value * HOP_PX }, { rotate: `${rot}deg` }] };
  });
  return (
    <Animated.View
      style={[styles.zebra, { left: slot.x, top: slot.y, width: slot.width, zIndex: slot.z }, anim]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * The field itself, plus grass tufts and flowers, all placed from the field's own size
 * so they never jump between renders.
 *
 * The top edge is a long shallow wave rather than a straight line, so the field reads as
 * ground rather than as a green box. A second, closer wave divides it into a far band
 * and a near one, which is what gives the herd somewhere to stand "in front".
 */
function makeScenery(w: number, h: number) {
  if (w <= 0) return { field: "", horizon: "", tufts: [] as string[], flowers: [] as { x: number; y: number; r: number }[] };
  const crest = h * 0.2;            // where the wavy top edge sits
  const swell = h * 0.075;          // how far it rises and falls
  const field = `M0 ${crest} C${w * 0.2} ${crest - swell} ${w * 0.34} ${crest + swell} ${w * 0.55} ${crest}`
    + ` C${w * 0.74} ${crest - swell} ${w * 0.88} ${crest + swell * 0.6} ${w} ${crest - swell * 0.3}`
    + ` L${w} ${h} L0 ${h} Z`;
  const band = h * 0.56;
  const horizon = `M0 ${band} Q${w * 0.25} ${band - h * 0.05} ${w * 0.5} ${band} T${w} ${band} L${w} ${h} L0 ${h} Z`;
  const tufts: string[] = [];
  const flowers: { x: number; y: number; r: number }[] = [];
  // a fixed lattice nudged by index, so it reads as scattered without a random source
  for (let i = 0; i < 14; i++) {
    const x = ((i * 97) % 100) / 100 * w;
    const y = band + ((i * 53) % 100) / 100 * (h - band) * 0.9;
    tufts.push(`M${x} ${y} l-4 -7 M${x} ${y} l0 -9 M${x} ${y} l4 -7`);
  }
  for (let i = 0; i < 7; i++) {
    const x = ((i * 61 + 23) % 100) / 100 * w;
    const y = band + ((i * 37 + 11) % 100) / 100 * (h - band) * 0.88;
    flowers.push({ x, y, r: 2.5 });
  }
  return { field, horizon, tufts, flowers };
}

const firstName = (n: string) => n.split(/\s+/)[0] ?? n;

const TAG_H = 22;

const styles = StyleSheet.create({
  field: { width: "100%", borderRadius: radius.hero, overflow: "hidden" },
  zebra: { position: "absolute" },
  tag: {
    position: "absolute", height: TAG_H, borderRadius: radius.pill,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingHorizontal: space[8],
  },
  /** the volt stripe the member pills used to carry, now on the tag itself */
  tagStripe: { width: 3, height: 10, borderRadius: 1.5, transform: [{ rotate: "10deg" }] },
  tagDone: { backgroundColor: color.surfaceInk },
  tagAdding: { backgroundColor: color.surface },
  more: {
    position: "absolute", right: space[10], top: space[10],
    backgroundColor: color.surface, borderRadius: radius.pill,
    paddingHorizontal: space[10], paddingVertical: space[4],
  },
});
