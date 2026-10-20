// Port design/zebra/outfits/*.svg into one generated React Native component map.
//
// The masters are machine-drawn, all in the full-zebra space (viewBox 0 -8 320 330), and
// use a small, fixed vocabulary: g, path, rect, circle, ellipse, text, defs, clipPath.
// Hand-porting 32 of them would be 32 chances to mistype a path; this reads them instead,
// so re-running it after a redraw is the whole update.
//
// Three things it does beyond a literal translation:
//   - every colour becomes a theme token, so the generated file holds no hex literal
//   - every stroke-width is multiplied by `k`, the caller's stroke scale (the outline has
//     to thicken as a zebra shrinks into a herd, DESIGN_SYSTEM §7)
//   - `url(#body)`, which 10 torso items clip themselves to, becomes the `clip` prop, so
//     the Zebra can clip to the body path on the full form and the neck path on the bust
//
// react-native-svg has no `paint-order`, so a text node that asked for stroke-behind-fill
// is emitted twice: once stroked, once filled.
//
// Usage: node scripts/make-outfits.mjs
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = "design/zebra/outfits";
const OUT = "apps/mobile/src/ui/zebra/outfits.generated.tsx";
const CAT = "packages/core/src/outfits.generated.ts";

const COLOR = {
  "#1D1A17": "c.ink", "#FFFBF2": "c.hide", "#E2FF2B": "c.volt", "#FF4FA3": "c.pink",
  "#FFE4F1": "c.blush", "#3A3631": "c.shade", "#5C5852": "c.shadeSoft", "#FFFFFF": "white",
  "#2F6BFF": "c.team.blue", "#1FA463": "c.team.green", "#7A4DFF": "c.team.purple", "#F0443A": "c.team.red",
};
const TAG = { g: "G", path: "Path", rect: "Rect", circle: "Circle", ellipse: "Ellipse", text: "SvgText", clipPath: "ClipPath", defs: "Defs" };
const PROP = {
  "stroke-width": "strokeWidth", "stroke-linejoin": "strokeLinejoin", "stroke-linecap": "strokeLinecap",
  "stroke-opacity": "strokeOpacity", "stroke-dasharray": "strokeDasharray", "fill-opacity": "fillOpacity",
  "clip-path": "clipPath", "font-size": "fontSize", "font-weight": "fontWeight", "font-family": "fontFamily",
  "text-anchor": "textAnchor",
};
const NUMERIC = new Set(["x", "y", "width", "height", "rx", "ry", "cx", "cy", "r", "fontSize", "strokeOpacity", "fillOpacity"]);

