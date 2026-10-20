import { availablePlatforms, choosePlatform, closeoutUnlocked, countDone, formatCents, formatHandle, payLink, planVenmoRequests, PLATFORM_SPECS, venmoChargeLink, zebraLabel, zebraMoodFor, type Handles, type PayPlatform } from "@bunktab/core";
import { color, layout, palette, radius, shadow, size, space } from "@bunktab/theme";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Linking, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ActionSheet, Banner, Button, Card, Confetti, CountUp, Dance, HeroCard, Icon, InsetPanel, PayZipButton, PersonPill, PlatformChip, PlatformMark, Press, Rise, ScreenBackground, StatusPill, TextLink, Toggle, TopBar, Zebra, ZebraFarewell, ZText, haptic, ScreenSkeleton, useToast } from "@/ui";
import { useAuth } from "@/lib/auth";
import { isNetworkError, supabase } from "@/lib/supabase";
import { activeMembers, memberName, useTrip } from "@/lib/trips";

/**
 * Earn your stripes / close out (RESKIN_PROMPT B7, board "Earn your stripes"; spec:
 * Screens → Close out and pay). One screen, two states:
 *
 * Not everyone done: "Earn your stripes", the zebra stage (one stripe per member
 * who's Done, mood by the progress rule), a person pill per member (yours toggles
 * set_done), a locked "Close out at N stripes · K to go" button and, for the creator,
 * a "Close out remaining zebras" toggle (force_close_out: every remaining member is
 * marked Done and told; confirmed in an action sheet). `?nudge=1` (the creator's Nudge
 * button on the dazzle page) adds a small Nudge CTA beside each person still adding:
 * send_nudge writes one notification + push per person per day, never a text.
 * Feedback round 1, items 13 and 14.
 *
 * Everyone done: "Stripes are even. Time to settle." The zebra dances and confetti
 * fires the moment the last stripe lands; the payment plan (written by the database
 * through generate_settlements) rises in, in two deliberately unalike halves
 * (feedback round 2, items 2, 4 and 5):
 *
 *  - "Your payments" — a volt-capped card, the amount you still owe in amountL, and a
 *    "Pay Mike $84.50" button each. Marking one paid sends a zebra galloping across the
 *    button, dragging the volt fill and "Paid, nice!" behind it and off the screen.
 *  - "Remaining zebras" — everyone else's payments, quieter type, each with the
 *    recipient's platform mark. A payment someone has marked paid is struck through and
 *    dimmed, so what is left to happen is what still reads as live.
 *
 * Then "We earned our stripes. Share the recap?" and, for a creditor, one volt
 * "Request … in Venmo". Settled up stays a toggle (set_settled_up) and now plays the
 * send-off: the zebra rears, neighs, spins, gallops off, and you land back on Home.
 *
 * Each payment opens Venmo, Cash App or PayPal, whichever the RECIPIENT has added:
 * the handle belongs to the person being paid, so the chip under a payment offers
 * only the platforms they actually registered. `choosePlatform` picks the payer's
 * recorded choice (settlements.platform, written by set_settlement_platform), then
 * the recipient's default. Someone with nothing registered can only be marked
 * "Paid another way" — that is also the Zelle, cash and bank-transfer path.
 *
 * There is one link per payment: Venmo's deep link carries several recipients but
 * only ONE amount, so three different debts cannot be batched into one trip out to
 * Venmo. The settlement algorithm keeps that cheap by minimising payments per payer.
 * The creditor's "Request from everyone" is the same constraint seen from the other
 * side: it batches only when every debt is the identical amount, and otherwise offers
 * one request per person rather than charging everybody the first person's figure.
 */
function friendly(m: string): string {
  const s = m.toLowerCase();
  if (s.includes("still locked")) return "Close out is locked until everyone has tapped Done.";
  if (s.includes("not a member")) return "You're not on this Dazzle any more.";
  if (isNetworkError(m) || s.includes("network")) return "Connection lost. Check your signal and try again.";
  if (s.includes("42501") || s.includes("only the")) return "Only the Dazzle creator can do that.";
  return m;
}

