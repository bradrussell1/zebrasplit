import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // core and theme ship TypeScript source from the workspace; Next compiles them.
  transpilePackages: ["@bunktab/core", "@bunktab/theme"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  reactStrictMode: true,
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
