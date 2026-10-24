import type { CardTemplate, UserCard } from "./types";

// ---------- Niveau (affichage uniquement : dérivé de profiles.xp_total) -------
export const XP_PER_LEVEL = 200;

export function levelInfo(xpTotal: number) {
  return {
    level: Math.floor(xpTotal / XP_PER_LEVEL) + 1,
    current: xpTotal % XP_PER_LEVEL,
    next: XP_PER_LEVEL,
  };
}

// ---------- Estimation de performance (AFFICHAGE : la base reste l'autorité) --
// Reprend les formules de private.compute_sp (migration 004).

export const tireMalus = (gum: number) => (gum >= 70 ? 0 : Math.floor((70 - gum) / 3));

export const scoreMecaRaw = (powerHp: number, totalWeightKg: number, shiftMs: number) =>
  Math.max(10, 100 + powerHp * 0.55 - totalWeightKg * 0.25 - shiftMs * 0.05);

export function scoreMeca(engine: CardTemplate, gearbox: CardTemplate): number {
  return scoreMecaRaw(engine.power_hp ?? 0, (engine.weight_kg ?? 0) + (gearbox.weight_kg ?? 0), gearbox.shift_time_ms ?? 0);
}

export const tireModifier = (bonusPct: number, gum: number) =>
  Math.max(0.1, 1 + (bonusPct - tireMalus(gum)) / 100);

export const totalWeight = (engine: CardTemplate, gearbox: CardTemplate) =>
  (engine.weight_kg ?? 0) + (gearbox.weight_kg ?? 0);

export type TireState = { label: string; tone: "ok" | "worn" | "critical" };
export function tireState(gum: number): TireState {
  if (gum >= 70) return { label: "OK", tone: "ok" };
  if (gum >= 30) return { label: "USÉ", tone: "worn" };
  return { label: "CRITIQUE", tone: "critical" };
}

export const isNewTire = (c: Pick<UserCard, "tire_wear">) => (c.tire_wear ?? 100) >= 100;

/** Risque de casse hors météo : R0 + duels × sensibilité. Moteur et boîte seulement. */
export function currentBreakRisk(
  t: Pick<CardTemplate, "category" | "base_break_risk" | "wear_sensitivity">,
  runs: number,
): number | null {
  if (t.category !== "moteur" && t.category !== "boite") return null;
  return Number(t.base_break_risk ?? 0) + runs * Number(t.wear_sensitivity ?? 0);
}

// ---------- Recyclage (affichage ; le paiement est dans public.recycle_card) --
// Pièces = base × pourcentage restant / 100, arrondi à l'entier.
//   moteur 50, boîte 30, pneus 10. Bonus : 1 pièce fixe.
// Pneu : gomme restante. Moteur / boîte : 100 − risque de casse actuel.

export const RECYCLE_BASE = { moteur: 50, boite: 30, pneus: 10 } as const;

export function recycleQuote(
  t: CardTemplate,
  c: Pick<UserCard, "runs_count" | "tire_wear">,
): { base: number; pct: number; coins: number; flat: boolean } | null {
  if (t.category === "bonus") return { base: 1, pct: 100, coins: 1, flat: true };
  let pct: number;
  if (t.category === "pneus") {
    if (c.tire_wear == null) return null;
    pct = Number(c.tire_wear);
  } else if (t.category === "moteur" || t.category === "boite") {
    const risk = currentBreakRisk(t, c.runs_count);
    if (risk == null) return null;
    pct = Math.min(100, Math.max(0, 100 - risk));
  } else {
    return null;
  }
  const base = RECYCLE_BASE[t.category];
  return { base, pct, coins: Math.round((base * pct) / 100), flat: false };
}
