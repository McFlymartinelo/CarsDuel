import assert from "node:assert/strict";
import { test } from "node:test";
import { RECYCLE_EXCHANGE_COST, RECYCLE_TIRE_WEIGHT_KG, recycleBinSummary, recycleCardWeight } from "../../src/lib/recycle.ts";

const card = (category, weight_kg = null) => ({ card_templates: { category, weight_kg } });

test("poids de la benne : poids réel ou 4 kg par pneu", () => {
  assert.equal(recycleCardWeight(card("moteur", 120).card_templates), 120);
  assert.equal(recycleCardWeight(card("boite", 45).card_templates), 45);
  assert.equal(recycleCardWeight(card("pneus").card_templates), RECYCLE_TIRE_WEIGHT_KG);
  assert.equal(recycleCardWeight(card("bonus").card_templates), 0);
});

test("cubes : floor(poids / 10)", () => {
  assert.deepEqual(recycleBinSummary([]), { cards: 0, weightKg: 0, cubes: 0 });
  assert.equal(recycleBinSummary([card("pneus"), card("pneus")]).cubes, 0); // 8 kg
  assert.equal(recycleBinSummary([card("pneus"), card("pneus"), card("pneus")]).cubes, 1); // 12 kg
  assert.equal(recycleBinSummary([card("moteur", 10)]).cubes, 1);
  assert.equal(recycleBinSummary([card("moteur", 19.99)]).cubes, 1);
  assert.equal(recycleBinSummary([card("moteur", 21)]).cubes, 2);
  assert.equal(recycleBinSummary([card("moteur", 21), card("pneus")]).cubes, 2); // 25 kg
});

test("échange : coût fixe de 25 cubes", () => {
  assert.equal(RECYCLE_EXCHANGE_COST, 25);
});
