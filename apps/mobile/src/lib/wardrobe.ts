import { normalizeOutfit, type Outfit, type OutfitSlot } from "@bunktab/core";
import { useCallback, useEffect, useRef, useState } from "react";
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
  /**
   * The equipped outfit, readable synchronously.
   *
   * `equip` has to send all three slots, because set_outfit replaces the row rather
   * than patching it. It can't read `outfit` from its own closure — the callback has
   * no deps, so that would be the first render's value — and it can't read it out of a
   * setState updater either: React only runs those eagerly when the fiber has no
   * pending work, and the screen sets a busy flag immediately before calling this, so
   * it never does. Reading from a ref is the only version that is right every time.
   */
  const current = useRef<Outfit>({});
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
    const worn2 = normalizeOutfit(worn.data as Outfit | null);
    current.current = worn2;
    setOutfit(worn2);
    setError(worn.error ? worn.error.message : null);
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const equip = useCallback(async (slot: OutfitSlot, id: string | null) => {
    const prev = current.current;
    const next = { ...prev, [slot]: id } as Outfit;
    current.current = next;
    setOutfit(next);
    const { error: e } = await supabase.rpc("set_outfit", {
      p_head: next.head ?? null, p_faceneck: next.faceneck ?? null, p_body: next.body ?? null,
    });
    if (e) { current.current = prev; setOutfit(prev); return e.message; }
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
