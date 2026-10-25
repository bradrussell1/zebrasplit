"use client";
import type { ZebraMood } from "@bunktab/core";
import { useRef } from "react";
import { Confetti } from "@/components/ui/Confetti";
import { Zebra } from "@/components/zebra";
import { FRIENDS } from "@/content/herd";
import { useOnScreen } from "@/lib/motion";
import s from "./herd.module.css";

/**
 * The field from Trip-Herd.dc.html at its 358 × 250 base size: three smaller zebras in the
 * back row, three larger in front, each a button, with a name tag at its feet. The scene
 * scales as one block with the panel width (up to ×1.5), so positions stay the board's.
 */
const BASE = { w: 358, h: 250 } as const;
type Spot = { left: number; top: number; width: number; back?: boolean; mirror?: boolean; roam: { r: number; d: number; delay: number } };
const SPOTS: Spot[] = [
  { left: 11.7, top: 120.8, width: 104, mirror: true, roam: { r: 6, d: 5.5, delay: 0 } },          // You
  { left: 127.0, top: 120.8, width: 104, roam: { r: 9, d: 6.8, delay: -1.7 } },                       // Priya
  { left: 242.3, top: 120.8, width: 104, mirror: true, roam: { r: 12, d: 8.1, delay: -3.4 } },     // Mike
  { left: 78.7, top: 75.6, width: 85.3, back: true, roam: { r: 6, d: 9.4, delay: -0.1 } },            // Jess
  { left: 194.0, top: 75.6, width: 85.3, back: true, mirror: true, roam: { r: 9, d: 6.7, delay: -1.8 } }, // Jordan
  { left: 266.7, top: 75.6, width: 85.3, back: true, roam: { r: 12, d: 8.0, delay: -3.5 } },          // Bradley
];
const TUFTS = [[149, 229], [178, 233], [269, 161], [25, 127], [349, 244], [343, 121], [323, 220], [68, 226], [265, 113], [205, 129], [49, 216], [98, 133], [45, 227], [262, 122]] as const;
const DOTS = [[89, 203], [46, 134], [250, 210], [307, 229], [77, 207]] as const;
const zebraHeight = (w: number) => (w * 330) / 320;

export function HerdScene({ done, onToggle, burst }: { done: boolean[]; onToggle: (i: number) => void; burst: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const onScreen = useOnScreen(ref);
  const all = done.every(Boolean);
  const moodFor = (i: number): ZebraMood => (all ? "starry" : done[i] || i === 0 ? "happy" : "hi");

  return (
    <div ref={ref} className={[s.field, !onScreen && s.paused].filter(Boolean).join(" ")}>
      <svg className={s.hills} viewBox={`0 0 ${BASE.w} ${BASE.h}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="zs-herd-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--zs-wash-volt)" /><stop offset="1" stopColor="var(--zs-pasture-field-front)" /></linearGradient>
        </defs>
        <path d="M0 85 C90 55 161 90 222 70 C286 50 329 75 358 65 L358 250 L0 250 Z" fill="var(--zs-pasture-field)" />
        <path d="M0 115 C107 95 215 125 358 105 L358 250 L0 250 Z" fill="url(#zs-herd-front)" />
      </svg>
      <div className={s.sceneBox}>
        <div className={s.scene} style={{ width: BASE.w, height: BASE.h }}>
          <svg className={s.grass} width={BASE.w} height={BASE.h} viewBox={`0 0 ${BASE.w} ${BASE.h}`} aria-hidden="true">
            {TUFTS.map(([x, y]) => <path key={`${x}-${y}`} d={`M${x} ${y} q-2 -7 -5 -9 M${x} ${y} q0 -8 1 -11 M${x} ${y} q2 -6 6 -8`} stroke="var(--zs-pasture-grass)" strokeWidth="1.6" fill="none" strokeLinecap="round" />)}
            {DOTS.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="2.6" fill="var(--zs-pink)" opacity="0.55" />)}
          </svg>
          {FRIENDS.map((f, i) => {
            const spot = SPOTS[i]!;
            const h = zebraHeight(spot.width);
            const idle = all ? { hop: true } : i % 3 === 1 ? { graze: true } : { trot: true };
            return (
              <button
                key={f.id}
                type="button"
                className={[s.zebraBtn, spot.back && s.back].filter(Boolean).join(" ")}
                style={{ left: spot.left, top: spot.top, width: spot.width, height: h }}
                aria-label={`${f.name}, ${done[i] ? "done, has stripes" : "still adding"}`}
                aria-pressed={done[i]}
                onClick={() => onToggle(i)}
              >
                <Zebra fluid size={spot.width * 1.5} variant="full" striped={done[i]} mood={moodFor(i)} outfit={f.outfit} mirror={spot.mirror} roam={spot.roam} delay={i * 0.12} animate={{ ...idle, blink: true, swish: true, sparkles: false }} decorative />
              </button>
            );
          })}
          {FRIENDS.map((f, i) => {
            const spot = SPOTS[i]!;
            return (
              <span key={f.id} className={[s.tag, done[i] && s.tagOn].filter(Boolean).join(" ")} style={{ left: spot.left + spot.width / 2, top: spot.top + zebraHeight(spot.width) + 1 }} aria-hidden="true">{f.name}</span>
            );
          })}
          <Confetti fire={burst || null} pieces={8} />
        </div>
      </div>
    </div>
  );
}
