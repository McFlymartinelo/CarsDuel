import assert from "node:assert/strict";
import { test } from "node:test";
import {
  EMAIL_MAX_LENGTH,
  normalizeEmail,
  validateEmail,
  validatePassword,
  validateUsername,
} from "../../src/lib/validation.ts";

test("pseudo : 3 à 24 caractères, lettres/chiffres/_ . - uniquement", () => {
  assert.equal(validateUsername("alex_42"), null);
  assert.equal(validateUsername("A.b-C_9"), null);
  assert.equal(validateUsername("ab"), "Pseudo : 3 à 24 caractères (lettres, chiffres, _ . -).");
  assert.equal(validateUsername("a".repeat(25)), "Pseudo : 3 à 24 caractères (lettres, chiffres, _ . -).");
  assert.equal(validateUsername("alex 42"), "Pseudo : 3 à 24 caractères (lettres, chiffres, _ . -).");
  assert.equal(validateUsername("alex@42"), "Pseudo : 3 à 24 caractères (lettres, chiffres, _ . -).");
});

test("e-mail : trim + minuscules, format valide, 254 caractères maximum", () => {
  assert.equal(normalizeEmail("  Alex@Example.COM  "), "alex@example.com");
  assert.equal(validateEmail("  Alex@Example.COM "), null);
  assert.equal(validateEmail("pas-un-email"), "Email invalide.");
  assert.equal(validateEmail("a@b"), "Email invalide.");
  assert.equal(validateEmail("a".repeat(EMAIL_MAX_LENGTH) + "@b.co"), "Email invalide.");
});

test("mot de passe : 8 à 128 caractères", () => {
  assert.equal(validatePassword("12345678"), null);
  assert.equal(validatePassword("a".repeat(128)), null);
  assert.equal(validatePassword("1234567"), "Mot de passe : 8 caractères minimum.");
  assert.equal(validatePassword("a".repeat(129)), "Mot de passe : 128 caractères maximum.");
});
