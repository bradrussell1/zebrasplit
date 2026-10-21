// Google Play store assets, rendered from the same icon source as the app.
//   play/icon-512.png        512x512 app icon (Play requires exactly this)
//   play/feature-1024x500.png the feature graphic shown at the top of the listing
// Usage: node scripts/make-play-assets.mjs
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const sharp = require("sharp");
const opentype = require("opentype.js");

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

/**
 * The type is drawn as outlines, not as text.
 *
 * Both of the obvious routes fail here. librsvg ignores an @font-face data URI, so
 * SVG text silently falls back. sharp's own text renderer goes through pango, which
 * resolves a font description through fontconfig — and on a machine with no
 * /etc/fonts/fonts.conf (every macOS box without Homebrew's fontconfig) it resolves
 * NOTHING: I rendered the same string with Figtree ExtraBold, Figtree Regular and IBM
 * Plex Mono as `fontfile` and got byte-identical PNGs, and the same again for
 * Helvetica, Courier and Times. `fontfile` is ignored outright. That is how a
 * not-Figtree wordmark shipped into a store asset without anyone noticing: it still
 * looks like a wordmark.
 *
 * So we read the TTF and emit real glyph outlines. No system font stack, no
 * fontconfig, and the same bytes on any machine.
 */
const face = (p) => opentype.parse(fs.readFileSync(require.resolve(p)).buffer);
const EXTRABOLD = face("@expo-google-fonts/figtree/800ExtraBold/Figtree_800ExtraBold.ttf");
const SEMIBOLD = face("@expo-google-fonts/figtree/600SemiBold/Figtree_600SemiBold.ttf");

/** Glyph outlines at `size` px, with tracking in em, as a transparent PNG. */
async function type(font, text, size, { tracking = 0, fill = INK, opacity = 1 } = {}) {
  const scale = size / font.unitsPerEm;
  const track = tracking * size;
  let x = 0;
  const parts = [];
  for (const glyph of font.stringToGlyphs(text)) {
    const d = glyph.getPath(x, size, size).toPathData(3);
    // opentype.js emits NaN coordinates when the pen position carries float noise:
    // x = 101.925 is fine, x = 101.92500000000001 is not. One NaN kills the rest of
    // the path, which is why the tagline rendered as "Split the t". Round the pen each
    // step — a thousandth of a pixel is far below anything that can be seen.
    if (d.includes("NaN")) throw new Error(`NaN in the outline for "${glyph.name}" at x=${x}`);
    parts.push(d);
    x = Math.round((x + glyph.advanceWidth * scale + track) * 1000) / 1000;
  }
  const w = Math.ceil(x - track) + 2;
  const h = Math.ceil(size * 1.35);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`
    + `<path d="${parts.join(" ")}" fill="${fill}" fill-opacity="${opacity}"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// the wordmark is always lowercase, tracked -0.03em (siteText.wordmark)
const title = await type(EXTRABOLD, "zebrasplit", 92, { tracking: -0.03 });
const tagline = await type(SEMIBOLD, "Split the trip. Keep it black and white.", 25, { opacity: 0.78 });

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
