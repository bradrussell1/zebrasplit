// Google Play store assets, rendered from the same icon source as the app.
//   play/icon-512.png        512x512 app icon (Play requires exactly this)
//   play/feature-1024x500.png the feature graphic shown at the top of the listing
// Usage: node scripts/make-play-assets.mjs
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const SRC = new URL("../design/brand/app-icon.svg", import.meta.url).pathname;
const OUT = new URL("../design/play", import.meta.url).pathname;
const VOLT = "#E2FF2B";
const INK = "#1D1A17";

fs.mkdirSync(OUT, { recursive: true });

const full = fs.readFileSync(SRC, "utf8");
const bare = full.replace(/<rect width="1024" height="1024" fill="#E2FF2B"\/>\s*/, "");
if (bare === full) throw new Error("could not strip the background rect — check the SVG");

// 1. app icon: 512x512, flattened onto the volt plate
await sharp(Buffer.from(full), { density: 600 }).resize(512, 512).flatten({ background: VOLT })
  .png().toFile(`${OUT}/icon-512.png`);

// 2. feature graphic: 1024x500. The zebra sits right of centre with the wordmark
//    and line to its left, so neither collides with the way Play crops this
//    image on narrow screens.
const zebra = await sharp(Buffer.from(bare), { density: 600 }).resize(430, 430, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

// Figtree ships with the app (@expo-google-fonts). librsvg ignores an @font-face
// data URI, so the type is drawn with sharp's own text renderer, which takes a
// font file directly — otherwise the wordmark silently falls back to Helvetica.
const ttf = (p) => require.resolve(p);
const render = (markup, font, file) =>
  sharp({ text: { text: markup, font, fontfile: ttf(file), rgba: true, dpi: 300 } }).png().toBuffer();

const title = await render(
  `<span foreground="${INK}" letter_spacing="-3000">zebrasplit</span>`,
  "Figtree ExtraBold 22",
  "@expo-google-fonts/figtree/800ExtraBold/Figtree_800ExtraBold.ttf",
);
const tagline = await render(
  `<span foreground="${INK}" alpha="78%">Split the trip. Keep it black and white.</span>`,
  "Figtree SemiBold 8.5",
  "@expo-google-fonts/figtree/600SemiBold/Figtree_600SemiBold.ttf",
);

await sharp({ create: { width: 1024, height: 500, channels: 4, background: VOLT } })
  .composite([
    { input: zebra, top: 35, left: 660 },
      { input: title, top: 168, left: 78 },
    { input: tagline, top: 282, left: 80 },
  ])
  .png().toFile(`${OUT}/feature-1024x500.png`);

for (const f of ["icon-512.png", "feature-1024x500.png"]) {
  const m = await sharp(`${OUT}/${f}`).metadata();
  console.log(f.padEnd(24), `${m.width}x${m.height}`, "alpha:", m.hasAlpha);
}
