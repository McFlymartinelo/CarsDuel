import assert from "node:assert/strict";
import { test } from "node:test";
import { breakRiskKey, cardGroupKey, groupCards, sortCardGroups } from "../../src/lib/card-groups.ts";
import { currentBreakRisk } from "../../src/lib/game.ts";

let nextId = 0;

function card({
  category = "moteur",
  template = "tpl",
  name = "Moteur",
  runs = 0,
  base = 5,
  sensitivity = 1,
  wear = null,
  destroyed = false,
  listed = false,
} = {}) {
  return {
    id: `card-${++nextId}`,
    owner_id: "owner",
    template_id: template,
    runs_count: runs,
    runs_total: runs,
    wins_count: 0,
    warranty_duels: 10,
    warranty_used: 0,
    warranty_extended: false,
    tire_wear: wear,
    is_destroyed: destroyed,
    is_listed: listed,
    in_recycle_bin: false,
    card_templates: {
      id: template,
      code: null,
      category,
      name,
      description: null,
      image_url: null,
      rarity: "commune",
      weight_kg: 100,
      base_break_risk: base,
      wear_sensitivity: sensitivity,
      architecture: null,
      power_hp: 100,
      gearbox_type: null,
      shift_time_ms: null,
      tire_type: null,
      tire_base_wear: null,
      bonus_effect: null,
      restricted_to_username: null,
      garantie: 10,
    },
  };
}

test("moteurs et boîtes : regroupés au même modèle et même risque de casse actuel", () => {
  const a = card({ runs: 3 });
  const b = card({ runs: 3 });
  const c = card({ runs: 4 });
  const groups = groupCards([a, b, c], cardGroupKey);

  assert.equal(breakRiskKey(a), "8.00");
  assert.equal(breakRiskKey(a), currentBreakRisk(a.card_templates, a.runs_count).toFixed(2));
  assert.equal(groups.length, 2);
  assert.equal(groups[0].count, 2);
  assert.deepEqual(groups[0].cards.map((x) => x.id).sort(), [a.id, b.id].sort());
  assert.equal(groups[1].count, 1);

  assert.notEqual(cardGroupKey(card({ template: "autre" })), cardGroupKey(card()));
  assert.notEqual(cardGroupKey(card({ destroyed: true })), cardGroupKey(card()));
  assert.notEqual(cardGroupKey(card({ listed: true })), cardGroupKey(card()));

  // Dans l'inventaire, la garantie sépare les fiches (réparation / prolongation) ;
  // au recyclage, seule l'identité mécanique compte.
  const intact = card({ runs: 3 });
  const repaired = card({ runs: 3 });
  repaired.warranty_used = 2;
  assert.notEqual(cardGroupKey(intact, true), cardGroupKey(repaired, true));
  assert.equal(cardGroupKey(intact), cardGroupKey(repaired));
});

test("pneus : regroupés au même modèle et même gomme restante", () => {
  const a = card({ category: "pneus", template: "pneu", name: "Pneu", wear: 100 });
  const b = card({ category: "pneus", template: "pneu", name: "Pneu", wear: "100.00" });
  const c = card({ category: "pneus", template: "pneu", name: "Pneu", wear: 80 });

  const groups = groupCards([a, b, c], cardGroupKey);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].count, 2);
});

test("bonus : regroupés par modèle, sans état d'usure", () => {
  const a = card({ category: "bonus", template: "bonus", name: "Révision" });
  const b = card({ category: "bonus", template: "bonus", name: "Révision" });
  const c = card({ category: "bonus", template: "autre-bonus", name: "Huile" });

  const groups = groupCards([a, b, c], cardGroupKey);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].count, 2);
});

test("tri explicite : gomme, quantité et référence", () => {
  const tire100 = card({ category: "pneus", template: "p", name: "Pneu", wear: 100 });
  const tire50 = card({ category: "pneus", template: "p", name: "Pneu", wear: 50 });
  const tireGroups = groupCards([tire50, tire100], cardGroupKey);
  assert.equal(sortCardGroups(tireGroups, "pneus", "gomme")[0].card.tire_wear, 100);

  const bonusA = card({ category: "bonus", template: "a", name: "A" });
  const bonusB = card({ category: "bonus", template: "b", name: "B" });
  const bonusGroups = groupCards([bonusB, bonusA, bonusA], cardGroupKey);
  assert.equal(sortCardGroups(bonusGroups, "bonus", "qty")[0].count, 2);
  assert.equal(sortCardGroups(bonusGroups, "bonus", "name")[0].card.card_templates.name, "A");

  const engineM2 = card({ template: "m2", name: "Deux" });
  engineM2.card_templates.code = "M2";
  const engineM10 = card({ template: "m10", name: "Dix" });
  engineM10.card_templates.code = "M10";
  const engineGroups = groupCards([engineM10, engineM2], cardGroupKey);
  assert.equal(sortCardGroups(engineGroups, "moteur", "ref")[0].card.card_templates.code, "M2");
});

test("tri : bonus par quantité, pièces par nom puis usure", () => {
  const bonusA = card({ category: "bonus", template: "a", name: "A" });
  const bonusB = card({ category: "bonus", template: "b", name: "B" });
  const bonusGroups = groupCards([bonusA, bonusA, bonusB], cardGroupKey);
  assert.equal(sortCardGroups(bonusGroups, "bonus")[0].count, 2);

  const tire100 = card({ category: "pneus", template: "p", name: "Pneu", wear: 100 });
  const tire50 = card({ category: "pneus", template: "p", name: "Pneu", wear: 50 });
  const tireGroups = groupCards([tire50, tire100], cardGroupKey);
  assert.equal(sortCardGroups(tireGroups, "pneus")[0].card.tire_wear, 100);

  const engineLow = card({ runs: 1, name: "Moteur" });
  const engineHigh = card({ runs: 5, name: "Moteur" });
  const engineGroups = groupCards([engineLow, engineHigh], cardGroupKey);
  assert.equal(sortCardGroups(engineGroups, "moteur")[0].card.runs_count, 5);
});
