"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Cog, Disc, Gauge, Hash, Settings2, Ticket, Timer, Weight, Zap, type LucideIcon } from "lucide-react";
import { compareCollectionDefault, compareTemplates } from "@/lib/catalog-sort";
import { CATEGORY_LABEL, RARITY_LABEL, TIRE_LABEL, cardSummary } from "@/lib/format";
import { matchesTemplateSearch } from "@/lib/search";
import type { CardTemplate, Category, Rarity } from "@/lib/types";
import { CardView, type TirePerf } from "@/components/CardView";
import { MobileCollectionFilters } from "@/components/MobileCollectionFilters";
import { SearchInput } from "@/components/SearchBox";
import { CatalogViewPanels } from "@/components/CatalogView";

type Entry = { card_templates: CardTemplate; obtained: boolean; image: string | null };
const CATEGORIES: { key: Category | "tout"; label: string }[] = [
  { key: "tout", label: "Toutes" }, { key: "moteur", label: "Moteurs" },
  { key: "boite", label: "Boîtes" }, { key: "pneus", label: "Pneus" }, { key: "bonus", label: "Bonus" },
];
const RARITIES: Rarity[] = ["commune", "rare", "tres_rare", "epique", "legendaire"];
const SORT_LABEL: Record<string, string> = {
  power: "Puissance", weight: "Poids", ref: "Référence", shift: "Temps de passage",
};
const SEGMENT = "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors";
const FILTER_ROW = "grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2";
const FILTER_LABEL = "font-display text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500";
const CATEGORY_ICONS: Partial<Record<Category | "tout", LucideIcon>> = { moteur: Cog, boite: Settings2, pneus: Disc, bonus: Zap };
const RARITY_DOT: Record<Rarity, string> = {
  commune: "bg-zinc-400", rare: "bg-blue-400", tres_rare: "bg-cyan-400", epique: "bg-purple-400", legendaire: "bg-amber-400",
};

