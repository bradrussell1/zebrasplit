import { cosmeticById, countDone, formatCents, formatDateRange, herdPick, normalizeOutfit, zebraMoodFor, type Outfit, type ZebraMood } from "@bunktab/core";
import { color, layout, palette, radius, size, space } from "@bunktab/theme";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Image, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AmountPill, Button, Card, CountUp, Icon, IconButton, Input, InsetPanel, HeroCard, Money, Press, ScreenBackground, SegmentedControl, TopBar, Zebra, ZText, useToast } from "@/ui";
import { trackOnboardingFinishedOnce } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";
import { useForegroundSeed } from "@/lib/foreground";
import { acceptInvite, declineInvite, fetchMyInvites, type MyInvite } from "@/lib/invites";
import { useSignedUrl } from "@/lib/media";
import { supabase } from "@/lib/supabase";
import { fetchUnseenNotifications, markNotificationsSeen } from "@/lib/notifications";
import { sortMembers } from "@/lib/trips";

/**
 * Home: Your dazzles (RESKIN_PROMPT B2, board `Main`). Wordmark top bar with search
 * and profile; the balance HeroCard (net across open dazzles, zebra bust in the
 * corner); "Your dazzles" with Open / Past; one Card per dazzle with its stripe
 * meter; "Start a dazzle" pinned at the bottom beside "Join with a link".
 * Balances are computed here from the same rows the dazzle page uses (base cents,
 * paid minus share), so the two screens can never disagree. Reloads whenever the
 * screen regains focus, so a dazzle created or edited elsewhere shows at once.
 * Invitations (pending invites to this account's number) sit above the list:
 * nobody joins a dazzle without accepting it here or on the join screen.
 */
type MemberRow = { user_id: string; role: "owner" | "member"; joined_at: string | null; done_at: string | null; display_name: string | null; photo_url: string | null; outfit: Outfit };
type TripRow = { id: string; title: string; status: "open" | "settled" | "archived"; start_date: string; end_date: string; base_currency: string; cover_photo_url: string | null; last_activity_at: string; members: MemberRow[]; net_cents: number };

