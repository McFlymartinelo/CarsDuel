import type { CardTemplate, Category, UserCard } from "./types";

/** Poids forfaitaire d'une carte pneu dans la benne. */
export const RECYCLE_TIRE_WEIGHT_KG = 4;

/** Poids nécessaire pour produire un cube de ferraille. */
export const RECYCLE_CUBE_WEIGHT_KG = 10;

/** Coût d'un échange de carte reconditionnée. */
export const RECYCLE_EXCHANGE_COST = 25;

export type RecyclableCategory = Extract<Category, "moteur" | "boite" | "pneus">;

export function isRecyclableCategory(category: Category): category is RecyclableCategory {
  return category === "moteur" || category === "boite" || category === "pneus";
}

/** Poids d'une carte dans la benne : poids réel (moteur/boîte) ou 4 kg (pneus). */
export function recycleCardWeight(t: Pick<CardTemplate, "category" | "weight_kg">): number {
  if (t.category === "pneus") return RECYCLE_TIRE_WEIGHT_KG;
  if (t.category === "moteur" || t.category === "boite") return Number(t.weight_kg ?? 0);
  return 0;
}

export interface RecycleBinSummary {
  cards: number;
  weightKg: number;
  cubes: number;
}

/** Résumé de la benne. Même formule que public.recycle_bin_process : floor(poids / 10). */
export function recycleBinSummary(cards: Pick<UserCard, "card_templates">[]): RecycleBinSummary {
  const weightKg = cards.reduce((total, card) => total + recycleCardWeight(card.card_templates), 0);
  // Les poids PostgreSQL sont des numeric(7,2) : on arrondit au centième pour éviter
  // qu'un artefact flottant (ex. 20.000000000004) ne fasse perdre un cube.
  const rounded = Math.round(weightKg * 100) / 100;
  return {
    cards: cards.length,
    weightKg: rounded,
    cubes: Math.floor(rounded / RECYCLE_CUBE_WEIGHT_KG),
  };
}

export const formatKg = (kg: number) =>
  `${kg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`;

export const formatCubes = (cubes: number) =>
  `${cubes.toLocaleString("fr-FR")} cube${cubes === 1 ? "" : "s"}`;
