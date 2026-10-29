import assert from "node:assert/strict";
import { test } from "node:test";
import { rpcErrorMessage } from "../../src/lib/errors.ts";

test("rpcErrorMessage : codes métier nouvellement mappés", () => {
  assert.equal(rpcErrorMessage({ message: "invalid_category" }), "Catégorie de tirage invalide.");
  assert.equal(rpcErrorMessage({ message: "profile_not_found" }), "Profil introuvable.");
  assert.equal(rpcErrorMessage({ message: "template_not_found" }), "Modèle de carte introuvable.");
  assert.equal(rpcErrorMessage({ message: "card_not_sellable" }), "Cette carte ne peut pas être mise en vente.");
});

test("rpcErrorMessage : code connu existant", () => {
  assert.equal(rpcErrorMessage({ message: "insufficient_funds" }), "Pièces insuffisantes.");
});

test("rpcErrorMessage : code inconnu masqué et journalisé", () => {
  const original = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);
  try {
    assert.equal(
      rpcErrorMessage({ message: "code_qui_n_existe_pas", code: "XX000" }),
      "Une erreur est survenue. Réessayez.",
    );
  } finally {
    console.error = original;
  }
  assert.equal(logged.length, 1);
});
