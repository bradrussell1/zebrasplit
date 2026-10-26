// Homepage alignment check: every element marked data-align="text" must share one left edge
// (the text line), every data-align="col2" one left edge above the split breakpoint, and the
// page must never scroll sideways. Run against a server: URL=http://localhost:3100 node scripts/check-alignment.mjs
// Playwright is resolved from node_modules, or from PLAYWRIGHT_MODULE (a path to the package) when
// it lives outside the repo, as it does on the build machine.
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
  const r = await p.evaluate(() => {
    const xs = (s) => [...document.querySelectorAll(s)].map((e) => [e.dataset.align + ":" + (e.id || e.textContent.trim().slice(0, 24)), Math.round(e.getBoundingClientRect().left)]);
    return { text: xs('[data-align="text"]'), col2: xs('[data-align="col2"]'), overflow: document.documentElement.scrollWidth - innerWidth };
  });
  const t = new Set(r.text.map(([, x]) => x));
  const c = new Set(r.col2.map(([, x]) => x));
  console.log(w, "text line", [...t], "col2", [...c], "overflow", r.overflow);
  if (t.size !== 1 || r.overflow > 0 || (w > 900 && c.size !== 1)) { fail = true; console.log(JSON.stringify(r, null, 1)); }
  await p.screenshot({ path: `alignment-${w}.png`, fullPage: true, animations: "disabled" });
  await p.close();
}
await b.close();
process.exit(fail ? 1 : 0);