export default function CloseoutScreen() {
  const { id, nudge: nudgeParam } = useLocalSearchParams<{ id: string; nudge?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const { session } = useAuth();
  const me = session!.user.id;
  const { data, loading, reload } = useTrip(id);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [settling, setSettling] = useState(false);
  const [busyDone, setBusyDone] = useState(false);
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [closingOut, setClosingOut] = useState(false);
  const [nudging, setNudging] = useState<string | null>(null);
  const [nudged, setNudged] = useState<Record<string, boolean>>({}); // user_id → sent this session
  const [picking, setPicking] = useState<string | null>(null); // settlement id whose platform is being changed
  const [requesting, setRequesting] = useState(false); // the one-by-one Venmo request sheet
  const [farewell, setFarewell] = useState(0); // bumped to play the send-off
  const [play, setPlay] = useState({ dance: 0, confetti: 0 });
  const wasUnlocked = useRef<boolean | null>(null);

  // the plan is only asked for once the gate is open; a locked trip shows the stripes instead
  const gateOpen = data ? (closeoutUnlocked(activeMembers(data).map((m) => ({ doneAt: m.done_at, removedAt: m.removed_at }))) || !!data.trip.closeout_override_at) : false;
  useEffect(() => {
    if (!data || generated || !gateOpen) return;
    setGenerated(true);
    if (data.trip.status === "open") supabase.rpc("generate_settlements", { p_trip: data.trip.id }).then(({ error: e }) => { if (e) setError(friendly(e.message)); reload(); });
  }, [data, generated, gateOpen, reload]);
  // the last stripe landing (while you watch) → dance + confetti; already even on open → one dance
  useEffect(() => {
    if (!data) return;
    if (wasUnlocked.current === null) { wasUnlocked.current = gateOpen; if (gateOpen) setPlay((p) => ({ ...p, dance: p.dance + 1 })); return; }
    if (!wasUnlocked.current && gateOpen) { wasUnlocked.current = true; setPlay((p) => ({ dance: p.dance + 1, confetti: p.confetti + 1 })); haptic.success(); }
    if (!gateOpen) wasUnlocked.current = false;
  }, [data, gateOpen]);

  if (loading || !data) {
    return <View style={styles.screen}><ScreenBackground /><TopBar onBack={() => router.back()} /><ScreenSkeleton rows={3} /></View>;
  }
  const { trip, settlements } = data;
  const members = activeMembers(data);
  const doneCount = countDone(members).done;
  const toGo = members.length - doneCount;
  const closed = trip.status !== "open";
  const cur = trip.base_currency;
  const isOwner = members.find((m) => m.user_id === me)?.role === "owner";
  const myDone = !!members.find((m) => m.user_id === me)?.done_at;
  const mood = zebraMoodFor({ place: "stripes", members: members.length, done: doneCount }) ?? "hi";
  const nudgeMode = nudgeParam === "1" && isOwner && !closed;

  const mine = settlements.filter((s) => s.from_user === me);
  const owed = settlements.filter((s) => s.to_user === me);
  const others = settlements.filter((s) => s.from_user !== me && s.to_user !== me);
  const venmoOf = (uid: string) => data.members.find((m) => m.user_id === uid)?.venmo_username ?? null;
  const handlesOf = (uid: string): Handles => data.members.find((m) => m.user_id === uid)?.handles ?? {};
  const defaultOf = (uid: string) => data.members.find((m) => m.user_id === uid)?.default_pay_platform ?? null;
  /** The platform a payment will open: the payer's recorded choice, else the recipient's default. */
  const platformFor = (s: { to_user: string; platform: PayPlatform | null }) =>
    choosePlatform(handlesOf(s.to_user), defaultOf(s.to_user), s.platform);
  const settledUp = !!data.members.find((m) => m.user_id === me)?.settled_up_at;
  const allMinePaid = mine.length > 0 && mine.every((s) => s.status !== "pending");
  const who = (uid: string) => memberName(data, uid, me);
  const minePaidCount = mine.filter((s) => s.status !== "pending").length;
  const mineLeftCents = mine.filter((s) => s.status === "pending").reduce((t, s) => t + s.amount_cents, 0);
  /** When every one of your payments opens the same app, the card says so once instead of per row. */
  const minePlatforms = Array.from(new Set(mine.map((s) => platformFor(s)).filter((p): p is PayPlatform => !!p)));
  const onePlatform = minePlatforms.length === 1 ? minePlatforms[0]! : null;
  // "Remaining zebras": every payment that isn't yours to make, what's owed to you first
  const remaining = [...owed.map((s) => ({ s, toMe: true })), ...others.map((s) => ({ s, toMe: false }))];
  const remainingOpen = remaining.filter(({ s }) => s.status === "pending").length;

  // A Venmo charge carries several recipients but one amount, so batching is only
  // honest when every debt matches; anything else goes one request at a time.
  const requestPlan = planVenmoRequests(owed.filter((s) => s.status === "pending")
    .map((s) => ({ recipient: venmoOf(s.from_user), amountCents: s.amount_cents, from: s.from_user })));
  const requestable = requestPlan.requests;

  async function open(link: { app: string; web: string }) {
    const can = await Linking.canOpenURL(link.app).catch(() => false);
    await Linking.openURL(can ? link.app : link.web);
  }
  async function toggleDone(v: boolean) {
    setBusyDone(true);
    const { error: e } = await supabase.rpc("set_done", { p_trip: trip.id, p_done: v });
    if (e) setError(friendly(e.message));
    await reload(); setBusyDone(false);
  }
  // the creator closes out for everyone: every remaining member is marked Done and told
  async function closeOutRemaining() {
    setClosingOut(true);
    const { error: e } = await supabase.rpc("force_close_out", { p_trip: trip.id });
    if (e) setError(friendly(e.message));
    await reload();
    setClosingOut(false);
  }
  // one nudge per person per day: the database dedupes (notification_log) and says so
  async function nudgeMember(uid: string, name: string) {
    setNudging(uid);
    const { data: sent, error: e } = await supabase.rpc("send_nudge", { p_trip: trip.id, p_user: uid });
    setNudging(null);
    if (e) { show({ message: friendly(e.message) }); return; }
    setNudged((n) => ({ ...n, [uid]: true }));
    show({ message: sent ? `Nudged ${name}. They'll get a push and see it next time they open the app.` : `${name} was already nudged today. One a day keeps it friendly.`, duration: 3500, bust: <Zebra variant="bust" mood="wink" size={28} decorative /> });
  }
  async function toggleSettledUp(v: boolean) {
    setSettling(true);
    const { error: e } = await supabase.rpc("set_settled_up", { p_trip: trip.id, p_on: v });
    if (e) setError(friendly(e.message));
    await reload(); setSettling(false);
    // turning it on is the end of this Dazzle: the zebra takes its bow, then Home
    if (v && !e) setFarewell((n) => n + 1);
  }
  async function mark(sid: string, action: "mark_paid" | "unmark" | "confirm") {
    const { error: e } = await supabase.rpc("mark_settlement", { p_settlement: sid, p_action: action });
    if (e) setError(friendly(e.message)); reload();
  }
  // the payer picks the platform; the database records it so the choice survives a reopen
  async function pickPlatform(sid: string, platform: PayPlatform) {
    const { error: e } = await supabase.rpc("set_settlement_platform", { p_settlement: sid, p_platform: platform });
    if (e) { show({ message: friendly(e.message) }); return; }
    reload();
  }
  const requestLabel = requestPlan.mode !== "batch" ? "Request in Venmo"
    : requestable.length === 1 ? `Request ${formatCents(requestable[0]!.amountCents, cur)} in Venmo`
      : `Request ${formatCents(requestable[0]!.amountCents, cur)} from ${requestPlan.coversAll ? "everyone" : `${requestable.length} people`} in Venmo`;
  const requestOne = (d: { recipient: string | null; amountCents: number }) => open(venmoChargeLink([d.recipient!], d.amountCents, trip.title));
  const request = () => {
    if (requestPlan.mode === "batch") return open(venmoChargeLink(requestable.map((d) => d.recipient!), requestable[0]!.amountCents, trip.title));
    setRequesting(true); // different amounts: one at a time, so nobody is charged the wrong figure
  };

  return (
    <View style={styles.screen}>
      <ScreenBackground />
      <TopBar onBack={() => router.back()} right={<StatusPill label={gateOpen ? `All ${members.length} stripes` : `${doneCount} of ${members.length} stripes`} complete={gateOpen} />} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
        {gateOpen ? (
          <Rise key="even" style={styles.titleBlock}>
            <ZText variant="title1" accessibilityRole="header">Stripes are even.{"\n"}Time to settle.</ZText>
          </Rise>
        ) : (
          <View style={styles.titleBlock}>
            <ZText variant="title1" accessibilityRole="header">Earn your stripes</ZText>
            <ZText variant="body" color={color.textSecondary}>Each stripe is someone who&apos;s done adding expenses.</ZText>
          </View>
        )}

        {error ? <Banner dot="pink" style={styles.gutter}>{error}</Banner> : null}

        {/* the zebra stage: one stripe per member who's Done */}
        <HeroCard style={styles.stage}>
          <Dance play={play.dance}>
            <Zebra variant="full" members={members.length} done={doneCount} mood={mood} size={244} animate={{ blink: true, swish: true }} accessibilityLabel={zebraLabel(mood, members.length, doneCount)} />
          </Dance>
          <Confetti play={play.confetti} style={StyleSheet.absoluteFill} />
        </HeroCard>

        {!gateOpen ? (
          <View style={styles.pills}>
            {members.map((m, i) => {
              const done = !!m.done_at;
              const isMe = m.user_id === me;
              return (
                <PersonPill
                  key={m.user_id}
                  name={isMe ? "You" : (m.display_name ?? "Member")}
                  done={done}
                  stripeIndex={done ? members.slice(0, i + 1).filter((x) => x.done_at).length : undefined}
                  bust={done ? <Zebra variant="bust" mood="happy" size={44} decorative /> : undefined}
                  onPress={isMe && !closed && !busyDone ? () => toggleDone(!myDone) : undefined}
                  action={nudgeMode && !done && !isMe ? (
                    <Button kind="nudge" label={nudged[m.user_id] ? "Nudged" : "Nudge"} loading={nudging === m.user_id} disabled={!!nudged[m.user_id] || !!nudging} onPress={() => nudgeMember(m.user_id, (m.display_name ?? "them").split(/\s+/)[0]!)} accessibilityLabel={`Nudge ${m.display_name ?? "this member"} to add their receipts`} />
                  ) : undefined}
                />
              );
            })}
          </View>
        ) : (
          <>
            {settlements.length === 0 ? (
              <Rise delay={250} style={styles.gutter}>
                <Card><ZText variant="headline">Everyone is even.</ZText><ZText variant="caption" color={color.textSecondary}>Nothing to settle on this Dazzle.</ZText></Card>
              </Rise>
            ) : null}

            {/* yours: volt-capped, the figure in amountL, one zip button each */}
            {mine.length > 0 ? (
              <Rise delay={250} style={styles.gutter}>
                <View style={styles.payCard}>
                  <View style={styles.payCap} />
                  <View style={styles.payBody}>
                    <View style={styles.payHeader}>
                      <View style={styles.flex}>
                        <ZText variant="overline" color={color.textMuted}>Your payments</ZText>
                        {allMinePaid
                          ? <ZText variant="amountL">All paid</ZText>
                          : <CountUp cents={mineLeftCents} variant="amountL" underlineColor={color.youOwe} fit />}
                        <ZText variant="caption" color={color.textSecondary}>
                          {allMinePaid ? `${mine.length === 1 ? "Your payment is" : `All ${mine.length} are`} marked paid.` : `${minePaidCount} of ${mine.length} marked paid.`}
                        </ZText>
                        {onePlatform ? (
                          <View style={styles.platformNote}>
                            <PlatformMark platform={onePlatform} size={16} />
                            <ZText variant="caption" color={color.textMuted}>
                              {mine.length === 1 ? `Opens in ${PLATFORM_SPECS[onePlatform].label}` : `Every one opens in ${PLATFORM_SPECS[onePlatform].label}`}
                            </ZText>
                          </View>
                        ) : null}
                      </View>
                      <Zebra variant="bust" size={84} mood={zebraMoodFor({ place: "payment", paid: allMinePaid }) ?? "hi"} animate={{ blink: true }} accessibilityLabel={allMinePaid ? "Zebra, love: all paid" : "Zebra, hi"} />
                    </View>
                    {mine.map((s) => {
                      const to = who(s.to_user);
                      const handles = handlesOf(s.to_user);
                      const platform = platformFor(s);
                      const paid = s.status !== "pending";
                      const amt = formatCents(s.amount_cents, cur);
                      const canSwitch = availablePlatforms(handles).length > 1;
                      return (
                        <View key={s.id} style={styles.payRow}>
                          {platform ? (
                            <PayZipButton
                              label={`Pay ${to} ${amt}`}
                              openingLabel={`Opening ${PLATFORM_SPECS[platform].label}…`}
                              paid={paid}
                              onPress={() => open(payLink(platform, handles[platform]!, s.amount_cents, trip.title, cur))}
                            />
                          ) : (
                            <Button kind="locked" label={`Pay ${to} ${amt}`} accessibilityLabel={`Pay ${to} ${amt}, unavailable: ${to} hasn't added a way to be paid yet`} />
                          )}
                          <View style={styles.payMeta}>
                            {platform ? (
                              <PlatformChip platform={platform} disabled={paid || !canSwitch} onPress={canSwitch && !paid ? () => setPicking(s.id) : undefined} />
                            ) : (
                              <ZText variant="caption" color={color.textMuted} style={styles.flex} numberOfLines={1}>{to} hasn&apos;t added a way to be paid yet</ZText>
                            )}
                            {platform ? (
                              <ZText variant="caption" color={color.textMuted} style={styles.flex} numberOfLines={1}>{formatHandle(platform, handles[platform]!)}</ZText>
                            ) : null}
                            {s.status === "confirmed"
                              ? <ZText variant="captionStrong">{to} confirmed</ZText>
                              : <TextLink label={paid ? "Undo" : platform ? "Mark as paid" : "Paid another way"} muted={paid} onPress={() => mark(s.id, paid ? "unmark" : "mark_paid")} />}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </View>
              </Rise>
            ) : null}

            {/* everyone else's: quieter, with the recipient's mark, struck off as they land */}
            {remaining.length > 0 ? (
              <Rise delay={mine.length ? 350 : 250} style={styles.gutter}>
                <Card style={styles.listCard}>
                  <View style={styles.listHead}>
                    <ZText variant="overline" color={color.textMuted}>Remaining zebras</ZText>
                    <ZText variant="caption" color={color.textSecondary}>
                      {remainingOpen === 0 ? "Everyone else has marked theirs paid." : `${remainingOpen} of ${remaining.length} still to pay. They cross off as people mark them paid.`}
                    </ZText>
                  </View>
                  {remaining.map(({ s, toMe }, i) => {
                    const platform = platformFor(s);
                    const paid = s.status !== "pending";
                    const title = toMe ? `${who(s.from_user)} pays you` : `${who(s.from_user)} pays ${who(s.to_user)}`;
                    const status = s.status === "pending" ? "Not marked paid yet" : s.status === "confirmed" ? (toMe ? "You confirmed" : "Confirmed") : "Marked paid";
                    const tone = paid ? color.textMuted : toMe ? color.text : color.textSecondary;
                    return (
                      <View key={s.id} style={[styles.listRow, styles.listRule, paid ? styles.rowPaid : null]} accessibilityLabel={`${title} ${formatCents(s.amount_cents, cur)}, ${status}`}>
                        {platform ? <PlatformMark platform={platform} size={20} /> : <View style={styles.markGap} />}
                        <View style={styles.flex}>
                          <ZText variant={toMe ? "bodyStrong" : "body"} color={tone} style={paid ? styles.struck : null} numberOfLines={1}>{title}</ZText>
                          <ZText variant="small" color={color.textMuted}>{status}</ZText>
                        </View>
                        <ZText variant="amountRow" tabular color={tone} style={paid ? styles.struck : null}>{formatCents(s.amount_cents, cur)}</ZText>
                        {toMe && s.status === "marked_paid" ? <Button kind="secondary" onWhite height={size.pillSmall} label="Got it" onPress={() => mark(s.id, "confirm")} /> : null}
                      </View>
                    );
                  })}
                </Card>
              </Rise>
            ) : null}

            <Rise delay={350} style={styles.gutter}>
              <Press onPress={() => router.push(`/(app)/trip/${trip.id}/recap`)} scaleTo={0.98} accessibilityRole="button" accessibilityLabel="We earned our stripes. Share the recap?">
                <InsetPanel tone="blush" style={styles.recapNudge}>
                  <ZText variant="label" color={color.youOweText}>We earned our stripes. Share the recap?</ZText>
                  <Icon name="chevronRight" size={16} color={color.youOweText} />
                </InsetPanel>
              </Press>
            </Rise>

            <Rise delay={450} style={styles.gutter}>
              <Card style={styles.settledCard}>
                <View style={styles.settledRow}>
                  <ZText variant="bodyStrong" style={styles.flex}>Settled up</ZText>
                  <Toggle value={settledUp} onChange={toggleSettledUp} disabled={settling} label="Settled up" />
                </View>
                <ZText variant="caption" color={color.textSecondary}>Turn this on once you&apos;ve paid and been paid for this Dazzle. It marks your payments paid and quiets the expenses.</ZText>
                <ZText variant="caption" color={color.textMuted}>Venmo, Cash App and PayPal do the paying. Zebrasplit only prepares each payment and can&apos;t see whether it went through, so mark each one paid yourself. Recipients can tap Got it to confirm, but they don&apos;t have to.</ZText>
              </Card>
            </Rise>
          </>
        )}
      </ScrollView>

      {/* footer */}
      {!gateOpen ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + layout.bottomCtaPadding }]}>
          {isOwner && !closed ? (
            // creator only: force every remaining member Done (confirmed below)
            <View style={styles.forceRow}>
              <View style={styles.flex}>
                <ZText variant="bodyStrong">Close out remaining zebras</ZText>
                <ZText variant="small" color={color.textMuted}>Marks the {toGo} still adding as Done and tells them.</ZText>
              </View>
              <Toggle value={false} onChange={() => setConfirmSkip(true)} disabled={closingOut} label="Close out remaining zebras" />
            </View>
          ) : null}
          <Button kind="locked" label={`Close out at ${members.length} stripes · ${toGo} to go`} accessibilityLabel={`Close out, locked, ${toGo} still adding expenses`} />
        </View>
      ) : requestPlan.mode !== "none" ? (
        <Rise delay={450} style={[styles.footer, { paddingBottom: insets.bottom + layout.bottomCtaPadding }]}>
          <Button label={requestLabel} right={<Icon name="arrowUpRight" size={18} />} onPress={request} />
        </Rise>
      ) : null}

      {/* different amounts can't share one Venmo charge, so they go one at a time */}
      <ActionSheet
        open={requesting}
        onClose={() => setRequesting(false)}
        title="Venmo can only request one amount at a time, so these go one by one."
        actions={requestable.map((d) => ({ label: `Request ${formatCents(d.amountCents, cur)} from ${who(d.from)}`, onPress: () => requestOne(d) }))}
      />

      <ActionSheet
        open={confirmSkip}
        onClose={() => setConfirmSkip(false)}
        title={`Close out the remaining ${toGo === 1 ? "zebra" : "zebras"}? Everyone still adding is marked Done and notified, the override is logged, and expenses already logged still count.`}
        actions={[{ label: "Close out for everyone", destructive: true, onPress: closeOutRemaining }]}
      />

      {/* changing the platform for one payment: only the ones that person has actually added */}
      {(() => {
        const s = picking ? mine.find((x) => x.id === picking) : null;
        if (!s) return null;
        const to = who(s.to_user);
        const handles = handlesOf(s.to_user);
        const current = platformFor(s);
        return (
          <ActionSheet
            open
            onClose={() => setPicking(null)}
            title={`How do you want to pay ${to}?`}
            actions={availablePlatforms(handles).map((p) => ({
              label: p === current ? `${PLATFORM_SPECS[p].label} · ${formatHandle(p, handles[p]!)} (using)` : `${PLATFORM_SPECS[p].label} · ${formatHandle(p, handles[p]!)}`,
              onPress: () => pickPlatform(s.id, p),
            }))}
          />
        );
      })()}

      {/* Settled up: the zebra rears, neighs, spins, gallops off, and we land on Home */}
      <ZebraFarewell play={farewell} onDone={() => router.replace("/(app)/home")} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bgMid },
  flex: { flex: 1 },
  content: { gap: space[12] },
  gutter: { marginHorizontal: layout.screenGutter },
  titleBlock: { paddingHorizontal: layout.textGutter, paddingTop: space[2], gap: space[4] },
  stage: { marginHorizontal: layout.screenGutter, backgroundColor: color.surfaceTranslucentStrong, alignItems: "center", paddingVertical: space[6], paddingHorizontal: space[10], overflow: "hidden" },
  pills: { paddingHorizontal: layout.screenGutter, gap: space[8] },
  // yours: a volt cap across the top of the card, so the two halves never read alike
  payCard: { backgroundColor: palette.white, borderRadius: radius.card, overflow: "hidden", ...shadow.card },
  payCap: { height: 6, backgroundColor: palette.volt },
  payBody: { gap: space[14], paddingVertical: 16, paddingHorizontal: layout.cardPadding },
  payHeader: { flexDirection: "row", alignItems: "flex-end", gap: space[12] },
  platformNote: { flexDirection: "row", alignItems: "center", gap: space[6], paddingTop: space[2] },
  payRow: { gap: space[8], paddingTop: space[12], borderTopWidth: 1, borderTopColor: color.divider },
  payMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[12], paddingHorizontal: space[4] },
  listCard: { paddingVertical: space[2] },
  listHead: { paddingVertical: 10, gap: space[2] },
  listRow: { flexDirection: "row", alignItems: "center", gap: space[12], paddingVertical: 12 },
  listRule: { borderTopWidth: 1, borderTopColor: color.divider },
  rowPaid: { opacity: 0.6 },
  struck: { textDecorationLine: "line-through" },
  markGap: { width: 20 },
  recapNudge: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[8], borderRadius: radius.inset + 4, paddingVertical: 12, paddingHorizontal: 16 },
  settledCard: { gap: space[8] },
  settledRow: { flexDirection: "row", alignItems: "center", gap: space[12] },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: layout.screenGutter, paddingTop: space[10], gap: space[4], backgroundColor: color.surfaceTranslucentStrong, borderTopLeftRadius: radius.hero, borderTopRightRadius: radius.hero, ...shadow.sheet },
  forceRow: { flexDirection: "row", alignItems: "center", gap: space[12], paddingHorizontal: space[4], paddingBottom: space[6], minHeight: layout.minTapTarget },
});
