import assert from "node:assert/strict";
import { test } from "node:test";
import { diagnoseDuel } from "../../src/lib/duel-diagnosis.ts";

/** Rapport neutre : aucun facteur ne se détache, aucun casse. */
function report(overrides = {}) {
  return {
    duelId: "duel-test",
    weather: "sunny_cool",
    weatherLines: [],
    win: false,
    brokenPart: null,
    partSaved: false,
    bonus: null,
    attackerSp: 100,
    defenderSp: 100,
    defenderName: "Adversaire",
    scoreMeca: 100,
    tireType: "route",
    tireBonusPct: 0,
    tireMalus: 0,
    tireMod: 1,
    engineProb: 1,
    gearboxProb: 1,
    coins: 0,
    xp: 0,
    gumAfter: 100,
    engineName: "Moteur",
    gearboxName: "Boîte",
    tireName: "Pneus",
    yourPower: 300,
    yourEngineWeight: 100,
    yourGearWeight: 50,
    yourShift: 120,
    ghostPower: 300,
    ghostEngineWeight: 100,
    ghostGearWeight: 50,
    ghostShift: 120,
    ghostGum: 100,
    ghostTireType: "route",
    ghostScoreMeca: 100,
    ghostTireBonusPct: 0,
    ghostTireMalus: 0,
    ghostTireMod: 1,
    ...overrides,
  };
}

function assertChipCount(d) {
  assert.ok(d.deltas.length >= 2, `attendu au moins 2 chips, reçu ${d.deltas.length}`);
  assert.ok(d.deltas.length <= 3, `attendu au plus 3 chips, reçu ${d.deltas.length}`);
}

test("casse moteur : risque chiffré, ton warn, piste atelier", () => {
  const d = diagnoseDuel(report({ brokenPart: "moteur", engineProb: 4.8, gearboxProb: null }));

  assert.equal(d.tone, "warn");
  assert.equal(d.icon, "wrench");
  assert.equal(d.eyebrow, "Le point de bascule");
  assert.equal(d.title, "Casse moteur");
  assert.match(d.reason, /4,8 %/);
  assert.ok(d.deltas.some((x) => x.label === "Risque 4,8 %" && x.tone === "bad"));
  assert.ok(d.deltas.some((x) => x.label === "Boîte non testée" && x.tone === "warn"));
  assert.deepEqual(d.hint, { label: "Aller à l'atelier", href: "/garage", icon: "wrench" });
  assertChipCount(d);
});

test("casse évitée : ton good, pas de renvoi atelier", () => {
  const d = diagnoseDuel(report({ brokenPart: "moteur", engineProb: 4.8, gearboxProb: null, partSaved: true }));

  assert.equal(d.tone, "good");
  assert.equal(d.title, "Casse évitée par la garantie");
  assert.match(d.reason, /garantie constructeur/);
  assert.ok(d.deltas.some((x) => x.label === "Pièce sauvée" && x.tone === "good"));
  assert.equal(d.hint, undefined);
  assertChipCount(d);
});

test("défaite par les pneus : mécanique devant, écart météo dominant", () => {
  const d = diagnoseDuel(report({
    weather: "rain_cool",
    scoreMeca: 92.4,
    ghostScoreMeca: 90.7,
    tireType: "route",
    ghostTireType: "pluie",
    tireMod: 0.91,
    ghostTireMod: 1.08,
  }));

  assert.equal(d.tone, "bad");
  assert.equal(d.icon, "tire");
  assert.equal(d.title, "Pneus inadaptés à la pluie");
  assert.equal(d.eyebrow, "Le point de bascule");
  assert.match(d.reason, /légèrement devant/);
  assert.match(d.reason, /\+1,7 pt/);
  assert.match(d.reason, /Route/);
  assert.match(d.reason, /Pluie/);
  assert.ok(d.deltas[0].label.startsWith("Pneus ×0,91"));
  assertChipCount(d);
});

test("victoire par la mécanique : puissance et temps de passage en avant", () => {
  const d = diagnoseDuel(report({
    win: true,
    scoreMeca: 102.7,
    ghostScoreMeca: 94.6,
    tireType: "sport",
    ghostTireType: "sport",
    tireMod: 1.02,
    ghostTireMod: 1.05,
    yourPower: 321,
    ghostPower: 300,
    yourShift: 112,
    ghostShift: 150,
  }));

  assert.equal(d.tone, "good");
  assert.equal(d.icon, "gauge");
  assert.equal(d.title, "La mécanique a dominé");
  assert.equal(d.eyebrow, "Ce qui a fait la différence");
  assert.match(d.reason, /\+21 ch/);
  assert.match(d.reason, /−38 ms/);
  assert.ok(d.deltas.some((x) => x.label === "+21 ch" && x.tone === "good"));
  assert.ok(d.deltas.some((x) => x.label === "−38 ms" && x.tone === "good"));
  assert.ok(d.deltas.some((x) => x.label === "Pneus ×1,02 vs ×1,05"));
  assertChipCount(d);
});

