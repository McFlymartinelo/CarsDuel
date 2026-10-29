"use client";

import { useState } from "react";
import { ArrowRight, Check, Cog, Disc, Layers, RotateCcw, Settings2, Ticket, Zap, type LucideIcon } from "lucide-react";
import { RARITY_LABEL } from "@/lib/format";
import type { Category, Rarity } from "@/lib/types";
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

type CategoryKey = Category | "tout";

const TYPES: { key: CategoryKey; label: string; icon: LucideIcon }[] = [
  { key: "tout", label: "Toutes", icon: Layers },
  { key: "moteur", label: "Moteurs", icon: Cog },
  { key: "boite", label: "Boîtes", icon: Settings2 },
  { key: "pneus", label: "Pneus", icon: Disc },
  { key: "bonus", label: "Bonus", icon: Zap },
];
const RARITIES: Rarity[] = ["commune", "rare", "tres_rare", "epique", "legendaire"];

export function MobileCollectionFilters({
  category, setCategory, rarity, setRarity, sort, setSort, ownedOnly, setOwnedOnly,
  counts, rarityCounts, ownedCount, sorts, resultCount,
}: {
  category: CategoryKey;
  setCategory: (value: CategoryKey) => void;
  rarity: Rarity | "";
  setRarity: (value: Rarity | "") => void;
  sort: string;
  setSort: (value: string) => void;
  ownedOnly: boolean;
  setOwnedOnly: (value: boolean) => void;
  counts: Record<Category, number>;
  rarityCounts: Record<Rarity, number>;
  ownedCount: number;
  sorts: { key: string; label: string }[];
  resultCount: number;
}) {
  const [open, setOpen] = useState(false);
  const mechanical = category === "tout" || category === "moteur" || category === "boite";
  const activeCount = Number(category !== "tout") + Number(Boolean(rarity)) + Number(ownedOnly);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const sortOptions = [{ key: "name", label: "Nom A–Z" }, ...sorts];

  const reset = () => {
    setCategory("tout");
    setRarity("");
    setSort("");
    setOwnedOnly(false);
  };

  /** Même comportement que la barre desktop : changer de type efface tri et rareté. */
  const chooseCategory = (value: CategoryKey) => {
    setCategory(value);
    setRarity("");
    setSort("");
  };

  const chips: { key: string; label: string; icon?: LucideIcon; dot?: string; onClick: () => void }[] = [];
  if (category !== "tout") {
    const type = TYPES.find((item) => item.key === category);
    if (type) chips.push({ key: "category", label: type.label, icon: type.icon, onClick: () => chooseCategory("tout") });
  }
  if (rarity) {
    chips.push({ key: "rarity", label: RARITY_LABEL[rarity], dot: RARITY_TONE[rarity].dot, onClick: () => setRarity("") });
  }
  if (ownedOnly) {
    chips.push({ key: "owned", label: "Déjà obtenue", icon: Ticket, onClick: () => setOwnedOnly(false) });
  }

  return (
    <div className="w-full md:hidden">
      <FilterTrigger
        activeCount={activeCount}
        open={open}
        onOpen={() => setOpen(true)}
        sorts={sortOptions}
        sort={sort}
        onSortChange={(key) => setSort(key ?? "")}
      />

      {chips.length > 0 && (
        <div className={FILTER_CHIPS_CLASS}>
          {chips.map(({ key, ...chip }) => <FilterChip key={key} {...chip} />)}
        </div>
      )}

      <FilterSheet
        open={open}
        onClose={() => setOpen(false)}
        labelId="mobile-collection-filters-title"
        activeCount={activeCount}
        reset={(
          <button type="button" onClick={reset} className={FILTER_RESET_CLASS}>
            <RotateCcw size={12} strokeWidth={2.25} />
            Réinitialiser
          </button>
        )}
      >
        <div className={FILTER_BODY_CLASS}>
          <section>
            <FilterSectionTitle hint={`${total}`}>Type</FilterSectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((type) => {
                const selected = category === type.key;
                const count = type.key === "tout" ? total : counts[type.key];
                const Icon = type.icon;
                return (
                  <button
                    key={type.key}
                    type="button"
                    onClick={() => chooseCategory(type.key)}
                    aria-pressed={selected}
                    className={`${FILTER_TYPE_TILE} ${selected ? FILTER_TYPE_ON : FILTER_TYPE_OFF} ${type.key === "tout" ? "col-span-2" : ""}`}
                  >
                    <Icon size={17} strokeWidth={2} className={selected ? "shrink-0 text-black/75" : "shrink-0 text-amber-400/80"} />
                    <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">{type.label}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${selected ? FILTER_COUNT_ON : FILTER_COUNT_OFF}`}>{count}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {mechanical && (
            <section>
              <FilterSectionTitle hint={rarity ? RARITY_LABEL[rarity] : "Toutes"}>Niveau</FilterSectionTitle>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRarity("")}
                  aria-pressed={!rarity}
                  className={`${FILTER_RARITY_TILE} ${!rarity ? FILTER_RARITY_ON : FILTER_RARITY_OFF}`}
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${!rarity ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]" : "bg-zinc-600"}`} />
                  <span className="min-w-0 flex-1 truncate text-left">Toutes</span>
                  <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${!rarity ? "bg-amber-400/15 text-amber-200/80" : FILTER_COUNT_OFF}`}>
                    {Object.values(rarityCounts).reduce((sum, count) => sum + count, 0)}
                  </span>
                </button>
                {RARITIES.filter((value) => rarityCounts[value] > 0 || rarity === value).map((value) => {
                  const selected = rarity === value;
                  const tone = RARITY_TONE[value];
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRarity(value)}
                      aria-pressed={selected}
                      className={`${FILTER_RARITY_TILE} ${selected ? tone.on : FILTER_RARITY_OFF}`}
                    >
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot} ${selected ? "shadow-[0_0_6px_currentColor]" : ""}`} />
                      <span className="min-w-0 flex-1 truncate text-left">{RARITY_LABEL[value]}</span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${selected ? "bg-white/10 text-white/80" : FILTER_COUNT_OFF}`}>
                        {rarityCounts[value]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <FilterSectionTitle>Possession</FilterSectionTitle>
            <button
              type="button"
              onClick={() => setOwnedOnly(!ownedOnly)}
              aria-pressed={ownedOnly}
              className={`flex min-h-12 w-full items-center gap-2.5 rounded-xl border px-3 text-sm transition active:scale-[0.99] ${
                ownedOnly ? "border-emerald-400/60 bg-emerald-400/10 font-semibold text-emerald-100" : FILTER_RARITY_OFF
              }`}
            >
              <Ticket size={17} strokeWidth={2} className={ownedOnly ? "shrink-0 text-emerald-300" : "shrink-0 text-zinc-500"} />
              <span className="min-w-0 flex-1 truncate text-left">Déjà obtenue</span>
              <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${ownedOnly ? "bg-emerald-400/15 text-emerald-200/80" : FILTER_COUNT_OFF}`}>
                {ownedCount}
              </span>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${ownedOnly ? "border-emerald-400/60 bg-emerald-400/20 text-emerald-200" : "border-white/10 bg-white/[0.04] text-transparent"}`}>
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
