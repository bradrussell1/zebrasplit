// Homepage alignment check.
//   Left:  every data-align="text" element shares one left edge (the text line); every data-align="col2"
//          element shares one left edge above the split breakpoint; the page never scrolls sideways.
//   Right: every data-align-right="surface" element (and "surface-desktop" above 900px) shares one right
//          edge, the surface line, which the bands define; every data-align-right="text" element inside a
//          band shares one right edge, the right text line.
// Run against a server: URL=http://localhost:3100 node scripts/check-alignment.mjs
// Playwright is resolved from node_modules, or from PLAYWRIGHT_MODULE (a path to the package) when it
// lives outside the repo, as it does on the build machine.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pwPath = process.env.PLAYWRIGHT_MODULE ?? "playwright";
const { chromium } = await import(pwPath.startsWith("/") ? `${pwPath}/index.mjs` : pwPath).catch(() => require(pwPath));

const widths = [1440, 1280, 1024, 390];
const base = process.env.URL ?? "http://localhost:3100";
const b = await chromium.launch();
let fail = false;
for (const w of widths) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto(`${base}/`, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  const r = await p.evaluate((desktop) => {
    const label = (e) => e.tagName + ":" + (e.id || e.textContent.trim().slice(0, 20));
    const lefts = (s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent).map((e) => [label(e), Math.round(e.getBoundingClientRect().left)]);
    const rights = (s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent).map((e) => [label(e), Math.round(e.getBoundingClientRect().right)]);
    return {
      text: lefts('[data-align="text"]'),
      col2: lefts('[data-align="col2"]'),
      surface: rights(desktop ? '[data-align-right="surface"], [data-align-right="surface-desktop"]' : '[data-align-right="surface"]'),
      bandText: rights('[data-align-right="text"]'),
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  }, w > 900);
  const t = new Set(r.text.map(([, x]) => x));
  const c = new Set(r.col2.map(([, x]) => x));
  const s = new Set(r.surface.map(([, x]) => x));
  const bt = new Set(r.bandText.map(([, x]) => x));
  console.log(w, "text line", [...t], "col2", [...c], "| surface right", [...s], "band text right", [...bt], "| overflow", r.overflow);
  const leftOk = t.size === 1 && (w <= 900 || c.size === 1);
  const rightOk = s.size === 1 && (w <= 900 || bt.size === 1);
  if (!leftOk || !rightOk || r.overflow > 0) { fail = true; console.log(JSON.stringify(r, null, 1)); }
  await p.screenshot({ path: `alignment-${w}.png`, fullPage: true, animations: "disabled" });
  await p.close();
}
await b.close();
process.exit(fail ? 1 : 0);
