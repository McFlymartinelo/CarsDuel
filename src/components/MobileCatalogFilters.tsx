"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { FILTER_TABS, sortsFor, type CatalogQuery } from "@/lib/catalog-filters";
import { RARITY_LABEL } from "@/lib/format";
import type { Rarity } from "@/lib/types";

type RarityCounts = Partial<Record<Rarity, number>>;

export function MobileCatalogFilters({
  path,
  query,
  counts,
  rarityCounts,
  extra,
  showRisk = true,
}: {
  path: string;
  query: CatalogQuery;
  counts: Record<string, number>;
  rarityCounts: RarityCounts;
  extra?: Record<string, string | undefined>;
  showRisk?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const mechanical = query.tab.category === "moteur" || query.tab.category === "boite";
  const activeCount = Number(query.tab.key !== FILTER_TABS[0].key)
    + Number(Boolean(query.rarity))
    + Number(query.min != null)
    + Number(query.max != null)
    + Number(query.risk != null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const href = (over: {
    tab?: string;
    rarity?: string | null;
    sort?: string | null;
    min?: number | null;
    max?: number | null;
    risk?: number | null;
  }) => {
    const tab = over.tab ?? query.tab.key;
    const changed = tab !== query.tab.key;
    const params = new URLSearchParams();
    params.set("tab", tab);
    const rarity = over.rarity === null || (changed && over.rarity === undefined) ? undefined : (over.rarity ?? query.rarity);
    const sort = over.sort === null || (changed && over.sort === undefined) ? undefined : (over.sort ?? query.sort);
    const min = over.min === null ? undefined : (over.min ?? query.min);
    const max = over.max === null ? undefined : (over.max ?? query.max);
    const risk = over.risk === null || changed ? undefined : (over.risk ?? query.risk);
    if (rarity) params.set("rarity", rarity);
    if (sort) params.set("sort", sort);
    if (min != null) params.set("min", String(min));
    if (max != null) params.set("max", String(max));
    if (risk != null) params.set("risk", String(risk));
    for (const [key, value] of Object.entries(extra ?? {})) if (value) params.set(key, value);
    return `${path}?${params.toString()}`;
  };

  const sorts = sortsFor(query.tab.category);
  const summary = [
    query.tab.label,
    query.rarity ? RARITY_LABEL[query.rarity] : null,
    query.min != null || query.max != null
      ? `${query.min?.toLocaleString("fr-FR") ?? "0"}–${query.max?.toLocaleString("fr-FR") ?? "∞"} 🪙`
      : null,
    query.risk != null ? `Casse ≤ ${query.risk} %` : null,
  ].filter(Boolean).join(" · ");

  return (
    <div className="md:hidden">
      <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-[#10131a] p-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-amber-500 px-3 text-sm font-semibold text-black"
        >
          <SlidersHorizontal size={16} />
          Filtres
          {activeCount > 0 && <span className="rounded-full bg-black/15 px-1.5 py-0.5 text-xs">{activeCount}</span>}
        </button>
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-zinc-500">Tri</span>
          <select
            aria-label="Trier les résultats"
            value={query.sort ?? ""}
            onChange={(event) => {
              const selected = sorts.find((sort) => sort.key === event.target.value);
              if (selected) router.push(href({ sort: selected.key }));
              else if (query.sort) router.push(href({ sort: null }));
            }}
            className="min-w-0 flex-1 appearance-none truncate rounded-lg border border-zinc-700 bg-[#0d1015] px-2 py-2 text-sm text-zinc-200"
          >
            <option value="">Par défaut</option>
            {sorts.map((sort) => <option key={sort.key} value={sort.key}>{sort.label}</option>)}
          </select>
        </label>
      </div>
      <p className="mt-1.5 truncate px-1 text-xs text-amber-300" title={summary}>{summary}</p>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end"
        >
          <button type="button" onClick={() => setOpen(false)} aria-label="Fermer les filtres" className="absolute inset-0 bg-black/70" />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-filters-title"
            className="relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-3xl border border-zinc-700 bg-[#10131a] px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl"
          >
            <div className="mx-auto mb-4 h-1 w-14 rounded-full bg-zinc-600" />
            <div className="mb-4 flex items-center justify-between">
              <h2 id="mobile-filters-title" className="font-display text-xl font-bold uppercase">Filtres</h2>
              <div className="flex items-center gap-3">
                <Link href={href({ rarity: null, sort: null, min: null, max: null, risk: null })} onClick={() => setOpen(false)} className="text-sm font-medium text-amber-300">
                  Réinitialiser
                </Link>
                <button type="button" onClick={() => setOpen(false)} aria-label="Fermer les filtres" className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white">
                  <X size={19} />
                </button>
              </div>
            </div>

            <div className="space-y-5">
              <section>
                <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Type</h3>
                <div className="grid grid-cols-2 gap-2">
                  {FILTER_TABS.map((tab) => {
                    const selected = tab.key === query.tab.key;
                    return (
                      <Link
                        key={tab.key}
                        href={href({ tab: tab.key, rarity: null, sort: null, risk: null })}
                        onClick={() => setOpen(false)}
                        aria-current={selected ? "true" : undefined}
                        className={`flex min-h-10 items-center justify-between rounded-lg border px-3 text-sm font-semibold ${selected ? "border-amber-500 bg-amber-500 text-black" : "border-zinc-700 bg-[#171a21] text-zinc-300"}`}
                      >
                        <span className="truncate">{tab.label}</span>
                        <span className="ml-2 text-xs tabular-nums opacity-70">{counts[tab.category] ?? 0}</span>
                      </Link>
                    );
                  })}
                </div>
              </section>

              {mechanical && (
                <section>
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Niveau</h3>
                  <div className="flex flex-wrap gap-2">
                    <Link href={href({ rarity: null })} onClick={() => setOpen(false)} aria-current={!query.rarity ? "true" : undefined} className={`rounded-lg border px-3 py-2 text-sm font-medium ${!query.rarity ? "border-amber-500 bg-amber-500 text-black" : "border-zinc-700 bg-[#171a21] text-zinc-300"}`}>
                      Tous
                    </Link>
                    {(Object.keys(RARITY_LABEL) as Rarity[]).filter((rarity) => (rarityCounts[rarity] ?? 0) > 0 || rarity === query.rarity).map((rarity) => {
                      const selected = rarity === query.rarity;
                      return (
                        <Link key={rarity} href={href({ rarity })} onClick={() => setOpen(false)} aria-current={selected ? "true" : undefined} className={`rounded-lg border px-3 py-2 text-sm font-medium ${selected ? "border-amber-500 bg-amber-500 text-black" : "border-zinc-700 bg-[#171a21] text-zinc-300"}`}>
                          {RARITY_LABEL[rarity]} <span className="text-xs opacity-70">{rarityCounts[rarity] ?? 0}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}

              <form action={path} method="get" className="space-y-4">
                <input type="hidden" name="tab" value={query.tab.key} />
                {query.rarity && <input type="hidden" name="rarity" value={query.rarity} />}
                {query.sort && <input type="hidden" name="sort" value={query.sort} />}
                {Object.entries(extra ?? {}).map(([key, value]) => value ? <input key={key} type="hidden" name={key} value={value} /> : null)}
                <section>
                  <h3 className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Limites de prix</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1 text-xs text-zinc-400">
                      Prix mini
                      <input name="min" type="number" min={0} step={1} defaultValue={query.min ?? ""} placeholder="Montant" className="!w-full !py-2 text-sm text-white" />
                    </label>
                    <label className="space-y-1 text-xs text-zinc-400">
                      Prix maxi
                      <input name="max" type="number" min={0} step={1} defaultValue={query.max ?? ""} placeholder="Montant" className="!w-full !py-2 text-sm text-white" />
                    </label>
                  </div>
                </section>
                {showRisk && mechanical && (
                  <label className="block space-y-1 text-xs text-zinc-400">
                    Casse maximale (%)
                    <input name="risk" type="number" min={0} step={0.1} defaultValue={query.risk ?? ""} placeholder="Pourcentage" className="!w-full !py-2 text-sm text-white" />
                  </label>
                )}
                <button type="submit" className="min-h-11 w-full rounded-lg bg-amber-500 px-4 font-semibold text-black hover:bg-amber-400">
                  Appliquer les filtres
                </button>
              </form>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