test("course serrée : aucun facteur au-dessus du seuil, pas de hint", () => {
  const loss = diagnoseDuel(report({
    scoreMeca: 100,
    ghostScoreMeca: 99,
    tireMod: 0.99,
    ghostTireMod: 1,
  }));
  assert.equal(loss.tone, "warn");
  assert.equal(loss.icon, "flag");
  assert.equal(loss.eyebrow, "Analyse de la course");
  assert.equal(loss.title, "Course serrée");
  assert.equal(loss.hint, undefined);
  assert.match(loss.reason, /Aucun facteur/);
  assertChipCount(loss);

  const win = diagnoseDuel(report({
    win: true,
    scoreMeca: 100,
    ghostScoreMeca: 99,
    tireMod: 1.01,
    ghostTireMod: 1,
  }));
  assert.equal(win.tone, "good");
  assert.equal(win.title, "Victoire acquise de justesse");
  assert.equal(win.hint, undefined);
  assertChipCount(win);
});

test("gomme en fin de vie : usure dominante, ton warn", () => {
  const d = diagnoseDuel(report({
    scoreMeca: 42.2,
    ghostScoreMeca: 42.2,
    tireMalus: 9,
    ghostTireMalus: 0,
    tireMod: 0.91,
    ghostTireMod: 1,
    gumAfter: 42,
    ghostGum: 100,
  }));

  assert.equal(d.tone, "warn");
  assert.equal(d.icon, "alert");
  assert.equal(d.title, "Gomme en fin de vie");
  assert.match(d.reason, /42 %/);
  assert.match(d.reason, /−9/);
  assert.match(d.reason, /3,8 pts/);
  assert.ok(d.deltas.some((x) => x.label === "Gomme 42 % vs 100 %" && x.tone === "bad"));
  assert.ok(d.deltas.some((x) => x.label === "Malus −9 vs 0" && x.tone === "bad"));
  assertChipCount(d);
});

test("formatage : signe moins U+2212 et virgule décimale", () => {
  const d = diagnoseDuel(report({
    scoreMeca: 94,
    ghostScoreMeca: 102,
    yourPower: 279,
    ghostPower: 300,
    yourShift: 158,
    ghostShift: 120,
  }));

  assert.equal(d.title, "La mécanique a creusé l'écart");
  assert.ok(d.reason.includes("−21 ch"));
  assert.ok(d.reason.includes("+38 ms"));
  assert.ok(d.reason.includes("−"));

  const gum = diagnoseDuel(report({
    scoreMeca: 42.2,
    ghostScoreMeca: 42.2,
    tireMalus: 9,
    ghostTireMalus: 0,
    tireMod: 0.91,
    ghostTireMod: 1,
    gumAfter: 42,
    ghostGum: 100,
  }));
  assert.ok(gum.reason.includes("3,8 pts"));
  assert.ok(gum.reason.includes(","));
  assert.ok(gum.deltas.some((x) => x.label.includes("−9")));
});

test("cas limites : probabilités nulles, gomme inconnue, libellé de pneu brut", () => {
  const noRisk = diagnoseDuel(report({ brokenPart: "boite", engineProb: null, gearboxProb: null }));
  assert.equal(noRisk.title, "Casse boîte");
  assert.match(noRisk.reason, /La casse a mis fin à la course/);
  assertChipCount(noRisk);

  const savedNoRisk = diagnoseDuel(report({ brokenPart: "moteur", engineProb: null, gearboxProb: null, partSaved: true }));
  assert.equal(savedNoRisk.title, "Casse évitée par la garantie");
  assert.equal(savedNoRisk.hint, undefined);
  assertChipCount(savedNoRisk);

  const rawTire = diagnoseDuel(report({
    weather: "sunny_hot",
    scoreMeca: 90,
    ghostScoreMeca: 95,
    tireType: "inconnu",
    ghostTireType: "route",
    tireMod: 0.8,
    ghostTireMod: 1,
    gumAfter: null,
  }));
  assert.equal(rawTire.title, "Pneus inadaptés au sec");
  assert.match(rawTire.reason, /inconnu/);
  assertChipCount(rawTire);
});

test("perspective défenseur : gomme normalisée, données adverses nommées comme telles", () => {
  const d = diagnoseDuel(report({
    win: true,
    scoreMeca: 95,
    ghostScoreMeca: 95,
    tireMalus: 0,
    ghostTireMalus: 6,
    tireMod: 1,
    ghostTireMod: 0.9,
    tireType: "pluie",
    ghostTireType: "route",
    gumAfter: null,
    ghostGum: 52,
    weather: "rain_hot",
  }));

  assert.equal(d.icon, "alert");
  assert.match(d.reason, /chez l'adversaire/);
  assert.match(d.reason, /100 %/);
  assertChipCount(d);
});
