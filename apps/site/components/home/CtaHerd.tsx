"use client";
import type { ZebraMood } from "@bunktab/core";
import { useRef } from "react";
import { Zebra, type ZebraAnimate } from "@/components/zebra";
import { friend } from "@/content/herd";
import { useOnScreen } from "@/lib/motion";
import s from "./home.module.css";

type Member = { id: string; width: 100 | 130 | 150; mood: ZebraMood; animate: ZebraAnimate; delay?: number; mirror?: boolean; edge?: boolean };
/** Left to right, as on the board. The two outer zebras drop out on phones. */
const HERD: Member[] = [
  { id: "jordan", width: 100, mood: "happy", animate: { trot: true }, edge: true },
  { id: "you", width: 130, mood: "happy", animate: { trot: true }, delay: 0.2, mirror: true },
  { id: "priya", width: 150, mood: "starry", animate: { hop: true } },
  { id: "mike", width: 130, mood: "happy", animate: { trot: true }, delay: 0.35 },
  { id: "bradley", width: 100, mood: "happy", animate: { graze: true }, delay: 0.5, mirror: true, edge: true },
];

/** Five fully striped zebras on the hill under the final CTA. Decorative; loops pause off-screen. */
export function CtaHerd() {
  const ref = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(ref);
  return (
    <div ref={ref} className={[s.ctaHerd, !onScreen && s.paused].filter(Boolean).join(" ")} aria-hidden="true">
      {HERD.map((m) => (
        <span key={m.id} className={[s.ctaZebra, s[`w${m.width}`], m.edge && s.ctaEdge].filter(Boolean).join(" ")}>
          <Zebra fluid size={m.width} variant="full" striped mood={m.mood} outfit={friend(m.id).outfit} mirror={m.mirror} delay={m.delay} animate={{ ...m.animate, blink: true, swish: true, sparkles: false }} decorative />
        </span>
      ))}
    </div>
  );
}