function CollectionRow({ card_templates: template, image, obtained }: Entry) {
  const badge = template.rarity ? RARITY_LABEL[template.rarity]
    : template.category === "pneus" ? TIRE_LABEL[template.tire_type ?? ""] ?? "Pneus" : null;
  return <article className="flex min-w-0 flex-wrap items-center gap-3 rounded-xl border border-zinc-700/80 bg-[#0b0d12] p-2.5 sm:flex-nowrap sm:gap-4">
    <div className="relative flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-700 bg-gradient-to-b from-[#171a21] to-[#0a0c10]">
      {image ? <img src={image} alt="" loading="lazy" className="h-full w-full object-contain p-1 mix-blend-lighten" /> : <Cog aria-hidden className="h-8 w-8 text-zinc-500" strokeWidth={1.2} />}
    </div>
    <div className="min-w-0 flex-1 basis-40">
      <h3 className="truncate font-display text-base font-bold uppercase leading-tight text-white">{template.name}</h3>
      <p className="mt-0.5 font-display text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{CATEGORY_LABEL[template.category]}{badge ? ` · ${badge}` : ""}</p>
      <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{cardSummary(template)}</p>
    </div>
    {obtained && <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">Déjà obtenue</span>}
  </article>;
}

export function CollectorCollection({ entries, tirePerfs = [] }: { entries: Entry[]; tirePerfs?: TirePerf[] }) {
  const [category, setCategory] = useState<Category | "tout">("tout");
  const [rarity, setRarity] = useState<Rarity | "">("");
  const [sort, setSort] = useState("");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [search, setSearch] = useState("");
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.slice(1).map(({ key }) => [
    key, entries.filter(({ card_templates }) => card_templates.category === key && matchesTemplateSearch(card_templates, search)).length,
  ])) as Record<Category, number>, [entries, search]);
  const rarityCounts = useMemo(() => Object.fromEntries(RARITIES.map((value) => [
    value, entries.filter(({ card_templates }) =>
      (category === "tout" ? card_templates.category === "moteur" || card_templates.category === "boite" : card_templates.category === category)
      && card_templates.rarity === value && matchesTemplateSearch(card_templates, search)).length,
  ])) as Record<Rarity, number>, [entries, category, search]);
  const mechanical = category === "tout" || category === "moteur" || category === "boite";
  const sorts = useMemo(() => category === "moteur" ? ["power", "weight", "ref"]
    : category === "boite" ? ["shift", "weight", "ref"] : [], [category]);
  const sortOptions: { key: string; label: string; icon: LucideIcon; descending?: boolean }[] = category === "moteur"
    ? [{ key: "power", label: "Puissance", icon: Gauge, descending: true }, { key: "weight", label: "Poids", icon: Weight }, { key: "ref", label: "Référence", icon: Hash }]
    : category === "boite"
      ? [{ key: "shift", label: "Temps de passage", icon: Timer }, { key: "weight", label: "Poids", icon: Weight }, { key: "ref", label: "Référence", icon: Hash }]
      : [];
  const shown = useMemo(() => entries.filter(({ card_templates, obtained }) =>
    (category === "tout" || card_templates.category === category)
    && (!rarity || card_templates.rarity === rarity)
    && (!ownedOnly || obtained)
    && matchesTemplateSearch(card_templates, search))
    .slice()
    .sort((a, b) => {
      if (sort && sorts.includes(sort)) return compareTemplates(a.card_templates, b.card_templates, sort as "power" | "weight" | "ref" | "shift");
      return compareCollectionDefault(a.card_templates, b.card_templates);
    }), [entries, category, rarity, ownedOnly, sort, sorts, search]);

  const ownedCount = useMemo(() => entries.filter(({ card_templates, obtained }) =>
    obtained
    && (category === "tout" || card_templates.category === category)
    && (!rarity || card_templates.rarity === rarity)
    && matchesTemplateSearch(card_templates, search)).length, [entries, category, rarity, search]);
  const totalCount = useMemo(() => entries.filter(({ card_templates }) => matchesTemplateSearch(card_templates, search)).length, [entries, search]);

  const changeCategory = (next: Category | "tout") => {
    setCategory(next);
    setRarity("");
    setSort("");
  };

  return (
    <div className="space-y-4">
      <SearchInput
        value={search}
        onChange={setSearch}
        placeholder="Rechercher une carte, un nom, une référence…"
      />
      <div className="hidden space-y-3 md:block">
        <div className={FILTER_ROW}>
          <span className={FILTER_LABEL}>Type</span>
          <nav className="inline-flex max-w-full justify-self-start gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Type de carte">
            {CATEGORIES.map((item) => {
              const active = category === item.key;
              const Icon = CATEGORY_ICONS[item.key];
              return <button key={item.key} type="button" aria-pressed={active} onClick={() => changeCategory(item.key)} className={`inline-flex shrink-0 items-center gap-1.5 ${SEGMENT} ${active ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>
                {Icon && <Icon size={15} strokeWidth={2} />}{item.label}<span className={active ? "tabular-nums text-black/60" : "tabular-nums text-zinc-500"}>{item.key === "tout" ? totalCount : counts[item.key]}</span>
              </button>;
            })}
          </nav>
        </div>
        {mechanical && <div className={FILTER_ROW}>
          <span className={FILTER_LABEL}>Niveau</span>
          <nav className="inline-flex max-w-full justify-self-start gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Filtrer par rareté">
            <button type="button" aria-pressed={!rarity} onClick={() => setRarity("")} className={`${SEGMENT} shrink-0 ${!rarity ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>Tous</button>
            {RARITIES.filter((value) => rarityCounts[value] > 0 || rarity === value).map((value) => {
              const active = rarity === value;
              return <button key={value} type="button" aria-pressed={active} onClick={() => setRarity(value)} className={`inline-flex shrink-0 items-center gap-1.5 ${SEGMENT} ${active ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>
                <span className={`h-2 w-2 rounded-full ${active ? "bg-black/40" : RARITY_DOT[value]}`} />{RARITY_LABEL[value]}<span className={active ? "tabular-nums text-black/60" : "tabular-nums text-zinc-500"}>{rarityCounts[value]}</span>
              </button>;
            })}
          </nav>
        </div>}
        {sortOptions.length > 0 && <div className={FILTER_ROW}>
          <span className={FILTER_LABEL}>Trier</span>
          <nav className="inline-flex max-w-full justify-self-start gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Trier les cartes">
            {sortOptions.map(({ key, label, icon: Icon, descending }) => {
              const active = sort === key;
              const Direction = descending ? ArrowDown : ArrowUp;
              return <button key={key} type="button" aria-pressed={active} onClick={() => setSort(active ? "" : key)} className={`inline-flex shrink-0 items-center gap-1.5 ${SEGMENT} ${active ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>
                <Icon size={15} strokeWidth={2} />{label}<Direction size={14} strokeWidth={2.25} className={active ? "text-black/70" : "text-zinc-600"} />
              </button>;
            })}
          </nav>
        </div>}
        <div className={FILTER_ROW}>
          <span className={FILTER_LABEL}>Possession</span>
          <div className="inline-flex justify-self-start rounded-xl border border-zinc-800 bg-[#10131a] p-1">
            <button type="button" aria-pressed={ownedOnly} onClick={() => setOwnedOnly((value) => !value)} className={`inline-flex items-center gap-1.5 ${SEGMENT} ${ownedOnly ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>
              <Ticket size={15} strokeWidth={1.8} aria-hidden="true" />Déjà obtenue
            </button>
          </div>
        </div>
      </div>
      <MobileCollectionFilters
        category={category} setCategory={changeCategory} rarity={rarity} setRarity={setRarity}
        sort={sort} setSort={setSort} ownedOnly={ownedOnly} setOwnedOnly={setOwnedOnly}
        counts={counts} rarityCounts={rarityCounts}
        ownedCount={ownedCount}
        sorts={sorts.map((key) => ({ key, label: SORT_LABEL[key] }))} resultCount={shown.length}
      />
      <p className="text-xs text-zinc-400">{shown.length} carte{shown.length > 1 ? "s" : ""} affichée{shown.length > 1 ? "s" : ""} sur {entries.length}</p>
      {shown.length ? <CatalogViewPanels
        cards={<div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {shown.map(({ card_templates: template, obtained, image }) => <div key={template.id} className="relative">
            <CardView template={template} image={image} tirePerfs={tirePerfs} />
            {obtained && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"><span className="-rotate-[14deg] whitespace-nowrap rounded-[3px] border-2 border-emerald-400 bg-black/55 px-3 py-1 font-display text-[clamp(1.1rem,1.9vw,1.6rem)] font-bold uppercase tracking-[0.1em] text-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.5),inset_0_0_10px_rgba(52,211,153,0.25)] [text-shadow:0_0_8px_rgba(52,211,153,0.7)]">Déjà obtenue</span></div>}
          </div>)}
        </div>}
        list={<div className="grid min-w-0 gap-2">
          {shown.map((entry) => <CollectionRow key={entry.card_templates.id} {...entry} />)}
        </div>}
      /> : <p className="rounded-xl border border-zinc-800 bg-[#10131a] p-6 text-center text-sm text-zinc-400">Aucune carte dans cette sélection.</p>}
    </div>
  );
}
