import { herdLayout, herdZebraLabel, type HerdSlot, type Outfit, type ZebraMood } from "@bunktab/core";
import { color, pasture as p, radius, space } from "@bunktab/theme";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useReducedMotion } from "../motion/useReducedMotion";
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
/** Roam amplitudes and periods, cycled per zebra — the board's own numbers. */
const ROAM_PX = [6, 9, 12];
const ROAM_SECS = [5.5, 6.8, 8.1, 9.4, 6.7, 8.0];
const TROT_SECS = 0.95;
const TROT_PX = -3;
const GRAZE_SECS = 6.5;
const GRAZE_DEG = -4;
/** The graze dip runs over this slice of its cycle, eased in and out. */
const GRAZE_FROM = 0.62;
const GRAZE_TO = 0.9;

export type PastureMember = {
  user_id: string;
  name: string;
  isMe?: boolean;
  /** Striped means this person has tapped Done. Stripes never mean money. */
  done: boolean;
  mood?: ZebraMood;
  outfit?: Outfit | null;
};

export type PastureProps = {
  /** Already picked and ordered — you first. Use `herdPick` for herds over 12. */
  members: PastureMember[];
  /** How many members aren't drawn, for the "+N more" chip. */
  more?: number;
  height?: number;
  onPressMember?: (m: PastureMember) => void;
  /** Tags cost a view each and read as clutter on a small card. */
  showTags?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Pasture({ members, more = 0, height = 250, onPressMember, showTags = true, style }: PastureProps) {
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
    <View style={[styles.field, { height }, style]} onLayout={(e) => { const next = e.nativeEvent.layout.width; setWidth((cur) => (Math.abs(cur - next) > 0.5 ? next : cur)); }}>
      {width > 0 ? (
        <>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            <Rect x={0} y={0} width={width} height={height} fill={p.field} />
            <Path d={scenery.horizon} fill={p.fieldFront} />
            {scenery.tufts.map((d, i) => <Path key={`t${i}`} d={d} stroke={p.grass} strokeWidth={3} fill="none" strokeLinecap="round" />)}
            {scenery.flowers.map((f, i) => <Circle key={`f${i}`} cx={f.x} cy={f.y} r={f.r} fill={p.flower} />)}
          </Svg>

          {/* back rows first, so the front row covers them */}
          {[...slots].reverse().map((slot) => {
            const m = members[slot.index];
            if (!m) return null;
            return (
              <Grazer key={m.user_id} slot={slot} clock={clock} index={slot.index}>
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
                    left: slot.x + slot.width / 2 - TAG_W / 2,
                    top: slot.y + slot.height - TAG_H / 2,
                    zIndex: 20 + slot.z,
                  }]}
                >
                  <ZText variant="micro" numberOfLines={1} color={m.done ? color.textOnInk : color.textMuted}>
                    {m.isMe ? "You" : firstName(m.name)}
                  </ZText>
                </View>
              );
            })
            : null}

          {more > 0 ? (
            <View style={styles.more} pointerEvents="none">
              <ZText variant="captionStrong" color={color.textSecondary}>+{more} more</ZText>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/**
 * One zebra's idle: a roam across the field, plus a trot or a graze. Every value is
 * derived from the shared clock inside a worklet, so nothing here touches the JS thread
 * once it's mounted.
 */
function Grazer({ slot, clock, index, children }: { slot: HerdSlot; clock: SharedValue<number>; index: number; children: ReactNode }) {
  const r = ROAM_PX[index % ROAM_PX.length]!;
  const d = ROAM_SECS[index % ROAM_SECS.length]!;
  const off = ((index * 0.37) % 1);
  const grazes = index % 3 === 1; // the board's rule: every third zebra grazes, the rest trot
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
    return { transform: [{ translateX: roam }, { translateY: y }, { rotate: `${rot}deg` }] };
  });
  return (
    <Animated.View
      style={[styles.zebra, { left: slot.x, top: slot.y, width: slot.width, zIndex: slot.z }, anim]}
    >
      {children}
    </Animated.View>
  );
}

/** Grass tufts and flowers, placed from the field's own size so they never jump. */
function makeScenery(w: number, h: number) {
  if (w <= 0) return { horizon: "", tufts: [] as string[], flowers: [] as { x: number; y: number; r: number }[] };
  const band = h * 0.46;
  const horizon = `M0 ${band} Q${w * 0.25} ${band - h * 0.05} ${w * 0.5} ${band} T${w} ${band} L${w} ${h} L0 ${h} Z`;
  const tufts: string[] = [];
  const flowers: { x: number; y: number; r: number }[] = [];
  // a fixed lattice nudged by index, so it reads as scattered without a random source
  for (let i = 0; i < 14; i++) {
    const x = ((i * 97) % 100) / 100 * w;
    const y = band + ((i * 53) % 100) / 100 * (h - band) * 0.92;
    tufts.push(`M${x} ${y} l-4 -7 M${x} ${y} l0 -9 M${x} ${y} l4 -7`);
  }
  for (let i = 0; i < 7; i++) {
    const x = ((i * 61 + 23) % 100) / 100 * w;
    const y = band + ((i * 37 + 11) % 100) / 100 * (h - band) * 0.88;
    flowers.push({ x, y, r: 2.5 });
  }
  return { horizon, tufts, flowers };
}

const firstName = (n: string) => n.split(/\s+/)[0] ?? n;

const TAG_W = 56;
const TAG_H = 20;

const styles = StyleSheet.create({
  field: { width: "100%", borderRadius: radius.hero, overflow: "hidden", backgroundColor: p.field },
  zebra: { position: "absolute" },
  tag: {
    position: "absolute", width: TAG_W, height: TAG_H, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center", paddingHorizontal: space[4],
  },
  tagDone: { backgroundColor: color.surfaceInk },
  tagAdding: { backgroundColor: color.surface },
  more: {
    position: "absolute", right: space[10], top: space[10],
    backgroundColor: color.surface, borderRadius: radius.pill,
    paddingHorizontal: space[10], paddingVertical: space[4],
  },
});
