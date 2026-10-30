"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Coins,
  Cog,
  Disc,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  TriangleAlert,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { FILTER_TABS, sortsFor, type CatalogQuery } from "@/lib/catalog-filters";
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

type RarityCounts = Partial<Record<Rarity, number>>;

const TAB_ICONS: Record<string, LucideIcon> = {
  moteurs: Cog,
  boites: Settings2,
  pneus: Disc,
  bonus: Zap,
};

const PRICE_PRESETS = [1_000, 5_000, 20_000];

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
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const router = useRouter();
  const mechanical = query.tab.category === "moteur" || query.tab.category === "boite";
  const activeCount = Number(query.tab.key !== FILTER_TABS[0].key)
    + Number(Boolean(query.rarity))
    + Number(query.min != null)
    + Number(query.max != null)
    + Number(query.risk != null);

  useEffect(() => {
    if (!open) return;
    setMinValue(query.min != null ? String(query.min) : "");
    setMaxValue(query.max != null ? String(query.max) : "");
  }, [open, query.min, query.max]);

  const href = (over: {
    tab?: string;
    rarity?: string | null;
    sort?: string | null;
    min?: number | null;
    max?: number | null;
    risk?: number | null;
    q?: string | null;
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
    const q = over.q === null ? undefined : (over.q ?? query.q);
    if (rarity) params.set("rarity", rarity);
    if (sort) params.set("sort", sort);
    if (min != null) params.set("min", String(min));
    if (max != null) params.set("max", String(max));
    if (risk != null) params.set("risk", String(risk));
    if (q) params.set("q", q);
    for (const [key, value] of Object.entries(extra ?? {})) if (value) params.set(key, value);
    return `${path}?${params.toString()}`;
  };

  const resetHref = href({ tab: FILTER_TABS[0].key, rarity: null, sort: null, min: null, max: null, risk: null, q: null });
  const sorts = sortsFor(query.tab.category);
  const rarityTotal = Object.values(rarityCounts).reduce((sum, n) => sum + (n ?? 0), 0);

  const chips: { key: string; label: string; href: string; icon?: LucideIcon; dot?: string }[] = [];
  if (query.tab.key !== FILTER_TABS[0].key) {
    chips.push({
      key: "tab",
      label: query.tab.label,
      href: href({ tab: FILTER_TABS[0].key, rarity: null, sort: null, risk: null }),
      icon: TAB_ICONS[query.tab.key],
    });
  }
  if (query.rarity) {
    chips.push({ key: "rarity", label: RARITY_LABEL[query.rarity], href: href({ rarity: null }), dot: RARITY_TONE[query.rarity].dot });
  }
  if (query.min != null || query.max != null) {
    chips.push({
      key: "price",
      label: `${query.min?.toLocaleString("fr-FR") ?? "0"} – ${query.max?.toLocaleString("fr-FR") ?? "∞"}`,
      href: href({ min: null, max: null }),
      icon: Coins,
    });
  }
  if (query.risk != null) {
    chips.push({ key: "risk", label: `Casse ≤ ${query.risk} %`, href: href({ risk: null }), icon: TriangleAlert });
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const form = event.currentTarget;
    form.querySelectorAll<HTMLInputElement>("input[name='min'], input[name='max'], input[name='risk']").forEach((input) => {
      if (input.value.trim() === "") input.disabled = true;
    });
    // Laisse la soumission native partir avant de refermer la feuille.
    window.setTimeout(() => setOpen(false), 0);
  };

  return (
    <div className="md:hidden">
      <FilterTrigger
        activeCount={activeCount}
        open={open}
        onOpen={() => setOpen(true)}
        sorts={sorts}
        sort={query.sort ?? ""}
        onSortChange={(key) => {
          if (key) router.push(href({ sort: key }));
          else if (query.sort) router.push(href({ sort: null }));
        }}
      />

      {chips.length > 0 && (
        <div className={FILTER_CHIPS_CLASS}>
          {chips.map(({ key, ...chip }) => <FilterChip key={key} {...chip} />)}
        </div>
      )}

      <FilterSheet
        open={open}
        onClose={() => setOpen(false)}
        labelId="mobile-filters-title"
        activeCount={activeCount}
        reset={(
          <Link href={resetHref} onClick={() => setOpen(false)} className={FILTER_RESET_CLASS}>
            <RotateCcw size={12} strokeWidth={2.25} />
            Réinitialiser
          </Link>
        )}
      >
        <form action={path} method="get" onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <input type="hidden" name="tab" value={query.tab.key} />
          {query.rarity && <input type="hidden" name="rarity" value={query.rarity} />}
          {query.sort && <input type="hidden" name="sort" value={query.sort} />}
          {query.q && <input type="hidden" name="q" value={query.q} />}
          {Object.entries(extra ?? {}).map(([key, value]) => value ? <input key={key} type="hidden" name={key} value={value} /> : null)}

          <div className={FILTER_BODY_CLASS}>
            <section>
              <FilterSectionTitle>Type</FilterSectionTitle>
              <div className="grid grid-cols-2 gap-2">
                {FILTER_TABS.map((tab) => {
                  const selected = tab.key === query.tab.key;
                  const Icon = TAB_ICONS[tab.key] ?? SlidersHorizontal;
                  return (
                    <Link
                      key={tab.key}
                      href={href({ tab: tab.key, rarity: null, sort: null, risk: null })}
                      scroll={false}
                      onClick={() => setOpen(false)}
                      aria-current={selected ? "true" : undefined}
                      className={`${FILTER_TYPE_TILE} ${selected ? FILTER_TYPE_ON : FILTER_TYPE_OFF}`}
                    >
                      <Icon size={17} strokeWidth={2} className={selected ? "shrink-0 text-black/75" : "shrink-0 text-amber-400/80"} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{tab.label}</span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${selected ? FILTER_COUNT_ON : FILTER_COUNT_OFF}`}>
                        {counts[tab.category] ?? 0}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>

            {mechanical && (
              <section>
                <FilterSectionTitle hint={query.rarity ? RARITY_LABEL[query.rarity] : "Toutes"}>Niveau</FilterSectionTitle>
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href={href({ rarity: null })}
                    scroll={false}
                    onClick={() => setOpen(false)}
                    aria-current={!query.rarity ? "true" : undefined}
                    className={`${FILTER_RARITY_TILE} ${!query.rarity ? FILTER_RARITY_ON : FILTER_RARITY_OFF}`}
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${!query.rarity ? "bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]" : "bg-zinc-600"}`} />
                    <span className="min-w-0 flex-1 truncate">Toutes</span>
                    <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${!query.rarity ? "bg-amber-400/15 text-amber-200/80" : FILTER_COUNT_OFF}`}>
                      {rarityTotal}
                    </span>
                  </Link>
                  {(Object.keys(RARITY_LABEL) as Rarity[]).filter((rarity) => (rarityCounts[rarity] ?? 0) > 0 || rarity === query.rarity).map((rarity) => {
                    const selected = rarity === query.rarity;
                    const tone = RARITY_TONE[rarity];
                    return (
                      <Link
                        key={rarity}
                        href={href({ rarity })}
                        scroll={false}
                        onClick={() => setOpen(false)}
                        aria-current={selected ? "true" : undefined}
                        className={`${FILTER_RARITY_TILE} ${selected ? tone.on : FILTER_RARITY_OFF}`}
                      >
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot} ${selected ? "shadow-[0_0_6px_currentColor]" : ""}`} />
                        <span className="min-w-0 flex-1 truncate">{RARITY_LABEL[rarity]}</span>
                        <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${selected ? "bg-white/10 text-white/80" : FILTER_COUNT_OFF}`}>
                          {rarityCounts[rarity] ?? 0}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            <section>
              <FilterSectionTitle>Prix</FilterSectionTitle>
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <label className="min-w-0">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Mini</span>
                  <div className="relative">
                    <Coins size={14} strokeWidth={2} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/70" />
                    <input
                      name="min"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={minValue}
                      onChange={(event) => setMinValue(event.target.value)}
                      placeholder="0"
                      className="!w-full !rounded-xl !border-white/10 !bg-[#0b0e13] !py-2.5 !pl-9 !pr-3 text-base font-semibold tabular-nums text-white placeholder:font-normal placeholder:text-zinc-600 [appearance:textfield] focus:!border-amber-400/60 focus:!outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                </label>
                <span className="pb-3 text-xs text-zinc-600">–</span>
                <label className="min-w-0">
                  <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Maxi</span>
                  <div className="relative">
                    <Coins size={14} strokeWidth={2} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/70" />
                    <input
                      name="max"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      value={maxValue}
                      onChange={(event) => setMaxValue(event.target.value)}
                      placeholder="∞"
                      className="!w-full !rounded-xl !border-white/10 !bg-[#0b0e13] !py-2.5 !pl-9 !pr-3 text-base font-semibold tabular-nums text-white placeholder:font-normal placeholder:text-zinc-600 [appearance:textfield] focus:!border-amber-400/60 focus:!outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </div>
                </label>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {PRICE_PRESETS.map((preset) => {
                  const selected = maxValue === String(preset) && minValue === "";
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        setMinValue("");
                        setMaxValue(String(preset));
                      }}
                      aria-pressed={selected}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium tabular-nums transition ${
                        selected
                          ? "border-amber-400/50 bg-amber-400/15 text-amber-200"
                          : "border-white/[0.07] bg-white/[0.03] text-zinc-400 active:bg-white/[0.07]"
                      }`}
                    >
                      ≤ {preset.toLocaleString("fr-FR")}
                    </button>
                  );
                })}
                {(minValue !== "" || maxValue !== "") && (
                  <button
                    type="button"
                    onClick={() => {
                      setMinValue("");
                      setMaxValue("");
                    }}
                    className="rounded-full px-2 py-1 text-[11px] font-medium text-zinc-500 underline decoration-zinc-700 underline-offset-2 active:text-zinc-300"
                  >
                    Effacer
                  </button>
                )}
              </div>
            </section>

            {showRisk && mechanical && (
              <section>
                <FilterSectionTitle hint="%">Casse maximale</FilterSectionTitle>
                <div className="relative">
                  <TriangleAlert size={14} strokeWidth={2} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-amber-400/70" />
                  <input
                    name="risk"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step={0.1}
                    defaultValue={query.risk ?? ""}
                    placeholder="Pourcentage accepté"
                    className="!w-full !rounded-xl !border-white/10 !bg-[#0b0e13] !py-2.5 !pl-9 !pr-3 text-base font-semibold tabular-nums text-white placeholder:font-normal placeholder:text-zinc-600 [appearance:textfield] focus:!border-amber-400/60 focus:!outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              </section>
            )}
          </div>

          <div className={FILTER_FOOTER_CLASS}>
            <button type="submit" className={FILTER_SUBMIT_CLASS}>
              Appliquer les filtres
              <ArrowRight size={18} strokeWidth={2.25} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </form>
      </FilterSheet>
    </div>
  );
}
