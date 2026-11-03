import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  RECYCLE_EXCHANGE_COST,
  RECYCLE_EXCHANGE_TIERS,
  RECYCLE_EXCHANGE_TIER_LIST,
  RECYCLE_TIRE_WEIGHT_KG,
  recycleBinSummary,
  recycleCardWeight,
} from "../../src/lib/recycle.ts";

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

test("échanges : trois paliers de tirage et tables de rareté", () => {
  assert.equal(RECYCLE_EXCHANGE_COST, 25);
  assert.deepEqual(RECYCLE_EXCHANGE_TIER_LIST.map((t) => [t.key, t.cost]), [
    ["standard", 25],
    ["ameliore", 50],
    ["prestige", 100],
  ]);

  for (const tier of RECYCLE_EXCHANGE_TIER_LIST) {
    assert.equal(tier.odds.length, 5);
    const total = tier.odds.reduce((sum, odd) => sum + odd.pct, 0);
    assert.ok(Math.abs(total - 100) < 1e-9, `${tier.key} doit totaliser 100 %`);
  }

  assert.deepEqual(
    RECYCLE_EXCHANGE_TIERS.standard.odds.map((o) => o.pct),
    [70, 20, 7, 2.5, 0.5],
  );
  assert.deepEqual(
    RECYCLE_EXCHANGE_TIERS.ameliore.odds.map((o) => o.pct),
    [45, 35, 14, 5, 1],
  );
  assert.deepEqual(
    RECYCLE_EXCHANGE_TIERS.prestige.odds.map((o) => o.pct),
    [15, 45, 25, 12, 3],
  );
});

test("échanges : chaque palier possède son illustration", () => {
  for (const tier of RECYCLE_EXCHANGE_TIER_LIST) {
    assert.match(tier.image, /^\/garage\/echange-[a-z]+\.webp$/);
    assert.ok(
      fs.existsSync(path.join(process.cwd(), "public", tier.image)),
      `illustration manquante : ${tier.image}`,
    );
  }
});
