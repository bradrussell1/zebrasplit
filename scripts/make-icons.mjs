// Render the icon set from the owner's 1024 SVG.
//   icon.png                     full bleed, opaque — iOS and the App Store
//   favicon.png                  the same mark, small
//   splash-icon.png              zebra only; the splash supplies the volt behind it
//   android-icon-foreground.png  zebra only, inside Android's safe zone
//   android-icon-background.png  flat volt
//   android-icon-monochrome.png  silhouette for themed icons
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

const SRC = new URL("../design/brand/app-icon.svg", import.meta.url).pathname;
const OUT = new URL("../apps/mobile/assets/images", import.meta.url).pathname;
const VOLT = "#E2FF2B";

const full = fs.readFileSync(SRC, "utf8");
// the same artwork without the volt plate behind it
const bare = full.replace(/<rect width="1024" height="1024" fill="#E2FF2B"\/>\s*/, "");
if (bare === full) throw new Error("could not strip the background rect — check the SVG");

const svg = (s) => Buffer.from(s);
const render = (s, size, density = 600) => sharp(svg(s), { density }).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } });

// 1. iOS / App Store: opaque, no alpha, no rounded corners (Apple masks it)
await render(full, 1024).flatten({ background: VOLT }).png().toFile(`${OUT}/icon.png`);

// 2. web favicon
await render(full, 64).png().toFile(`${OUT}/favicon.png`);

// 3. splash: the zebra alone, the config paints the volt
await render(bare, 480).png().toFile(`${OUT}/splash-icon.png`);

// 4. Android adaptive foreground: the outer ~28% of an adaptive icon can be
//    cropped by the launcher's mask, so the mark sits inside the safe zone.
const inner = await render(bare, 620).png().toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: inner, gravity: "center" }])
  .png().toFile(`${OUT}/android-icon-foreground.png`);

// 5. Android adaptive background: flat volt
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: VOLT } })
  .png().toFile(`${OUT}/android-icon-background.png`);

// 6. Themed icon: the silhouette, which the launcher tints itself
const alpha = await sharp(inner).ensureAlpha().extractChannel("alpha").toBuffer();
const silhouette = await sharp({ create: { width: 620, height: 620, channels: 3, background: "#000000" } })
  .joinChannel(alpha).png().toBuffer();
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([{ input: silhouette, gravity: "center" }])
  .png().toFile(`${OUT}/android-icon-monochrome.png`);

for (const f of ["icon.png", "favicon.png", "splash-icon.png", "android-icon-foreground.png", "android-icon-background.png", "android-icon-monochrome.png"]) {
  const m = await sharp(`${OUT}/${f}`).metadata();
  console.log(f.padEnd(30), `${m.width}x${m.height}`, "alpha:", m.hasAlpha);
}
