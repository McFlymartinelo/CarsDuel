"use client";

import { useId, useMemo, useState } from "react";
import {
  ArrowRight,
  Cog,
  Disc,
  Layers,
  PackageSearch,
  RotateCcw,
  Settings2,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { FilterRow } from "@/components/FilterRow";
import {
  FILTER_BODY_CLASS,
  FILTER_CHIPS_CLASS,
  FILTER_COUNT_OFF,
  FILTER_COUNT_ON,
  FILTER_FOOTER_CLASS,
  FILTER_RESET_CLASS,
  FILTER_SUBMIT_CLASS,
  FILTER_TYPE_OFF,
  FILTER_TYPE_ON,
  FILTER_TYPE_TILE,
  FilterChip,
  FilterSectionTitle,
  FilterSheet,
  FilterTrigger,
} from "@/components/MobileFilterUi";
import { Modal } from "@/components/Modal";
import { SearchInput } from "@/components/SearchBox";
import { SortRow } from "@/components/SortRow";
import { TradeCardTile } from "@/components/marketplace/TradeCardTile";
import { ENGINE_SORTS, GEARBOX_SORTS, compareTemplates } from "@/lib/catalog-sort";
import type { Category, TradeCard } from "@/lib/types";

type SortKey = "power" | "weight" | "ref" | "shift" | "gomme" | "name";

/** Mêmes tris que les autres pages, adaptés à la catégorie affichée. */
const SORTS: Record<Category | "toutes", readonly { key: SortKey; label: string; title: string }[]> = {
  toutes: [
    { key: "name", label: "Nom", title: "Ordre alphabétique" },
    { key: "ref", label: "Référence", title: "Numéro croissant" },
  ],
  moteur: ENGINE_SORTS,
  boite: GEARBOX_SORTS,
  pneus: [
    { key: "gomme", label: "Gomme", title: "Plus de gomme restante d'abord" },
    { key: "name", label: "Nom", title: "Ordre alphabétique" },
  ],
  bonus: [{ key: "name", label: "Nom", title: "Ordre alphabétique" }],
};

function compareCards(a: TradeCard, b: TradeCard, sort: SortKey): number {
  const byName = a.card_templates.name.localeCompare(b.card_templates.name, "fr");
  if (sort === "name") return byName;
  if (sort === "gomme") return Number(b.tire_wear ?? -1) - Number(a.tire_wear ?? -1) || byName;
  return compareTemplates(a.card_templates, b.card_templates, sort) || byName;
}

const FILTERS: { key: Category | "toutes"; label: string; icon: LucideIcon }[] = [
  { key: "toutes", label: "Toutes", icon: Layers },
  { key: "moteur", label: "Moteurs", icon: Cog },
  { key: "boite", label: "Boîtes", icon: Settings2 },
  { key: "pneus", label: "Pneus", icon: Disc },
  { key: "bonus", label: "Bonus", icon: Zap },
];

/** Barre mobile standard : bouton « Filtres » + tri, puces des filtres actifs et feuille de filtres. */
function TradeMobileFilters({
  category,
  counts,
  sorts,
  sort,
  resultCount,
  open,
  onOpen,
  onClose,
  onCategory,
  onSort,
  onReset,
}: {
  category: Category | "toutes";
  counts: Record<string, number>;
  sorts: readonly { key: string; label: string; title: string }[];
  sort: string;
  resultCount: number;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onCategory: (value: Category | "toutes") => void;
  onSort: (value: string) => void;
  onReset: () => void;
}) {
  const active = category === "toutes" ? undefined : FILTERS.find((filter) => filter.key === category);
  const activeCount = active ? 1 : 0;

  return (
    <div className="w-full md:hidden">
      <FilterTrigger
        activeCount={activeCount}
        open={open}
        onOpen={onOpen}
        sorts={sorts}
        sort={sort}
        onSortChange={(key) => onSort(key ?? "")}
      />

      {active && (
        <div className={FILTER_CHIPS_CLASS}>
          <FilterChip label={active.label} icon={active.icon} onClick={() => onCategory("toutes")} />
        </div>
      )}

      <FilterSheet
        open={open}
        onClose={onClose}
        labelId="trade-inventory-filters-title"
        activeCount={activeCount}
        zClass="z-[90]"
        reset={
          <button type="button" onClick={onReset} className={FILTER_RESET_CLASS}>
            <RotateCcw size={12} strokeWidth={2.25} />
            Réinitialiser
          </button>
        }
      >
        <div className={FILTER_BODY_CLASS}>
          <section>
            <FilterSectionTitle hint={`${counts.toutes ?? 0}`}>Type</FilterSectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {FILTERS.map(({ key, label, icon: Icon }) => {
                const selected = key === category;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onCategory(key)}
                    aria-pressed={selected}
                    className={`${FILTER_TYPE_TILE} ${selected ? FILTER_TYPE_ON : FILTER_TYPE_OFF} ${key === "toutes" ? "col-span-2" : ""}`}
                  >
                    <Icon
                      size={17}
                      strokeWidth={2}
                      className={selected ? "shrink-0 text-black/75" : "shrink-0 text-amber-400/80"}
                    />
                    <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">{label}</span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${selected ? FILTER_COUNT_ON : FILTER_COUNT_OFF}`}
                    >
                      {counts[key] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <div className={FILTER_FOOTER_CLASS}>
          <button type="button" onClick={onClose} className={FILTER_SUBMIT_CLASS}>
            Afficher {resultCount} carte{resultCount > 1 ? "s" : ""}
            <ArrowRight size={18} strokeWidth={2.25} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </FilterSheet>
    </div>
  );
}

/** Inventaire en modale : une carte cliquée est ajoutée à l'emplacement courant. */
export function TradeInventoryPicker({
  ownerName,
  cards,
  excludedIds,
  onPick,
  onClose,
}: {
  ownerName: string;
  cards: TradeCard[];
  /** Cartes déjà placées dans les autres emplacements (non sélectionnables). */
  excludedIds: Set<string>;
  onPick: (card: TradeCard) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "toutes">("toutes");
  const [sort, setSort] = useState<SortKey | "">("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const sorts = SORTS[category];
  const activeSort = sorts.some((option) => option.key === sort) ? sort : "";

  const available = useMemo(() => cards.filter((card) => !excludedIds.has(card.id)), [cards, excludedIds]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = available.filter((card) => {
      if (category !== "toutes" && card.card_templates.category !== category) return false;
      if (!q) return true;
      const t = card.card_templates;
      return t.name.toLowerCase().includes(q) || (t.code ?? "").toLowerCase().includes(q);
    });
    return activeSort ? filtered.slice().sort((a, b) => compareCards(a, b, activeSort)) : filtered;
  }, [available, category, query, activeSort]);

  function chooseCategory(next: Category | "toutes") {
    setCategory(next);
    // Comme la collection : un tri qui n'a plus de sens dans la nouvelle catégorie est retiré.
    setSort((current) => (SORTS[next].some((option) => option.key === current) ? current : ""));
  }

  const counts = useMemo(() => {
    const map: Record<string, number> = { toutes: available.length };
    for (const card of available) map[card.card_templates.category] = (map[card.card_templates.category] ?? 0) + 1;
    return map;
  }, [available]);

  return (
    <Modal
      labelledBy={titleId}
      size="lg"
      // La feuille de filtres mobile gère elle-même Échap, sinon elle fermerait aussi la modale.
      onClose={filtersOpen ? undefined : onClose}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-amber-400/90">Sélection de carte</p>
          <h3 id={titleId} className="font-display text-2xl font-bold uppercase leading-tight">
            Inventaire de {ownerName}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer l'inventaire"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-strong text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-4">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Rechercher une carte, un nom, une référence…"
          label="Rechercher une carte"
        />
      </div>

      <div className="mt-3">
        <TradeMobileFilters
          category={category}
          counts={counts}
          sorts={sorts}
          sort={activeSort}
          resultCount={visible.length}
          open={filtersOpen}
          onOpen={() => setFiltersOpen(true)}
          onClose={() => setFiltersOpen(false)}
          onCategory={chooseCategory}
          onSort={(key) => setSort(key as SortKey | "")}
          onReset={() => {
            setCategory("toutes");
            setSort("");
          }}
        />
      </div>

      <div className="hidden md:mt-3 md:block md:space-y-3">
        <FilterRow label="Type">
          <nav
            className="inline-flex max-w-full justify-self-start gap-1 overflow-x-auto rounded-xl border border-line bg-panel p-1"
            aria-label="Catégories de l'inventaire"
          >
            {FILTERS.map(({ key, label, icon: Icon }) => {
              const on = category === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => chooseCategory(key)}
                  aria-pressed={on}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    on ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                  }`}
                >
                  <Icon size={15} strokeWidth={2} />
                  {label}
                  <span className={`tabular-nums ${on ? "text-black/60" : "text-zinc-500"}`}>{counts[key] ?? 0}</span>
                </button>
              );
            })}
          </nav>
        </FilterRow>
        <SortRow
          options={sorts}
          current={activeSort}
          onSelect={(key) => setSort(activeSort === key ? "" : (key as SortKey))}
          ariaLabel="Trier les cartes de l'inventaire"
        />
      </div>

      {visible.length === 0 ? (
        <div className="mt-5 rounded-xl border border-line bg-panel-mid px-4 py-10 text-center">
          <PackageSearch size={34} strokeWidth={1.4} className="mx-auto text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-400">
            {available.length === 0 ? "Aucune carte disponible pour cet échange." : "Aucune carte ne correspond à cette recherche."}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {visible.map((card) => (
            <TradeCardTile
              key={card.id}
              card={card}
              onClick={() => onPick(card)}
              label={`Choisir ${card.card_templates.name}`}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}
