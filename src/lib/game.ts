import type { CardTemplate, UserCard } from "./types";

// ---------- Rang de profil (affichage : dérivé de l'XP du mois, reset naturel) --
// Bronze 0–250, Argent 251–700, Or 701–1500, Platine 1501–3000, Diamant 3001+.
export const RANKS = [
  { id: "bronze", tier: "Bronze", name: "Rookie", min: 0, max: 250, dot: "bg-emerald-400", text: "text-emerald-300", bar: "bg-emerald-400", row: "bg-emerald-500/10" },
  { id: "argent", tier: "Argent", name: "Amateur de Paddock", min: 251, max: 700, dot: "bg-blue-400", text: "text-blue-300", bar: "bg-blue-400", row: "bg-blue-500/10" },
  { id: "or", tier: "Or", name: "Pro de la Config", min: 701, max: 1500, dot: "bg-fuchsia-400", text: "text-fuchsia-300", bar: "bg-fuchsia-400", row: "bg-fuchsia-500/10" },
  { id: "platine", tier: "Platine", name: "Pilote d'Élite", min: 1501, max: 3000, dot: "bg-orange-400", text: "text-orange-300", bar: "bg-orange-400", row: "bg-orange-500/10" },
  { id: "diamant", tier: "Diamant", name: "Légende de la Piste", min: 3001, max: null, dot: "bg-rose-400", text: "text-rose-300", bar: "bg-rose-400", row: "bg-rose-500/10" },
] as const;

export type PaddockRank = (typeof RANKS)[number];

export function rankFor(monthlyXp: number): PaddockRank {
  const xp = Math.max(0, Math.floor(Number(monthlyXp) || 0));
  let current: PaddockRank = RANKS[0];
  for (const rank of RANKS) {
    if (xp >= rank.min) current = rank;
  }
  return current;
}

export function rankRange(rank: PaddockRank): string {
  if (rank.max == null) return `${rank.min.toLocaleString("fr-FR")}+`;
  return `${rank.min.toLocaleString("fr-FR")} – ${rank.max.toLocaleString("fr-FR")}`;
}

/** Progression dans le palier courant, vers le rang suivant. */
export function rankProgress(monthlyXp: number): { rank: PaddockRank; next: PaddockRank | null; pct: number; remaining: number } {
  const xp = Math.max(0, Math.floor(Number(monthlyXp) || 0));
  const rank = rankFor(xp);
  const next = RANKS[RANKS.findIndex((r) => r.id === rank.id) + 1] ?? null;
  if (!next) return { rank, next: null, pct: 100, remaining: 0 };
  const span = next.min - rank.min;
  return {
    rank,
    next,
    pct: Math.max(0, Math.min(100, Math.round(((xp - rank.min) / span) * 100))),
    remaining: next.min - xp,
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
