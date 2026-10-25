// The receipt mock on the homepage shows a total; make sure the items, tax and tip add up to it.
// Runs with Node's built-in runner and type stripping: `npm test --workspace=@bunktab/site`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { FRIENDS, formatCents, HERD_START, RECEIPT, toCents } from "../content/herd.ts";

test("receipt items + tax + tip = total", () => {
  const items = RECEIPT.lines.reduce((sum, l) => sum + toCents(l.amount), 0);
  assert.equal(items, 26000);
  const total = items + toCents(RECEIPT.tax) + toCents(RECEIPT.tip);
  assert.equal(total, 33540);
  assert.equal(formatCents(total), RECEIPT.total);
});

test("every receipt line is assigned to a known friend", () => {
  const ids = new Set(FRIENDS.map((f) => f.id));
  for (const line of RECEIPT.lines) {
    assert.ok(line.who.length > 0, `${line.item} has nobody`);
    for (const id of line.who) assert.ok(ids.has(id), `${line.item}: unknown friend ${id}`);
  }
});

test("the herd starts at 3 of 6", () => {
  assert.equal(HERD_START.length, FRIENDS.length);
  assert.equal(HERD_START.filter(Boolean).length, 3);
});

test("toCents never goes through a float", () => {
  assert.equal(toCents("0.10"), 10);
  assert.equal(toCents("$2,193.10".replace(",", "")), 219310);
  assert.throws(() => toCents("abc"));
});
