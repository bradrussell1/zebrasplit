"use client";
/**
 * The zebra for the web (DESIGN_SYSTEM.md §7), ported from apps/mobile/src/ui/zebra with
 * the same props. One inline <svg>; motion is CSS (zebra.module.css) driven by the motion
 * tokens; every mood's eye group is mounted and crossfades over 250 ms; a body stripe is a
 * ghost rect with an ink rect that scales down from its top edge (520 ms spring) when
 * that member is done. Outfits come from the generated layer map (the same masters the
 * app draws), painted in the catalogue's order. Everything looping stops under Reduce Motion.
 */
import type { Outfit, OutfitLayerSpec, ZebraMood } from "@bunktab/core";
import { outfitLayers, stripeLayout, zebraLabel, ZEBRA_STRIPE } from "@bunktab/core";
import { zebra as z } from "@bunktab/theme";
import { createElement, useId, useMemo, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion } from "@/lib/motion";
import { BLINKING, bodyFill, BODY_PATH, BUST_VIEWBOX, ears, eyes, FULL_VIEWBOX, head, legs, mane, MOODS, NECK_PATH, neckStripes, outline, shadow, sparkles, strokeScale, sweatDrop, TAIL_ROOT, tail, tuft, zs, type SvgNode } from "./geometry";
import { OUTFIT_LAYERS, type OutfitNode } from "./outfits.generated";
import s from "./zebra.module.css";

export type ZebraAnimate = {
  blink?: boolean;
  bob?: boolean;
  swish?: boolean;
  dance?: boolean;
  /** Sparkles: forced on, or forced off (`false`) for a striped starry zebra in a herd. */
  sparkles?: boolean;
  /** Herd idles (Trip-Herd board): one of these at a time, each a loop. */
  trot?: boolean;
  graze?: boolean;
  hop?: boolean;
};

export type ZebraProps = {
  variant?: "full" | "bust";
  mood?: ZebraMood;
  /** Full only: members in the dazzle and how many are done (the old per-trip meter). */
  members?: number;
  done?: number;
  /** One zebra in a herd: all six stripes or none. Wins over members/done. */
  striped?: boolean;
  /** What it's wearing: one item each in head, faceneck and body (ids from the catalogue). */
  outfit?: Outfit | null;
  /** Rendered width in px; height follows the viewBox. With `fluid`, it's only the nominal size for the stroke rule. */
  size?: number;
  /** Fill the parent's width instead of a fixed px size (the herd scene scales as one). */
  fluid?: boolean;
  /** Face the other way (scaleX −1), so a herd doesn't all look left. */
  mirror?: boolean;
  animate?: ZebraAnimate;
  /** Offset for the idle loop, in seconds (herds stagger in 0.12 s steps). */
  delay?: number;
  /** Drift left and right by `r` px over `d` seconds, starting `delay` s in (negative = already moving). */
  roam?: { r: number; d: number; delay?: number };
  /** Freeze every loop (off-screen zebras don't animate). */
  paused?: boolean;
  /** Change this to replay the dance. */
  danceKey?: number | string;
  /** Tail up (the dazzled pose). Defaults to true when every stripe is in. */
  tailUp?: boolean;
  label?: string;
  /** Decorative zebras (inside pills, next to a heading) are hidden from screen readers. */
  decorative?: boolean;
  className?: string;
  style?: CSSProperties;
};

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");
const render = (nodes: SvgNode[]) => nodes.map((n, i) => createElement(n.t, { key: i, ...n.a }, n.text));
const renderTree = (nodes: OutfitNode[]): ReactNode => nodes.map((n, i) => createElement(n.t, { key: i, ...n.a }, n.c ? renderTree(n.c) : n.text));

