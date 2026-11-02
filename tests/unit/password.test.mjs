import assert from "node:assert/strict";
import { test } from "node:test";
import { fakePasswordHash, hashPassword, verifyPassword } from "../../src/lib/password.ts";

test("scrypt : hash salé, vérification correcte et rejet d'un mauvais mot de passe", async () => {
  const hash = await hashPassword("MotDePasse!42");
  assert.match(hash, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.equal(await verifyPassword("MotDePasse!42", hash), true);
  assert.equal(await verifyPassword("mauvais", hash), false);

  const other = await hashPassword("MotDePasse!42");
  assert.notEqual(hash, other, "deux hachages du même mot de passe utilisent des sels différents");
});

test("hash factice : un vrai hash scrypt, jamais une chaîne vide ou « 00:00 »", async () => {
  const fake = fakePasswordHash();
  assert.notEqual(fake, "00:00");
  assert.notEqual(fake, "");
  assert.match(fake, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.equal(fake, fakePasswordHash(), "le hash factice est calculé une seule fois");
  assert.equal(await verifyPassword("n'importe quel mot de passe", fake), false);
  assert.equal(await verifyPassword("", fake), false);
});

test("verifyPassword refuse un hash stocké malformé", async () => {
  assert.equal(await verifyPassword("x", ""), false);
  assert.equal(await verifyPassword("x", "00:00"), false);
  assert.equal(await verifyPassword("x", "abc"), false);
});
