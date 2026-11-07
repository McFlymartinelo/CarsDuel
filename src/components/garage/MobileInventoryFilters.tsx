"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Cog, Disc, RotateCcw, Settings2, Zap, type LucideIcon } from "lucide-react";
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

const TYPES: { key: string; label: string; icon: LucideIcon }[] = [
  { key: "moteurs", label: "Moteurs", icon: Cog },
  { key: "boites", label: "Boîtes", icon: Settings2 },
  { key: "pneus", label: "Pneus", icon: Disc },
  { key: "bonus", label: "Bonus", icon: Zap },
];

const RARITIES = Object.keys(RARITY_LABEL) as Rarity[];
const DEFAULT_TAB = TYPES[0].key;

/** Barre mobile de l'inventaire : « Filtres » + tri, comme la boutique et la collection. */
export function MobileInventoryFilters({
  tab,
  rarity,
  sort,
  counts,
  rarityCounts,
  sorts,
  tabHrefs,
  rarityHrefs,
  sortHrefs,
  resetHref,
  resultCount,
  unitLabel,
}: {
  tab: string;
  rarity: Rarity | "";
  sort: string;
  counts: Record<string, number>;
  rarityCounts: Record<Rarity, number>;
  sorts: readonly { key: string; label: string }[];
  tabHrefs: Record<string, string>;
  rarityHrefs: Record<string, string>;
  sortHrefs: Record<string, string>;
  resetHref: string;
  resultCount: number;
  unitLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const activeCount = Number(tab !== DEFAULT_TAB) + Number(Boolean(rarity));
  const rarityTotal = Object.values(rarityCounts).reduce((sum, count) => sum + count, 0);

  const chips: { key: string; label: string; href: string; icon?: LucideIcon; dot?: string }[] = [];
  if (tab !== DEFAULT_TAB) {
    const type = TYPES.find((item) => item.key === tab);
    if (type) chips.push({ key: "type", label: type.label, href: tabHrefs[DEFAULT_TAB], icon: type.icon });
  }
  if (rarity) {
    chips.push({ key: "rarity", label: RARITY_LABEL[rarity], href: rarityHrefs[""], dot: RARITY_TONE[rarity].dot });
  }

  return (
    <div className="w-full md:hidden">
      <FilterTrigger
        activeCount={activeCount}
        open={open}
        onOpen={() => setOpen(true)}
        sorts={sorts}
        sort={sort}
        onSortChange={(key) => router.push(sortHrefs[key ?? ""] ?? sortHrefs[""])}
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
        labelId="mobile-inventory-filters-title"
        activeCount={activeCount}
        reset={(
          <Link href={resetHref} scroll={false} onClick={() => setOpen(false)} className={FILTER_RESET_CLASS}>
            <RotateCcw size={12} strokeWidth={2.25} />
            Réinitialiser
          </Link>
        )}
      >
        <div className={FILTER_BODY_CLASS}>
          <section>
            <FilterSectionTitle hint={`${Object.values(counts).reduce((sum, n) => sum + n, 0)}`}>Type</FilterSectionTitle>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((type) => {
                const selected = type.key === tab;
                const Icon = type.icon;
                return (
                  <Link
                    key={type.key}
                    href={tabHrefs[type.key]}
                    scroll={false}
                    onClick={() => setOpen(false)}
                    aria-current={selected ? "true" : undefined}
                    className={`${FILTER_TYPE_TILE} ${selected ? FILTER_TYPE_ON : FILTER_TYPE_OFF}`}
                  >
                    <Icon size={17} strokeWidth={2} className={selected ? "shrink-0 text-black/75" : "shrink-0 text-amber-400/80"} />
                    <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold">{type.label}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${selected ? FILTER_COUNT_ON : FILTER_COUNT_OFF}`}>
                      {counts[type.key] ?? 0}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>

          <section>
            <FilterSectionTitle hint={rarity ? RARITY_LABEL[rarity] : "Toutes"}>Niveau</FilterSectionTitle>
            <div className="grid grid-cols-2 gap-2">
              <Link
                href={rarityHrefs[""]}
                scroll={false}
                onClick={() => setOpen(false)}
                aria-current={!rarity ? "true" : undefined}
                className={`${FILTER_RARITY_TILE} ${!rarity ? FILTER_RARITY_ON : FILTER_RARITY_OFF}`}
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${!rarity ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]" : "bg-zinc-600"}`} />
                <span className="min-w-0 flex-1 truncate text-left">Toutes</span>
                <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${!rarity ? "bg-amber-400/15 text-amber-200/80" : FILTER_COUNT_OFF}`}>
                  {rarityTotal}
                </span>
              </Link>
              {RARITIES.filter((key) => rarityCounts[key] > 0 || rarity === key).map((key) => {
                const selected = rarity === key;
                const tone = RARITY_TONE[key];
                return (
                  <Link
                    key={key}
                    href={rarityHrefs[key]}
                    scroll={false}
                    onClick={() => setOpen(false)}
                    aria-current={selected ? "true" : undefined}
                    className={`${FILTER_RARITY_TILE} ${selected ? tone.on : FILTER_RARITY_OFF}`}
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot} ${selected ? "shadow-[0_0_6px_currentColor]" : ""}`} />
                    <span className="min-w-0 flex-1 truncate text-left">{RARITY_LABEL[key]}</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${selected ? "bg-white/10 text-white/80" : FILTER_COUNT_OFF}`}>
                      {rarityCounts[key]}
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>

        <div className={FILTER_FOOTER_CLASS}>
          <button type="button" onClick={() => setOpen(false)} className={FILTER_SUBMIT_CLASS}>
            Afficher {resultCount} {unitLabel}
            <ArrowRight size={18} strokeWidth={2.25} className="transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </FilterSheet>
    </div>
  );
}
