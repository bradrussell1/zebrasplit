import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { supabase } from "./supabase";

/**
 * First-party analytics. Events go to public.client_events through log_event,
 * which allow-lists the names below server-side; props are numbers and enums
 * only, never names, phones, trip ids or typed amounts.
 *
 * Onboarding happens before there is a session, so those events are keyed by an
 * `anon_id` generated once per install and kept in AsyncStorage. It is a random
 * id and nothing else — it is not derived from the device, and it is never sent
 * with a signed-in event, so it cannot be used to join the two.
 *
 * Fire-and-forget: a failed insert is never surfaced to the user.
 */
export type OnboardingEvent =
  | "onboarding_landing_seen" | "onboarding_signup_started" | "onboarding_phone_entered"
  | "onboarding_code_sent" | "onboarding_code_verified" | "onboarding_profile_saved"
  | "onboarding_payment_added" | "onboarding_finished"
  | "login_started" | "login_succeeded";

export type ActivityEvent =
  | "trip_created" | "invite_sent" | "expense_added" | "done_tapped" | "closeout_opened" | "payment_opened";

export type ReceiptEvent =
  | "receipt_scan_started" | "receipt_read_ready" | "receipt_read_failed" | "receipt_line_edited"
  | "tip_selected" | "split_method_chosen" | "split_rest_used" | "receipt_expense_saved";

export type EventName = OnboardingEvent | ActivityEvent | ReceiptEvent;

const ONBOARDING = new Set<string>([
  "onboarding_landing_seen", "onboarding_signup_started", "onboarding_phone_entered",
  "onboarding_code_sent", "onboarding_code_verified", "onboarding_profile_saved",
  "onboarding_payment_added", "onboarding_finished", "login_started", "login_succeeded",
]);

const ANON_KEY = "zs.anon_id";
const version = Constants.expoConfig?.version ?? null;
let anonId: string | null = null;

/** One random id per install, so a signed-out funnel can be followed end to end. */
async function getAnonId(): Promise<string | null> {
  if (anonId) return anonId;
  try {
    const stored = await AsyncStorage.getItem(ANON_KEY);
    if (stored) { anonId = stored; return anonId; }
    const fresh = Crypto.randomUUID();
    await AsyncStorage.setItem(ANON_KEY, fresh);
    anonId = fresh;
    return anonId;
  } catch {
    return null; // storage unavailable: the event still lands, just unattributed
  }
}

export function track(name: EventName, props: Record<string, string | number | boolean | null> = {}): void {
  if (__DEV__) console.log("[track]", name, props);
  const send = (p_anon_id: string | null) =>
    supabase.rpc("log_event", { p_name: name, p_props: props, p_platform: Platform.OS, p_app_version: version, p_anon_id })
      .then(({ error }) => { if (error && __DEV__) console.warn("track", name, error.message); });

  if (ONBOARDING.has(name)) { getAnonId().then(send, () => send(null)); return; }
  send(null);
}

/** Clears the install id — called when an account is deleted. */
export async function forgetAnonId(): Promise<void> {
  anonId = null;
  try { await AsyncStorage.removeItem(ANON_KEY); } catch { /* nothing to clear */ }
}

/**
 * "Reached the app", fired once per install.
 *
 * Every route into an account ends at Home, but they do not share a last step:
 * a text-code account finishes on the profile screen, a sign-up does not go
 * near it. Counting the first arrival at Home is the one signal both have.
 */
const FINISHED_KEY = "zs.onboarding_finished";

export async function trackOnboardingFinishedOnce(): Promise<void> {
  try {
    if (await AsyncStorage.getItem(FINISHED_KEY)) return;
    await AsyncStorage.setItem(FINISHED_KEY, "1");
  } catch {
    return; // without storage this would fire on every launch, which is worse than not firing
  }
  track("onboarding_finished");
}
