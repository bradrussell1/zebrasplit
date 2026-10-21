import { normalizeOutfit, type Outfit, type OutfitSlot } from "@bunktab/core";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * Your own wardrobe: what you own and what you're wearing.
 *
 * Ownership is readable only by its owner (user_cosmetics has a select policy for
 * auth.uid() and no insert policy at all), so this is the one place that reads it.
 * Equipping goes through set_outfit, which re-checks the slot and the ownership
 * server-side — the screen's own checks are only there to keep the UI honest.
 */
export type Wardrobe = {
  owned: Set<string>;
  outfit: Outfit;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Equip, or pass null to take the slot's item off. Optimistic, rolled back on failure. */
  equip: (slot: OutfitSlot, id: string | null) => Promise<string | null>;
};

export function useWardrobe(): Wardrobe {
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [outfit, setOutfit] = useState<Outfit>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) { setError("Sign in first"); setLoading(false); return; }
    const [mine, worn] = await Promise.all([
      supabase.from("user_cosmetics").select("cosmetic_id"),
      // scoped to me on purpose: user_outfit is readable for everyone you share a dazzle
      // with, so an unfiltered maybeSingle() sees the whole herd's rows and returns none
      supabase.from("user_outfit").select("head, faceneck, body").eq("user_id", uid).maybeSingle(),
    ]);
    if (mine.error) { setError(mine.error.message); setLoading(false); return; }
    setOwned(new Set((mine.data ?? []).map((r) => r.cosmetic_id as string)));
    setOutfit(normalizeOutfit(worn.data as Outfit | null));
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const equip = useCallback(async (slot: OutfitSlot, id: string | null) => {
    let rolledBack: Outfit | null = null;
    setOutfit((cur) => { rolledBack = cur; return { ...cur, [slot]: id }; });
    const next = { ...(rolledBack ?? {}), [slot]: id } as Outfit;
    const { error: e } = await supabase.rpc("set_outfit", {
      p_head: next.head ?? null, p_faceneck: next.faceneck ?? null, p_body: next.body ?? null,
    });
    if (e) { if (rolledBack) setOutfit(rolledBack); return e.message; }
    return null;
  }, []);

  return { owned, outfit, loading, error, reload, equip };
}

/**
 * Progress towards an earned item, for the tile's locked label. The two trip rules
 * count settled dazzles; the gift rule is server-side and has no client-visible
 * progress, so it reads as a plain instruction.
 */
export async function earnProgress(): Promise<{ settledTrips: number }> {
  const { count } = await supabase
    .from("trips")
    .select("id", { count: "exact", head: true })
    .eq("status", "settled");
  return { settledTrips: count ?? 0 };
}
