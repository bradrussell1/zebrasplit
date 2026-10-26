import { SectionHeading } from "@/components/site/SectionHeading";
import l from "@/components/layout/layout.module.css";
import s from "./home.module.css";

const STEPS = [
  { title: "Start a dazzle", body: <>A group of zebras is a <b>dazzle</b>. Create the trip, add the dates, and invite your herd.</> },
  { title: "Track what you paid", body: <>Snap a receipt or type it in. Split evenly, by item, or by the nights each person stayed.</> },
  { title: "Earn your stripes, close out", body: <>Tap <b>Done</b> when you&apos;re finished. When everyone has their stripes, close out opens Venmo, Cash App or PayPal with everything pre-filled.</> },
];

export function HowItWorks() {
  return (
    <section id="how" className={`${l.section} section`}>
      <div className={`${l.container} ${l.inset} ${s.stack}`}>
        <SectionHeading eyebrow="How it works" title="Three steps. Simplified." eyebrowAlign="text" />
        <ol className={`${l.cardGrid} ${s.steps}`}>
          {STEPS.map((st, i) => (
            <li key={st.title} className={`${s.card} ${l.card} ${s.step}`} data-align-right={i === STEPS.length - 1 ? "surface" : undefined}>
              <span className={s.stepNo} aria-hidden="true" data-align={i === 0 ? "text" : undefined}>{i + 1}</span>
              <h3 className={s.h3}>{st.title}</h3>
              <p className={s.cardBody}>{st.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
