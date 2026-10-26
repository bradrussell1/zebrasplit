import type { ReactNode } from "react";
import l from "@/components/layout/layout.module.css";
import s from "./home.module.css";

const I = ({ children }: { children: ReactNode }) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>;

const FEATURES: { tile: "volt" | "sand" | "blush"; icon: ReactNode; title: string; body: string }[] = [
  { tile: "volt", icon: <I><circle cx="9" cy="12" r="6" /><path d="M9 9.5v5M7.5 11h3M15 7l5 5-5 5M20 12h-5" /></I>, title: "One payment each", body: "Every expense is netted out so most people pay one person, once, in the app they prefer." },
  { tile: "sand", icon: <I><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></I>, title: "Who slept where", body: "Tap the nights each person stayed and the rental splits itself. Showed up Saturday? You pay for Saturday." },
  { tile: "blush", icon: <I><path d="M6 3h12v18l-2.4-1.5-2.4 1.5-2.4-1.5-2.4 1.5L6 21z" /><path d="M9 8h6M9 12h6" /></I>, title: "Itemized receipts", body: "Every line on the receipt, split by who ordered it. Tax and tip follow along." },
  { tile: "sand", icon: <I><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></I>, title: "Any currency", body: "Add in pesos, settle in dollars. The exchange rate locks when you save." },
  { tile: "sand", icon: <I><path d="M2 8.5a16 16 0 0 1 6.3-3.4M12 12.5a8 8 0 0 1 3.4-1.9M9 16.5a4 4 0 0 1 6 0" /><path d="M2 2l20 20" /><path d="M22 8.5a16 16 0 0 0-3.5-2.4" /></I>, title: "Works offline", body: "Cabin with no signal? Track it anyway. It syncs when you’re back online." },
  { tile: "volt", icon: <I><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></I>, title: "Nothing lingering", body: "Once everyone’s square, the trip moves to ‘Past’ with a recap. Pull it up any time." },
];

export function Features() {
  return (
    <section className={`${l.section} section`} aria-labelledby="features-title">
      <div className={`${l.container} ${l.inset} ${s.stack}`}>
        <h2 id="features-title" className="display" style={{ maxWidth: 720 }} data-align="text">The expense sharing app you&apos;ll actually enjoy</h2>
        <ul className={`${l.cardGrid} ${s.grid}`}>
          {FEATURES.map((f, i) => (
            <li key={f.title} className={`${s.card} ${l.card} ${s.feature}`} data-align-right={i % 3 === 2 ? "surface" : undefined}>
              <span className={`${s.tile} ${s[`tile_${f.tile}`]}`} aria-hidden="true" data-align={i === 0 ? "text" : undefined}>{f.icon}</span>
              <h3 className={s.featureTitle}>{f.title}</h3>
              <p className={s.cardBody}>{f.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