/** Minimal tokenizer: these files are generated, so there is no CDATA, comment or entity. */
function parse(svg) {
  const body = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const nodes = [];
  const stack = [{ children: nodes }];
  const re = /<(\/?)([a-zA-Z]+)((?:\s+[a-zA-Z-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(body))) {
    const [, close, tag, attrText, selfClose, text] = m;
    const top = stack[stack.length - 1];
    if (text !== undefined) {
      const t = text.trim();
      if (t) top.children.push({ text: t });
      continue;
    }
    if (close) { stack.pop(); continue; }
    const attrs = {};
    for (const a of attrText.matchAll(/([a-zA-Z-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
    const node = { tag, attrs, children: [] };
    top.children.push(node);
    if (!selfClose) stack.push(node);
  }
  return nodes;
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? (Math.round(n * 1000) / 1000) : null; };

function emitAttrs(tag, attrs) {
  const out = [];
  let paintOrder = false;
  for (const [rawKey, rawVal] of Object.entries(attrs)) {
    if (rawKey === "id") continue;                      // ids are per-item and unused once inlined
    if (rawKey === "paint-order") { paintOrder = true; continue; }
    const key = PROP[rawKey] ?? rawKey;
    let val = rawVal;
    if (key === "clipPath") {
      if (val !== "url(#body)") throw new Error(`unexpected clip ${val}`);
      out.push("clipPath={clip}");
      continue;
    }
    if (key === "fontFamily") { out.push("fontFamily={black}"); continue; }
    if (key === "strokeWidth") { out.push(`strokeWidth={${num(val)} * k}`); continue; }
    if (key === "fill" || key === "stroke") {
      if (val === "none") { out.push(`${key}="none"`); continue; }
      const tok = COLOR[val.toUpperCase()];
      if (!tok) throw new Error(`unmapped colour ${val}`);
      out.push(`${key}={${tok}}`);
      continue;
    }
    if (NUMERIC.has(key)) { out.push(`${key}={${num(val)}}`); continue; }
    out.push(`${key}="${val}"`);
  }
  return { attrs: out, paintOrder };
}

function emit(node, depth) {
  const pad = "  ".repeat(depth);
  if (node.text !== undefined) return `${pad}{${JSON.stringify(node.text)}}`;
  const Tag = TAG[node.tag];
  if (!Tag) throw new Error(`unsupported element <${node.tag}>`);
  usedTags.add(Tag);
  const { attrs, paintOrder } = emitAttrs(node.tag, node.attrs);
  const kids = node.children.map((c) => emit(c, depth + 1)).join("\n");
  const open = attrs.length ? `<${Tag} ${attrs.join(" ")}>` : `<${Tag}>`;
  const one = kids ? `${pad}${open}\n${kids}\n${pad}</${Tag}>` : `${pad}<${Tag} ${attrs.join(" ")} />`;
  if (!paintOrder) return one;
  // paint-order: stroke, fill -> draw the stroked copy first, then the filled one
  const strokeOnly = attrs.filter((a) => !a.startsWith("fill=")).concat('fill="none"');
  const fillOnly = attrs.filter((a) => !a.startsWith("stroke"));
  return [
    `${pad}<${Tag} ${strokeOnly.join(" ")}>`, kids, `${pad}</${Tag}>`,
    `${pad}<${Tag} ${fillOnly.join(" ")}>`, kids, `${pad}</${Tag}>`,
  ].join("\n");
}

const manifest = JSON.parse(readFileSync(join(SRC, "manifest.json"), "utf8"));
// The hood is drawn by the hoodie rather than owned, so it has art but no catalogue row.
const SYNTHETIC = ["hood"];
const ids = manifest.items.map((i) => i.id);
const files = readdirSync(SRC).filter((f) => f.endsWith(".svg")).map((f) => f.replace(/\.svg$/, ""));
const missing = ids.filter((i) => !files.includes(i));
const extra = files.filter((f) => !ids.includes(f) && !SYNTHETIC.includes(f));
if (missing.length) throw new Error(`manifest lists items with no art: ${missing.join(", ")}`);
if (extra.length) throw new Error(`art with no manifest entry: ${extra.join(", ")}`);
const drawn = [...ids, ...SYNTHETIC.filter((f) => files.includes(f))];

const parts = [];
const usedTags = new Set();
let nodes = 0;
for (const id of drawn) {
  const svg = readFileSync(join(SRC, `${id}.svg`), "utf8");
  let tree = parse(svg);
  // drop each item's own <defs><clipPath id="body">: the Zebra owns the clip paths
  tree = tree.filter((n) => n.tag !== "defs");
  // unwrap the single <g id="<id>"> wrapper so the layer adds no group of its own
  if (tree.length === 1 && tree[0].tag === "g" && tree[0].attrs.id === id && Object.keys(tree[0].attrs).length === 1) {
    tree = tree[0].children;
  }
  nodes += JSON.stringify(tree).match(/"tag"/g)?.length ?? 0;
  const jsx = tree.map((n) => emit(n, 2)).join("\n");
  parts.push(`  ${JSON.stringify(id)}: ({ k, clip, black }) => (\n    <>\n${jsx}\n    </>\n  ),`);
}

const IMPORT_NAME = { SvgText: "Text as SvgText" };
const used = [...usedTags].sort().map((t) => IMPORT_NAME[t] ?? t);

const out = `// GENERATED by scripts/make-outfits.mjs from design/zebra/outfits/*.svg — do not edit.
// Re-run the script after a redraw. ${drawn.length} layers (${ids.length} wearable), ${nodes} drawn nodes.
//
// Every layer draws in the full-zebra master space (viewBox 0 -8 320 330); the bust is the
// same space cropped, so one drawing serves both forms. \`k\` scales every stroke so the
// outline thickens as a zebra shrinks; \`clip\` is the clip path torso items are held to
// (the body on a full zebra, the neck on a bust); \`black\` is the Figtree 900 face.
import type { ReactNode } from "react";
import { ${used.join(", ")} } from "react-native-svg";
import { outfit as c, palette } from "@bunktab/theme";

const white = palette.white;

export type OutfitLayerProps = { k: number; clip: string; black: string };
export type OutfitLayer = (p: OutfitLayerProps) => ReactNode;

export const OUTFIT_LAYERS: Record<string, OutfitLayer> = {
${parts.join("\n")}
};

export const OUTFIT_IDS = Object.keys(OUTFIT_LAYERS);
`;
writeFileSync(OUT, out);

// ── the catalog: data and rules, in core, so they can be tested without React ──
const LAYER_ORDER = { torso: 1, skirt: 2, hood: 3, throat: 4, face: 5, head: 6 };
const row = (i) => {
  const price = i.status === "paid" ? "0.99" : i.status === "free" ? null : null;
  const rule = i.status === "earned" ? String(i.price_or_rule).split(":")[0] : null;
  return `  { id: ${JSON.stringify(i.id)}, name: ${JSON.stringify(i.name)}, slot: ${JSON.stringify(i.slot)}, ` +
    `layer: ${JSON.stringify(i.layer)}, drawOrder: ${LAYER_ORDER[i.layer]}, clipped: ${i.clip ? "true" : "false"}, ` +
    `hidesHeadSlot: ${i.hides_head_slot ? "true" : "false"}, status: ${JSON.stringify(i.status)}, ` +
    `price: ${price ? JSON.stringify(price) : "null"}, earnRule: ${rule ? JSON.stringify(rule) : "null"}, ` +
    `packs: ${JSON.stringify(i.in_packs)} },`;
};
const packs = Object.entries(manifest.packs).map(([id, p]) =>
  `  { id: ${JSON.stringify(id)}, name: ${JSON.stringify(p.name)}, price: ${JSON.stringify(p.price)}, ` +
  `items: ${JSON.stringify(p.items)}, group: ${p.group ? JSON.stringify(p.group) : "null"} },`).join("\n");

const cat = `// GENERATED by scripts/make-outfits.mjs from design/zebra/outfits/manifest.json — do not edit.
//
// The launch wardrobe as data: ${ids.length} items in 3 slots, ${Object.keys(manifest.packs).length} packs, 3 earn rules.
// Prices are here only as the catalogue's view of the tiers; what a person is actually
// charged comes from the store, and what they own comes from the database. Nothing here
// grants anything.
import type { OutfitSlot } from "./outfits";

export type OutfitStatus = "free" | "earned" | "paid";
/** Where a layer sits in the paint order, within the outfit layers. */
export type OutfitLayerName = "torso" | "skirt" | "hood" | "throat" | "face" | "head";

export type CosmeticDef = {
  id: string;
  name: string;
  slot: OutfitSlot;
  layer: OutfitLayerName;
  drawOrder: number;
  /** Torso items are held to the body path (full) or the neck path (bust). */
  clipped: boolean;
  /** The hoodie puts its hood up and hides whatever is in the head slot. */
  hidesHeadSlot: boolean;
  status: OutfitStatus;
  price: string | null;
  earnRule: string | null;
  packs: string[];
};

export type PackDef = { id: string; name: string; price: string; items: string[]; group: string | null };

export const COSMETICS: readonly CosmeticDef[] = [
${manifest.items.map(row).join("\n")}
] as const;

export const PACKS: readonly PackDef[] = [
${packs}
] as const;

/** rule id -> the cosmetic it grants. */
export const EARN_RULES: Readonly<Record<string, string>> = ${JSON.stringify(manifest.earn_rules)};
`;
writeFileSync(CAT, cat);
console.log(`make-outfits: ${ids.length} items, ${nodes} nodes -> ${OUT}`);
console.log(`make-outfits: ${ids.length} catalogue rows, ${Object.keys(manifest.packs).length} packs -> ${CAT}`);
