import type { CardTemplate, Category, DrawnCard, Rarity, UserCard } from "./types";

/** Poids forfaitaire d'une carte pneu dans la benne. */
export const RECYCLE_TIRE_WEIGHT_KG = 4;

/** Poids nécessaire pour produire un cube de ferraille. */
export const RECYCLE_CUBE_WEIGHT_KG = 10;

export type RecycleExchangeTier = "standard" | "ameliore" | "prestige";
export type RecycleExchangeCategory = Extract<Category, "moteur" | "boite">;

export interface RecycleExchangeOdds {
  rarity: Rarity;
  pct: number;
}

export interface RecycleExchangeTierConfig {
  key: RecycleExchangeTier;
  label: string;
  shortLabel: string;
  cost: number;
  tagline: string;
  /** Illustration transparente affichée sur la carte et dans le popup. */
  image: string;
  odds: RecycleExchangeOdds[];
}

/** Trois paliers de tirage du centre de recyclage (coût + table de rareté). */
export const RECYCLE_EXCHANGE_TIERS: Record<RecycleExchangeTier, RecycleExchangeTierConfig> = {
  standard: {
    key: "standard",
    label: "Échange Standard",
    shortLabel: "Standard",
    cost: 25,
    tagline: "Le tirage d'entrée de gamme, avec une forte majorité de communes.",
    image: "/garage/echange-standard.webp",
    odds: [
      { rarity: "commune", pct: 70 },
      { rarity: "rare", pct: 20 },
      { rarity: "tres_rare", pct: 7 },
      { rarity: "epique", pct: 2.5 },
      { rarity: "legendaire", pct: 0.5 },
    ],
  },
  ameliore: {
    key: "ameliore",
    label: "Échange Amélioré",
    shortLabel: "Amélioré",
    cost: 50,
    tagline: "Des chances nettement renforcées sur les raretés supérieures.",
    image: "/garage/echange-ameliore.webp",
    odds: [
      { rarity: "commune", pct: 45 },
      { rarity: "rare", pct: 35 },
      { rarity: "tres_rare", pct: 14 },
      { rarity: "epique", pct: 5 },
      { rarity: "legendaire", pct: 1 },
    ],
  },
  prestige: {
    key: "prestige",
    label: "Échange Prestige",
    shortLabel: "Prestige",
    cost: 100,
    tagline: "Le palier le plus généreux en très rares, épiques et légendaires.",
    image: "/garage/echange-prestige.webp",
    odds: [
      { rarity: "commune", pct: 15 },
      { rarity: "rare", pct: 45 },
      { rarity: "tres_rare", pct: 25 },
      { rarity: "epique", pct: 12 },
      { rarity: "legendaire", pct: 3 },
    ],
  },
};

export const RECYCLE_EXCHANGE_TIER_LIST: RecycleExchangeTierConfig[] = [
  RECYCLE_EXCHANGE_TIERS.standard,
  RECYCLE_EXCHANGE_TIERS.ameliore,
  RECYCLE_EXCHANGE_TIERS.prestige,
];

/** Coût historique du palier Standard (compatibilité). */
export const RECYCLE_EXCHANGE_COST = RECYCLE_EXCHANGE_TIERS.standard.cost;

/** Réponse d'un tirage : cartes révélées + nouveau solde de cubes. */
export interface RecycleExchangeResult {
  cards: DrawnCard[];
  cubesLeft: number;
  cost: number;
  tier: RecycleExchangeTier;
  category: RecycleExchangeCategory;
  rarity: Rarity | null;
}

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
