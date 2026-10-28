"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/Button";
import { supabaseBrowser } from "@/lib/supabase";
import s from "./admin.module.css";

/**
 * The admin portal.
 *
 * Signing in is Supabase Auth through Google; being an admin is a row in
 * private.admins plus an OAuth session (is_admin checks both). Every read below
 * goes through a security-definer function that checks public.is_admin() first,
 * so this page has no privileges of its own — a non-admin who signs in sees an
 * empty portal, not a leak.
 *
 * The range pills top-right (7 days / 30 days / all time) go to every read as
 * p_since: rows created at or after it. "Last 7 days" sub-labels are always the
 * trailing week regardless of the range.
 */
const TABS = ["Overview", "Users", "Dazzles", "Welcome wizard", "Models", "Integrations", "Feedback", "Data"] as const;
type Tab = (typeof TABS)[number];
type Range = "7d" | "30d" | "all";
const RANGES: { key: Range; label: string }[] = [{ key: "7d", label: "Last 7D" }, { key: "30d", label: "Last 30D" }, { key: "all", label: "All-time" }];
function sinceOf(r: Range): string | null {
  if (r === "all") return null;
  return new Date(Date.now() - (r === "7d" ? 7 : 30) * 86400 * 1000).toISOString();
}

// one dollar format everywhere: $3,545.00 (a minus sign ahead of the $ for negatives)
const money = (cents: number | null | undefined) => {
  const c = Number(cents ?? 0);
  return `${c < 0 ? "−" : ""}$${(Math.abs(c) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const usd = (n: number | null | undefined) => `$${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
const num = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("en-US");
const pct = (n: number | null | undefined) => (n == null || Number.isNaN(Number(n)) ? "—" : `${(Number(n) * 100).toFixed(1)}%`);
const ratio = (a: number | null | undefined, b: number | null | undefined) => (Number(b ?? 0) > 0 ? Number(a ?? 0) / Number(b) : null);
const when = (iso: string | null | undefined) =>
  !iso ? "—" : new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function useRpc<T>(fn: string, args: Record<string, unknown>, active: boolean) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(args);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data: d, error: e } = await supabaseBrowser().rpc(fn, JSON.parse(key));
    setLoading(false);
    if (e) { setError(e.message); return; }
    setData(d as T);
  }, [fn, key]);

  useEffect(() => { if (active) load(); }, [active, load]);
  return { data, error, loading, reload: load };
}

function Panel({ loading, error, empty, children }: { loading: boolean; error: string | null; empty?: boolean; children: React.ReactNode }) {
  if (error) return <p className={s.error} role="alert">{error}</p>;
  if (loading) return <p className={s.muted}>Loading…</p>;
  if (empty) return <p className={s.muted}>Nothing here yet.</p>;
  return <>{children}</>;
}

function Stat({ label, value, sub, onClick }: { label: string; value: string; sub?: string; onClick?: () => void }) {
  const inner = (
    <>
      <span className={s.statLabel}>{label}{onClick ? <span className={s.statGo} aria-hidden="true"> ›</span> : null}</span>
      <span className={s.statValue}>{value}</span>
      {sub ? <span className={s.statSub}>{sub}</span> : null}
    </>
  );
  if (onClick) return <button type="button" className={`${s.stat} ${s.statBtn}`} onClick={onClick}>{inner}</button>;
  return <div className={s.stat}>{inner}</div>;
}

/** A short-lived link to a private photo, requested as the signed-in admin (storage policy admin_reads_receipts). */
async function signedUrl(bucket: "receipts" | "covers", path: string): Promise<string | null> {
  const { data } = await supabaseBrowser().storage.from(bucket).createSignedUrl(path, 300);
  return data?.signedUrl ?? null;
}

function PhotoViewer({ title, bucket, path, onClose, children }: { title: string; bucket: "receipts" | "covers"; path: string; onClose: () => void; children?: React.ReactNode }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    signedUrl(bucket, path).then((u) => { if (!live) return; if (u) setUrl(u); else setError("Couldn't open this photo."); });
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => { live = false; window.removeEventListener("keydown", onKey); };
  }, [bucket, path, onClose]);
  return (
    <div className={s.drawerWrap}>
      <button type="button" className={s.overlay} aria-label="Close" onClick={onClose} />
      <aside className={s.drawer} role="dialog" aria-modal="true" aria-label={title}>
        <div className={s.drawerHead}><h2 className={s.drawerTitle}>{title}</h2><Button variant="secondary" size="sm" onClick={onClose}>Close</Button></div>
        {error ? <p className={s.error}>{error}</p> : url ? <img src={url} alt={title} className={s.photo} /> : <p className={s.muted}>Loading…</p>}
        {url ? <a className={s.link} href={url} target="_blank" rel="noreferrer">Open full size</a> : null}
        {children}
      </aside>
    </div>
  );
}

