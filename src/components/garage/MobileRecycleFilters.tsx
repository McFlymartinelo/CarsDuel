"use client";

import { useState } from "react";
import { ArrowRight, Check, Cog, Disc, LayoutGrid, RotateCcw, Settings2, TriangleAlert, type LucideIcon } from "lucide-react";
import { RARITY_LABEL } from "@/lib/format";
import type { Rarity } from "@/lib/types";
import {
  FILTER_BODY_CLASS,
  FILTER_CHIPS_CLASS,
  FILTER_COUNT_OFF,
  FILTER_COUNT_ON,
  FILTER_FOOTER_CLASS,
  FILTER_RARITY_OFF,
  FILTER_RARITY_ON,
  FILTER_RARITY_TILE,
  FILTER_RESET_CLASS,
  FILTER_SUBMIT_CLASS,
  FILTER_TYPE_OFF,
  FILTER_TYPE_ON,
  FILTER_TYPE_TILE,
  FilterChip,
  FilterSectionTitle,
  FilterSheet,
  FilterTrigger,
  RARITY_TONE,
} from "@/components/MobileFilterUi";

export type RecycleFilter = "toutes" | "moteurs" | "boites" | "pneus";

const FILTERS: { key: RecycleFilter; label: string; icon: LucideIcon }[] = [
  { key: "toutes", label: "Toutes", icon: LayoutGrid },
  { key: "moteurs", label: "Moteurs", icon: Cog },
  { key: "boites", label: "Boîtes", icon: Settings2 },
  { key: "pneus", label: "Pneus", icon: Disc },
];

const RARITIES = Object.keys(RARITY_LABEL) as Rarity[];

