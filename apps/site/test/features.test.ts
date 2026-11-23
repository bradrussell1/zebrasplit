// The feature pages are search landing pages too: titles and descriptions must fit a result,
// every guide and FAQ they cite must exist, and the worked examples in the copy must match the
// figures in content/featureExamples.ts (the mocks check those against @bunktab/core at build).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { features } from "../content/features.ts";
import { guides } from "../content/guides.ts";
import { CURRENCY_EXAMPLE, NIGHTS_EXAMPLE } from "../content/featureExamples.ts";

const faqSource = readFileSync(new URL("../../../packages/core/src/faq.ts", import.meta.url), "utf8");

test("slugs are unique and URL-safe", () => {
  const slugs = features.map((f) => f.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of slugs) assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("titles and descriptions fit a search result", () => {
  for (const f of features) {
    assert.ok(f.title.length <= 60, `${f.slug} title is ${f.title.length} characters`);
    assert.ok(f.description.length >= 110 && f.description.length <= 160, `${f.slug} description is ${f.description.length} characters`);
    assert.ok(f.sections.length >= 3, `${f.slug} needs at least three sections`);
    assert.ok(f.nav.length <= 26 && f.blurb.length <= 50, `${f.slug} nav label or blurb is too long for the dropdown`);
    assert.match(f.updated, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("guides and FAQ references exist", () => {
  const slugs = new Set(guides.map((g) => g.slug));
  for (const f of features) {
    for (const g of f.guides) assert.ok(slugs.has(g), `${f.slug} links to missing guide ${g}`);
    for (const id of f.faqIds) assert.ok(faqSource.includes(`["${id}"`), `${f.slug} cites missing FAQ ${id}`);
  }
});

test("no feature page promises what the product no longer does", () => {
  for (const f of features) assert.doesNotMatch(JSON.stringify(f), /in (a|their|your) browser|without (the|an) app/i, f.slug);
});

const usd = (cents: number) => `$${Math.floor(cents / 100).toLocaleString("en-US")}${cents % 100 ? `.${String(cents % 100).padStart(2, "0")}` : ""}`;

test("the nights copy states the example's figures", () => {
  const { amountCents, nights, expected } = NIGHTS_EXAMPLE;
  assert.equal(Object.values(expected).reduce((a, b) => a + b, 0), amountCents);
  const copy = JSON.stringify(features.find((f) => f.slug === "split-by-nights"));
  for (const s of [usd(amountCents), `${usd(amountCents / nights)} a night`, usd(expected.priya), usd(expected.jess)]) assert.ok(copy.includes(s), `nights copy is missing ${s}`);
});

test("the currency copy states the example's figures", () => {
  const { rate, currency, base, expected } = CURRENCY_EXAMPLE;
  assert.equal(expected.shares.reduce((a, b) => a + b, 0), expected.baseCents);
  const copy = JSON.stringify(features.find((f) => f.slug === "multi-currency"));
  for (const s of ["1,840 pesos", `1 ${currency} = ${rate} ${base}`, usd(expected.baseCents), usd(expected.shares[0])]) assert.ok(copy.includes(s), `currency copy is missing ${s}`);
});
