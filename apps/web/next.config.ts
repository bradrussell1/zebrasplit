import type { NextConfig } from "next";
import path from "node:path";

// The same posture as zebrasplit.com (apps/site/next.config.ts). Since the guest view was
// retired this host serves three static policy pages and redirects, so the policy is
// tight: no scripts or connections beyond our own and Vercel Analytics, nothing may
// frame these pages (Twilio and Apple link to them as the official policies).
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // core and theme ship TypeScript source from the workspace; Next compiles them.
  transpilePackages: ["@bunktab/core", "@bunktab/theme"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  // the web guest view is retired (2026-10-27): a Dazzle is joined in the app, after
  // accepting the invite. Old invite and trip URLs go to the join page on the site.
  async redirects() {
    const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://zebrasplit.com").replace(/\/$/, "");
    return [
      { source: "/i/:token", destination: `${site}/join/:token`, permanent: false },
      { source: "/t/:path*", destination: site, permanent: false },
    ];
  },
};

export default nextConfig;
