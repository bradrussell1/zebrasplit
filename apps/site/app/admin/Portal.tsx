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
const TABS = ["Overview", "Users", "Welcome wizard", "Models", "Integrations", "Feedback", "Data"] as const;
type Tab = (typeof TABS)[number];
type Range = "7d" | "30d" | "all";
const RANGES: { key: Range; label: string }[] = [{ key: "7d", label: "Last 7D" }, { key: "30d", label: "Last 30D" }, { key: "all", label: "All-time" }];
function sinceOf(r: Range): string | null {
  if (r === "all") return null;
  return new Date(Date.now() - (r === "7d" ? 7 : 30) * 86400 * 1000).toISOString();
}

const money = (cents: number | null | undefined) =>
  `$${(((cents ?? 0) as number) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyShort = (cents: number | null | undefined) => {
  const d = Math.abs((cents ?? 0) as number) / 100;
  return `${(cents ?? 0) < 0 ? "−" : ""}$${d >= 10000 ? `${(d / 1000).toFixed(1)}k` : d.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={s.stat}>
      <span className={s.statLabel}>{label}</span>
      <span className={s.statValue}>{value}</span>
      {sub ? <span className={s.statSub}>{sub}</span> : null}
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
const RAIL_LABEL: Record<string, string> = { venmo: "Venmo", cashapp: "Cash App", paypal: "PayPal", manual: "Cash / by hand" };

function OverviewTab({ active, since }: { active: boolean; since: string | null }) {
  const { data, error, loading } = useRpc<Overview>("admin_overview", { p_since: since }, active);
  const d = data;
  const outstanding = d ? Number(d.expenses.cents) - Number(d.settlements.paid_cents) : 0;
  const railTotal = d ? d.settlements.rails.reduce((a, r) => a + Number(r.payments), 0) : 0;
  return (
    <Panel loading={loading} error={error}>
      {d ? (
        <>
          <div className={s.stats}>
            <Stat label="People" value={num(d.users.total)} sub={`${num(d.users.new_7d)} in the last 7 days`} />
            <Stat label="Can be paid" value={num(d.users.with_payment)} sub="have a payment handle" />
            <Stat label="Dazzles" value={num(d.trips.total)} sub={`${num(d.trips.open)} open · ${num(d.trips.settled)} settled · ${num(d.trips.archived)} archived`} />
            <Stat label="Expenses" value={num(d.expenses.total)} sub={`${num(d.expenses.from_receipt)} from receipts · ${num(d.expenses.manual)} by hand`} />
            <Stat label="Logged" value={moneyShort(d.expenses.cents)} sub="across every Dazzle" />
            <Stat label="Settled" value={moneyShort(d.settlements.paid_cents)} sub={`${num(d.settlements.paid)} of ${num(d.settlements.total)} payments marked`} />
            <Stat label="Outstanding" value={moneyShort(outstanding)} sub={`${moneyShort(d.settlements.pending_lt7_cents)} pending < 7 days · ${moneyShort(d.settlements.pending_gt30_cents)} aging > 30 days`} />
            <Stat label="Time to settle" value={d.settlements.avg_days_to_settle == null ? "—" : `${Number(d.settlements.avg_days_to_settle).toFixed(1)} days`} sub={d.settlements.settled_trips ? `avg. from the last expense, ${num(d.settlements.settled_trips)} settled` : "no Dazzle has settled yet"} />
            <Stat label="Receipts read" value={num(d.receipts.total)} sub={`${num(d.receipts.failed)} failed · ${usd(d.receipts.cost_usd)} spent · ${usd(d.receipts.avg_cost_usd)} each`} />
            <Stat label="Corrected after reading" value={pct(ratio(d.receipts.corrected, d.receipts.read))} sub={`${num(d.receipts.corrected)} of ${num(d.receipts.read)} receipts · ${pct(ratio(d.receipts.lines_edited, d.receipts.lines))} of lines`} />
            <Stat label="Group size" value={d.trips.avg_members == null ? "—" : Number(d.trips.avg_members).toFixed(1)} sub={d.trips.expenses_per_day == null ? "people per Dazzle" : `people per Dazzle · ${Number(d.trips.expenses_per_day).toFixed(2)} expenses per active day`} />
            <Stat label="Invites" value={num(d.invites.total)} sub={`${num(d.invites.accepted)} accepted · ${num(d.invites.pending)} waiting`} />
            <Stat label="New feedback" value={num(d.feedback_new)} sub="waiting to be read" />
          </div>
          <h3 className={s.sub}>Which rail carries the payments</h3>
          {railTotal === 0 ? <p className={s.muted}>No payment has been marked paid yet.</p> : (
            <Bars rows={d.settlements.rails.map((r) => ({ key: r.rail, label: RAIL_LABEL[r.rail] ?? r.rail, value: Number(r.payments), num: `${num(r.payments)} · ${money(r.cents)}`, pct: pct(Number(r.payments) / railTotal) }))} top={railTotal} />
          )}
        </>
      ) : null}
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

function UsersTab({ active, since }: { active: boolean; since: string | null }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
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
                <Stat label="Position" value={net === 0 ? "even" : moneyShort(net)} sub="paid minus share, open Dazzles" />
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
type TripRow = { id: string; title: string; status: string; base_currency: string; created_at: string; members: number; done: number; expenses: number; cents: number; settled_cents: number };
type CatRow = { category: string; subcategory: string; expenses: number; cents: number; share: number };
type SplitRow = { split_type: string; expenses: number; cents: number; from_receipt: number };
const SPLIT_LABEL: Record<string, string> = { equal: "Equally", exact: "Exact amounts", percent: "By percent", shares: "By shares", nights: "By nights", itemized: "Itemized receipt" };

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
        {tab === "Overview" ? <OverviewTab active since={since} /> : null}
        {tab === "Users" ? <UsersTab active since={since} /> : null}
        {tab === "Welcome wizard" ? <WizardTab active /> : null}
        {tab === "Models" ? <ModelsTab active since={since} /> : null}
        {tab === "Integrations" ? <IntegrationsTab active /> : null}
        {tab === "Feedback" ? <FeedbackTab active /> : null}
        {tab === "Data" ? <DataTab active since={since} /> : null}
      </section>
    </div>
  );
}
