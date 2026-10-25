import Link from "next/link";
import { Cog, Coins, Disc, Settings2, TriangleAlert, Zap, type LucideIcon } from "lucide-react";
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

const row = "grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2";
const label = "font-display text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500";
const field = "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-medium text-zinc-400";
const input = "!w-20 !py-1 text-white";

/** Type, puis rareté, puis tri, puis bornes de prix (et de risque de casse si `showRisk`). */
export function CatalogFilters({
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
  rarityCounts: Partial<Record<Rarity, number>>;
  extra?: Record<string, string | undefined>;
  showRisk?: boolean;
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
      <div className={row}>
        <span className={label}>Type</span>
        <nav className="inline-flex max-w-full justify-self-start gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Type de carte">
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
        <div className={row}>
          <span className={label}>Niveau</span>
          <nav className="inline-flex max-w-full justify-self-start gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Filtrer par rareté">
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

      <form action={path} className={row}>
        <input type="hidden" name="tab" value={query.tab.key} />
        {query.rarity && <input type="hidden" name="rarity" value={query.rarity} />}
        {query.sort && <input type="hidden" name="sort" value={query.sort} />}
        {Object.entries(extra ?? {}).map(([key, value]) => value ? <input key={key} type="hidden" name={key} value={value} /> : null)}
        <span className={label}>{showRisk && mechanical ? "Limites" : "Prix"}</span>
        <div className="inline-flex max-w-full flex-wrap items-center justify-self-start gap-1 rounded-xl border border-zinc-800 bg-[#10131a] p-1">
          <label className={field}>
            <Coins size={15} strokeWidth={2} />
            Prix mini
            <input name="min" type="number" min={0} step={1} defaultValue={query.min ?? ""} className={input} />
          </label>
          <label className={field}>
            <Coins size={15} strokeWidth={2} />
            Prix maxi
            <input name="max" type="number" min={0} step={1} defaultValue={query.max ?? ""} className={input} />
          </label>
          {showRisk && mechanical && (
            <label className={field}>
              <TriangleAlert size={15} strokeWidth={2} />
              Casse maxi
              <input name="risk" type="number" min={0} step={0.1} defaultValue={query.risk ?? ""} className={input} />
            </label>
          )}
          <button type="submit" className={`${seg(true)} cursor-pointer`}>Filtrer</button>
          {bounds && (
            <Link href={href({ min: null, max: null, risk: null })} scroll={false} className={seg(false)}>
              Effacer
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