/** Barre mobile du centre de recyclage : « Filtres » + tri, comme la boutique et la collection. */
export function MobileRecycleFilters({
  filter,
  rarity,
  destroyed,
  sort,
  counts,
  rarityCounts,
  destroyedCount,
  sorts,
  resultCount,
  onFilter,
  onRarity,
  onDestroyed,
  onSort,
  onReset,
}: {
  filter: RecycleFilter;
  rarity: Rarity | "";
  destroyed: boolean;
  sort: string;
  counts: Record<RecycleFilter, number>;
  rarityCounts: Record<Rarity, number>;
  destroyedCount: number;
  sorts: readonly { key: string; label: string }[];
  resultCount: number;
  onFilter: (value: RecycleFilter) => void;
  onRarity: (value: Rarity | "") => void;
  onDestroyed: (value: boolean) => void;
  onSort: (value: string) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const activeCount = Number(filter !== "toutes") + Number(Boolean(rarity)) + Number(destroyed);
  const total = counts.toutes ?? 0;
  const rarityTotal = Object.values(rarityCounts).reduce((sum, count) => sum + count, 0);

  const chips: { key: string; label: string; icon?: LucideIcon; dot?: string; onClick: () => void }[] = [];
  if (filter !== "toutes") {
    const type = FILTERS.find((item) => item.key === filter);
    if (type) chips.push({ key: "type", label: type.label, icon: type.icon, onClick: () => onFilter("toutes") });
  }
  if (rarity) {
    chips.push({ key: "rarity", label: RARITY_LABEL[rarity], dot: RARITY_TONE[rarity].dot, onClick: () => onRarity("") });
  }
  if (destroyed) {
    chips.push({ key: "destroyed", label: "Cartes détruites", icon: TriangleAlert, onClick: () => onDestroyed(false) });
  }

  return (
    <div className="w-full md:hidden">
      <FilterTrigger
        activeCount={activeCount}
        open={open}
        onOpen={() => setOpen(true)}
        sorts={sorts}
        sort={sort}
        onSortChange={(key) => onSort(key ?? "")}
      />

      {chips.length > 0 && (
        <div className={FILTER_CHIPS_CLASS}>
          {chips.map(({ key, ...chip }) => (
            <FilterChip key={key} {...chip} />
          ))}
        </div>
      )}

      <FilterSheet
        open={open}
        onClose={() => setOpen(false)}
        labelId="mobile-recycle-filters-title"
        activeCount={activeCount}
        reset={(
          <button
            type="button"
            onClick={() => {
              onReset();
              setOpen(false);
            }}
            className={FILTER_RESET_CLASS}
          >
            <RotateCcw size={12} strokeWidth={2.25} />
            Réinitialiser
          </button>
        )}
      >
        <div className={FILTER_BODY_CLASS}>
          <section>
            <FilterSectionTitle hint={`${total}`}>Type</FilterSectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {FILTERS.map((type) => {
                const selected = type.key === filter;
                const Icon = type.icon;
                return (
                  <button
                    key={type.key}
                    type="button"
                    onClick={() => {
                      onFilter(type.key);
                      setOpen(false);
                    }}
                    aria-pressed={selected}
                    className={`${FILTER_TYPE_TILE} ${selected ? FILTER_TYPE_ON : FILTER_TYPE_OFF} ${type.key === "toutes" ? "col-span-2" : ""}`}
                  >
                    <Icon size={17} strokeWidth={2} className={selected ? "shrink-0 text-black/75" : "shrink-0 text-amber-400/80"} />
                    <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">{type.label}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${selected ? FILTER_COUNT_ON : FILTER_COUNT_OFF}`}>
                      {counts[type.key] ?? 0}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <FilterSectionTitle hint={rarity ? RARITY_LABEL[rarity] : "Toutes"}>Niveau</FilterSectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onRarity("")}
                aria-pressed={!rarity}
                className={`${FILTER_RARITY_TILE} ${!rarity ? FILTER_RARITY_ON : FILTER_RARITY_OFF}`}
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${!rarity ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]" : "bg-zinc-600"}`} />
                <span className="min-w-0 flex-1 truncate text-left">Toutes</span>
                <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${!rarity ? "bg-amber-400/15 text-amber-200/80" : FILTER_COUNT_OFF}`}>
                  {rarityTotal}
                </span>
              </button>
              {RARITIES.filter((key) => rarityCounts[key] > 0 || rarity === key).map((key) => {
                const selected = rarity === key;
                const tone = RARITY_TONE[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onRarity(key)}
                    aria-pressed={selected}
                    className={`${FILTER_RARITY_TILE} ${selected ? tone.on : FILTER_RARITY_OFF}`}
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot} ${selected ? "shadow-[0_0_6px_currentColor]" : ""}`} />
                    <span className="min-w-0 flex-1 truncate text-left">{RARITY_LABEL[key]}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${selected ? "bg-white/10 text-white/80" : FILTER_COUNT_OFF}`}>
                      {rarityCounts[key]}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <FilterSectionTitle>État</FilterSectionTitle>
            <button
              type="button"
              onClick={() => onDestroyed(!destroyed)}
              aria-pressed={destroyed}
              className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl border px-3 text-sm transition active:scale-[0.99] ${
                destroyed ? "border-red-400/60 bg-red-400/10 font-semibold text-red-100" : FILTER_RARITY_OFF
              }`}
            >
              <TriangleAlert size={17} strokeWidth={2} className={destroyed ? "shrink-0 text-red-300" : "shrink-0 text-red-400/80"} />
              <span className="min-w-0 flex-1 truncate text-left">Cartes détruites</span>
              <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${destroyed ? "bg-red-400/15 text-red-200/80" : FILTER_COUNT_OFF}`}>
                {destroyedCount}
              </span>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${destroyed ? "border-red-400/60 bg-red-400/20 text-red-200" : "border-white/10 bg-white/[0.04] text-transparent"}`}>
                <Check size={13} strokeWidth={3} />
              </span>
            </button>
          </section>
        </div>

        <div className={FILTER_FOOTER_CLASS}>
          <button type="button" onClick={() => setOpen(false)} className={FILTER_SUBMIT_CLASS}>
            Afficher {resultCount} carte{resultCount > 1 ? "s" : ""}
            <ArrowRight size={18} strokeWidth={2.25} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </FilterSheet>
    </div>
  );
}
