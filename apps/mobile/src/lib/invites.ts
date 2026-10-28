import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

/**
 * Invites are accepted, never auto-joined (user decision 2026-10-27). A pending invite
 * for my confirmed number shows under Invitations on Home and on the join screen a link
 * opens; both go through accept_invite_token / decline_invite. A link opened while
 * signed out is remembered on the device and reopened once the account is in.
 */
export type MyInvite = {
  id: string; token: string; trip_id: string; title: string; start_date: string; end_date: string;
  inviter: string; member_count: number; created_at: string; expires_at: string;
};

export async function fetchMyInvites(): Promise<MyInvite[]> {
  const { data } = await supabase.rpc("my_invites");
  return (data ?? []) as MyInvite[];
}

export async function acceptInvite(token: string): Promise<{ tripId: string } | { error: string }> {
  const { data, error } = await supabase.rpc("accept_invite_token", { p_token: token, p_via: "app" });
  if (error) return { error: inviteErrorMessage(error.message) };
  return { tripId: String(data) };
}

export async function declineInvite(token: string): Promise<string | null> {
  const { error } = await supabase.rpc("decline_invite", { p_token: token });
  return error ? inviteErrorMessage(error.message) : null;
}

export function inviteErrorMessage(message: string): string {
  if (message.includes("different number")) return "This invite was sent to a different phone number. Sign in with the number that got the text, or ask the organizer to invite this one.";
  if (message.includes("expired") || message.includes("not found")) return "This invite link has expired or was already used. Ask the organizer for a new one.";
  return message;
}

const PENDING = "zs.join.pending";
export async function rememberJoin(code: string): Promise<void> {
  await AsyncStorage.setItem(PENDING, code).catch(() => undefined);
}
export async function takePendingJoin(): Promise<string | null> {
  const code = await AsyncStorage.getItem(PENDING).catch(() => null);
  if (code) await AsyncStorage.removeItem(PENDING).catch(() => undefined);
  return code || null;
}
