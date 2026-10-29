"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { RARITY_LABEL } from "@/lib/format";
import type { Category, Rarity } from "@/lib/types";

type CategoryKey = Category | "tout";
const TYPES: { key: CategoryKey; label: string }[] = [
  { key: "moteur", label: "Moteurs" }, { key: "boite", label: "Boîtes" },
  { key: "pneus", label: "Pneus" }, { key: "bonus", label: "Bonus" },
];
const RARITIES: Rarity[] = ["commune", "rare", "tres_rare", "epique", "legendaire"];

export function MobileCollectionFilters({
  category, setCategory, rarity, setRarity, sort, setSort, ownedOnly, setOwnedOnly,
  counts, rarityCounts, sorts, resultCount,
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
  sorts: { key: string; label: string }[];
  resultCount: number;
}) {
  const [open, setOpen] = useState(false);
  const mechanical = category === "tout" || category === "moteur" || category === "boite";
  const activeCount = Number(category !== "tout") + Number(Boolean(rarity)) + Number(ownedOnly);
  const summary = [
    category === "tout" ? "Toutes" : TYPES.find((type) => type.key === category)?.label,
    rarity ? RARITY_LABEL[rarity] : null,
    ownedOnly ? "Déjà obtenue" : null,
  ].filter(Boolean).join(" · ");

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const reset = () => {
    setCategory("tout"); setRarity(""); setSort(""); setOwnedOnly(false);
  };

  return <div className="w-full md:hidden">
    <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-[#10131a] p-2">
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open} className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-amber-500 px-3 text-sm font-semibold text-black">
        <SlidersHorizontal size={16} /> Filtres
        {activeCount > 0 && <span className="rounded-full bg-black/15 px-1.5 py-0.5 text-xs">{activeCount}</span>}
      </button>
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tri</span>
        <select aria-label="Trier les résultats" value={sort} onChange={(event) => setSort(event.target.value)} className="min-w-0 flex-1 appearance-none truncate rounded-lg border border-zinc-700 bg-[#0d1015] px-2 py-2 text-sm text-zinc-200">
          <option value="">Par défaut</option>
          <option value="name">Nom A–Z</option>
          {sorts.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
      </label>
    </div>
    <p className="mt-1.5 truncate px-1 text-xs text-amber-300" title={summary}>{summary}</p>
    {open && <div className="fixed inset-0 z-[60] flex items-end">
      <button type="button" onClick={() => setOpen(false)} aria-label="Fermer les filtres" className="absolute inset-0 bg-black/70" />
      <section role="dialog" aria-modal="true" aria-labelledby="mobile-collection-filters-title" className="relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-[#10131a] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-14 rounded-full bg-zinc-600" />
        <div className="mb-4 flex items-center justify-between">
          <h2 id="mobile-collection-filters-title" className="font-display text-xl font-bold uppercase">Filtres</h2>
          <div className="flex items-center gap-3">
            <button type="button" onClick={reset} className="text-sm font-medium text-amber-300">Réinitialiser</button>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer les filtres" className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"><X size={19} /></button>
          </div>
        </div>
        <div className="space-y-5">
          <section>
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Type</h3>
            <div className="grid grid-cols-2 gap-2">
              {[{ key: "tout" as const, label: "Toutes", count: Object.values(counts).reduce((sum, count) => sum + count, 0) }, ...TYPES.map((type) => ({ ...type, count: counts[type.key as Category] }))].map((type) => {
                const selected = category === type.key;
                return <button key={type.key} type="button" onClick={() => { setCategory(type.key); setRarity(""); setSort(""); }} aria-pressed={selected} className={`flex min-h-10 items-center justify-between rounded-lg border px-3 text-sm font-semibold ${selected ? "border-amber-500 bg-amber-500 text-black" : "border-zinc-700 bg-[#171a21] text-zinc-300"}`}>
                  <span className="truncate">{type.label}</span><span className="ml-2 text-xs tabular-nums opacity-70">{type.count}</span>
                </button>;
              })}
            </div>
          </section>
          {mechanical && <section>
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Rareté</h3>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setRarity("")} aria-pressed={!rarity} className={`rounded-lg border px-3 py-2 text-sm font-medium ${!rarity ? "border-amber-500 bg-amber-500 text-black" : "border-zinc-700 bg-[#171a21] text-zinc-300"}`}>Toutes</button>
              {RARITIES.filter((value) => rarityCounts[value] > 0 || rarity === value).map((value) => <button key={value} type="button" onClick={() => setRarity(value)} aria-pressed={rarity === value} className={`rounded-lg border px-3 py-2 text-sm font-medium ${rarity === value ? "border-amber-500 bg-amber-500 text-black" : "border-zinc-700 bg-[#171a21] text-zinc-300"}`}>
                {RARITY_LABEL[value]} <span className="text-xs opacity-70">{rarityCounts[value]}</span>
              </button>)}
            </div>
          </section>}
          <section>
            <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Possession</h3>
            <button type="button" onClick={() => setOwnedOnly(!ownedOnly)} aria-pressed={ownedOnly} className={`min-h-10 rounded-lg border px-3 text-sm font-medium ${ownedOnly ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-zinc-700 bg-[#171a21] text-zinc-300"}`}>Déjà obtenue {ownedOnly ? "✓" : ""}</button>
          </section>
          <button type="button" onClick={() => setOpen(false)} className="min-h-11 w-full rounded-lg bg-amber-500 px-4 font-semibold text-black hover:bg-amber-400">Afficher {resultCount} carte{resultCount === 1 ? "" : "s"}</button>
        </div>
      </section>
    </div>}
  </div>;
}
