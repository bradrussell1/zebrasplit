import { color, layout, radius, space } from "@bunktab/theme";
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Platform, StyleSheet, View } from "react-native";
import type { WebView } from "react-native-webview";
import { CaptchaWebView } from "./captcha-webview";
import { TextLink } from "@/ui";

/**
 * Cloudflare Turnstile for the requests that make Supabase send a text or check a
 * password: sign-up, a login code, a resend, a password-reset code, a password login.
 * Each of those costs money or guesses at an account, and all of them are reachable
 * with no session, so a script could run them all day. With captcha switched on in
 * Supabase (Auth → Attack protection) a request without a valid token is refused.
 *
 * There is no native SDK: the widget lives on zebrasplit.com/captcha, loaded here in a
 * WebView that is kept off-screen and only shown if Cloudflare decides it needs the
 * person to tap a checkbox (rare: VPNs, emulators, brand-new devices). The user sees
 * nothing otherwise, and nothing new is asked of them during onboarding.
 *
 * getToken() never throws and never blocks for long: if the page is slow, errors, or
 * reports itself disabled, it resolves undefined and the request goes out untokened,
 * leaving the server to decide. That is also the kill switch: clear TURNSTILE_SITE_KEY on
 * the site and turn captcha off in Supabase, and every build in the wild carries on.
 * Tokens are single-use and short-lived, so a fresh one is fetched per request.
 */
type Msg =
  | { type: "ready" } | { type: "disabled" } | { type: "token"; token: string } | { type: "interactive" }
  | { type: "done-interactive" } | { type: "expired" } | { type: "error"; code?: string };

const url = process.env.EXPO_PUBLIC_CAPTCHA_URL ?? "https://zebrasplit.com/captcha";
const enabled = Platform.OS !== "web" && !!CaptchaWebView && url !== "off" && /^https:\/\//.test(url);
const READY_MS = 6000;     // page + Cloudflare script
const SILENT_MS = 12000;   // an invisible pass normally takes well under a second
const INTERACTIVE_MS = 120000;

type GetToken = () => Promise<string | undefined>;
const Ctx = createContext<GetToken>(async () => undefined);
export const useCaptcha = (): GetToken => useContext(Ctx);

export function CaptchaProvider({ children }: { children: ReactNode }) {
  const web = useRef<WebView>(null);
  const [mounted, setMounted] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [generation, setGeneration] = useState(0); // bumped to reload the page after a load failure
  const ready = useRef(false);
  const disabled = useRef(false);
  const failed = useRef(false);
  const readyWaiters = useRef<Array<() => void>>([]);
  const pending = useRef<{ resolve: (t: string | undefined) => void; timer: ReturnType<typeof setTimeout> } | null>(null);

  const finish = useCallback((token: string | undefined) => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    clearTimeout(p.timer);
    setInteractive(false);
    p.resolve(token);
  }, []);

  const arm = useCallback((resolve: (t: string | undefined) => void, ms: number) => {
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = { resolve, timer: setTimeout(() => finish(undefined), ms) };
  }, [finish]);

  const flushReady = useCallback(() => { const w = readyWaiters.current; readyWaiters.current = []; w.forEach((f) => f()); }, []);

  const onMessage = useCallback((raw: string) => {
    let m: Msg;
    try { m = JSON.parse(raw) as Msg; } catch { return; }
    switch (m.type) {
      case "ready": ready.current = true; failed.current = false; flushReady(); break;
      case "disabled": disabled.current = true; flushReady(); finish(undefined); break;
      case "token": finish(m.token); break;
      case "interactive": // Cloudflare wants a tap: show the widget and give the person time
        if (pending.current) { const r = pending.current.resolve; arm(r, INTERACTIVE_MS); setInteractive(true); }
        break;
      case "done-interactive": break; // the token (or error) follows on its own
      case "expired": case "error": finish(undefined); break;
    }
  }, [arm, finish, flushReady]);

  const onLoadFailed = useCallback(() => { ready.current = false; failed.current = true; flushReady(); finish(undefined); }, [finish, flushReady]);

  const getToken = useCallback<GetToken>(async () => {
    if (!enabled || disabled.current) return undefined;
    if (pending.current) finish(undefined); // one at a time; the newer request wins
    if (!mounted) setMounted(true);
    else if (failed.current) { failed.current = false; ready.current = false; setGeneration((g) => g + 1); }
    if (!ready.current) {
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => { readyWaiters.current = readyWaiters.current.filter((f) => f !== done); resolve(); }, READY_MS);
        const done = () => { clearTimeout(t); resolve(); };
        readyWaiters.current.push(done);
      });
      if (!ready.current || disabled.current) return undefined;
    }
    return new Promise<string | undefined>((resolve) => {
      arm(resolve, SILENT_MS);
      web.current?.injectJavaScript("window.__zs && window.__zs.execute(); true;");
    });
  }, [arm, finish, mounted]);

  const Web = CaptchaWebView;
  return (
    <Ctx.Provider value={getToken}>
      {children}
      {enabled && mounted && Web ? (
        <View style={interactive ? styles.scrim : styles.hidden} pointerEvents={interactive ? "auto" : "none"}>
          <View style={interactive ? styles.card : styles.slot}>
            <Web
              key={generation}
              ref={web}
              source={{ uri: url }}
              style={styles.web}
              originWhitelist={["https://*"]}
              javaScriptEnabled
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              scrollEnabled={false}
              bounces={false}
              setSupportMultipleWindows={false}
              onMessage={(e) => onMessage(e.nativeEvent.data)}
              onError={onLoadFailed}
              onHttpError={onLoadFailed}
            />
            {interactive ? <TextLink label="Cancel" muted style={styles.cancel} onPress={() => finish(undefined)} /> : null}
          </View>
        </View>
      ) : null}
    </Ctx.Provider>
  );
}

// The Turnstile widget is 300 × 65; the slot keeps that size so a checkbox, if one is
// ever shown, is already laid out when the card appears.
const styles = StyleSheet.create({
  hidden: { position: "absolute", top: -1000, left: 0, width: 320, height: 90, opacity: 0 },
  slot: { width: 320, height: 90 },
  scrim: { ...StyleSheet.absoluteFill as object, backgroundColor: color.scrim, alignItems: "center", justifyContent: "center", padding: layout.screenGutter },
  card: { width: 320 + layout.cardPadding * 2, backgroundColor: color.surface, borderRadius: radius.card, padding: layout.cardPadding, alignItems: "center", gap: space[4] },
  web: { width: 320, height: 90, backgroundColor: "transparent" },
  cancel: { alignSelf: "center" },
});
