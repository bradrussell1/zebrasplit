"use client";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Button } from "@/components/ui/Button";
import { supabaseBrowser } from "@/lib/supabase";
import s from "./admin.module.css";

/**
 * The admin portal.
 *
 * Signing in is ordinary Supabase Auth; being an admin is a row in
 * private.admins. Every read below goes through a security-definer function
 * that checks public.is_admin() first, so this page has no privileges of its
 * own — a non-admin who signs in sees an empty portal, not a leak.
 */
const TABS = ["Overview", "Users", "Welcome wizard", "Models", "Integrations", "Feedback", "Data"] as const;
type Tab = (typeof TABS)[number];

const money = (cents: number | null | undefined) =>
  `$${(((cents ?? 0) as number) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const usd = (n: number | null | undefined) => `$${Number(n ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
const num = (n: number | null | undefined) => Number(n ?? 0).toLocaleString("en-US");
const pct = (n: number | null | undefined) => (n == null ? "—" : `${(Number(n) * 100).toFixed(1)}%`);
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

/* ---------------------------------------------------------------- Overview */
type Overview = {
  users: { total: number; new_7d: number; with_payment: number };
  trips: { total: number; open: number; settled: number; archived: number; new_7d: number };
  expenses: { total: number; cents: number; new_7d: number };
  settlements: { total: number; cents: number; paid: number };
  receipts: { total: number; cost_usd: number; failed: number };
  feedback_new: number;
  invites: { total: number; accepted: number };
};

function OverviewTab({ active }: { active: boolean }) {
  const { data, error, loading } = useRpc<Overview>("admin_overview", {}, active);
  return (
    <Panel loading={loading} error={error}>
      {data ? (
        <div className={s.stats}>
          <Stat label="People" value={num(data.users.total)} sub={`${num(data.users.new_7d)} in the last 7 days`} />
          <Stat label="Can be paid" value={num(data.users.with_payment)} sub="have a payment handle" />
          <Stat label="Dazzles" value={num(data.trips.total)} sub={`${num(data.trips.open)} open · ${num(data.trips.settled)} settled`} />
          <Stat label="Expenses" value={num(data.expenses.total)} sub={`${num(data.expenses.new_7d)} in the last 7 days`} />
          <Stat label="Logged" value={money(data.expenses.cents)} sub="across every Dazzle" />
          <Stat label="Settled" value={money(data.settlements.cents)} sub={`${num(data.settlements.paid)} of ${num(data.settlements.total)} payments marked`} />
          <Stat label="Receipts read" value={num(data.receipts.total)} sub={`${num(data.receipts.failed)} failed · ${usd(data.receipts.cost_usd)} spent`} />
          <Stat label="Invites" value={num(data.invites.total)} sub={`${num(data.invites.accepted)} accepted`} />
          <Stat label="New feedback" value={num(data.feedback_new)} sub="waiting to be read" />
        </div>
      ) : null}
    </Panel>
  );
}

/* ------------------------------------------------------------------- Users */
type UserRow = {
  id: string; display_name: string | null; email: string | null; phone: string | null;
  created_at: string; platforms: string[]; trips: number; expenses: number; last_active: string | null;
};

function UsersTab({ active }: { active: boolean }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const { data, error, loading } = useRpc<UserRow[]>("admin_users", { p_search: query || null, p_limit: 200, p_offset: 0 }, active);

  return (
    <>
      <form className={s.toolbar} onSubmit={(e) => { e.preventDefault(); setQuery(search); }}>
        <input className={s.search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email or phone" aria-label="Search people" />
        <Button type="submit" variant="secondary" size="sm">Search</Button>
      </form>
      <Panel loading={loading} error={error} empty={!!data && data.length === 0}>
        <div className={s.scroll}>
          <table className={s.table}>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Pays with</th><th className={s.n}>Dazzles</th><th className={s.n}>Expenses</th><th>Joined</th><th>Last active</th></tr></thead>
            <tbody>
              {(data ?? []).map((u) => (
                <tr key={u.id}>
                  <td>{u.display_name ?? <span className={s.muted}>no name yet</span>}</td>
                  <td className={s.wrap}>{u.email ?? "—"}</td>
                  <td>{u.phone ?? "—"}</td>
                  <td>{u.platforms.length ? u.platforms.join(", ") : <span className={s.muted}>none</span>}</td>
                  <td className={s.n}>{num(u.trips)}</td>
                  <td className={s.n}>{num(u.expenses)}</td>
                  <td>{when(u.created_at)}</td>
                  <td>{when(u.last_active)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
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

function ModelsTab({ active }: { active: boolean }) {
  const models = useRpc<ModelRow[]>("admin_models", {}, active);
  const settings = useRpc<Record<string, string> | null>("admin_settings", {}, active);
  const [saving, setSaving] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const current = { ...(settings.data ?? {}), ...draft };
  async function save(key: string) {
    setSaving(key);
    const { error } = await supabaseBrowser().rpc("admin_set_setting", { p_key: key, p_value: current[key] ?? "" });
    setSaving(null);
    if (!error) settings.reload();
  }

  const FIELDS: { key: string; label: string; hint: string }[] = [
    { key: "receipt_model", label: "First read", hint: "The model every receipt goes to first." },
    { key: "receipt_retry_model", label: "Retry", hint: "Used once when the first read doesn't reconcile." },
    { key: "receipt_daily_limit", label: "Scans per person per day", hint: "" },
    { key: "receipt_ai_enabled", label: "AI reading enabled", hint: "true or false. Setting false stops all scanning." },
  ];

  return (
    <>
      <Panel loading={settings.loading} error={settings.error}>
        <div className={s.settings}>
          {FIELDS.map((f) => (
            <div key={f.key} className={s.setting}>
              <label className={s.settingLabel} htmlFor={`set-${f.key}`}>{f.label}</label>
              <div className={s.settingRow}>
                <input
                  id={`set-${f.key}`} className={s.input} value={current[f.key] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                />
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
          A model name has to be one the Anthropic API accepts, e.g. <code>claude-sonnet-5</code>.
        </p>
      </Panel>

      <h3 className={s.sub}>How each model has done</h3>
      <Panel loading={models.loading} error={models.error} empty={!!models.data && models.data.length === 0}>
        <div className={s.scroll}>
          <table className={s.table}>
            <thead><tr><th>Model</th><th className={s.n}>Receipts</th><th className={s.n}>Reconciled</th><th className={s.n}>Failed</th><th className={s.n}>Lines read</th><th className={s.n}>Corrected</th><th className={s.n}>Cost</th></tr></thead>
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
type SplitRow = { split_type: string; expenses: number; cents: number };

function DataTab({ active }: { active: boolean }) {
  const trips = useRpc<TripRow[]>("admin_trips", { p_limit: 200, p_offset: 0 }, active);
  const cats = useRpc<CatRow[]>("admin_categories", {}, active);
  const splits = useRpc<SplitRow[]>("admin_split_types", {}, active);
  const top = Math.max(...(cats.data ?? []).map((c) => Number(c.cents)), 1);

  return (
    <>
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
        <div className={s.bars}>
          {(cats.data ?? []).map((c) => (
            <div key={`${c.category}/${c.subcategory}`} className={s.barRow}>
              <span className={s.barLabel}>{c.category}<span className={s.muted}> · {c.subcategory}</span></span>
              <div className={s.barTrack}><div className={s.bar} style={{ width: `${(Number(c.cents) / top) * 100}%` }} /></div>
              <span className={s.barNum}>{money(c.cents)}</span>
              <span className={s.barPct}>{pct(c.share)}</span>
            </div>
          ))}
        </div>
      </Panel>

      <h3 className={s.sub}>How people split</h3>
      <Panel loading={splits.loading} error={splits.error} empty={!!splits.data && splits.data.length === 0}>
        <div className={s.scroll}>
          <table className={s.table}>
            <thead><tr><th>Split</th><th className={s.n}>Expenses</th><th className={s.n}>Total</th></tr></thead>
            <tbody>
              {(splits.data ?? []).map((r) => (
                <tr key={r.split_type}><td>{r.split_type}</td><td className={s.n}>{num(r.expenses)}</td><td className={s.n}>{money(r.cents)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

/* ------------------------------------------------------------------- Shell */
function SignIn({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error: err } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) { setError(err.message); return; }
    onDone();
  }

  return (
    <form className={s.signin} onSubmit={submit}>
      <h1 className={s.signinTitle}>Admin</h1>
      <div className={s.field}>
        <label className={s.settingLabel} htmlFor="ad-email">Email</label>
        <input id="ad-email" className={s.input} type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className={s.field}>
        <label className={s.settingLabel} htmlFor="ad-pw">Password</label>
        <input id="ad-pw" className={s.input} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error ? <p className={s.error} role="alert">{error}</p> : null}
      <Button type="submit" variant="primary" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
    </form>
  );
}

export function Portal() {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");

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
  if (!session) return <SignIn onDone={() => undefined} />;

  if (isAdmin === false) {
    return (
      <div className={s.signin}>
        <h1 className={s.signinTitle}>Not an admin</h1>
        <p className={s.muted}>That account is signed in but isn&apos;t on the admin list.</p>
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
        {tab === "Overview" ? <OverviewTab active /> : null}
        {tab === "Users" ? <UsersTab active /> : null}
        {tab === "Welcome wizard" ? <WizardTab active /> : null}
        {tab === "Models" ? <ModelsTab active /> : null}
        {tab === "Integrations" ? <IntegrationsTab active /> : null}
        {tab === "Feedback" ? <FeedbackTab active /> : null}
        {tab === "Data" ? <DataTab active /> : null}
      </section>
    </div>
  );
}
