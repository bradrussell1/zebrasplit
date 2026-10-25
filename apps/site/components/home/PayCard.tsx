"use client";
import { useState } from "react";
import { Zebra } from "@/components/zebra";
import { friend } from "@/content/herd";
import s from "./home.module.css";

const AMOUNT = "$84.50";

/**
 * The pay-card mock: picking an app in the segmented row updates the Pay button's label.
 * Mock behaviour only; nothing here opens a payment app.
 */
export function PayCard({ apps }: { apps: readonly string[] }) {
  const [app, setApp] = useState(apps[0]!);
  return (
    <div className={s.payCard} role="group" aria-label={`Payment card mock: you owe Jen ${AMOUNT}. Pick Venmo, Cash App or PayPal to see the Pay button change.`}>
      <div className={s.payHead}>
        <span className={s.payDisc} aria-hidden="true"><Zebra variant="bust" mood="love" size={50} outfit={friend("priya").outfit} decorative /></span>
        <span className={s.payWho}><span className={s.payLabel}>You owe</span><span className={s.payName}>Jen</span></span>
        <span className={`${s.payAmount} tabular`}>{AMOUNT}</span>
      </div>
      <div className={s.picker} role="radiogroup" aria-label="Payment app">
        {apps.map((a) => (
          <button key={a} type="button" role="radio" aria-checked={a === app} className={[s.pickerCell, a === app && s.pickerOn].filter(Boolean).join(" ")} onClick={() => setApp(a)}>{a}</button>
        ))}
      </div>
      <div className={s.payButton} aria-live="polite">Pay Jen {AMOUNT} in {app}</div>
      <div className={s.payFallback}>Paid another way</div>
    </div>
  );
}
