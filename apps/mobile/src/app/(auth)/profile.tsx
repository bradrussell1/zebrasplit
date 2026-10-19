import { isValidHandle, isValidNamePart, joinName, normalizeHandle, PAY_PLATFORMS, PLATFORM_SPECS, splitName, zebraLabel, zebraMoodFor, type PayPlatform } from "@bunktab/core";
import { track } from "@/lib/analytics";
import { color, radius, space } from "@bunktab/theme";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AuthScreen, FormError } from "@/components/AuthScreen";
import { Avatar, Button, Icon, Input, Press, Zebra, ZText } from "@/ui";
import { useAuth } from "@/lib/auth";
import { pickImage, uploadImage } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { PlatformPills } from "@/components/PaymentMethods";
import { hasAnyHandle, saveHandle, setDefaultPlatform, useMyPayments } from "@/lib/payments";

/**
 * Profile step: first name, last name, optional photo (Avatar with a sand "+" tile),
 * and a required way to get paid (Venmo, Cash App or PayPal) when the account has
 * none yet. Shown on a first login with no name, and once
 * to an existing account that has no last name yet (feedback round 1, item 18): the
 * fields are prefilled from the display name. The zebra is hi until the profile saves,
 * then happy (login rule in zebraMoodFor).
 */
export default function ProfileScreen() {
  const { session, profile, refreshProfile } = useAuth();
  const uid = session!.user.id;
  const prefill = splitName(profile?.display_name);
  const [first, setFirst] = useState(profile?.first_name ?? prefill.first ?? "");
  const [last, setLast] = useState(profile?.last_name ?? prefill.last ?? "");
  const pay = useMyPayments(uid);
  const needsPayment = !pay.loading && !hasAnyHandle(pay.handles);
  const [payPlatform, setPayPlatform] = useState<PayPlatform>("venmo");
  const [payHandle, setPayHandle] = useState("");
  const [photo, setPhoto] = useState<string | null>(profile?.photo_url ?? null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mood = zebraMoodFor({ place: "login", profileSaved: saved }) ?? "hi";
  const completing = !!profile?.display_name; // an existing account asked for its last name

  async function changePhoto() {
    setError(null);
    const uri = await pickImage([1, 1]);
    if (!uri) return;
    setPhotoBusy(true);
    try {
      const url = await uploadImage("avatars", `${uid}/avatar.jpg`, uri);
      const { error: e } = await supabase.from("users").update({ photo_url: url }).eq("id", uid);
      if (e) throw e;
      setPhoto(url);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't upload the photo."); }
    setPhotoBusy(false);
  }

  async function save() {
    if (!isValidNamePart(first)) { setError("Enter your first name."); return; }
    if (!isValidNamePart(last)) { setError("Enter your last name."); return; }
    // only asked for when the account has no way to be paid at all
    if (needsPayment) {
      if (!payHandle.trim()) { setError(`Add your ${PLATFORM_SPECS[payPlatform].label} ${PLATFORM_SPECS[payPlatform].handleLabel} so friends can pay you.`); return; }
      if (!isValidHandle(payPlatform, payHandle)) { setError(`That doesn't look like a ${PLATFORM_SPECS[payPlatform].label} ${PLATFORM_SPECS[payPlatform].handleLabel}.`); return; }
    }
    setBusy(true); setError(null);
    const f = first.trim(), l = last.trim();
    const { error: e } = await supabase.from("users").update({ first_name: f, last_name: l, display_name: joinName(f, l) }).eq("id", uid);
    if (e) { setBusy(false); setError(e.message); return; }
    if (needsPayment) {
      const pe = (await saveHandle(uid, payPlatform, normalizeHandle(payPlatform, payHandle))) ?? (await setDefaultPlatform(uid, payPlatform));
      if (pe) { setBusy(false); setError(pe); return; }
    }
    setBusy(false);
    track("onboarding_profile_saved");
    if (needsPayment) track("onboarding_payment_added");
    setSaved(true);
    // let the happy zebra land before the root layout moves on
    setTimeout(() => { refreshProfile(); }, 600);
  }

  return (
    <AuthScreen
      hero={<Zebra variant="full" mood={mood} size={176} animate={{ blink: true, bob: true }} accessibilityLabel={zebraLabel(mood)} />}
      title={completing ? "One more thing" : "Almost there"}
      lead={completing ? "Zebrasplit now shows first names and last initials on a Dazzle. Add your last name so your crew knows which Sam you are." : "How should your Dazzle see you, and where should they send money?"}
      footer={
        <>
          <FormError>{error}</FormError>
          <Button label="Save and continue" onPress={save} loading={busy} />
        </>
      }
    >
      <Press onPress={changePhoto} disabled={photoBusy} scaleTo={0.98} accessibilityRole="button" accessibilityLabel={photo ? "Replace photo" : "Add a photo"} accessibilityState={{ busy: photoBusy }} style={styles.photoRow}>
        <View>
          <Avatar name={joinName(first, last) || "?"} uri={photo} size={72} />
          <View style={styles.plus} accessibilityElementsHidden><Icon name="plus" size={14} stroke={2.4} /></View>
        </View>
        <ZText variant="label" color={color.textSecondary}>{photoBusy ? "Uploading…" : photo ? "Replace photo" : "Add a photo (optional)"}</ZText>
      </Press>
      <View style={styles.names}>
        <Input label="First name" placeholder="Bradley" value={first} onChangeText={setFirst} autoCapitalize="words" textContentType="givenName" autoComplete="given-name" returnKeyType="next" style={styles.flex} />
        <Input label="Last name" placeholder="Russell" value={last} onChangeText={setLast} autoCapitalize="words" textContentType="familyName" autoComplete="family-name" returnKeyType="done" style={styles.flex} />
      </View>
      <View style={{ gap: space[4] }}>
        {needsPayment ? (
          <>
            <PlatformPills value={payPlatform} onChange={setPayPlatform} options={[...PAY_PLATFORMS]} />
            <Input
              label={`${PLATFORM_SPECS[payPlatform].label} ${PLATFORM_SPECS[payPlatform].handleLabel}`}
              placeholder={payPlatform === "paypal" ? "yourname" : `${PLATFORM_SPECS[payPlatform].prefix}yourname`}
              value={payHandle}
              onChangeText={setPayHandle}
              autoCapitalize="none"
              autoCorrect={false}
              helper="How friends pay you at close-out. You can add the others later."
              returnKeyType="done"
            />
          </>
        ) : null}
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  names: { flexDirection: "row", gap: space[10] },
  photoRow: { flexDirection: "row", alignItems: "center", gap: space[12], alignSelf: "flex-start" },
  plus: { position: "absolute", right: -2, bottom: -2, width: 26, height: 26, borderRadius: radius.pill, backgroundColor: color.surfaceTile, borderWidth: 2, borderColor: color.surface, alignItems: "center", justifyContent: "center" },
});