function Bars({ rows, top }: { rows: { key: string; label: React.ReactNode; value: number; num: string; pct: string }[]; top?: number }) {
  const max = top ?? Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className={s.bars}>
      {rows.map((r) => (
        <div key={r.key} className={s.barRow}>
          <span className={s.barLabel}>{r.label}</span>
          <div className={s.barTrack}><div className={s.bar} style={{ width: `${(r.value / max) * 100}%` }} /></div>
          <span className={s.barNum}>{r.num}</span>
          <span className={s.barPct}>{r.pct}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Overview */
type Overview = {
  users: { total: number; new_7d: number; with_payment: number };
  trips: { total: number; open: number; settled: number; archived: number; new_7d: number; avg_members: number | null; expenses_per_day: number | null };
  expenses: { total: number; cents: number; new_7d: number; from_receipt: number; manual: number };
  settlements: { total: number; paid: number; paid_cents: number; pending_cents: number; pending_lt7_cents: number; pending_gt30_cents: number; avg_days_to_settle: number | null; settled_trips: number; rails: { rail: string; payments: number; cents: number }[] };
  receipts: { total: number; cost_usd: number; avg_cost_usd: number; failed: number; read: number; corrected: number; lines: number; lines_edited: number };
  feedback_new: number;
  invites: { total: number; accepted: number; pending: number };
};
const METHODS: { key: string; label: string }[] = [
  { key: "manual", label: "Cash/by hand" }, { key: "venmo", label: "Venmo" }, { key: "cashapp", label: "Cashapp" }, { key: "paypal", label: "Paypal" },
];
type TripRow = { id: string; title: string; status: string; base_currency: string; created_at: string; members: number; done: number; expenses: number; cents: number; settled_cents: number };
type Detail = "expenses" | "receipts" | "payments";
const SPLIT_LABEL: Record<string, string> = { equal: "Equally", exact: "Exact amounts", percent: "By percent", shares: "By shares", nights: "By nights", itemized: "Itemized receipt" };

function OverviewTab({ active, since, go }: { active: boolean; since: string | null; go: (tab: Tab, filter?: Filter) => void }) {
  const { data, error, loading } = useRpc<Overview>("admin_overview", { p_since: since }, active);
  const [detail, setDetail] = useState<Detail | null>(null);
  const d = data;
  const outstanding = d ? Number(d.expenses.cents) - Number(d.settlements.paid_cents) : 0;
  const railTotal = d ? d.settlements.rails.reduce((a, r) => a + Number(r.payments), 0) : 0;
  const byRail = new Map((d?.settlements.rails ?? []).map((r) => [r.rail, r]));

  if (detail) {
    const title = detail === "expenses" ? "Expenses" : detail === "receipts" ? "Receipts" : "Payments";
    return (
      <>
        <div className={s.crumbs}><button type="button" className={s.link} onClick={() => setDetail(null)}>‹ Overview</button><span className={s.muted}> / {title}</span></div>
        {detail === "expenses" ? <ExpensesList since={since} /> : detail === "receipts" ? <ReceiptsList since={since} /> : <PaymentsList since={since} />}
      </>
    );
  }

  const handles = ratio(d?.users.with_payment, d?.users.total);
  return (
    <Panel loading={loading} error={error}>
      {d ? (
        <div className={s.domains}>
          {/* 1. money: what was logged, what is still owed, what moved, and how */}
          <section className={`${s.block} ${s.hero}`} aria-labelledby="dom-money">
            <h3 id="dom-money" className={s.blockTitle}>Financials &amp; settlement flow</h3>
            <div className={s.heroGrid}>
              <Stat label="Logged" value={money(d.expenses.cents)} sub={`across ${num(d.expenses.total)} expenses · ${num(d.expenses.from_receipt)} from receipts`} onClick={() => setDetail("expenses")} />
              <Stat label="Outstanding" value={money(outstanding)} sub={`${money(d.settlements.pending_lt7_cents)} pending < 7 days · ${money(d.settlements.pending_gt30_cents)} aging > 30 days`} onClick={() => setDetail("payments")} />
              <Stat label="Settled" value={money(d.settlements.paid_cents)} sub={`${num(d.settlements.paid)} of ${num(d.settlements.total)} payments completed`} onClick={() => setDetail("payments")} />
              <Stat label="Settlement velocity" value={d.settlements.avg_days_to_settle == null ? "—" : `${Number(d.settlements.avg_days_to_settle).toFixed(1)} days`} sub={d.settlements.settled_trips ? `last expense → settled, ${num(d.settlements.settled_trips)} Dazzles` : "no Dazzle has settled yet"} onClick={() => go("Dazzles")} />
            </div>
            <h4 className={s.blockSub}>Payment method</h4>
            <Bars rows={METHODS.map((m) => { const r = byRail.get(m.key); const n = Number(r?.payments ?? 0); return { key: m.key, label: m.label, value: n, num: `${num(n)} · ${money(r?.cents ?? 0)}`, pct: railTotal ? pct(n / railTotal) : "—" }; })} top={Math.max(railTotal, 1)} />
            {railTotal === 0 ? <p className={s.hint}>No payment has been marked paid yet.</p> : null}
          </section>

          <div className={s.halves}>
            {/* 2. the network: groups, people, invitations */}
            <section className={s.block} aria-labelledby="dom-groups">
              <h3 id="dom-groups" className={s.blockTitle}>Group dynamics &amp; network growth</h3>
              <div className={s.blockGrid}>
                <Stat label="Dazzles" value={`${num(d.trips.total)} total`} sub={`${num(d.trips.open)} open · ${num(d.trips.settled)} settled · ${num(d.trips.archived)} archived`} onClick={() => go("Dazzles")} />
                <Stat label="People" value={num(d.users.total)} sub={`${num(d.users.with_payment)} have handles (${handles == null ? "—" : `${Math.round(handles * 100)}%`}) · ${num(d.users.new_7d)} joined this week`} onClick={() => go("Users")} />
                <Stat label="Group health" value={d.trips.avg_members == null ? "—" : `${Number(d.trips.avg_members).toFixed(1)} avg. size`} sub={`${num(d.invites.total)} invites sent (${num(d.invites.accepted)} accepted)${d.trips.expenses_per_day == null ? "" : ` · ${Number(d.trips.expenses_per_day).toFixed(2)} expenses/day`}`} onClick={() => go("Users", "invited")} />
              </div>
            </section>

            {/* 3. the machinery: the receipt reader and what is waiting on you */}
            <section className={s.block} aria-labelledby="dom-ops">
              <h3 id="dom-ops" className={s.blockTitle}>OCR &amp; operations</h3>
              <div className={s.blockGrid}>
                <Stat label="Receipt pipeline" value={`${num(d.receipts.total)} read`} sub={`${num(d.receipts.failed)} failed · ${usd(d.receipts.cost_usd)} cost · ${usd(d.receipts.avg_cost_usd)} each`} onClick={() => setDetail("receipts")} />
                <Stat label="OCR quality" value={`${pct(ratio(d.receipts.corrected, d.receipts.read))} corrected`} sub={`${num(d.receipts.corrected)} of ${num(d.receipts.read)} receipts edited · ${pct(ratio(d.receipts.lines_edited, d.receipts.lines))} of lines`} onClick={() => setDetail("receipts")} />
                <button type="button" className={`${s.stat} ${s.statBtn}`} onClick={() => go("Feedback")}>
                  <span className={s.statLabel}>Feedback<span className={s.statGo} aria-hidden="true"> ›</span></span>
                  {Number(d.feedback_new) === 0
                    ? <span className={`${s.chip} ${s.chipOk}`}>✓ All caught up</span>
                    : <span className={`${s.chip} ${s.chipWarn}`}>{num(d.feedback_new)} awaiting review</span>}
                  <span className={s.statSub}>{Number(d.feedback_new) === 0 ? "nothing new from the app or the site" : "new from the app or the site"}</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

/* ------------------------------------------------- Overview detail lists */
type ExpenseRow = { id: string; trip_id: string; trip_title: string; description: string; category: string; subcategory: string | null; amount_cents: number; currency: string; base_amount_cents: number; split_type: string; nights: number | null; paid_by: string | null; people: number; receipt_id: string | null; created_by: string | null; created_at: string; deleted_at: string | null };
function ExpensesList({ since, trip }: { since: string | null; trip?: string }) {
  const { data, error, loading } = useRpc<ExpenseRow[]>("admin_expenses", { p_since: since, p_limit: 500, p_offset: 0, p_trip: trip ?? null }, true);
  return (
    <Panel loading={loading} error={error} empty={!!data && data.length === 0}>
      <div className={s.scroll}>
        <table className={s.table}>
          <thead><tr><th>When</th>{trip ? null : <th>Dazzle</th>}<th>Expense</th><th>Category</th><th>Paid by</th><th>Split</th><th className={s.n}>People</th><th className={s.n}>Amount</th><th>Receipt</th><th>Logged by</th></tr></thead>
          <tbody>
            {(data ?? []).map((e) => (
              <tr key={e.id} className={e.deleted_at ? s.rowGone : undefined}>
                <td>{when(e.created_at)}</td>
                {trip ? null : <td className={s.wrap}>{e.trip_title}</td>}
                <td className={s.wrap}>{e.description}{e.deleted_at ? <span className={s.muted}> (deleted)</span> : null}</td>
                <td>{e.category}{e.subcategory ? <span className={s.muted}> · {e.subcategory}</span> : null}</td>
                <td>{e.paid_by ?? "—"}</td>
                <td>{SPLIT_LABEL[e.split_type] ?? e.split_type}{e.nights ? ` · ${e.nights} nights` : ""}</td>
                <td className={s.n}>{num(e.people)}</td>
                <td className={s.n}>{money(e.base_amount_cents)}{e.currency !== "USD" ? <span className={s.muted}> ({e.currency} {(e.amount_cents / 100).toFixed(2)})</span> : null}</td>
                <td>{e.receipt_id ? "scanned" : "—"}</td>
                <td>{e.created_by ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

type ReceiptRow = { id: string; trip_id: string; trip_title: string; expense_id: string | null; storage_path: string; status: string; model: string | null; merchant: string | null; receipt_date: string | null; currency: string | null; printed_total_cents: number | null; subtotal_cents: number | null; reconciled: boolean | null; error: string | null; attempts: number; cost_usd: number; lines: number; lines_edited: number; created_by: string | null; created_at: string };
function ReceiptsList({ since, trip }: { since: string | null; trip?: string }) {
  const { data, error, loading } = useRpc<ReceiptRow[]>("admin_receipts", { p_since: since, p_limit: 500, p_offset: 0, p_trip: trip ?? null }, true);
  const [view, setView] = useState<ReceiptRow | null>(null);
  return (
    <Panel loading={loading} error={error} empty={!!data && data.length === 0}>
      <div className={s.scroll}>
        <table className={s.table}>
          <thead><tr><th>When</th>{trip ? null : <th>Dazzle</th>}<th>Merchant</th><th>Status</th><th className={s.n}>Printed total</th><th className={s.n}>Lines</th><th className={s.n}>Edited</th><th>Model</th><th className={s.n}>Cost</th><th>Scanned by</th><th>Photo</th></tr></thead>
          <tbody>
            {(data ?? []).map((r) => (
              <tr key={r.id}>
                <td>{when(r.created_at)}</td>
                {trip ? null : <td className={s.wrap}>{r.trip_title}</td>}
                <td className={s.wrap}>{r.merchant ?? <span className={s.muted}>—</span>}{r.receipt_date ? <span className={s.muted}> · {r.receipt_date}</span> : null}</td>
                <td><span className={`${s.badge} ${s[`badge_${r.status}`] ?? ""}`}>{r.status}</span>{r.error ? <span className={s.muted}> {r.error}</span> : null}{r.expense_id ? <span className={s.muted}> · saved</span> : null}</td>
                <td className={s.n}>{r.printed_total_cents == null ? "—" : money(r.printed_total_cents)}</td>
                <td className={s.n}>{num(r.lines)}</td>
                <td className={s.n}>{num(r.lines_edited)}</td>
                <td><code>{r.model ?? "—"}</code></td>
                <td className={s.n}>{usd(r.cost_usd)}</td>
                <td>{r.created_by ?? "—"}</td>
                <td><Button variant="secondary" size="sm" onClick={() => setView(r)}>View</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {view ? <PhotoViewer title={`${view.merchant ?? "Receipt"} · ${view.trip_title}`} bucket="receipts" path={view.storage_path} onClose={() => setView(null)} /> : null}
    </Panel>
  );
}

type PaymentRow = { id: string; trip_id: string; trip_title: string; from_name: string | null; to_name: string | null; amount_cents: number; currency: string; status: string; platform: string | null; created_at: string; marked_at: string | null; confirmed_at: string | null };
const METHOD_LABEL = Object.fromEntries(METHODS.map((m) => [m.key, m.label]));
function PaymentsList({ since, trip }: { since: string | null; trip?: string }) {
  const { data, error, loading } = useRpc<PaymentRow[]>("admin_settlements", { p_since: since, p_limit: 500, p_offset: 0, p_trip: trip ?? null }, true);
  return (
    <Panel loading={loading} error={error} empty={!!data && data.length === 0}>
      <div className={s.scroll}>
        <table className={s.table}>
          <thead><tr><th>Created</th>{trip ? null : <th>Dazzle</th>}<th>From</th><th>To</th><th className={s.n}>Amount</th><th>Status</th><th>Method</th><th>Marked paid</th><th>Confirmed</th></tr></thead>
          <tbody>
            {(data ?? []).map((x) => (
              <tr key={x.id}>
                <td>{when(x.created_at)}</td>
                {trip ? null : <td className={s.wrap}>{x.trip_title}</td>}
                <td>{x.from_name ?? "—"}</td><td>{x.to_name ?? "—"}</td>
                <td className={s.n}>{money(x.amount_cents)}{x.currency !== "USD" ? <span className={s.muted}> {x.currency}</span> : null}</td>
                <td><span className={`${s.badge} ${s[`badge_${x.status}`] ?? ""}`}>{x.status.replace("_", " ")}</span></td>
                <td>{x.status === "pending" ? "—" : METHOD_LABEL[x.platform ?? "manual"] ?? x.platform}</td>
                <td>{when(x.marked_at)}</td><td>{when(x.confirmed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------- Users */
type UserRow = {
  id: string; kind: "user" | "invite"; display_name: string | null; email: string | null; phone: string | null;
  created_at: string; platforms: string[]; trips: number; expenses: number; last_active: string | null;
  invited_by: string | null; net_cents: number; owes_cents: number;
};
type Filter = "all" | "debt" | "no_payment" | "invited";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" }, { key: "debt", label: "Active debt" }, { key: "no_payment", label: "Missing payment info" }, { key: "invited", label: "Invited, not joined" },
];
type SortKey = "display_name" | "trips" | "expenses" | "created_at" | "last_active" | "net_cents";

function UsersTab({ active, since, initialFilter = "all" }: { active: boolean; since: string | null; initialFilter?: Filter }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "created_at", dir: -1 });
  const [open, setOpen] = useState<UserRow | null>(null);
  const { data, error, loading } = useRpc<UserRow[]>("admin_users", { p_search: query || null, p_limit: 200, p_offset: 0, p_since: since, p_filter: filter }, active);

  const rows = useMemo(() => {
    const list = [...(data ?? [])];
    const k = sort.key;
    list.sort((a, b) => {
      const av = a[k], bv = b[k];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const c = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return c * sort.dir;
    });
    return list;
  }, [data, sort]);

  function toggle(key: SortKey) {
    setSort((cur) => (cur.key === key ? { key, dir: cur.dir === 1 ? -1 : 1 } : { key, dir: key === "display_name" ? 1 : -1 }));
  }
  const Th = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => (
    <th className={right ? s.n : undefined} aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" className={s.thBtn} onClick={() => toggle(k)}>{label}{sort.key === k ? <span aria-hidden="true"> {sort.dir === 1 ? "↑" : "↓"}</span> : null}</button>
    </th>
  );

  return (
    <>
      <div className={s.pills} role="group" aria-label="Quick filters">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" className={`${s.pill} ${filter === f.key ? s.pillOn : ""}`} onClick={() => setFilter(f.key)} aria-pressed={filter === f.key}>{f.label}</button>
        ))}
      </div>
      <form className={s.toolbar} onSubmit={(e) => { e.preventDefault(); setQuery(search); }}>
        <input className={s.search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email or phone" aria-label="Search people" />
        <Button type="submit" variant="secondary" size="sm">Search</Button>
      </form>
      <Panel loading={loading} error={error} empty={!!data && data.length === 0}>
        <div className={s.scroll}>
          <table className={s.table}>
            <thead>
              <tr>
                <Th k="display_name" label="Name" /><th>Email</th><th>Phone</th><th>Pays with</th><th>Invited by</th>
                <Th k="trips" label="Dazzles" right /><Th k="expenses" label="Expenses" right /><Th k="net_cents" label="Position" right />
                <Th k="created_at" label="Joined" /><Th k="last_active" label="Last active" />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className={u.kind === "user" ? s.rowBtn : undefined} onClick={u.kind === "user" ? () => setOpen(u) : undefined} tabIndex={u.kind === "user" ? 0 : undefined}
                    onKeyDown={u.kind === "user" ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(u); } } : undefined}>
                  <td>{u.kind === "invite" ? <span className={s.muted}>invited</span> : u.display_name ?? <span className={s.muted}>no name yet</span>}</td>
                  <td className={s.wrap}>{u.email ?? "—"}</td>
                  <td>{u.phone ?? "—"}</td>
                  <td>{u.platforms.length ? u.platforms.join(", ") : <span className={s.muted}>none</span>}</td>
                  <td>{u.invited_by ?? "—"}</td>
                  <td className={s.n}>{num(u.trips)}</td>
                  <td className={s.n}>{num(u.expenses)}</td>
                  <td className={s.n}>{u.kind === "invite" ? "—" : u.owes_cents > 0 ? <span className={s.owes}>owes {money(u.owes_cents)}</span> : u.net_cents === 0 ? "even" : u.net_cents > 0 ? <span className={s.owed}>+{money(u.net_cents)}</span> : <span className={s.owes}>{money(u.net_cents)}</span>}</td>
                  <td>{when(u.created_at)}</td>
                  <td>{when(u.last_active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {open ? <UserDrawer row={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

type UserDetail = {
  user: { id: string; display_name: string | null; email: string | null; phone: string | null; created_at: string; deleted: boolean } | null;
  trips: { id: string; title: string; status: string; currency: string; role: string; done: boolean; joined_at: string; net_cents: number }[];
  owes_cents: number; owed_cents: number; stripes: number;
  outfit: { head: string | null; faceneck: string | null; body: string | null } | null;
  cosmetics_owned: number; platforms: { platform: string; handle: string }[];
  invited_by: string | null; invites_sent: number; invites_accepted: number; feedback: number;
};

function UserDrawer({ row, onClose }: { row: UserRow; onClose: () => void }) {
  const { data, error, loading } = useRpc<UserDetail>("admin_user_detail", { p_user: row.id }, true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const d = data;
  const net = (d?.trips ?? []).filter((t) => t.status === "open").reduce((a, t) => a + Number(t.net_cents), 0);
  const look = d?.outfit ? [d.outfit.head, d.outfit.faceneck, d.outfit.body].filter(Boolean).join(", ") : "";
  return (
    <div className={s.drawerWrap}>
      <button type="button" className={s.overlay} aria-label="Close" onClick={onClose} />
      <aside className={s.drawer} role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <div className={s.drawerHead}>
          <h2 id="drawer-title" className={s.drawerTitle}>{row.display_name ?? "No name yet"}</h2>
          <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
        </div>
        <Panel loading={loading} error={error}>
          {d ? (
            <div className={s.drawerBody}>
              <dl className={s.kv}>
                <dt>Email</dt><dd className={s.wrap}>{d.user?.email ?? "—"}</dd>
                <dt>Phone</dt><dd>{d.user?.phone ?? "—"}</dd>
                <dt>Joined</dt><dd>{when(d.user?.created_at)}</dd>
                <dt>Invited by</dt><dd>{d.invited_by ?? "—"}</dd>
                <dt>Pays with</dt><dd className={s.wrap}>{d.platforms.length ? d.platforms.map((p) => `${p.platform} ${p.handle}`).join(" · ") : "nothing yet"}</dd>
              </dl>
              <div className={s.stats}>
                <Stat label="Position" value={net === 0 ? "even" : money(net)} sub="paid minus share, open Dazzles" />
                <Stat label="Owes" value={money(d.owes_cents)} sub="pending payments to make" />
                <Stat label="Owed" value={money(d.owed_cents)} sub="pending payments to receive" />
                <Stat label="Stripes" value={num(d.stripes)} sub={`${num(d.cosmetics_owned)} wardrobe ${d.cosmetics_owned === 1 ? "item" : "items"}${look ? ` · wearing ${look}` : ""}`} />
                <Stat label="Invited" value={num(d.invites_sent)} sub={`${num(d.invites_accepted)} accepted`} />
                <Stat label="Feedback" value={num(d.feedback)} sub="sent from the app" />
              </div>
              <h3 className={s.sub}>Dazzles</h3>
              {d.trips.length === 0 ? <p className={s.muted}>Not in any Dazzle.</p> : (
                <div className={s.scroll}>
                  <table className={s.table}>
                    <thead><tr><th>Title</th><th>Status</th><th>Role</th><th>Done</th><th className={s.n}>Position</th><th>Joined</th></tr></thead>
                    <tbody>
                      {d.trips.map((t) => (
                        <tr key={t.id}>
                          <td className={s.wrap}>{t.title}</td>
                          <td><span className={`${s.badge} ${s[`badge_${t.status}`] ?? ""}`}>{t.status}</span></td>
                          <td>{t.role}</td>
                          <td>{t.done ? "yes" : "no"}</td>
                          <td className={s.n}>{Number(t.net_cents) === 0 ? "even" : <span className={Number(t.net_cents) > 0 ? s.owed : s.owes}>{Number(t.net_cents) > 0 ? "+" : ""}{money(t.net_cents)}</span>}</td>
                          <td>{when(t.joined_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : null}
        </Panel>
      </aside>
    </div>
  );
}

/* ----------------------------------------------------------------- Dazzles */
type TripDetail = {
  trip: { id: string; title: string; description: string | null; status: string; currency: string; start_date: string; end_date: string; created_at: string; settled_at: string | null; last_activity_at: string; owner: string | null; closeout_override_at: string | null } | null;
  members: { user_id: string; name: string; email: string | null; phone: string | null; role: string; done: boolean; joined_at: string; joined_via: string | null; removed_at: string | null; paid_cents: number; share_cents: number }[];
  expenses: { id: string; description: string; category: string; subcategory: string | null; amount_cents: number; currency: string; base_amount_cents: number; tip_cents: number; split_type: string; nights: number | null; receipt_id: string | null; created_at: string; deleted_at: string | null; created_by: string | null; payers: { name: string | null; cents: number }[]; shares: { name: string | null; cents: number }[] }[];
  settlements: { id: string; from_name: string | null; to_name: string | null; amount_cents: number; status: string; platform: string | null; created_at: string; marked_at: string | null; confirmed_at: string | null }[];
  receipts: { id: string; storage_path: string; status: string; model: string | null; merchant: string | null; receipt_date: string | null; printed_total_cents: number | null; currency: string | null; cost_usd: number; expense_id: string | null; created_by: string | null; created_at: string; items: { name: string; cents: number; kind: string; edited: boolean }[] }[];
  invites: { phone: string; status: string; invited_by: string | null; created_at: string }[];
  history: { action: string; actor: string | null; expense_id: string | null; at: string }[];
};

function DazzlesTab({ active, since }: { active: boolean; since: string | null }) {
  const trips = useRpc<TripRow[]>("admin_trips", { p_limit: 500, p_offset: 0, p_since: since }, active);
  const [open, setOpen] = useState<TripRow | null>(null);
  const [q, setQ] = useState("");
  const rows = (trips.data ?? []).filter((t) => !q.trim() || t.title.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <p className={s.muted}>Every Dazzle ever started, with its people, expenses, payments and receipts. Click one to open the whole record.</p>
      <div className={s.toolbar}><input className={s.search} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a Dazzle by title" aria-label="Find a Dazzle" /></div>
      <Panel loading={trips.loading} error={trips.error} empty={!!trips.data && trips.data.length === 0}>
        <div className={s.scroll}>
          <table className={s.table}>
            <thead><tr><th>Title</th><th>Status</th><th className={s.n}>People</th><th className={s.n}>Stripes</th><th className={s.n}>Expenses</th><th className={s.n}>Total</th><th className={s.n}>Settled</th><th>Started</th></tr></thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className={s.rowBtn} tabIndex={0} onClick={() => setOpen(t)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(t); } }}>
                  <td className={s.wrap}>{t.title}</td>
                  <td><span className={`${s.badge} ${s[`badge_${t.status}`] ?? ""}`}>{t.status}</span></td>
                  <td className={s.n}>{num(t.members)}</td>
                  <td className={s.n}>{num(t.done)} / {num(t.members)}</td>
                  <td className={s.n}>{num(t.expenses)}</td>
                  <td className={s.n}>{money(t.cents)}</td>
                  <td className={s.n}>{money(t.settled_cents)}</td>
                  <td>{when(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {open ? <TripDrawer row={open} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function TripDrawer({ row, onClose }: { row: TripRow; onClose: () => void }) {
  const { data, error, loading } = useRpc<TripDetail>("admin_trip_detail", { p_trip: row.id }, true);
  const [photo, setPhoto] = useState<TripDetail["receipts"][number] | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { if (photo) setPhoto(null); else onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, photo]);
  const d = data;
  const t = d?.trip;
  const named = (xs: { name: string | null; cents: number }[]) => xs.map((x) => `${x.name ?? "Someone"} ${money(x.cents)}`).join(", ");
  return (
    <div className={s.drawerWrap}>
      <button type="button" className={s.overlay} aria-label="Close" onClick={onClose} />
      <aside className={`${s.drawer} ${s.drawerWide}`} role="dialog" aria-modal="true" aria-labelledby="trip-title">
        <div className={s.drawerHead}><h2 id="trip-title" className={s.drawerTitle}>{row.title}</h2><Button variant="secondary" size="sm" onClick={onClose}>Close</Button></div>
        <Panel loading={loading} error={error}>
          {d && t ? (
            <div className={s.drawerBody}>
              <dl className={s.kv}>
                <dt>Status</dt><dd><span className={`${s.badge} ${s[`badge_${t.status}`] ?? ""}`}>{t.status}</span>{t.closeout_override_at ? <span className={s.muted}> · closed early by the owner</span> : null}</dd>
                <dt>Dates</dt><dd>{t.start_date} → {t.end_date}</dd>
                <dt>Owner</dt><dd>{t.owner ?? "—"}</dd>
                <dt>Currency</dt><dd>{t.currency}</dd>
                <dt>Started</dt><dd>{when(t.created_at)}</dd>
                <dt>Last activity</dt><dd>{when(t.last_activity_at)}</dd>
                <dt>Settled</dt><dd>{when(t.settled_at)}</dd>
                {t.description ? <><dt>Description</dt><dd className={s.wrap} style={{ textAlign: "left" }}>{t.description}</dd></> : null}
              </dl>
              <div className={s.stats}>
                <Stat label="Logged" value={money(d.expenses.filter((e) => !e.deleted_at).reduce((a, e) => a + Number(e.base_amount_cents), 0))} sub={`${num(d.expenses.filter((e) => !e.deleted_at).length)} expenses`} />
                <Stat label="Settled" value={money(d.settlements.filter((x) => x.status !== "pending").reduce((a, x) => a + Number(x.amount_cents), 0))} sub={`${num(d.settlements.filter((x) => x.status !== "pending").length)} of ${num(d.settlements.length)} payments`} />
                <Stat label="Receipts" value={num(d.receipts.length)} sub={`${usd(d.receipts.reduce((a, r) => a + Number(r.cost_usd), 0))} to read`} />
              </div>

              <h3 className={s.sub}>People</h3>
              <div className={s.scroll}><table className={s.table}>
                <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Done</th><th className={s.n}>Paid</th><th className={s.n}>Share</th><th className={s.n}>Position</th><th>Joined</th></tr></thead>
                <tbody>{d.members.map((m) => { const net = Number(m.paid_cents) - Number(m.share_cents); return (
                  <tr key={m.user_id} className={m.removed_at ? s.rowGone : undefined}>
                    <td>{m.name}{m.removed_at ? <span className={s.muted}> (removed)</span> : null}</td><td className={s.wrap}>{m.email ?? "—"}</td><td>{m.phone ?? "—"}</td><td>{m.role}</td><td>{m.done ? "yes" : "no"}</td>
                    <td className={s.n}>{money(m.paid_cents)}</td><td className={s.n}>{money(m.share_cents)}</td>
                    <td className={s.n}>{net === 0 ? "even" : <span className={net > 0 ? s.owed : s.owes}>{net > 0 ? "+" : ""}{money(net)}</span>}</td>
                    <td>{when(m.joined_at)}{m.joined_via ? <span className={s.muted}> · {m.joined_via}</span> : null}</td>
                  </tr>); })}</tbody>
              </table></div>

              <h3 className={s.sub}>Expenses</h3>
              {d.expenses.length === 0 ? <p className={s.muted}>None logged.</p> : (
                <div className={s.scroll}><table className={s.table}>
                  <thead><tr><th>When</th><th>Expense</th><th>Category</th><th>Paid by</th><th>Split</th><th>Shares</th><th className={s.n}>Amount</th><th>Receipt</th><th>Logged by</th></tr></thead>
                  <tbody>{d.expenses.map((e) => (
                    <tr key={e.id} className={e.deleted_at ? s.rowGone : undefined}>
                      <td>{when(e.created_at)}</td>
                      <td className={s.wrap}>{e.description}{e.deleted_at ? <span className={s.muted}> (deleted)</span> : null}</td>
                      <td>{e.category}{e.subcategory ? <span className={s.muted}> · {e.subcategory}</span> : null}</td>
                      <td className={s.wrap}>{named(e.payers) || "—"}</td>
                      <td>{SPLIT_LABEL[e.split_type] ?? e.split_type}{e.nights ? ` · ${e.nights} nights` : ""}</td>
                      <td className={s.wrap}>{named(e.shares) || "—"}</td>
                      <td className={s.n}>{money(e.base_amount_cents)}{Number(e.tip_cents) ? <span className={s.muted}> incl. {money(e.tip_cents)} tip</span> : null}{e.currency !== t.currency ? <span className={s.muted}> ({e.currency} {(e.amount_cents / 100).toFixed(2)})</span> : null}</td>
                      <td>{e.receipt_id ? "scanned" : "—"}</td>
                      <td>{e.created_by ?? "—"}</td>
                    </tr>))}</tbody>
                </table></div>
              )}

              <h3 className={s.sub}>Payments</h3>
              {d.settlements.length === 0 ? <p className={s.muted}>Not at close-out yet.</p> : (
                <div className={s.scroll}><table className={s.table}>
                  <thead><tr><th>From</th><th>To</th><th className={s.n}>Amount</th><th>Status</th><th>Method</th><th>Marked paid</th><th>Confirmed</th></tr></thead>
                  <tbody>{d.settlements.map((x) => (
                    <tr key={x.id}><td>{x.from_name ?? "—"}</td><td>{x.to_name ?? "—"}</td><td className={s.n}>{money(x.amount_cents)}</td>
                      <td><span className={`${s.badge} ${s[`badge_${x.status}`] ?? ""}`}>{x.status.replace("_", " ")}</span></td>
                      <td>{x.status === "pending" ? "—" : METHOD_LABEL[x.platform ?? "manual"] ?? x.platform}</td><td>{when(x.marked_at)}</td><td>{when(x.confirmed_at)}</td></tr>))}</tbody>
                </table></div>
              )}

              <h3 className={s.sub}>Receipts</h3>
              {d.receipts.length === 0 ? <p className={s.muted}>No receipts scanned.</p> : (
                <div className={s.scroll}><table className={s.table}>
                  <thead><tr><th>When</th><th>Merchant</th><th>Status</th><th className={s.n}>Printed total</th><th className={s.n}>Lines</th><th>Model</th><th className={s.n}>Cost</th><th>Scanned by</th><th>Photo</th></tr></thead>
                  <tbody>{d.receipts.map((r) => (
                    <tr key={r.id}><td>{when(r.created_at)}</td><td className={s.wrap}>{r.merchant ?? "—"}{r.receipt_date ? <span className={s.muted}> · {r.receipt_date}</span> : null}</td>
                      <td><span className={`${s.badge} ${s[`badge_${r.status}`] ?? ""}`}>{r.status}</span>{r.expense_id ? <span className={s.muted}> · saved</span> : null}</td>
                      <td className={s.n}>{r.printed_total_cents == null ? "—" : money(r.printed_total_cents)}</td><td className={s.n}>{num(r.items.length)}{r.items.some((i) => i.edited) ? <span className={s.muted}> · {num(r.items.filter((i) => i.edited).length)} edited</span> : null}</td>
                      <td><code>{r.model ?? "—"}</code></td><td className={s.n}>{usd(r.cost_usd)}</td><td>{r.created_by ?? "—"}</td>
                      <td><Button variant="secondary" size="sm" onClick={() => setPhoto(r)}>View</Button></td></tr>))}</tbody>
                </table></div>
              )}

              {d.invites.length ? (<>
                <h3 className={s.sub}>Invites</h3>
                <div className={s.scroll}><table className={s.table}>
                  <thead><tr><th>Phone</th><th>Status</th><th>Invited by</th><th>When</th></tr></thead>
                  <tbody>{d.invites.map((i, k) => <tr key={`${i.phone}-${k}`}><td>{i.phone}</td><td><span className={`${s.badge} ${s[`badge_${i.status}`] ?? ""}`}>{i.status}</span></td><td>{i.invited_by ?? "—"}</td><td>{when(i.created_at)}</td></tr>)}</tbody>
                </table></div>
              </>) : null}

              {d.history.length ? (<>
                <h3 className={s.sub}>History</h3>
                <div className={s.scroll}><table className={s.table}>
                  <thead><tr><th>When</th><th>What</th><th>Who</th></tr></thead>
                  <tbody>{d.history.map((h, k) => <tr key={k}><td>{when(h.at)}</td><td>{h.action.replace(".", " ")}</td><td>{h.actor ?? "—"}</td></tr>)}</tbody>
                </table></div>
              </>) : null}
            </div>
          ) : null}
        </Panel>
      </aside>
      {photo ? (
        <PhotoViewer title={`${photo.merchant ?? "Receipt"} · ${row.title}`} bucket="receipts" path={photo.storage_path} onClose={() => setPhoto(null)}>
          {photo.items.length ? (
            <table className={s.table}><thead><tr><th>Line</th><th className={s.n}>Amount</th></tr></thead>
              <tbody>{photo.items.map((i, k) => <tr key={k}><td className={s.wrap}>{i.name}{i.edited ? <span className={s.muted}> (edited)</span> : null}</td><td className={s.n}>{money(i.cents)}</td></tr>)}</tbody></table>
          ) : null}
        </PhotoViewer>
      ) : null}
    </div>
  );
}

/* ----------------------------------------------------------- Welcome wizard */
type FunnelRow = { step: string; step_order: number; people: number };
const STEP_LABELS: Record<string, string> = {
  onboarding_landing_seen: "Opened the app",
  onboarding_signup_started: "Tapped Create an account",
  onboarding_phone_entered: "Entered a phone number",
  onboarding_code_sent: "Code sent",
  onboarding_code_verified: "Code verified",
  onboarding_profile_saved: "Saved their name",
  onboarding_payment_added: "Added a payment method",
  onboarding_finished: "Reached the app",
};

function WizardTab({ active }: { active: boolean }) {
  const { data, error, loading } = useRpc<FunnelRow[]>("admin_funnel", {}, active);
  const rows = data ?? [];
  const first = rows[0]?.people ?? 0;
  const noData = rows.every((r) => Number(r.people) === 0);

  return (
    <Panel loading={loading} error={error}>
      {noData ? (
        <div className={s.notice}>
          <strong>No onboarding events yet.</strong>
          <p>The funnel is wired on the database side, but the app isn&apos;t sending these events yet — that&apos;s the next piece of work. Once a build ships with the instrumentation, the last 30 days appear here.</p>
        </div>
      ) : null}
      <div className={s.funnel}>
        {rows.map((r, i) => {
          const people = Number(r.people);
          const prev = i === 0 ? people : Number(rows[i - 1]?.people ?? 0);
          const width = first > 0 ? Math.max(2, (people / first) * 100) : 2;
          const drop = prev > 0 ? 1 - people / prev : 0;
          return (
            <div key={r.step} className={s.funnelRow}>
              <span className={s.funnelLabel}>{STEP_LABELS[r.step] ?? r.step}</span>
              <div className={s.funnelTrack}><div className={s.funnelBar} style={{ width: `${width}%` }} /></div>
              <span className={s.funnelNum}>{num(people)}</span>
              <span className={s.funnelDrop}>{i === 0 || prev === 0 ? "" : drop > 0 ? `−${(drop * 100).toFixed(0)}%` : "—"}</span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ Models */
type ModelRow = { model: string; receipts: number; reconciled: number; failed: number; cost_usd: number; lines_read: number; lines_edited: number; correction_rate: number | null };
// Anthropic models the receipt worker can be pointed at. Other providers need the
// worker to speak their API first (see the PR notes); until then a name from
// another vendor would simply fail every read.
const MODELS = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5", "claude-opus-5", "claude-sonnet-5"];
const CUSTOM = "__custom__";

function ModelsTab({ active, since }: { active: boolean; since: string | null }) {
  const models = useRpc<ModelRow[]>("admin_models", { p_since: since }, active);
  const settings = useRpc<Record<string, string> | null>("admin_settings", {}, active);
  const [saving, setSaving] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [custom, setCustom] = useState<Record<string, boolean>>({});

  const current = { ...(settings.data ?? {}), ...draft };
  const seen = (models.data ?? []).map((m) => m.model).filter((m) => m && m !== "—");
  const options = Array.from(new Set([...MODELS, ...seen, current.receipt_model, current.receipt_retry_model].filter(Boolean) as string[]));

  async function save(key: string) {
    setSaving(key);
    const { error } = await supabaseBrowser().rpc("admin_set_setting", { p_key: key, p_value: current[key] ?? "" });
    setSaving(null);
    if (!error) { settings.reload(); setCustom((c) => ({ ...c, [key]: false })); }
  }

  const FIELDS: { key: string; label: string; hint: string; kind: "model" | "number" | "bool" }[] = [
    { key: "receipt_model", label: "First read", hint: "The model every receipt goes to first.", kind: "model" },
    { key: "receipt_retry_model", label: "Retry", hint: "Used once when the first read doesn't reconcile.", kind: "model" },
    { key: "receipt_daily_limit", label: "Scans per person per day", hint: "", kind: "number" },
    { key: "receipt_ai_enabled", label: "AI reading enabled", hint: "Off stops all scanning; photos still save for manual entry.", kind: "bool" },
  ];

  return (
    <>
      <Panel loading={settings.loading} error={settings.error}>
        <div className={s.settings}>
          {FIELDS.map((f) => (
            <div key={f.key} className={s.setting}>
              <label className={s.settingLabel} htmlFor={`set-${f.key}`}>{f.label}</label>
              <div className={s.settingRow}>
                {f.kind === "model" && !custom[f.key] ? (
                  <select id={`set-${f.key}`} className={s.select} value={current[f.key] ?? ""}
                    onChange={(e) => { if (e.target.value === CUSTOM) setCustom((c) => ({ ...c, [f.key]: true })); else setDraft((d) => ({ ...d, [f.key]: e.target.value })); }}>
                    {options.map((m) => <option key={m} value={m}>{m}</option>)}
                    <option value={CUSTOM}>Other model name…</option>
                  </select>
                ) : f.kind === "bool" ? (
                  <select id={`set-${f.key}`} className={s.select} value={current[f.key] === "false" ? "false" : "true"} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}>
                    <option value="true">On</option><option value="false">Off</option>
                  </select>
                ) : (
                  <input id={`set-${f.key}`} className={s.input} value={current[f.key] ?? ""} type={f.kind === "number" ? "number" : "text"} min={f.kind === "number" ? 0 : undefined}
                    placeholder={f.kind === "model" ? "exact model id" : undefined}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} />
                )}
                <Button variant="secondary" size="sm" onClick={() => save(f.key)} disabled={saving === f.key}>
                  {saving === f.key ? "Saving…" : "Save"}
                </Button>
              </div>
              {f.hint ? <p className={s.hint}>{f.hint}</p> : null}
            </div>
          ))}
        </div>
        <p className={s.hint}>
          Saved straight away — the receipt worker reads these on its next run, so there&apos;s no deploy.
          Only Anthropic models work today; a model name has to be one the Anthropic API accepts.
        </p>
      </Panel>

      <h3 className={s.sub}>How each model has done</h3>
      <Panel loading={models.loading} error={models.error} empty={!!models.data && models.data.length === 0}>
        <div className={s.scroll}>
          <table className={s.table}>
            <thead><tr><th>Model</th><th className={s.n}>Receipts</th><th className={s.n}>Reconciled</th><th className={s.n}>Failed</th><th className={s.n}>Lines read</th><th className={s.n}>Corrected</th><th className={s.n}>Cost</th><th className={s.n}>Per receipt</th></tr></thead>
            <tbody>
              {(models.data ?? []).map((m) => (
                <tr key={m.model}>
                  <td><code>{m.model}</code></td>
                  <td className={s.n}>{num(m.receipts)}</td>
                  <td className={s.n}>{num(m.reconciled)}</td>
                  <td className={s.n}>{num(m.failed)}</td>
                  <td className={s.n}>{num(m.lines_read)}</td>
                  <td className={s.n}>{pct(m.correction_rate)}</td>
                  <td className={s.n}>{usd(m.cost_usd)}</td>
                  <td className={s.n}>{Number(m.receipts) ? usd(Number(m.cost_usd) / Number(m.receipts)) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/* ------------------------------------------------------------ Integrations */
type Integrations = {
  sms: { invites_sent: number; last_invite: string | null };
  push: { devices: number; notifications: number; last_notification: string | null };
  ai: { receipts: number; last_receipt: string | null; settings: Record<string, string> | null };
  events: { total: number; last: string | null };
};

function IntegrationsTab({ active }: { active: boolean }) {
  const { data, error, loading } = useRpc<Integrations>("admin_integrations", {}, active);
  return (
    <Panel loading={loading} error={error}>
      {data ? (
        <div className={s.cards}>
          <div className={s.card}>
            <h3 className={s.cardTitle}>Twilio — invite texts</h3>
            <dl className={s.kv}><dt>Invites created</dt><dd>{num(data.sms.invites_sent)}</dd><dt>Most recent</dt><dd>{when(data.sms.last_invite)}</dd></dl>
            <p className={s.hint}>Toll-free verification status lives in the Twilio console; it isn&apos;t exposed to the database.</p>
          </div>
          <div className={s.card}>
            <h3 className={s.cardTitle}>Expo push</h3>
            <dl className={s.kv}><dt>Registered devices</dt><dd>{num(data.push.devices)}</dd><dt>Notifications sent</dt><dd>{num(data.push.notifications)}</dd><dt>Most recent</dt><dd>{when(data.push.last_notification)}</dd></dl>
            <p className={s.hint}>Android push needs FCM credentials on EAS before any of this works there.</p>
          </div>
          <div className={s.card}>
            <h3 className={s.cardTitle}>Anthropic — receipt reading</h3>
            <dl className={s.kv}>
              <dt>Receipts</dt><dd>{num(data.ai.receipts)}</dd>
              <dt>Most recent</dt><dd>{when(data.ai.last_receipt)}</dd>
              <dt>Enabled</dt><dd>{data.ai.settings?.receipt_ai_enabled ?? "—"}</dd>
            </dl>
          </div>
          <div className={s.card}>
            <h3 className={s.cardTitle}>Analytics</h3>
            <dl className={s.kv}><dt>Events recorded</dt><dd>{num(data.events.total)}</dd><dt>Most recent</dt><dd>{when(data.events.last)}</dd></dl>
            <p className={s.hint}>First-party only. Nothing leaves Supabase.</p>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

/* ---------------------------------------------------------------- Feedback */
type FeedbackRow = { id: string; email: string | null; title: string; body: string; source: string; status: string; platform: string | null; app_version: string | null; created_at: string };
const STATUSES = ["new", "reading", "done", "wontfix"] as const;

function FeedbackTab({ active }: { active: boolean }) {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error: e } = await supabaseBrowser().from("feedback").select("*").order("created_at", { ascending: false }).limit(200);
    setLoading(false);
    if (e) { setError(e.message); return; }
    setRows(data as FeedbackRow[]);
  }, []);
  useEffect(() => { if (active) load(); }, [active, load]);

  async function setStatus(id: string, status: string) {
    await supabaseBrowser().rpc("admin_set_feedback_status", { p_id: id, p_status: status });
    load();
  }

  return (
    <Panel loading={loading} error={error} empty={!!rows && rows.length === 0}>
      <ul className={s.feed}>
        {(rows ?? []).map((f) => (
          <li key={f.id} className={s.feedItem}>
            <button className={s.feedHead} onClick={() => setOpen(open === f.id ? null : f.id)} aria-expanded={open === f.id}>
              <span className={`${s.badge} ${s[`badge_${f.status}`] ?? ""}`}>{f.status}</span>
              <span className={s.feedTitle}>{f.title}</span>
              <span className={s.feedMeta}>{f.source} · {when(f.created_at)}</span>
            </button>
            {open === f.id ? (
              <div className={s.feedBody}>
                <p className={s.feedText}>{f.body}</p>
                <dl className={s.kv}>
                  <dt>From</dt><dd className={s.wrap}>{f.email ?? "—"}</dd>
                  <dt>Where</dt><dd>{[f.platform, f.app_version].filter(Boolean).join(" ") || "—"}</dd>
                </dl>
                <div className={s.feedActions}>
                  {STATUSES.filter((x) => x !== f.status).map((x) => (
                    <Button key={x} variant="secondary" size="sm" onClick={() => setStatus(f.id, x)}>Mark {x}</Button>
                  ))}
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* -------------------------------------------------------------------- Data */
type CatRow = { category: string; subcategory: string; expenses: number; cents: number; share: number };
type SplitRow = { split_type: string; expenses: number; cents: number; from_receipt: number };

function DataTab({ active, since }: { active: boolean; since: string | null }) {
  const trips = useRpc<TripRow[]>("admin_trips", { p_limit: 200, p_offset: 0, p_since: since }, active);
  const cats = useRpc<CatRow[]>("admin_categories", { p_since: since }, active);
  const splits = useRpc<SplitRow[]>("admin_split_types", { p_since: since }, active);
  const overview = useRpc<Overview>("admin_overview", { p_since: since }, active);
  const o = overview.data;
  const splitTotal = (splits.data ?? []).reduce((a, r) => a + Number(r.expenses), 0);
  const scanned = (splits.data ?? []).reduce((a, r) => a + Number(r.from_receipt), 0);

  return (
    <>
      <h3 className={s.sub}>Group dynamics</h3>
      <Panel loading={overview.loading} error={overview.error}>
        {o ? (
          <div className={s.stats}>
            <Stat label="People per Dazzle" value={o.trips.avg_members == null ? "—" : Number(o.trips.avg_members).toFixed(1)} sub="average active members" />
            <Stat label="Expenses per active day" value={o.trips.expenses_per_day == null ? "—" : Number(o.trips.expenses_per_day).toFixed(2)} sub="first to last expense, per Dazzle" />
            <Stat label="From receipts" value={pct(ratio(o.expenses.from_receipt, o.expenses.total))} sub={`${num(o.expenses.from_receipt)} scanned · ${num(o.expenses.manual)} entered by hand`} />
            <Stat label="Time to settle" value={o.settlements.avg_days_to_settle == null ? "—" : `${Number(o.settlements.avg_days_to_settle).toFixed(1)} days`} sub="last expense → settled" />
          </div>
        ) : null}
      </Panel>

      <h3 className={s.sub}>Dazzles</h3>
      <Panel loading={trips.loading} error={trips.error} empty={!!trips.data && trips.data.length === 0}>
        <div className={s.scroll}>
          <table className={s.table}>
            <thead><tr><th>Title</th><th>Status</th><th className={s.n}>People</th><th className={s.n}>Stripes</th><th className={s.n}>Expenses</th><th className={s.n}>Total</th><th className={s.n}>Settled</th><th>Started</th></tr></thead>
            <tbody>
              {(trips.data ?? []).map((t) => (
                <tr key={t.id}>
                  <td className={s.wrap}>{t.title}</td>
                  <td><span className={`${s.badge} ${s[`badge_${t.status}`] ?? ""}`}>{t.status}</span></td>
                  <td className={s.n}>{num(t.members)}</td>
                  <td className={s.n}>{num(t.done)} / {num(t.members)}</td>
                  <td className={s.n}>{num(t.expenses)}</td>
                  <td className={s.n}>{money(t.cents)}</td>
                  <td className={s.n}>{money(t.settled_cents)}</td>
                  <td>{when(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <h3 className={s.sub}>Where the money goes</h3>
      <Panel loading={cats.loading} error={cats.error} empty={!!cats.data && cats.data.length === 0}>
        <Bars rows={(cats.data ?? []).map((c) => ({ key: `${c.category}/${c.subcategory}`, label: <>{c.category}<span className={s.muted}> · {c.subcategory}</span></>, value: Number(c.cents), num: money(c.cents), pct: pct(c.share) }))} />
      </Panel>

      <h3 className={s.sub}>How people split</h3>
      <Panel loading={splits.loading} error={splits.error} empty={!!splits.data && splits.data.length === 0}>
        <div className={s.scroll}>
          <table className={s.table}>
            <thead><tr><th>Split</th><th className={s.n}>Expenses</th><th className={s.n}>Share</th><th className={s.n}>From receipts</th><th className={s.n}>Total</th></tr></thead>
            <tbody>
              {(splits.data ?? []).map((r) => (
                <tr key={r.split_type}>
                  <td>{SPLIT_LABEL[r.split_type] ?? r.split_type}</td>
                  <td className={s.n}>{num(r.expenses)}</td>
                  <td className={s.n}>{splitTotal ? pct(Number(r.expenses) / splitTotal) : "—"}</td>
                  <td className={s.n}>{num(r.from_receipt)}</td>
                  <td className={s.n}>{money(r.cents)}</td>
                </tr>
              ))}
              <tr><td className={s.muted}>Scanned receipts, any split</td><td className={s.n}>{num(scanned)}</td><td className={s.n}>{splitTotal ? pct(scanned / splitTotal) : "—"}</td><td className={s.n}>—</td><td className={s.n}>—</td></tr>
            </tbody>
          </table>
        </div>
        <p className={s.hint}>An itemized receipt is saved as an exact split of its lines, so it shows under Exact amounts and in the From receipts column.</p>
      </Panel>
    </>
  );
}

/* ------------------------------------------------------------------- Shell */
function SignIn() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Google only: the account's 2-step verification is the second factor, and is_admin()
  // in the database refuses a session that wasn't opened through a provider.
  async function google() {
    setBusy(true); setError(null);
    const { error: err } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/admin`, queryParams: { prompt: "select_account" } },
    });
    if (err) { setBusy(false); setError(err.message); }
  }

  return (
    <div className={s.signin}>
      <h1 className={s.signinTitle}>Admin</h1>
      <p className={s.muted}>Sign in with the Google account on the admin list.</p>
      {error ? <p className={s.error} role="alert">{error}</p> : null}
      <Button type="button" variant="primary" disabled={busy} onClick={google}>{busy ? "Opening Google…" : "Continue with Google"}</Button>
    </div>
  );
}

export function Portal() {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [range, setRange] = useState<Range>("all");
  const since = sinceOf(range);
  const [usersFilter, setUsersFilter] = useState<Filter>("all");
  const [usersKey, setUsersKey] = useState(0);
  const go = (t: Tab, filter?: Filter) => { if (filter) { setUsersFilter(filter); setUsersKey((k) => k + 1); } setTab(t); };

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getSession().then(({ data }) => { setSession(data.session); setChecked(true); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, next) => setSession(next));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setIsAdmin(null); return; }
    supabaseBrowser().rpc("is_admin").then(({ data }) => setIsAdmin(!!data));
  }, [session]);

  if (!checked) return <p className={s.muted}>Loading…</p>;
  if (!session) return <SignIn />;

  if (isAdmin === false) {
    return (
      <div className={s.signin}>
        <h1 className={s.signinTitle}>Not an admin</h1>
        <p className={s.muted}>That account is signed in but isn&apos;t on the admin list, or it signed in without Google.</p>
        <Button variant="secondary" onClick={() => supabaseBrowser().auth.signOut()}>Sign out</Button>
      </div>
    );
  }
  if (isAdmin === null) return <p className={s.muted}>Checking…</p>;

  return (
    <div className={s.portal}>
      <header className={s.header}>
        <h1 className={s.h1}>Admin</h1>
        <div className={s.headerRight}>
          <div className={s.range} role="group" aria-label="Date range">
            {RANGES.map((r) => (
              <button key={r.key} type="button" className={`${s.pill} ${range === r.key ? s.pillOn : ""}`} onClick={() => setRange(r.key)} aria-pressed={range === r.key}>{r.label}</button>
            ))}
          </div>
          <span className={s.muted}>{session.user.email}</span>
          <Button variant="secondary" size="sm" onClick={() => supabaseBrowser().auth.signOut()}>Sign out</Button>
        </div>
      </header>

      <nav className={s.tabs} aria-label="Sections">
        {TABS.map((t) => (
          <button key={t} className={`${s.tab} ${tab === t ? s.tabOn : ""}`} onClick={() => setTab(t)} aria-current={tab === t ? "page" : undefined}>{t}</button>
        ))}
      </nav>

      <section className={s.panel}>
        {tab === "Overview" ? <OverviewTab active since={since} go={go} /> : null}
        {tab === "Users" ? <UsersTab key={usersKey} active since={since} initialFilter={usersFilter} /> : null}
        {tab === "Dazzles" ? <DazzlesTab active since={since} /> : null}
        {tab === "Welcome wizard" ? <WizardTab active /> : null}
        {tab === "Models" ? <ModelsTab active since={since} /> : null}
        {tab === "Integrations" ? <IntegrationsTab active /> : null}
        {tab === "Feedback" ? <FeedbackTab active /> : null}
        {tab === "Data" ? <DataTab active since={since} /> : null}
      </section>
    </div>
  );
}
