import Link from "next/link";
import { Cog, Disc, Settings2, Zap, type LucideIcon } from "lucide-react";
import { SortLinks } from "@/components/SortLinks";
import { FILTER_TABS, sortsFor, type CatalogQuery } from "@/lib/catalog-filters";
import { RARITY_LABEL } from "@/lib/format";
import type { Rarity } from "@/lib/types";

const ICONS: Record<string, LucideIcon> = { moteurs: Cog, boites: Settings2, pneus: Disc, bonus: Zap };

const RARITY_DOT: Record<Rarity, string> = {
  commune: "bg-zinc-400",
  rare: "bg-blue-400",
  tres_rare: "bg-cyan-400",
  epique: "bg-purple-400",
  legendaire: "bg-amber-400",
};

const seg = (active: boolean) =>
  `inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
  }`;

/** Type, puis rareté, puis tri. Prix mini / maxi et risque de casse en plus. */
export function CatalogFilters({
  path,
  query,
  counts,
  rarityCounts,
  extra,
}: {
  path: string;
  query: CatalogQuery;
  counts: Record<string, number>;
  rarityCounts: Partial<Record<Rarity, number>>;
  extra?: Record<string, string | undefined>;
}) {
  const mechanical = query.tab.category === "moteur" || query.tab.category === "boite";
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
    const q = new URLSearchParams();
    q.set("tab", tab);
    const rarity = over.rarity === null || (changed && over.rarity === undefined) ? undefined : (over.rarity ?? query.rarity);
    const sort = over.sort === null || (changed && over.sort === undefined) ? undefined : (over.sort ?? query.sort);
    const min = over.min === null ? undefined : (over.min ?? query.min);
    const max = over.max === null ? undefined : (over.max ?? query.max);
    const risk = over.risk === null || changed ? undefined : (over.risk ?? query.risk);
    if (rarity) q.set("rarity", rarity);
    if (sort) q.set("sort", sort);
    if (min != null) q.set("min", String(min));
    if (max != null) q.set("max", String(max));
    if (risk != null) q.set("risk", String(risk));
    for (const [key, value] of Object.entries(extra ?? {})) if (value) q.set(key, value);
    return `${path}?${q.toString()}`;
  };
  const bounds = query.min != null || query.max != null || query.risk != null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Type</span>
        <nav className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Type de carte">
          {FILTER_TABS.map((t) => {
            const on = t.key === query.tab.key;
            const Icon = ICONS[t.key];
            return (
              <Link key={t.key} href={href({ tab: t.key, rarity: null, sort: null, risk: null })} scroll={false} aria-current={on ? "true" : undefined} className={seg(on)}>
                <Icon size={15} strokeWidth={2} />
                {t.label}
                <span className={on ? "tabular-nums text-black/60" : "tabular-nums text-zinc-500"}>{counts[t.category] ?? 0}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {mechanical && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Niveau</span>
          <nav className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Filtrer par rareté">
            <Link href={href({ rarity: null })} scroll={false} aria-current={!query.rarity ? "true" : undefined} className={seg(!query.rarity)}>
              Tous
            </Link>
            {(Object.keys(RARITY_LABEL) as Rarity[]).filter((r) => (rarityCounts[r] ?? 0) > 0 || r === query.rarity).map((r) => {
              const on = r === query.rarity;
              return (
                <Link key={r} href={href({ rarity: r })} scroll={false} aria-current={on ? "true" : undefined} className={seg(on)}>
                  <span className={`h-2 w-2 shrink-0 rounded-full ${on ? "bg-black/40" : RARITY_DOT[r]}`} />
                  {RARITY_LABEL[r]}
                  <span className={on ? "tabular-nums text-black/60" : "tabular-nums text-zinc-500"}>{rarityCounts[r] ?? 0}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      <SortLinks label="Trier" options={sortsFor(query.tab.category)} current={query.sort} hrefFor={(key) => href({ sort: key })} />

      <form action={path} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="tab" value={query.tab.key} />
        {query.rarity && <input type="hidden" name="rarity" value={query.rarity} />}
        {query.sort && <input type="hidden" name="sort" value={query.sort} />}
        {Object.entries(extra ?? {}).map(([key, value]) => value ? <input key={key} type="hidden" name={key} value={value} /> : null)}
        <label className="text-xs text-zinc-400">
          Prix mini
          <input name="min" type="number" min={0} step={1} defaultValue={query.min ?? ""} className="mt-1 block w-28" />
        </label>
        <label className="text-xs text-zinc-400">
          Prix maxi
          <input name="max" type="number" min={0} step={1} defaultValue={query.max ?? ""} className="mt-1 block w-28" />
        </label>
        {mechanical && (
          <label className="text-xs text-zinc-400">
            Risque de casse maxi
            <input name="risk" type="number" min={0} step={0.1} defaultValue={query.risk ?? ""} className="mt-1 block w-36" />
          </label>
        )}
        <button type="submit" className="min-h-10 rounded-lg border border-zinc-600 px-3 text-sm hover:bg-zinc-800">Filtrer</button>
        {bounds && (
          <Link href={href({ min: null, max: null, risk: null })} scroll={false} className="pb-2 text-sm text-zinc-400 hover:text-white">
            Effacer
          </Link>
        )}
      </form>
    </div>
  );
}
