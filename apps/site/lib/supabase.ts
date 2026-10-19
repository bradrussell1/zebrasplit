import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client for the site's two signed-in-ish surfaces: the
 * feedback form (anonymous, one RPC) and the admin portal (a real session).
 *
 * The anon key is public by design — every table the portal touches is behind
 * row-level security, and every admin read goes through a function that checks
 * public.is_admin(). The page never decides who may see what.
 */
let client: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) throw new Error("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set");
  client = createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}
