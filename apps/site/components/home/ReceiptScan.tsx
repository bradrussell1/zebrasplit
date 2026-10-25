import { Zebra } from "@/components/zebra";
import { friend, RECEIPT } from "@/content/herd";
import s from "./home.module.css";

const STEPS = [
  <><b>Snap the receipt.</b> Every item, the tax and the total come out on their own.</>,
  <><b>Everyone taps what they ordered.</b> Shared plates split between whoever had them.</>,
  <><b>Tax and tip follow your order.</b> The tip gets its own field, because receipts print before you write it in.</>,
];

/** Receipt scanning (#features): the steps, and a thermal receipt built in HTML with the herd's busts on each line. */
export function ReceiptScan() {
  return (
    <section id="features" className="section">
      <div className={`container ${s.band} ${s.bandWhite} ${s.twoCol}`}>
        <div className={s.receiptCopy}>
          <span className="eyebrow">New · Receipt scanning</span>
          <h2 className="display display--tight">Snap it<br />Split it by item</h2>
          <ol className={s.receiptSteps}>
            {STEPS.map((body, i) => (
              <li key={i} className={s.receiptStep}><span className={s.stepDot} aria-hidden="true">{i + 1}</span><span className={s.receiptStepText}>{body}</span></li>
            ))}
          </ol>
          <p className={s.note}>If something doesn&apos;t add up, we flag it for a quick check instead of guessing.</p>
        </div>
        <div className={s.receiptCol}>
          <ReceiptMock />
        </div>
      </div>
    </section>
  );
}

function ReceiptMock() {
  const who = (ids: readonly string[]) => ids.map((id) => friend(id).name).join(", ");
  const summary = RECEIPT.lines.map((l) => `${l.item} ${l.amount}, ${who(l.who)}`).join("; ");
  return (
    <div className={s.receipt} role="img" aria-label={`Itemized receipt from ${RECEIPT.merchant} with each item assigned to a zebra: ${summary}. Tax ${RECEIPT.tax}, tip ${RECEIPT.tip}, total ${RECEIPT.total}.`}>
      <div className={s.receiptHead}>{RECEIPT.merchant}</div>
      <div className={s.receiptMeta}>{RECEIPT.meta}</div>
      <div className={s.rule} />
      {RECEIPT.lines.map((l) => (
        <div key={l.item} className={s.receiptLine}>
          <span className={s.receiptItem}>{l.item}</span>
          <span className={s.avatars} aria-hidden="true">
            {l.who.map((id) => (
              <span key={id} className={s.avatar}><Zebra variant="bust" mood="happy" size={22} outfit={friend(id).outfit} decorative /></span>
            ))}
          </span>
          <span className={`${s.receiptAmt} tabular`}>{l.amount}</span>
        </div>
      ))}
      <div className={s.rule} />
      <div className={s.receiptTotals}><span>TAX</span><span className="tabular">{RECEIPT.tax}</span></div>
      <div className={s.receiptTotals}><span>TIP (added by you)</span><span className="tabular">{RECEIPT.tip}</span></div>
      <div className={`${s.receiptTotals} ${s.receiptTotal}`}><span>TOTAL</span><span className={`${s.receiptHi} tabular`}>{RECEIPT.total}</span></div>
    </div>
  );
}
