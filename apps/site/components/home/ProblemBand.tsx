import l from "@/components/layout/layout.module.css";
import s from "./home.module.css";

/** Unchanged copy from the first homepage: the ink band straight under the hero. */
export function ProblemBand() {
  return (
    <section className={l.section}>
      <div className={l.container}>
        <div className={`${l.band} ${s.bandInk} ${l.split} ${s.problem}`} data-align-right="surface">
          <div className={s.problemCopy}>
            <h2 className="display" data-align="text">A paywall after three expenses?<br />On a <span className={s.mark}>trip</span>?</h2>
            <p className={s.onInkBody}>Some apps cap free users at a handful of expenses a day. Zebrasplit has no daily limit and no upsell when you need it most.</p>
          </div>
          <ol aria-label="A normal travel day" className={s.day} data-align="col2" data-align-right="text">
            <li className={s.dayItem}><span>Breakfast tacos</span><span>1</span></li>
            <li className={s.dayItem}><span>Rideshare to the beach</span><span>2</span></li>
            <li className={s.dayItem}><span>Boat rental</span><span>3</span></li>
            <li className={`${s.dayItem} ${s.dayBlocked}`}><span>Groceries · blocked elsewhere</span><span>4</span></li>
            <li className={`${s.dayItem} ${s.dayFree}`}><span>Dinner · still free here</span><span>5</span></li>
          </ol>
        </div>
      </div>
    </section>
  );
}
