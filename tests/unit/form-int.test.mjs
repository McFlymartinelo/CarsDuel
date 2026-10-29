import assert from "node:assert/strict";
import { test } from "node:test";
import { parseFormInt } from "../../src/lib/form-int.ts";

test("parseFormInt : chaîne vide → null", () => {
  assert.equal(parseFormInt(""), null);
  assert.equal(parseFormInt("   "), null);
});

test("parseFormInt : entier positif valide", () => {
  assert.equal(parseFormInt("12"), 12);
  assert.equal(parseFormInt("00012"), 12);
});

test("parseFormInt : valeurs invalides refusées", () => {
  assert.throws(() => parseFormInt("12abc"), /invalid_number/);
  assert.throws(() => parseFormInt("-1"), /invalid_number/);
  assert.throws(() => parseFormInt("1.5"), /invalid_number/);
  assert.throws(() => parseFormInt("abc"), /invalid_number/);
});

test("parseFormInt : hors plage integer PostgreSQL refusé", () => {
  assert.throws(() => parseFormInt("2147483648"), /invalid_number/);
  assert.throws(() => parseFormInt("999999999999999999999"), /invalid_number/);
});

test("parseFormInt : code métier personnalisé", () => {
  assert.throws(() => parseFormInt("abc", "invalid_price"), /invalid_price/);
  assert.throws(() => parseFormInt("abc", "invalid_amount"), /invalid_amount/);
});
