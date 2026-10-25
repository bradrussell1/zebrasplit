import { StoreBadges, type StoreUrls } from "@/components/site/StoreBadges";
import { CtaHerd } from "./CtaHerd";
import s from "./home.module.css";

export function FinalCta({ urls }: { urls: StoreUrls }) {
  return (
    <section id="get" className="section" aria-labelledby="get-title">
      <div className={`container ${s.band} ${s.bandInk} ${s.cta}`}>
        <h2 id="get-title" className="display display--cta">Create your Dazzle</h2>
        <p className={s.ctaSub}>Free on iPhone and Android.</p>
        <StoreBadges urls={urls} location="final_cta" onInk variant="band" />
        <svg className={s.ctaHill} viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 60 Q300 20 600 50 T1200 44 V200 H0 Z" fill="var(--zs-ink-soft)" /></svg>
        <CtaHerd />
      </div>
    </section>
  );
}
