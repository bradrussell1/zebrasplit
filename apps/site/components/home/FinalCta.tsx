import { StoreBadges, type StoreUrls } from "@/components/site/StoreBadges";
import { CtaHerd } from "./CtaHerd";
import l from "@/components/layout/layout.module.css";
import s from "./home.module.css";

/** Final CTA: an ink band, left-aligned on the text line like everything else, the herd on a hill along the bottom. */
export function FinalCta({ urls }: { urls: StoreUrls }) {
  return (
    <section id="get" className={`${l.section} section`} aria-labelledby="get-title">
      <div className={l.container}>
        <div className={`${l.band} ${s.bandInk} ${s.cta}`}>
          <h2 id="get-title" className="display display--cta" data-align="text">Create your Dazzle</h2>
          <p className={s.ctaSub}>Free on iPhone and Android.</p>
          <StoreBadges urls={urls} location="final_cta" onInk variant="band" />
          <svg className={s.ctaHill} viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 60 Q300 20 600 50 T1200 44 V200 H0 Z" fill="var(--zs-ink-soft)" /></svg>
          <CtaHerd />
        </div>
      </div>
    </section>
  );
}
