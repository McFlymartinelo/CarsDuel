import { ENGINE_SORTS, GEARBOX_SORTS, PRICE_SORT, type CardSort } from "@/lib/catalog-sort";
import type { Category, Rarity } from "@/lib/types";

export const FILTER_TABS: { key: string; label: string; category: Category }[] = [
  { key: "moteurs", label: "Moteurs", category: "moteur" },
  { key: "boites", label: "Boîtes", category: "boite" },
  { key: "pneus", label: "Pneus", category: "pneus" },
  { key: "bonus", label: "Bonus", category: "bonus" },
];

const RARITIES: Rarity[] = ["commune", "rare", "tres_rare", "epique", "legendaire"];

export function sortsFor(category: Category) {
  if (category === "moteur") return [...ENGINE_SORTS, PRICE_SORT];
  if (category === "boite") return [...GEARBOX_SORTS, PRICE_SORT];
  return [PRICE_SORT];
}

export interface CatalogQuery {
  tab: (typeof FILTER_TABS)[number];
  rarity?: Rarity;
  sort?: CardSort;
  min?: number;
  max?: number;
  risk?: number;
}

function bound(v: string | undefined): number | undefined {
  if (v == null || v.trim() === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return n;
}

export function readCatalogQuery(sp: {
  tab?: string;
  rarity?: string;
  sort?: string;
  min?: string;
  max?: string;
  risk?: string;
}): CatalogQuery {
  const tab = FILTER_TABS.find((t) => t.key === sp.tab) ?? FILTER_TABS[0];
  const mechanical = tab.category === "moteur" || tab.category === "boite";
  const rarity = mechanical && RARITIES.includes(sp.rarity as Rarity) ? (sp.rarity as Rarity) : undefined;
  const allowed = new Set(sortsFor(tab.category).map((s) => s.key));
  const sort = sp.sort && allowed.has(sp.sort as CardSort) ? (sp.sort as CardSort) : undefined;
  return { tab, rarity, sort, min: bound(sp.min), max: bound(sp.max), risk: mechanical ? bound(sp.risk) : undefined };
}
