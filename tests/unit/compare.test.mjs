import assert from "node:assert/strict";
import { test } from "node:test";
import { compareCandidate } from "../../src/lib/compare.ts";
import { currentBreakRisk, scoreMeca } from "../../src/lib/game.ts";

const MINUS = "\u2212";

let nextId = 0;

function template({
  id,
  name = "Pièce",
  category = "moteur",
  power = null,
  weight = null,
  shift = null,
  baseRisk = null,
  wear = null,
  tireType = null,
} = {}) {
  return {
    id: id ?? `tpl-${++nextId}`,
    code: null,
    category,
    name,
    description: null,
    image_url: null,
    rarity: "commune",
    weight_kg: weight,
    base_break_risk: baseRisk,
    wear_sensitivity: wear,
    architecture: null,
    power_hp: power,
    gearbox_type: null,
    shift_time_ms: shift,
    tire_type: tireType,
    tire_base_wear: null,
    bonus_effect: null,
    restricted_to_username: null,
    garantie: 10,
  };
}

/** Config de référence : V8 5.0 / DCT 7 / Sport, pièces intactes. */
const equipped = {
  engine: {
    card: { runs_count: 0, tire_wear: null },
    template: template({ id: "eq-engine", name: "V8 5.0", power: 400, weight: 220, baseRisk: 2, wear: 0.1 }),
  },
  gearbox: {
    card: { runs_count: 0, tire_wear: null },
    template: template({ id: "eq-gearbox", name: "DCT 7", category: "boite", shift: 120, weight: 80, baseRisk: 1, wear: 0.05 }),
  },
  tire: {
    card: { runs_count: 0, tire_wear: 100 },
    template: template({ id: "eq-tire", name: "Sport", category: "pneus", tireType: "sport" }),
  },
};

const noTires = [];

test("moteur plus puissant : gain de score mécanique et chips puissance / poids / risque", () => {
  const candidate = template({ id: "m-strong", name: "V6 3.0 Bi-Turbo", power: 460, weight: 240, baseRisk: 4, wear: 0.1 });
  const comparison = compareCandidate(candidate, null, equipped, noTires);

  assert.ok(comparison);
  const delta = scoreMeca(candidate, equipped.gearbox.template) - scoreMeca(equipped.engine.template, equipped.gearbox.template);
  assert.equal(delta, 28);

  assert.ok(comparison.headline.startsWith("+"));
  assert.equal(comparison.headline, "+28,0 pts");
  assert.equal(comparison.caption, "de score mécanique estimé");
  assert.equal(comparison.tone, "good");
  assert.equal(comparison.reference, "V8 5.0");

  assert.deepEqual(comparison.chips[0], { label: "+60 ch", tone: "good" });
  assert.deepEqual(comparison.chips[1], { label: "+20 kg", tone: "bad" });
  assert.deepEqual(comparison.chips[2], { label: "risque +2,0 pts", tone: "bad" });
});

test("moteur plus faible : headline négatif en U+2212 et ton bad", () => {
  const candidate = template({ id: "m-weak", power: 300, weight: 220, baseRisk: 1, wear: 0.1 });
  const comparison = compareCandidate(candidate, null, equipped, noTires);

  assert.ok(comparison);
  assert.equal(comparison.headline, `${MINUS}55,0 pts`);
  assert.ok(comparison.headline.startsWith(MINUS));
  assert.equal(comparison.tone, "bad");
  assert.equal(comparison.chips[0].tone, "bad");
  assert.ok(!comparison.headline.includes("-"), "le signe moins typographique ne doit jamais être un hyphen");
});

test("boîte plus rapide : score positif et temps de passage négatif en good", () => {
  const candidate = template({ id: "b-fast", category: "boite", shift: 100, weight: 80, baseRisk: 1, wear: 0.05 });
  const comparison = compareCandidate(candidate, null, equipped, noTires);

  assert.ok(comparison);
  assert.equal(comparison.headline, "+1,0 pt");
  assert.equal(comparison.tone, "good");
  assert.equal(comparison.reference, "DCT 7");
  assert.deepEqual(comparison.chips[0], { label: `${MINUS}20 ms`, tone: "good" });
  assert.deepEqual(comparison.chips[1], { label: "0 kg", tone: "neutral" });
});

test("pneus : une chip par météo, sans moyenne affichée", () => {
  const candidate = template({ id: "t-rain", category: "pneus", tireType: "pluie" });
  const bonuses = { sunny_hot: 10, sunny_cool: 20, rain_hot: 30, rain_cool: 40 };
  const tirePerfs = [
    ...Object.entries(bonuses).map(([weather, bonus]) => ({ tire_type: "pluie", weather, perf_bonus_pct: bonus })),
    ...["sunny_hot", "sunny_cool", "rain_hot", "rain_cool"].map((weather) => ({ tire_type: "sport", weather, perf_bonus_pct: 0 })),
  ];

  const comparison = compareCandidate(candidate, { runs_count: 0, tire_wear: 100 }, equipped, tirePerfs);
  assert.ok(comparison);

  assert.equal(comparison.kind, "tires");
  assert.equal(comparison.headline, undefined);
  assert.equal(comparison.caption, undefined);
  assert.equal(comparison.tone, "good");
  assert.equal(comparison.reference, "Sport");
  assert.equal(comparison.chips.length, 4);
  assert.deepEqual(comparison.chips.map((c) => c.label), [
    "Sec chaud +10,0 %",
    "Sec frais +20,0 %",
    "Humide chaud +30,0 %",
    "Humide frais +40,0 %",
  ]);
  assert.ok(comparison.chips.every((c) => c.tone === "good"));
});

test("pneus : une météo sans modificateur annule la comparaison", () => {
  const candidate = template({ id: "t-partial", category: "pneus", tireType: "pluie" });
  const tirePerfs = [
    { tire_type: "pluie", weather: "sunny_hot", perf_bonus_pct: 10 },
    ...["sunny_hot", "sunny_cool", "rain_hot", "rain_cool"].map((weather) => ({ tire_type: "sport", weather, perf_bonus_pct: 0 })),
  ];
  assert.equal(compareCandidate(candidate, null, equipped, tirePerfs), null);
});

test("bonus : aucune comparaison", () => {
  const candidate = template({ id: "bonus-1", category: "bonus", name: "Révision" });
  assert.equal(compareCandidate(candidate, null, equipped, noTires), null);
});

test("même modèle que la pièce équipée : aucune comparaison", () => {
  assert.equal(compareCandidate(equipped.engine.template, null, equipped, noTires), null);
  assert.equal(compareCandidate(equipped.gearbox.template, null, equipped, noTires), null);
  assert.equal(compareCandidate(equipped.tire.template, null, equipped, noTires), null);
});

test("risque d'occasion : les runs de l'annonce comptent dans le risque actuel", () => {
  const candidate = template({ id: "m-used", power: 400, weight: 220, baseRisk: 2, wear: 0.1 });
  const card = { runs_count: 5, tire_wear: null };

  assert.equal(currentBreakRisk(candidate, card.runs_count), 2.5);
  const comparison = compareCandidate(candidate, card, equipped, noTires);
  assert.ok(comparison);
  assert.deepEqual(comparison.chips[2], { label: "risque +0,5 pt", tone: "bad" });
});
