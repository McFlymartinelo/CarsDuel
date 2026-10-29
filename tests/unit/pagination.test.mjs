import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePage } from "../../src/lib/pagination.ts";

test("parsePage : valeur par défaut", () => {
  assert.equal(parsePage(undefined), 1);
  assert.equal(parsePage(null), 1);
  assert.equal(parsePage(""), 1);
});

test("parsePage : valeurs invalides ou non positives", () => {
  assert.equal(parsePage("0"), 1);
  assert.equal(parsePage("-5"), 1);
  assert.equal(parsePage("Infinity"), 1);
  assert.equal(parsePage("-Infinity"), 1);
  assert.equal(parsePage("abc"), 1);
  assert.equal(parsePage(Number.NaN), 1);
});

test("parsePage : décimales tronquées (politique : floor)", () => {
  assert.equal(parsePage("3.7"), 3);
  assert.equal(parsePage(3.9), 3);
});

test("parsePage : valeur bornée à 1000 par défaut", () => {
  assert.equal(parsePage("999999999999999999999"), 1000);
  assert.equal(parsePage(5000), 1000);
});

test("parsePage : borne personnalisée", () => {
  assert.equal(parsePage("42", 10), 10);
  assert.equal(parsePage("3", 10), 3);
  assert.equal(parsePage("3", 0), 1);
});
