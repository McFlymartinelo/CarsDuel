import type { CardTemplate, Category, UserCard } from "./types";

/** Tris proposés par l'inventaire du garage, adaptés à chaque catégorie. */
export type GroupSort = "power" | "weight" | "ref" | "shift" | "gomme" | "qty" | "name";

const MECHANICAL_SORTS = {
  moteur: [
    { key: "power", label: "Puissance", title: "Plus puissant d'abord" },
    { key: "weight", label: "Poids", title: "Plus léger d'abord" },
    { key: "ref", label: "Référence", title: "Numéro croissant" },
  ],
  boite: [
    { key: "shift", label: "Temps de passage", title: "Plus rapide d'abord" },
    { key: "weight", label: "Poids", title: "Plus léger d'abord" },
    { key: "ref", label: "Référence", title: "Numéro croissant" },
  ],
} as const satisfies Record<"moteur" | "boite", readonly { key: GroupSort; label: string; title: string }[]>;

const TIRE_SORTS = [
  { key: "gomme", label: "Gomme", title: "Plus de gomme restante d'abord" },
  { key: "name", label: "Nom", title: "Ordre alphabétique" },
] as const;

const BONUS_SORTS = [
  { key: "qty", label: "Quantité", title: "Plus d'exemplaires d'abord" },
  { key: "name", label: "Nom", title: "Ordre alphabétique" },
] as const;

export const INVENTORY_SORTS: Record<Category, readonly { key: GroupSort; label: string; title: string }[]> = {
  moteur: MECHANICAL_SORTS.moteur,
  boite: MECHANICAL_SORTS.boite,
  pneus: TIRE_SORTS,
  bonus: BONUS_SORTS,
};

/** Référence comparable (#1A, #1B, #2…) : nombre puis suffixe, comme catalog-sort. */
function refParts(code: string | null): [number, string] {
  const match = code?.match(/^[mb]_?(\d+)(.*)$/i);
  return match ? [Number(match[1]), match[2]] : [Number.MAX_SAFE_INTEGER, code ?? ""];
}

/** Ordre catalogue d'une carte (hors gomme / quantité / nom, traités à part). */
function compareByTemplate(a: CardTemplate, b: CardTemplate, sort: GroupSort): number {
  const name = a.name.localeCompare(b.name, "fr");
  if (sort === "power") return (b.power_hp ?? -1) - (a.power_hp ?? -1) || name;
  if (sort === "weight") {
    return (a.weight_kg ?? Number.MAX_SAFE_INTEGER) - (b.weight_kg ?? Number.MAX_SAFE_INTEGER) || name;
  }
  if (sort === "shift") {
    return (a.shift_time_ms ?? Number.MAX_SAFE_INTEGER) - (b.shift_time_ms ?? Number.MAX_SAFE_INTEGER) || name;
  }
  const [an, asuffix] = refParts(a.code);
  const [bn, bsuffix] = refParts(b.code);
  return an - bn || asuffix.localeCompare(bsuffix) || name;
}

/** Même formule que currentBreakRisk() dans game.ts, sans import runtime (tests unitaires Node). */
function currentBreakRisk(card: UserCard): number | null {
  const template = card.card_templates;
  if (template.category !== "moteur" && template.category !== "boite") return null;
  return Number(template.base_break_risk ?? 0) + card.runs_count * Number(template.wear_sensitivity ?? 0);
}

export type CardGroup = { card: UserCard; count: number; cards: UserCard[] };

/** Regroupe les cartes qui partagent une même clé, en conservant la première comme représentante. */
export function groupCards(cards: UserCard[], keyOf: (card: UserCard) => string): CardGroup[] {
  const groups = new Map<string, CardGroup>();
  for (const card of cards) {
    const key = keyOf(card);
    const group = groups.get(key);
    if (group) {
      group.count += 1;
      group.cards.push(card);
    } else groups.set(key, { card, count: 1, cards: [card] });
  }
  return [...groups.values()];
}

/** Gomme restante comparable : numeric PostgreSQL ("100.00") et number donnent la même clé. */
export const tireWearKey = (card: UserCard) =>
  card.tire_wear == null ? "sans-gomme" : Number(card.tire_wear).toFixed(2);

/** Risque de casse actuel arrondi au centième, comme l'affichage de la carte. */
export function breakRiskKey(card: UserCard): string {
  const risk = currentBreakRisk(card);
  return risk == null || !Number.isFinite(risk) ? "sans-risque" : risk.toFixed(2);
}

/**
 * Clé de regroupement d'une carte :
 * - bonus : même modèle ;
 * - pneus : même modèle et même gomme restante ;
 * - moteur / boîte : même modèle et même risque de casse actuel.
 * `includeWarranty` ajoute l'état de garantie pour l'inventaire : les actions
 * « réparer » / « étendre la garantie » ne s'appliquent qu'à une carte précise.
 * Une carte détruite garde sa propre fiche, tout comme une carte en vente
 * (les actions disponibles ne sont pas les mêmes).
 */
export function cardGroupKey(card: UserCard, includeWarranty = false): string {
  const category = card.card_templates.category;
  const mechanical = category === "moteur" || category === "boite";
  const base =
    category === "pneus"
      ? `${card.template_id}|${tireWearKey(card)}`
      : mechanical
        ? `${card.template_id}|${breakRiskKey(card)}`
        : card.template_id;
  const warranty =
    includeWarranty && mechanical
      ? `|w${card.warranty_used}/${card.warranty_duels}/${card.warranty_extended ? 1 : 0}${card.source === "reconditioned" ? "|reconditioned" : ""}`
      : "";
  return `${base}${warranty}${card.is_destroyed ? "|hs" : ""}${card.is_listed ? `|${card.id}` : ""}`;
}

/**
 * Trie les groupes d'un même onglet. Sans tri explicite : bonus par quantité,
 * pneus par nom puis gomme, moteurs/boîtes par nom puis usure.
 * Avec `sort`, applique le tri choisi dans la rangée « Trier ».
 */
export function sortCardGroups(
  groups: CardGroup[],
  category: Category,
  sort: GroupSort | "" = "",
): CardGroup[] {
  const byName = (a: CardGroup, b: CardGroup) =>
    a.card.card_templates.name.localeCompare(b.card.card_templates.name, "fr");

  if (!sort) {
    return [...groups].sort((a, b) => {
      if (category === "bonus") return b.count - a.count || byName(a, b);
      if (category === "pneus") {
        return byName(a, b) || Number(b.card.tire_wear ?? 0) - Number(a.card.tire_wear ?? 0);
      }
      return byName(a, b) || Number(b.card.runs_count) - Number(a.card.runs_count) || b.count - a.count;
    });
  }

  return [...groups].sort((a, b) => {
    if (sort === "qty") return b.count - a.count || byName(a, b);
    if (sort === "name") return byName(a, b);
    if (sort === "gomme") {
      return Number(b.card.tire_wear ?? -1) - Number(a.card.tire_wear ?? -1) || byName(a, b);
    }
    return compareByTemplate(a.card.card_templates, b.card.card_templates, sort) || b.count - a.count;
  });
}

