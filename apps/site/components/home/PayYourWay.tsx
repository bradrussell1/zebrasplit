import { PayCard } from "./PayCard";
import s from "./home.module.css";

const APPS = ["Venmo", "Cash App", "PayPal"] as const;

/** Pay your way: the ink band with the only volt eyebrow on the page, and the pay-card mock. Text only, no third-party logos. */
export function PayYourWay() {
  return (
    <section className="section" aria-labelledby="pay-title">
      <div className={`container ${s.band} ${s.bandInk} ${s.twoCol}`}>
        <div className={s.payCopy}>
          <span className={`eyebrow ${s.eyebrowVolt}`}>Pay your way</span>
          <h2 id="pay-title" className="display display--tight">One tap<br />Their app. Done.</h2>
          <p className={s.onInkBody}>Paying with Venmo? Cash App? PayPal? You only see the app the person you owe actually uses, with the amount pre-filled.</p>
          <ul className={s.appPills} aria-label="Payment apps">
            {APPS.map((a) => <li key={a} className={s.appPill}>{a}</li>)}
          </ul>
        </div>
        <div className={s.payCol}>
          <PayCard apps={APPS} />
        </div>
      </div>
    </section>
  );
}
