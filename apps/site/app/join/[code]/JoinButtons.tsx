"use client";
import { Button } from "@/components/ui/Button";
import { StoreBadges, type StoreUrls } from "@/components/site/StoreBadges";
import { trackEvent } from "@/lib/analytics";
import s from "./join.module.css";

/** Join → the platform's store (or "Coming soon" pills). The invite is accepted in the app; there is no browser route in. */
export function JoinButtons({ storeHref, platform, urls }: { storeHref: string | null; platform: "ios" | "android" | "other"; urls: StoreUrls }) {
  return (
    <div className={s.actions}>
      {storeHref ? (
        <Button variant="primary" size="lg" full href={storeHref} onClick={() => trackEvent({ name: "join_cta_click", action: "join" })}>Join</Button>
      ) : platform === "other" && (urls.appStore || urls.playStore) ? (
        <StoreBadges urls={urls} location="join" size="lg" />
      ) : (
        <div className={s.coming}><StoreBadges urls={{ appStore: null, playStore: null }} location="join" only={platform === "other" ? undefined : platform} /></div>
      )}
    </div>
  );
}
