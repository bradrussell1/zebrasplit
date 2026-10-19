import { normalizeHandle, PAY_PLATFORMS, type Handles, type PayPlatform } from "@bunktab/core";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * The signed-in user's payment handles (Venmo, Cash App, PayPal).
 *
 * These are the addresses other people pay *to*, so they live on the recipient:
 * a payer can only be routed to a platform the person they owe has registered.
 * Writing a venmo row keeps the legacy `users.venmo_username` in step through a
 * database trigger, so the web guest view needs no change.
 */
export type MyPayments = { handles: Handles; defaultPlatform: PayPlatform | null };

export async function fetchMyPayments(userId: string): Promise<MyPayments> {
  const [h, u] = await Promise.all([
    supabase.from("payment_handles").select("platform, handle").eq("user_id", userId),
    supabase.from("users").select("default_pay_platform").eq("id", userId).maybeSingle(),
  ]);
  const handles = Object.fromEntries(((h.data ?? []) as { platform: PayPlatform; handle: string }[]).map((r) => [r.platform, r.handle])) as Handles;
  return { handles, defaultPlatform: (u.data?.default_pay_platform as PayPlatform | null) ?? null };
}

/** Upsert one handle. Returns the error message, or null when it saved. */
export async function saveHandle(userId: string, platform: PayPlatform, raw: string): Promise<string | null> {
  const handle = normalizeHandle(platform, raw);
  if (!handle) return "Add a handle first.";
  const { error } = await supabase.from("payment_handles").upsert({ user_id: userId, platform, handle, updated_at: new Date().toISOString() }, { onConflict: "user_id,platform" });
  return error ? error.message : null;
}

export async function removeHandle(userId: string, platform: PayPlatform): Promise<string | null> {
  const { error } = await supabase.from("payment_handles").delete().eq("user_id", userId).eq("platform", platform);
  return error ? error.message : null;
}

export async function setDefaultPlatform(userId: string, platform: PayPlatform): Promise<string | null> {
  const { error } = await supabase.from("users").update({ default_pay_platform: platform }).eq("id", userId);
  return error ? error.message : null;
}

/** Load-and-edit for the settings and onboarding screens. */
export function useMyPayments(userId: string | undefined) {
  const [data, setData] = useState<MyPayments>({ handles: {}, defaultPlatform: null });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    const next = await fetchMyPayments(userId).catch(() => ({ handles: {}, defaultPlatform: null } as MyPayments));
    setData(next);
    setLoading(false);
  }, [userId]);

  useEffect(() => { reload(); }, [reload]);

  return { ...data, loading, reload };
}

/** True once at least one platform is registered — the onboarding gate. */
export const hasAnyHandle = (handles: Handles) => PAY_PLATFORMS.some((p) => !!handles[p]);
