// The category palette is for charts and nothing else (decision A14 in
// docs/ZEBRASPLIT_HERD_STORIES_PROMPT.md). It is the only place in Zebrasplit where a
// colour carries meaning rather than brand, and the moment one of these seven leaks onto
// a button, a pill or an outfit the product stops reading as two accents on warm paper.
//
// So: `chart` may be imported from @bunktab/theme, and `theme.chart.*` / `chart.*` may be
// read, only inside a charts directory. Everything else fails this check. The palette's
// own definition in packages/theme is exempt, as is this script.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(import.meta.url), "../..");
const roots = ["apps", "packages"];
const skipDirs = new Set(["node_modules", ".next", ".expo", "dist", "build", "public", "assets", ".vercel", "android", "ios"]);
/** Where the palette is allowed to be read. */
const allowed = (rel) => rel.includes(`${sep}ui${sep}charts${sep}`) || rel.startsWith(`packages${sep}theme${sep}`);

// `chart` named-imported from the theme, or any `theme.chart.x` / `chart.x` read
const importsChart = /import\s*\{[^}]*\bchart\b[^}]*\}\s*from\s*["']@bunktab\/theme["']/;
const readsChart = /\b(?:theme\.)?chart\.[a-z]/i;

const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const rel = relative(root, p);
    if (statSync(p).isDirectory()) { if (!skipDirs.has(name)) walk(p); continue; }
    if (!/\.(tsx?|mjs|js)$/.test(name) || allowed(rel) || rel === join("scripts", "check-chart-tokens.mjs")) continue;
    readFileSync(p, "utf8").split("\n").forEach((line, i) => {
      if (importsChart.test(line) || readsChart.test(line)) {
        hits.push(`${rel.split(sep).join("/")}:${i + 1}: ${line.trim().slice(0, 120)}`);
      }
    });
  }
}
for (const r of roots) walk(join(root, r));

if (hits.length) {
  console.error(
    `check-chart-tokens: the category palette is chart-only (A14). ${hits.length} use(s) outside a ui/charts directory:\n  ` +
    hits.join("\n  "),
  );
  process.exit(1);
}
console.log("check-chart-tokens: the category palette is only read inside ui/charts");
