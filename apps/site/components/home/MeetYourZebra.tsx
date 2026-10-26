"use client";
import type { ZebraMood } from "@bunktab/core";
import { outfitDescription } from "@bunktab/core";
import { useState } from "react";
import { Zebra } from "@/components/zebra";
import { FRIENDS } from "@/content/herd";
import l from "@/components/layout/layout.module.css";
import s from "./home.module.css";

const MOODS: { id: ZebraMood; label: string }[] = [{ id: "hi", label: "Hi" }, { id: "happy", label: "Happy" }, { id: "starry", label: "Starry" }];

/** Meet your zebra (#zebra): six looks × three moods on one full-body, fully striped zebra. No prices anywhere. */
export function MeetYourZebra() {
  const [look, setLook] = useState(0);
  const [mood, setMood] = useState<ZebraMood>("happy");
  const outfit = FRIENDS[look]!.outfit;
  return (
    <section id="zebra" className={`${l.section} section`} aria-labelledby="zebra-title">
      <div className={`${l.container} ${l.inset}`}>
        <div className={l.split}>
          <div className={s.zebraCopy}>
            <span className="eyebrow" data-align="text">New · Your zebra</span>
            <h2 id="zebra-title" className="display display--tight">Meet your zebra</h2>
            <p className={s.sectionBody}>Dress it up. Your friends see it on every trip. Free outfits to start, new drops all the time.</p>
            <div role="group" aria-label="Try a look" className={s.looks}>
              {FRIENDS.map((f, i) => (
                <button key={f.id} type="button" className={[s.lookChip, i === look && s.lookOn, "pillFocus"].filter(Boolean).join(" ")} aria-pressed={i === look} onClick={() => setLook(i)}>{f.look}</button>
              ))}
            </div>
            <div role="group" aria-label="Try a mood" className={s.moods}>
              {MOODS.map((m) => (
                <button key={m.id} type="button" className={[s.moodChip, m.id === mood && s.moodOn, "pillFocus"].filter(Boolean).join(" ")} aria-pressed={m.id === mood} onClick={() => setMood(m.id)}>{m.label}</button>
              ))}
            </div>
          </div>
          {/* a surface in column 2: its right edge reaches the surface line (2.3); the zebra stays centred inside it */}
          <div className={`${s.zebraPanel} ${l.bleedRight}`} data-align="col2" data-align-right="surface">
            <svg className={s.zebraHill} viewBox="0 0 520 160" preserveAspectRatio="none" aria-hidden="true"><path d="M0 40 Q130 10 270 34 T520 28 V160 H0 Z" fill="var(--zs-pasture-field)" /></svg>
            <svg className={s.zebraSparkles} viewBox="0 0 520 420" aria-hidden="true">
              <path d="M80 80 l5 12 l12 5 l-12 5 l-5 12 l-5 -12 l-12 -5 l12 -5 Z" fill="var(--zs-volt)" stroke="var(--zs-ink)" strokeWidth="2" />
              <path d="M440 110 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z" fill="var(--zs-pink)" />
            </svg>
            <div key={look} className={s.zebraStage}>
              <Zebra fluid size={300} variant="full" striped mood={mood} outfit={outfit} animate={{ trot: true, blink: true, swish: true, sparkles: false }} decorative />
            </div>
            <p className="srOnly" aria-live="polite">Zebra wearing {outfitDescription(outfit)}, {mood} mood</p>
          </div>
        </div>
      </div>
    </section>
  );
}
