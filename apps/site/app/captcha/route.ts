import { NextResponse } from "next/server";

/**
 * The Turnstile page the mobile app loads in a hidden WebView before any request that
 * makes Supabase send a text (sign-up, a login code, a password-reset code) or checks a
 * password. Cloudflare has no native SDK: the widget must run on a page served from an
 * allowed hostname, and this is that page. It talks to the app with postMessage:
 *   ready | disabled | token {token} | interactive | done-interactive | expired | error {code}
 * and the app asks for a fresh token by calling window.__zs.execute().
 *
 * With TURNSTILE_SITE_KEY unset the page answers "disabled" and the app sends no token,
 * which is also what to do if Cloudflare ever has an outage: clear the key here and
 * switch captcha off in Supabase (Auth → Attack protection), no build needed.
 */
export const dynamic = "force-dynamic";

const html = (siteKey: string) => `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<title>Zebrasplit</title>
<style>html,body{margin:0;height:100%;background:transparent}body{display:flex;align-items:center;justify-content:center}</style>
<script>
(function () {
  var KEY = ${JSON.stringify(siteKey)};
  var id = null;
  function send(m) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  if (!KEY) { window.onTurnstileLoad = function () {}; send({ type: "disabled" }); return; }
  window.onTurnstileLoad = function () {
    try {
      id = turnstile.render("#w", {
        sitekey: KEY,
        execution: "execute",
        appearance: "interaction-only",
        theme: "light",
        callback: function (t) { send({ type: "token", token: t }); },
        "error-callback": function (c) { send({ type: "error", code: String(c) }); return true; },
        "expired-callback": function () { send({ type: "expired" }); },
        "timeout-callback": function () { send({ type: "error", code: "timeout" }); },
        "before-interactive-callback": function () { send({ type: "interactive" }); },
        "after-interactive-callback": function () { send({ type: "done-interactive" }); }
      });
      send({ type: "ready" });
    } catch (e) { send({ type: "error", code: "render:" + e }); }
  };
  window.__zs = {
    execute: function () {
      if (id === null) { send({ type: "error", code: "not-ready" }); return; }
      try { turnstile.reset(id); turnstile.execute(id); } catch (e) { send({ type: "error", code: "execute:" + e }); }
    }
  };
})();
</script>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad" async defer></script>
</head><body><div id="w"></div></body></html>`;

export function GET() {
  return new NextResponse(html(process.env.TURNSTILE_SITE_KEY ?? ""), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      // only Cloudflare's challenge may run here; nothing may frame it
      "Content-Security-Policy": [
        "default-src 'none'",
        "script-src 'unsafe-inline' https://challenges.cloudflare.com",
        "frame-src https://challenges.cloudflare.com",
        "connect-src https://challenges.cloudflare.com",
        "img-src https://challenges.cloudflare.com data:",
        "style-src 'unsafe-inline'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join("; "),
    },
  });
}
