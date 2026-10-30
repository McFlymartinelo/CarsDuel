import type { CardTemplate } from "@/lib/types";

export const ENGINE_SORTS = [
  { key: "power", label: "Puissance", title: "Plus puissant d'abord" },
  { key: "weight", label: "Poids", title: "Plus léger d'abord" },
  { key: "ref", label: "Référence", title: "Numéro croissant" },
] as const;

export const GEARBOX_SORTS = [
  { key: "shift", label: "Temps de passage", title: "Plus rapide d'abord" },
  { key: "weight", label: "Poids", title: "Plus léger d'abord" },
  { key: "ref", label: "Référence", title: "Numéro croissant" },
] as const;

export const PRICE_SORT = { key: "price", label: "Prix", title: "Prix croissant" } as const;

export type CardSort = "power" | "weight" | "ref" | "shift" | "price";

/** Fragments ORDER BY figés. Jamais construits à partir du texte utilisateur. */
export const LISTING_ORDER_SQL: Record<CardSort, string> = {
  power: "t.power_hp desc nulls last, t.name",
  weight: "t.weight_kg asc nulls last, t.name",
  shift: "t.shift_time_ms asc nulls last, t.name",
  ref: "nullif(substring(t.code from '^[mbMB]_?([0-9]+)'), '')::int asc nulls last, t.code asc, t.name",
  price: "l.price asc nulls last, t.name",
};

function refParts(code: string | null): [number, string] {
  const m = code?.match(/^[mb]_?(\d+)(.*)$/i);
  if (!m) return [Number.MAX_SAFE_INTEGER, code ?? ""];
  return [Number(m[1]), m[2]];
}

const CATEGORY_ORDER: Record<CardTemplate["category"], number> = { moteur: 0, boite: 1, pneus: 2, bonus: 3 };

/** Ordre par défaut de la collection : catégorie, puis référence croissante (#1A, #1B, #2…). */
export function compareCollectionDefault(a: CardTemplate, b: CardTemplate): number {
  return CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] || compareTemplates(a, b, "ref");
}

export function compareTemplates(a: CardTemplate, b: CardTemplate, sort: CardSort): number {
  const name = a.name.localeCompare(b.name, "fr");
  if (sort === "power") return (b.power_hp ?? -1) - (a.power_hp ?? -1) || name;
  if (sort === "weight") return (a.weight_kg ?? Number.MAX_SAFE_INTEGER) - (b.weight_kg ?? Number.MAX_SAFE_INTEGER) || name;
  if (sort === "shift") return (a.shift_time_ms ?? Number.MAX_SAFE_INTEGER) - (b.shift_time_ms ?? Number.MAX_SAFE_INTEGER) || name;
  if (sort === "price") return name;
  const [an, asuf] = refParts(a.code);
  const [bn, bsuf] = refParts(b.code);
  return an - bn || asuf.localeCompare(bsuf) || name;
}
