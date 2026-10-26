import l from "@/components/layout/layout.module.css";
import s from "./home.module.css";

const Check = () => <svg className={s.check} width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>;

export function FreeBand() {
  return (
    <section className={`${l.section} section`} aria-labelledby="free-title">
      <div className={l.container}>
        <div className={`${l.band} ${s.bandVolt} ${l.split} ${s.free}`}>
          <h2 id="free-title" className={`display display--free ${s.freeTitle}`} data-align="text">Zebrasplitting is free<br />Actually free</h2>
          <ul className={s.freeList} data-align="col2">
            <li><Check />No expense limits, no daily caps</li>
            <li><Check />We never hold your money. Your payment app does.</li>
            <li><Check />Outfits are just for fun</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
