import assert from "node:assert/strict";
import { test } from "node:test";
import { compareCollectionDefault } from "../../src/lib/catalog-sort.ts";
import { cleanSearch, matchesTemplateSearch } from "../../src/lib/search.ts";

const card = (name, code, category = "moteur") => ({ name, code, category });

test("cleanSearch : retire le # de référence, les espaces et borne la longueur", () => {
  assert.equal(cleanSearch("  #1A "), "1A");
  assert.equal(cleanSearch("vintage"), "vintage");
  assert.equal(cleanSearch(""), undefined);
  assert.equal(cleanSearch("   "), undefined);
  assert.equal(cleanSearch(undefined), undefined);
  assert.equal(cleanSearch("x".repeat(200)).length, 60);
});

test("matchesTemplateSearch : référence exacte, casse et accents ignorés", () => {
  const moteur = card("1.1 Essence Fonte Vintage 45", "M1A");
  assert.equal(matchesTemplateSearch(moteur, "1a"), true);
  assert.equal(matchesTemplateSearch(moteur, "#1A"), true);
  assert.equal(matchesTemplateSearch(moteur, "m1a"), true);
  assert.equal(matchesTemplateSearch(moteur, "1"), true);
  assert.equal(matchesTemplateSearch(card("1.1 Autre", "M21A"), "1a"), false);
  assert.equal(matchesTemplateSearch(card("1.6 Autre", "M10"), "1"), false);
  assert.equal(matchesTemplateSearch(card("Huile moteur de compétition", "bonus_huile_moteur"), "competition"), true);
  assert.equal(matchesTemplateSearch(card("Manuelle 4 Rapports Vintage", "B1"), "VINTAGE"), true);
  // ancien format encore accepté (données historiques)
  assert.equal(matchesTemplateSearch(card("1.1 Essence", "m_1b"), "1b"), true);
});

test("compareCollectionDefault : catégorie puis référence (#1A, #1B, #2, #3…)", () => {
  const sorted = [
    card("Bonus", "bonus_x", "bonus"),
    card("Boîte", "B1", "boite"),
    card("Moteur 2", "M2"),
    card("Moteur 1B", "M1B"),
    card("Moteur 1A", "M1A"),
    card("Moteur 3", "M3"),
  ]
    .sort((a, b) => compareCollectionDefault(a, b))
    .map((x) => x.code);
  assert.deepEqual(sorted, ["M1A", "M1B", "M2", "M3", "B1", "bonus_x"]);
});
