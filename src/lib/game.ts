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
