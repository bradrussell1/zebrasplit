import { computeNightsShares, divideEvenly, formatCents, toBaseCents } from "@bunktab/core";
import { Zebra } from "@/components/zebra";
import { friend } from "@/content/herd";
import { CURRENCY_EXAMPLE, NIGHTS_EXAMPLE } from "@/content/featureExamples";
import s from "./features.module.css";

/**
 * The two feature-page mocks with no homepage twin. Both are computed by the same
 * @bunktab/core functions the app uses, and both throw at build time if the engine's answer
 * stops matching the figures the page copy quotes (content/featureExamples.ts).
 */
const Bust = ({ id }: { id: string }) => (
  <span className={s.bust} aria-hidden="true"><Zebra variant="bust" mood="happy" size={26} outfit={friend(id).outfit} decorative /></span>
);

/** Who slept where: a row per person, a cell per night, and the share the lodging engine gives them. */
export function NightsMock() {
  const { label, amountCents, nights, nightLabels, people, payer, expected } = NIGHTS_EXAMPLE;
  const { shares } = computeNightsShares({ amountCents, nights, presence: Object.fromEntries(people.map((p) => [p.id, [...p.stayed]])), payerIds: [payer] });
  if (JSON.stringify(shares) !== JSON.stringify(expected)) throw new Error(`nights example drifted from the engine: ${JSON.stringify(shares)}`);
  const summary = people.map((p) => `${friend(p.id).name} stayed ${p.stayed.filter(Boolean).length} of ${nights} nights and pays ${formatCents(shares[p.id]!)}`).join("; ");
  return (
    <div className={s.mockWrap} data-align="col2">
      <div className={s.mock} role="img" aria-label={`${label}, ${formatCents(amountCents)} for ${nights} nights, split by nights stayed: ${summary}.`}>
        <div className={s.mockHead}>
          <span className={s.mockTitle}>{label}</span>
          <span className={`${s.mockTotal} tabular`}>{formatCents(amountCents)}</span>
        </div>
        <div className={s.nightsGrid}>
          <span />
          {nightLabels.map((n) => <span key={n} className={s.nightLabel}>{n}</span>)}
          <span />
          {people.map((p) => (
            <div key={p.id} className={s.nightsRow}>
              <span className={s.person}><Bust id={p.id} /><span className={s.personName}>{friend(p.id).name}</span></span>
              {p.stayed.map((there, n) => (
                <span key={n} className={[s.night, there && s.nightOn].filter(Boolean).join(" ")}>
                  {there ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg> : null}
                </span>
              ))}
              <span className={`${s.share} tabular`}>{formatCents(shares[p.id]!)}</span>
            </div>
          ))}
        </div>
        <div className={s.mockFoot}>Jess arrived Saturday, so she pays for two nights.</div>
      </div>
    </div>
  );
}

/** One expense in pesos, the locked rate, and what it comes to in the trip's main currency. */
export function CurrencyMock() {
  const { label, amountCents, currency, base, rate, people, expected } = CURRENCY_EXAMPLE;
  const baseCents = toBaseCents(amountCents, rate);
  const shares = divideEvenly(baseCents, people.length);
  if (baseCents !== expected.baseCents || JSON.stringify(shares) !== JSON.stringify(expected.shares)) throw new Error(`currency example drifted from the engine: ${baseCents} ${JSON.stringify(shares)}`);
  const pesos = formatCents(amountCents, currency);
  return (
    <div className={s.mockWrap} data-align="col2">
      <div className={s.mock} role="img" aria-label={`${label}: ${pesos} at a locked rate of 1 ${currency} = ${rate} ${base} is ${formatCents(baseCents)} in the trip, split ${people.length} ways at about ${formatCents(shares[0]!)} each.`}>
        <div className={s.mockHead}>
          <span className={s.mockTitle}>{label}</span>
          <span className={s.code}>{currency}</span>
        </div>
        <div className={`${s.bigAmount} tabular`}>{pesos}</div>
        <div className={s.rateRow}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          <span>Rate locked</span>
          <span className={`${s.rate} tabular`}>1 {currency} = {rate} {base}</span>
        </div>
        <div className={s.convert}>
          <span className={s.convertLabel}>In the trip ({base})</span>
          <span className={`${s.convertAmount} tabular`}>{formatCents(baseCents)}</span>
        </div>
        <div className={s.shareList}>
          {people.map((id, i) => (
            <div key={id} className={s.shareRow}>
              <span className={s.person}><Bust id={id} /><span className={s.personName}>{friend(id).name}</span></span>
              <span className={`${s.share} tabular`}>{formatCents(shares[i]!)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
