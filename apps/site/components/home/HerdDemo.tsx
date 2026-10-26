"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { FRIENDS, HERD_COLLECT, HERD_START } from "@/content/herd";
import { trackEvent } from "@/lib/analytics";
import l from "@/components/layout/layout.module.css";
import s from "./home.module.css";

// The field, the six zebras and the confetti are below the fold; their code loads on its own.
const HerdScene = dynamic(() => import("./HerdScene").then((m) => m.HerdScene), { loading: () => <div className={s.herdLoading} aria-hidden="true" /> });

/**
 * Earn your Stripes (Trip-Herd board): six zebras in a field and six toggles share one
 * Done state. At 6 of 6 every zebra goes starry and hops, confetti fires once, the locked
 * pill becomes the volt Close out link, and `stripes_demo_complete` fires the first time.
 */
export function HerdDemo() {
  const [done, setDone] = useState<boolean[]>([...HERD_START]);
  const [burst, setBurst] = useState(0);
  const wasAll = useRef(false);
  const fired = useRef(false);
  const count = done.filter(Boolean).length;
  const all = count === FRIENDS.length;

  useEffect(() => {
    if (all && !wasAll.current) {
      setBurst((b) => b + 1);
      if (!fired.current) { fired.current = true; trackEvent({ name: "stripes_demo_complete" }); }
    }
    wasAll.current = all;
  }, [all]);

  const toggle = (i: number) => setDone((d) => d.map((v, j) => (j === i ? !v : v)));

  return (
    <section className={`${l.section} section`} aria-labelledby="stripes-title">
      {/* the panel is a surface: it bleeds back out to the surface line on its left (2.3) */}
      <div className={`${l.container} ${l.inset}`}>
        <div className={l.split}>
          <div className={`${s.herdPanel} ${l.bleedLeft}`}>
            <HerdScene done={done} onToggle={toggle} burst={burst} />
            <div className={s.counter} aria-live="polite">{count} of 6 striped</div>
          </div>
          {/* column 2 reaches out to the surface line on the right; its content still starts on the column-2 line */}
          <div className={`${s.demoCopy} ${l.reachRight}`}>
            <span className="eyebrow" data-align="col2">Try it · tap a friend</span>
            <h2 id="stripes-title" className="display display--feature">Earn your Stripes</h2>
            <p className={s.demoBody}><b>Nobody settles up until everyone has finished adding expenses.</b> Each zebra earns its stripes when they tap Done. No more &quot;wait, I forgot the gas.&quot;</p>
            <div className={s.toggles} data-align-right="surface">
              {FRIENDS.map((f, i) => (
                <button key={f.id} type="button" className={[s.toggle, done[i] && s.toggleOn, "pillFocus"].filter(Boolean).join(" ")} aria-pressed={done[i]} onClick={() => toggle(i)}>
                  {done[i] ? `${f.name} ✓` : f.name}
                </button>
              ))}
            </div>
            {all ? (
              <Button variant="primary" size="lg" href="#get" className={`${s.demoCta} ${s.rise}`}>Close out · collect {HERD_COLLECT}</Button>
            ) : (
              <Button variant="locked" size="lg" disabled className={s.demoCta}>Close out unlocks at 6 of 6</Button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