export function Zebra({ variant = "full", mood = "hi", members = 6, done = 0, striped, outfit, size = 244, fluid, mirror, animate, delay, roam, paused, danceKey = 0, tailUp, label, decorative, className, style }: ZebraProps) {
  const reduced = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const torsoClip = `zs-torso-${uid}`;
  const bodyClip = `zs-body-${uid}`;
  const neckClip = `zs-neck-${uid}`;
  const bust = variant === "bust";
  const vb = bust ? BUST_VIEWBOX : FULL_VIEWBOX;
  const height = size * (vb.h / vb.w);
  const sw = strokeScale(size);
  const m = striped === undefined ? members : ZEBRA_STRIPE.six.length;
  const d = striped === undefined ? done : striped ? ZEBRA_STRIPE.six.length : 0;
  const stripes = stripeLayout(m, d);
  const allIn = m > 0 && d >= m;
  const up = tailUp ?? (!bust && mood === "starry");
  const blinks = !!animate?.blink && !reduced && BLINKING.includes(mood);
  const swishes = !!animate?.swish && !reduced && !bust;
  const dances = !!animate?.dance && !reduced;
  const idle = reduced ? null : animate?.hop ? s.hop : animate?.graze ? s.graze : animate?.trot ? s.trot : animate?.bob ? s.bob : null;
  const roams = !!roam && !reduced;
  const showSparkles = !bust && (animate?.sparkles ?? (allIn && mood === "starry"));
  const a11yLabel = label ?? zebraLabel(mood, bust ? undefined : m, bust ? undefined : d);

  // What it's wearing, in paint order: torso (clipped) under the outline, skirt over it,
  // then everything else above the eyes so glasses cover them rather than hide behind them.
  const look = useMemo(() => outfitLayers(outfit), [outfit]);
  const clipUrl = `url(#${bust ? neckClip : bodyClip})`;
  const wears = (spec: OutfitLayerSpec) => {
    const art = OUTFIT_LAYERS[spec.id];
    return art ? <g key={spec.id}>{renderTree(art({ k: sw, clip: clipUrl, black: "inherit" }))}</g> : null;
  };
  const worn = (order: number) => look.filter((l) => l.drawOrder === order).map(wears);
  const overEyes = look.filter((l) => l.drawOrder >= 3);

  return (
    <span
      className={cx(s.root, fluid && s.fluid, roams && s.roam, className)}
      style={{ width: fluid ? "100%" : size, height: fluid ? "auto" : height, ...(roams ? ({ "--r": `${roam!.r}px`, "--d": `${roam!.d}s`, animationDelay: `${roam!.delay ?? 0}s` } as CSSProperties) : null), ...style }}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : a11yLabel}
      aria-hidden={decorative ? true : undefined}
      data-reduced={reduced ? "" : undefined}
      data-paused={paused ? "" : undefined}
      data-mood={mood}
    >
      <span key={String(danceKey)} className={cx(s.layer, dances && s.dance, idle)} style={delay ? { animationDelay: `${delay}s` } : undefined}>
        <svg className={s.svg} width={size} height={height} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} style={mirror ? { transform: "scaleX(-1)" } : undefined} focusable="false" aria-hidden="true">
          <defs>
            <clipPath id={torsoClip}><rect x={ZEBRA_STRIPE.clip.x} y={ZEBRA_STRIPE.clip.y} width={ZEBRA_STRIPE.clip.width} height={ZEBRA_STRIPE.clip.height} rx={ZEBRA_STRIPE.clip.rx} /></clipPath>
            <clipPath id={bodyClip}><path d={BODY_PATH} /></clipPath>
            <clipPath id={neckClip}><path d={NECK_PATH} /></clipPath>
          </defs>
          {!bust ? render(shadow()) : null}
          {!bust ? (
            <g className={cx(swishes && s.swish)} style={{ transformOrigin: `${TAIL_ROOT.x - vb.x}px ${TAIL_ROOT.y - vb.y}px` }}>{render(tail(up, sw))}</g>
          ) : null}
          {!bust ? render(legs(sw)) : null}
          {render(mane(sw))}
          {render(bodyFill(bust))}
          {!bust ? (
            <g clipPath={`url(#${torsoClip})`}>
              {stripes.map((st, i) => {
                const x = st.cx - st.width / 2;
                return (
                  <g key={`${m}-${i}`} transform={`rotate(${ZEBRA_STRIPE.angleDeg} ${st.cx} ${ZEBRA_STRIPE.pivotY})`}>
                    <rect x={x} y={ZEBRA_STRIPE.top} width={st.width} height={ZEBRA_STRIPE.height} rx={st.width / 2} fill={z.ghostStripe} />
                    <rect className={s.stripeInk} x={x} y={ZEBRA_STRIPE.top} width={st.width} height={ZEBRA_STRIPE.height} rx={st.width / 2} fill={z.ink} style={{ transform: st.done ? "scaleY(1)" : "scaleY(0)", transitionDelay: striped === undefined ? `${i * 40}ms` : "0ms" }} />
                  </g>
                );
              })}
            </g>
          ) : null}
          {bust ? render(neckStripes(true, sw)) : <g clipPath={`url(#${bodyClip})`}>{render(neckStripes(false, sw))}</g>}
          {worn(1)}
          {render(outline(bust, sw))}
          {worn(2)}
          {ears(mood, sw).map((ear, i) => <g key={i} transform={ear.transform}>{render(ear.nodes)}</g>)}
          {render(head(mood, sw))}
          {MOODS.map((mm) => (
            <g key={mm} className={s.fade} style={{ opacity: mm === mood ? 1 : 0 }}>
              <g className={cx(BLINKING.includes(mm) && blinks && s.blink)}>{render(eyes(mm, sw))}</g>
            </g>
          ))}
          {render(tuft(sw))}
          {overEyes.flatMap((l) => (l.layer === "hood"
            ? [wears(l), <g key="hood-ears">{ears(mood, sw).map((ear, i) => <g key={i} transform={ear.transform}>{render(ear.nodes)}</g>)}</g>]
            : [wears(l)]))}
          {/* mood extras draw above the outfit, never under it */}
          <g className={s.fade} style={{ opacity: mood === "worried" ? 1 : 0 }}>{render(sweatDrop(sw))}</g>
          {showSparkles ? render(sparkles(sw)) : null}
          {mood === "sleepy" ? <g className={cx(!reduced && s.zz)}>{render(zs())}</g> : null}
        </svg>
      </span>
    </span>
  );
}
