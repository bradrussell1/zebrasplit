// The guides are search landing pages: keep titles and descriptions inside what a result shows,
// keep the links between them alive, and keep every FAQ reference pointing at a real answer.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { guides } from "../content/guides.ts";

const faqSource = readFileSync(new URL("../../../packages/core/src/faq.ts", import.meta.url), "utf8");

test("slugs are unique and URL-safe", () => {
  const slugs = guides.map((g) => g.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const s of slugs) assert.match(s, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("titles and descriptions fit a search result", () => {
  for (const g of guides) {
    assert.ok(g.title.length <= 60, `${g.slug} title is ${g.title.length} characters`);
    assert.ok(g.description.length >= 110 && g.description.length <= 160, `${g.slug} description is ${g.description.length} characters`);
    assert.ok(g.sections.length >= 3, `${g.slug} needs at least three sections`);
    assert.match(g.updated, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test("related guides and FAQ references exist", () => {
  const slugs = new Set(guides.map((g) => g.slug));
  for (const g of guides) {
    for (const r of g.related) {
      assert.ok(slugs.has(r), `${g.slug} links to missing guide ${r}`);
      assert.notEqual(r, g.slug);
    }
    for (const id of g.faqIds) assert.ok(faqSource.includes(`["${id}"`), `${g.slug} cites missing FAQ ${id}`);
  }
});

test("no guide promises what the product no longer does", () => {
  // The browser guest view was removed (invites are app-only); never tell a reader they can join in a browser.
  for (const g of guides) assert.doesNotMatch(JSON.stringify(g), /in (a|their|your) browser|without (the|an) app/i, g.slug);
});
