/** Server-side env access with the defaults the build prompt specifies. */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://zebrasplit.com").replace(/\/$/, "");
export const webAppUrl = (process.env.NEXT_PUBLIC_WEB_APP_URL ?? "https://app.zebrasplit.com").replace(/\/$/, "");
// The App Store listing went live on 2026-11-23, so it is the default; the env var still overrides it.
// Google Play has no listing yet: unset keeps its badge on "Coming soon".
export const appStoreUrl = process.env.NEXT_PUBLIC_APP_STORE_URL || "https://apps.apple.com/us/app/zebrasplit/id6818411520";
export const playStoreUrl = process.env.NEXT_PUBLIC_PLAY_STORE_URL || null;
export const appStoreId = process.env.APP_STORE_ID || "6818411520";
export const deepLink = {
  teamId: process.env.TEAM_ID || null,
  bundleId: process.env.BUNDLE_ID || null,
  androidPackage: process.env.ANDROID_PACKAGE || null,
  androidFingerprints: (process.env.ANDROID_SHA256_FINGERPRINTS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
};