export default function HomeScreen() {
  // the last step of the funnel: every route into an account ends up here
  useEffect(() => { trackOnboardingFinishedOnce(); }, []);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { session } = useAuth();
  const me = session!.user.id;
  const params = useLocalSearchParams<{ tab?: "open" | "past" }>();
  const [tab, setTab] = useState<"open" | "past">(params.tab === "past" ? "past" : "open");
  useEffect(() => { if (params.tab === "open" || params.tab === "past") setTab(params.tab); }, [params.tab]); // a link can open either tab
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const herdSeed = useForegroundSeed();
  /**
   * Your own look on the hero zebra — head and face only. A bust is cropped at the
   * shoulder, so a body item would either be invisible or clipped halfway through.
   */
  const [myLook, setMyLook] = useState<Outfit>({});
  useEffect(() => {
    let live = true;
    supabase.from("user_outfit").select("head, faceneck").eq("user_id", me).maybeSingle()
      .then(({ data: row }) => { if (live && row) setMyLook(normalizeOutfit(row as Outfit)); });
    return () => { live = false; };
  }, [me]);
  /**
   * The drop banner (A17): built, and shipped switched off. `active_drop` returns the
   * newest live drop this person hasn't dismissed, and with no rows in `drops` — which
   * is launch — it always returns nothing, so neither the banner nor the dot appears.
   */
  const [drop, setDrop] = useState<{ id: string; title: string; subtitle: string | null; item_ids: string[] } | null>(null);
  useEffect(() => {
    let live = true;
    supabase.rpc("active_drop").then(({ data: rows }) => {
      const d = Array.isArray(rows) ? rows[0] : null;
      if (live && d) setDrop(d);
    });
    return () => { live = false; };
  }, []);
  async function dismissDrop() {
    if (!drop) return;
    const d = drop;
    setDrop(null);
    // user_id is NOT NULL with no default, so omitting it fails with 23502 and the
    // banner comes back on the next launch looking like the dismiss never took
    const { error: e } = await supabase.from("drop_seen").insert({ drop_id: d.id, user_id: me });
    if (e) { setDrop(d); show({ message: "Couldn't dismiss that. Try again." }); }
  }
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [invites, setInvites] = useState<MyInvite[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [footerH, setFooterH] = useState(size.ctaHeight + layout.bottomCtaPadding);

  const load = useCallback(async () => {
    const [t, m, e, inv] = await Promise.all([
      supabase.from("trips").select("id, title, status, start_date, end_date, base_currency, cover_photo_url, last_activity_at").order("last_activity_at", { ascending: false }),
      // done_at is read here only for the stripe meter ("3 of 6 stripes"); nothing on Home writes it
      supabase.from("trip_members").select("trip_id, user_id, role, joined_at, done_at, users(display_name, photo_url, user_outfit(head, faceneck, body))").is("removed_at", null),
      supabase.from("expenses").select("trip_id, expense_payers(user_id, base_amount_cents), expense_shares(user_id, base_share_cents)").is("deleted_at", null),
      fetchMyInvites().catch(() => [] as MyInvite[]),
    ]);
    setInvites(inv);
    type OutfitRow = { head: string | null; faceneck: string | null; body: string | null };
    type M = { trip_id: string; user_id: string; role: "owner" | "member"; joined_at: string | null; done_at: string | null; users: { display_name: string | null; photo_url: string | null; user_outfit: OutfitRow | OutfitRow[] | null } | null };
    type E = { trip_id: string; expense_payers: { user_id: string; base_amount_cents: number }[]; expense_shares: { user_id: string; base_share_cents: number }[] };
    const membersBy = new Map<string, MemberRow[]>();
    for (const r of (m.data ?? []) as unknown as M[]) membersBy.set(r.trip_id, [...(membersBy.get(r.trip_id) ?? []), { user_id: r.user_id, role: r.role, joined_at: r.joined_at, done_at: r.done_at, display_name: r.users?.display_name ?? null, photo_url: r.users?.photo_url ?? null, outfit: normalizeOutfit((Array.isArray(r.users?.user_outfit) ? r.users?.user_outfit[0] : r.users?.user_outfit) as Outfit | null) }]);
    const netBy = new Map<string, number>();
    for (const x of (e.data ?? []) as unknown as E[]) {
      const paid = x.expense_payers.filter((p) => p.user_id === me).reduce((s, p) => s + p.base_amount_cents, 0);
      const share = x.expense_shares.filter((p) => p.user_id === me).reduce((s, p) => s + p.base_share_cents, 0);
      netBy.set(x.trip_id, (netBy.get(x.trip_id) ?? 0) + paid - share);
    }
    setTrips(((t.data ?? []) as Omit<TripRow, "members" | "net_cents">[]).map((r) => ({ ...r, members: sortMembers(membersBy.get(r.id) ?? []), net_cents: netBy.get(r.id) ?? 0 })));
    setLoading(false);
  }, [me]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  async function accept(i: MyInvite) {
    setActing(i.id);
    const r = await acceptInvite(i.token);
    setActing(null);
    if ("error" in r) { show({ message: r.error }); load(); return; }
    show({ message: `You're in ${i.title}.`, bust: <Zebra variant="bust" mood="happy" size={28} decorative /> });
    router.push(`/(app)/trip/${r.tripId}`);
  }
  async function decline(i: MyInvite) {
    setActing(i.id);
    const e = await declineInvite(i.token);
    setActing(null);
    if (e) { show({ message: e }); return; }
    setInvites((rows) => rows.filter((r) => r.id !== i.id));
  }
  // the in-app surface for nudges and invites: the newest unseen one shows as a toast on open
  useEffect(() => {
    let live = true;
    fetchUnseenNotifications().then((rows) => {
      if (!live || rows.length === 0) return;
      const top = rows[0]!;
      // an invite isn't a dazzle of mine yet: its action opens the join screen to accept
      const action = top.kind === "trip.invited"
        ? (top.token ? { label: "View", onPress: () => router.push(`/join/${top.token}`) } : undefined)
        : top.trip_id ? { label: "Open", onPress: () => router.push(`/(app)/trip/${top.trip_id}`) } : undefined;
      show({ message: top.body, duration: 5000, bust: <Zebra variant="bust" mood="happy" size={28} decorative />, action });
      markNotificationsSeen(top.id);
    }).catch(() => undefined);
    return () => { live = false; };
  }, [show, router]);

  const open = useMemo(() => trips.filter((t) => t.status === "open"), [trips]);
  // one figure per currency: the hero shows the currency with the most open dazzles (ties → USD), the rest as captions
  const position = useMemo(() => {
    const by = new Map<string, { net: number; n: number }>();
    for (const t of open) { const c = by.get(t.base_currency) ?? { net: 0, n: 0 }; by.set(t.base_currency, { net: c.net + t.net_cents, n: c.n + 1 }); }
    const rows = [...by.entries()].map(([currency, v]) => ({ currency, ...v })).sort((a, b) => b.n - a.n || (a.currency === "USD" ? -1 : b.currency === "USD" ? 1 : a.currency.localeCompare(b.currency)));
    return { main: rows[0] ?? null, others: rows.slice(1) };
  }, [open]);
  const overall = position.main?.net ?? 0;
  const heroMood = zebraMoodFor({ place: "home-hero", netCents: overall, openDazzles: open.length }) ?? "hi";

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trips
      .filter((t) => (tab === "open" ? t.status === "open" : t.status !== "open"))
      .filter((t) => !q || t.title.toLowerCase().includes(q) || t.members.some((mm) => (mm.display_name ?? "").toLowerCase().includes(q)));
  }, [trips, tab, query]);

  function toggleSearch() {
    if (searching) setQuery("");
    setSearching((s) => !s);
  }
  function joinWithLink() {
    // invites arrive as links (and pushes) that open the join screen; pending ones also sit above the list
    show({ message: "Open the invite link you were sent and accept it. Invites to your number also show up here.", bust: <Zebra variant="bust" mood="wink" size={28} decorative /> });
  }

  const header = loading ? null : (
    <View style={styles.header}>
      <HeroCard style={styles.hero}>
        <View style={styles.heroText}>
          <ZText variant="caption" color={color.textMuted}>
            {open.length === 0 ? "Nothing open right now" : `Across ${open.length} ${open.length === 1 ? "Dazzle" : "Dazzles"}`}
          </ZText>
          {position.main && position.main.currency !== "USD"
            ? <Money variant="display" cents={Math.abs(overall)} currency={`${position.main.currency} `} />
            : <CountUp cents={Math.abs(overall)} fit underline={overall !== 0} underlineColor={overall > 0 ? color.owedToYou : color.youOwe} />}
          {overall !== 0 ? <LabelPill tone={overall > 0 ? "volt" : "blush"} label={overall > 0 ? "Owed To You" : "You Owe"} /> : null}
          {position.others.map((o) => (
            <ZText key={o.currency} variant="caption" color={color.textMuted}>
              {o.net === 0 ? `Even across ${o.n} ${o.n === 1 ? "Dazzle" : "Dazzles"} in ${o.currency}` : `${formatCents(Math.abs(o.net), o.currency)} ${o.net > 0 ? "owed to you" : "you owe"} across ${o.n} ${o.n === 1 ? "Dazzle" : "Dazzles"} in ${o.currency}`}
            </ZText>
          ))}
        </View>
        <View style={styles.heroZebra}>
          <Zebra variant="bust" mood={heroMood} size={108} outfit={myLook} animate={{ bob: true }} accessibilityLabel={`Your zebra, ${heroMood}`} />
        </View>
      </HeroCard>
      {/* the drop banner sits between the balance and Your Dazzles, and only when a
          drop is live and undismissed — which is never, until there is drop content */}
      {drop ? (
        <Press onPress={() => router.push("/(app)/shop")} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={`${drop.title}. ${drop.subtitle ?? ""} Opens the Shop`} style={styles.drop}>
          {cosmeticById(drop.item_ids[0]) ? (
            <Zebra variant="bust" size={44} striped mood="happy" outfit={{ [cosmeticById(drop.item_ids[0])!.slot]: drop.item_ids[0]! }} decorative />
          ) : null}
          <View style={styles.dropText}>
            <ZText variant="bodyStrong" color={color.textOnInk} numberOfLines={1}>{drop.title}</ZText>
            {drop.subtitle ? <ZText variant="caption" color={palette.hide} numberOfLines={1}>{drop.subtitle}</ZText> : null}
          </View>
          <View style={styles.dropChip}><ZText variant="captionStrong">Shop</ZText></View>
          <Press onPress={dismissDrop} scaleTo={0.97} accessibilityRole="button" accessibilityLabel="Dismiss" hitSlop={10}>
            <Icon name="close" size={16} color={palette.hide} />
          </Press>
        </Press>
      ) : null}
      {invites.length ? (
        <View style={styles.invites}>
          <ZText variant="title2" accessibilityRole="header">Invitations</ZText>
          {invites.map((i) => (
            <Card key={i.id} accessibilityLabel={`${i.inviter} invited you to ${i.title}`}>
              <ZText variant="headline" numberOfLines={2}>{i.title}</ZText>
              <ZText variant="caption" color={color.textMuted}>
                {`${i.inviter} invited you · ${shortRange(i.start_date, i.end_date)} · ${i.member_count} ${i.member_count === 1 ? "zebra" : "zebras"} so far`}
              </ZText>
              <View style={styles.inviteActions}>
                <Button label="Accept" loading={acting === i.id} disabled={!!acting && acting !== i.id} onPress={() => accept(i)} style={styles.inviteButton} />
                <Button kind="secondary" label="Not now" disabled={!!acting} onPress={() => decline(i)} style={styles.inviteButton} />
              </View>
            </Card>
          ))}
        </View>
      ) : null}
      <View style={styles.titleRow}>
        <ZText variant="title2" accessibilityRole="header">Your Dazzles</ZText>
        <SegmentedControl options={[{ key: "open", label: "Open" }, { key: "past", label: "Past" }]} value={tab} onChange={setTab} style={styles.segment} />
      </View>
    </View>
  );

  const empty = loading ? null : query.trim() ? (
    <Empty mood="worried" size={64} title="No Dazzles match" body="Try a Dazzle title or someone's name." />
  ) : tab === "open" ? (
    <Empty mood={zebraMoodFor({ place: "empty", kind: "no-dazzles" }) ?? "hi"} title="Start your first Dazzle" body="Invite the crew, log what you paid, and earn your stripes together." />
  ) : (
    <Empty mood={zebraMoodFor({ place: "empty", kind: "no-past" }) ?? "sleepy"} title="Nothing filed away yet" body="Settled Dazzles, and ones that go quiet, land here." />
  );

  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar
        wordmark
        right={
          <>
            <IconButton name={searching ? "close" : "search"} label={searching ? "Close search" : "Search Dazzles"} onPress={toggleSearch} accessibilityState={{ expanded: searching }} />
            <View>
              <IconButton name="bag" label="Shop" onPress={() => router.push("/(app)/shop")} />
              {/* the dot is a live drop nobody has dismissed; with no drops it never shows */}
              {drop ? <View style={styles.shopDot} pointerEvents="none" /> : null}
            </View>
            <IconButton name="person" label="Profile" onPress={() => router.push("/(app)/settings")} />
          </>
        }
      />
      {searching ? (
        <View style={styles.search}>
          <Input
            left={<Icon name="search" size={18} color={color.textMuted} />}
            placeholder="Search Dazzles or people"
            value={query}
            onChangeText={setQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
            accessibilityLabel="Search Dazzles by title or member name"
          />
        </View>
      ) : null}
      <FlatList
        data={shown}
        keyExtractor={(t) => t.id}
        refreshControl={<RefreshControl refreshing={loading && trips.length > 0} onRefresh={load} />}
        ListHeaderComponent={header}
        ItemSeparatorComponent={() => <View style={{ height: layout.listGap }} />}
        ListEmptyComponent={empty}
        renderItem={({ item }) => <DazzleCard trip={item} me={me} seed={herdSeed} onPress={() => router.push(`/(app)/trip/${item.id}`)} />}
        contentContainerStyle={[styles.list, { paddingBottom: footerH + space[16] }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
      <View onLayout={(e) => setFooterH(e.nativeEvent.layout.height + layout.bottomCtaPadding + insets.bottom)} style={[styles.footer, { bottom: layout.bottomCtaPadding + insets.bottom }]}>
        <Button label="Start a Dazzle" icon="plus" style={styles.start} onPress={() => router.push("/(app)/trip/new")} />
        <IconButton name="link" label="Join with a link" size={size.ctaHeight} onPress={joinWithLink} />
      </View>
    </View>
  );
}

/** "owed to you" / "you owe" under the hero amount: volt or blush, 13/700. */
function LabelPill({ tone, label }: { tone: "volt" | "blush"; label: string }) {
  return (
    <View style={[styles.labelPill, { backgroundColor: tone === "volt" ? color.owedToYou : color.youOwe }]}>
      <ZText variant="captionStrong" color={tone === "volt" ? color.textOnVolt : color.youOweText}>{label}</ZText>
    </View>
  );
}

/** Drop the year from "Oct 9 – 14, 2026" when it's this year (the board's card caption). */
function shortRange(start: string, end: string) {
  return formatDateRange(start, end).replace(new RegExp(`, ${new Date().getFullYear()}$`), "");
}

function DazzleCard({ trip, me, seed, onPress }: { trip: TripRow; me: string; seed: number; onPress: () => void }) {
  const cover = useSignedUrl("covers", trip.cover_photo_url); // object path in the private bucket
  const settled = trip.status === "settled";
  const youOwe = !settled && trip.net_cents < 0;
  const { done } = countDone(trip.members);
  const notDone = trip.members.length - done;
  // up to eight busts, picked the same way the field picks twelve: you always among them
  const MINI = 8;
  const pick = herdPick([...trip.members].sort((a, b) => a.user_id.localeCompare(b.user_id)), me, seed);
  const shown = pick.shown.slice(0, MINI);
  const hidden = trip.members.length - shown.length;
  const cardMood = zebraMoodFor({ place: "home-card", youOwe });
  const caption = `${shortRange(trip.start_date, trip.end_date)} · ${trip.members.length} ${trip.members.length === 1 ? "zebra" : "zebras"} in the Dazzle`;
  const status = settled ? "settled" : trip.net_cents > 0 ? `owed ${formatCents(trip.net_cents, trip.base_currency)}` : trip.net_cents < 0 ? `you owe ${formatCents(-trip.net_cents, trip.base_currency)}` : "even";
  const stillAdding = settled ? "Settled" : trip.status === "archived" ? "Archived" : notDone === 0 ? "Everyone's done" : cardMood ? "still adding" : `${notDone} still adding`;
  return (
    <Card onPress={onPress} accessibilityLabel={`${trip.title}, ${caption}, ${status}, ${done} of ${trip.members.length} done`}>
      <View style={styles.cardTop}>
        {cover ? <Image source={{ uri: cover }} style={styles.cover} accessibilityIgnoresInvertColors /> : null}
        <View style={styles.cardText}>
          <ZText variant="headline" numberOfLines={2}>{trip.title}</ZText>
          <ZText variant="caption" color={color.textMuted}>{caption}</ZText>
        </View>
        {!settled ? <AmountPill cents={trip.net_cents} hideZero /> : null}
      </View>
      <InsetPanel style={styles.inset}>
        <View style={styles.meterRow}>
          {/* A11: a mini herd, not a meter. A bust can't show body stripes, so the fade
              and the dashed ring carry "still adding", and a small ink check carries done. */}
          <View style={styles.miniHerd} accessibilityLabel={`${done} of ${trip.members.length} have their stripes`}>
            {shown.map((m) => (
              <View key={m.user_id} style={[styles.miniBust, m.done_at ? null : styles.miniAdding]}>
                <Zebra variant="bust" size={34} striped={!!m.done_at} outfit={m.outfit} mood={m.done_at ? "happy" : "hi"} decorative />
                {m.done_at
                  ? <View style={styles.miniCheck}><Icon name="check" size={9} color={palette.white} stroke={3} /></View>
                  : null}
              </View>
            ))}
            {hidden > 0 ? <ZText variant="micro" color={color.textMuted}>+{hidden}</ZText> : null}
          </View>
          <View style={styles.adding}>
            <ZText variant="small" color={settled ? color.text : color.textMuted}>{stillAdding}</ZText>
          </View>
        </View>
      </InsetPanel>
    </Card>
  );
}

function Empty({ mood, title, body, size: s = 120 }: { mood: ZebraMood; title: string; body: string; size?: number }) {
  return (
    <View style={styles.empty} accessibilityRole="summary">
      <Zebra variant="bust" mood={mood} size={s} animate={{ blink: true }} accessibilityLabel={`Zebra, ${mood}`} />
      <ZText variant="title2" style={styles.center}>{title}</ZText>
      <ZText variant="body" color={color.textMuted} style={styles.center}>{body}</ZText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  search: { paddingHorizontal: layout.screenGutter, paddingBottom: space[12] },
  list: { paddingHorizontal: layout.screenGutter, flexGrow: 1 },
  header: { gap: space[16], paddingTop: space[4], paddingBottom: space[12] },
  invites: { gap: space[12] },
  inviteActions: { flexDirection: "row", gap: space[12], marginTop: space[12] },
  inviteButton: { flex: 1 },
  hero: { minHeight: 176, justifyContent: "center" },
  heroText: { gap: space[8], alignItems: "flex-start", paddingRight: 118 },
  // the bust sits in the bottom-right corner with its whole head (ears included) inside the
  // card; the amount column stops 118 px short of the edge so the two never overlap
  heroZebra: { position: "absolute", right: 2, bottom: -2 },
  labelPill: { borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 11 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: layout.textGutter - layout.screenGutter, gap: space[12] },
  segment: { width: 150 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: space[12] },
  cover: { width: 40, height: 40, borderRadius: radius.tile, backgroundColor: color.surfaceTile },
  cardText: { flex: 1, gap: 2 },
  inset: { marginTop: space[10] },
  meterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[8] },
  miniHerd: { flexDirection: "row", alignItems: "center", gap: 2, flex: 1, flexWrap: "nowrap" },
  shopDot: { position: "absolute", top: 2, right: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: color.attention, borderWidth: 2, borderColor: palette.white },
  drop: { flexDirection: "row", alignItems: "center", gap: space[10], backgroundColor: palette.ink, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 14 },
  dropText: { flex: 1, gap: 1 },
  dropChip: { backgroundColor: palette.volt, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 12 },
  miniBust: { marginRight: -8 },
  miniAdding: { opacity: 0.4, borderWidth: 1.5, borderColor: color.outlineDashed, borderStyle: "dashed", borderRadius: 17 },
  miniCheck: { position: "absolute", right: 0, bottom: 0, width: 13, height: 13, borderRadius: 6.5, backgroundColor: palette.ink, alignItems: "center", justifyContent: "center" },
  adding: { flexDirection: "row", alignItems: "center", gap: space[6] },
  empty: { alignItems: "center", gap: space[8], paddingVertical: space[32], paddingHorizontal: layout.textGutter },
  center: { textAlign: "center" },
  footer: { position: "absolute", left: layout.screenGutter, right: layout.screenGutter, flexDirection: "row", alignItems: "center", gap: space[10] },
  start: { flex: 1 },
});
