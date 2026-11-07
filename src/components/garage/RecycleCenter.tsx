"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  Boxes,
  Cog,
  Disc,
  LayoutGrid,
  List,
  Minus,
  Plus,
  Recycle,
  Settings2,
  TriangleAlert,
  Undo2,
  Weight,
  type LucideIcon,
} from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { CardRow } from "@/components/CardRow";
import { CardView, type TirePerf } from "@/components/CardView";
import { FilterRow } from "@/components/FilterRow";
import { SortRow } from "@/components/SortRow";
import type { CardViewMode } from "@/components/ViewToggle";
import { BackToGarage } from "@/components/garage/BackToGarage";
import { MobileRecycleFilters } from "@/components/garage/MobileRecycleFilters";
import { RecycleExchangeTiers } from "@/components/garage/RecycleExchangeTiers";
import { RecycleLaunch } from "@/components/garage/RecycleLaunch";
import { addToRecycleBin, exchangeRecycledCard, removeFromRecycleBin } from "@/app/(game)/garage/actions";
import { cardGroupKey, groupCards } from "@/lib/card-groups";
import { ENGINE_SORTS, GEARBOX_SORTS, compareTemplates, type CardSort } from "@/lib/catalog-sort";
import { RARITY_LABEL } from "@/lib/format";
import {
  formatCubes,
  formatKg,
  isRecyclableCategory,
  recycleBinSummary,
} from "@/lib/recycle";
import type { ActionState, Category, Rarity, UserCard } from "@/lib/types";

export type RecycleTab = "inventaire" | "benne" | "echanges";
export type RecycleFilter = "toutes" | "moteurs" | "boites" | "pneus";

const TABS: { key: RecycleTab; label: string; icon: LucideIcon }[] = [
  { key: "inventaire", label: "Inventaire", icon: LayoutGrid },
  { key: "benne", label: "Benne", icon: Recycle },
  { key: "echanges", label: "Échanges", icon: ArrowLeftRight },
];

const FILTERS: { key: RecycleFilter; label: string; icon: LucideIcon }[] = [
  { key: "toutes", label: "Toutes", icon: LayoutGrid },
  { key: "moteurs", label: "Moteurs", icon: Cog },
  { key: "boites", label: "Boîtes", icon: Settings2 },
  { key: "pneus", label: "Pneus", icon: Disc },
];

const VIEWS: { key: CardViewMode; label: string; icon: LucideIcon }[] = [
  { key: "cartes", label: "Cartes", icon: LayoutGrid },
  { key: "liste", label: "Liste", icon: List },
];

const RARITIES = Object.keys(RARITY_LABEL) as Rarity[];

const RARITY_DOT: Record<Rarity, string> = {
  commune: "bg-zinc-400",
  rare: "bg-blue-400",
  tres_rare: "bg-cyan-400",
  epique: "bg-purple-400",
  legendaire: "bg-amber-400",
};

const isRarity = (value: string | undefined): value is Rarity =>
  !!value && (RARITIES as string[]).includes(value);

const FILTER_CATEGORY: Partial<Record<RecycleFilter, Category>> = {
  moteurs: "moteur",
  boites: "boite",
  pneus: "pneus",
};

export type RecycleSort = Exclude<CardSort, "price"> | "gomme";

/** Options de tri du même catalogue que boutique et marketplace, gomme en plus pour les pneus. */
const MIXED_SORTS = [
  { key: "ref", label: "Référence", title: "Numéro croissant" },
  { key: "power", label: "Puissance", title: "Plus puissant d'abord" },
  { key: "weight", label: "Poids", title: "Plus léger d'abord" },
  { key: "shift", label: "Temps de passage", title: "Plus rapide d'abord" },
  { key: "gomme", label: "Gomme", title: "Plus de gomme restante d'abord" },
] as const;

const SORTS: Record<RecycleFilter, readonly { key: RecycleSort; label: string; title: string }[]> = {
  toutes: MIXED_SORTS,
  moteurs: ENGINE_SORTS,
  boites: GEARBOX_SORTS,
  pneus: [{ key: "gomme", label: "Gomme", title: "Plus de gomme restante d'abord" }],
};

const trimSort = (filter: RecycleFilter, sort: string | undefined): string =>
  SORTS[filter].some((o) => o.key === sort) ? (sort as string) : "";

const byName = (a: UserCard, b: UserCard) => a.card_templates.name.localeCompare(b.card_templates.name, "fr");

/** Compare deux cartes selon le tri choisi (« gomme » n'existe pas dans le tri catalogue). */
function compareCards(a: UserCard, b: UserCard, sort: RecycleSort): number {
  if (sort === "gomme") {
    // Un pneu a une gomme ; les autres pièces n'en ont pas et restent groupées par modèle.
    const wear = Number(b.tire_wear ?? -1) - Number(a.tire_wear ?? -1);
    return wear || byName(a, b);
  }
  return compareTemplates(a.card_templates, b.card_templates, sort) || byName(a, b);
}

const CATEGORY_ORDER: Record<Category, number> = { moteur: 0, boite: 1, pneus: 2, bonus: 3 };

const segment = (active: boolean) =>
  `inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
  }`;

const countClass = (active: boolean) => (active ? "tabular-nums text-black/60" : "tabular-nums text-zinc-500");

/** URL canonique du centre de recyclage (partage, rechargement). */
const recycleHref = (
  tab: RecycleTab,
  filter: RecycleFilter,
  view: CardViewMode,
  sort = "",
  rarity = "",
  destroyed = false,
) => {
  const params = new URLSearchParams({ tab });
  if (tab === "inventaire") {
    params.set("cat", filter);
    if (rarity) params.set("rarity", rarity);
    if (destroyed) params.set("etat", "detruites");
    if (sort) params.set("sort", sort);
  }
  if (view === "liste") params.set("vue", "liste");
  return `/garage/recyclage?${params.toString()}`;
};

function emptyState(title: string, text: string, action?: { label: string; onClick: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-700 bg-[#0e1117] px-4 py-8 text-center">
      <Recycle size={34} strokeWidth={1.5} className="mx-auto text-zinc-600" />
      <p className="mt-3 font-display text-lg font-bold uppercase text-zinc-300">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-zinc-500">{text}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-amber-500/70 px-4 text-sm font-semibold text-amber-300 hover:bg-amber-500/10"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone = "text-white" }: { label: string; value: string; icon: LucideIcon; tone?: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-[#10131a] p-3 sm:p-4">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
        <Icon size={14} strokeWidth={2} />
        {label}
      </p>
      <p className={`mt-1 font-display text-2xl font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

const binStepBtn =
  "flex size-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-[#12151b] text-zinc-200 transition hover:border-amber-500/60 hover:text-amber-300 disabled:opacity-40 disabled:hover:border-zinc-700 disabled:hover:text-zinc-200";
const binField =
  "min-w-0 flex-1 rounded-lg border border-zinc-700 bg-[#12151b] px-2 py-1.5 text-center text-sm font-semibold tabular-nums text-white [appearance:textfield] focus:border-amber-500/60 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

/**
 * Dépose un ou plusieurs exemplaires d'un groupe dans la benne.
 * Comme la boutique, la quantité choisie est plafonnée au nombre du groupe.
 */
function PlaceInBinForm({
  cardIds,
  onResult,
}: {
  cardIds: string[];
  onResult?: (result: ActionState) => void;
}) {
  const [raw, setRaw] = useState("1");
  const max = cardIds.length;
  const qty = Math.min(Math.max(1, max), Math.max(1, Math.floor(Number(raw)) || 1));
  const selected = cardIds.slice(0, qty);

  return (
    <div className="flex w-full flex-col gap-2">
      {max > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Retirer un exemplaire"
            className={binStepBtn}
            disabled={qty <= 1}
            onClick={() => setRaw(String(qty - 1))}
          >
            <Minus size={14} strokeWidth={2.5} aria-hidden />
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={max}
            aria-label="Nombre d’exemplaires à placer dans la benne"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            onBlur={() => setRaw(String(qty))}
            className={binField}
          />
          <button
            type="button"
            aria-label="Ajouter un exemplaire"
            className={binStepBtn}
            disabled={qty >= max}
            onClick={() => setRaw(String(qty + 1))}
          >
            <Plus size={14} strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      )}
      <ActionForm
        action={addToRecycleBin}
        onResult={(result) => {
          if (result?.ok) setRaw("1");
          onResult?.(result);
        }}
        submitLabel={
          <span className="inline-flex items-center justify-center gap-1.5">
            <Recycle size={13} strokeWidth={2.5} aria-hidden />
            {max > 1 ? `Placer ${qty} dans la benne` : "Placer dans la benne"}
          </span>
        }
        variant="none"
        submitClassName="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-center text-xs font-semibold leading-tight text-amber-300 transition hover:border-amber-400 hover:bg-amber-500/20 hover:text-amber-200 active:scale-95"
        className="flex w-full"
      >
        {selected.map((id) => (
          <input key={id} type="hidden" name="card_id" value={id} />
        ))}
      </ActionForm>
    </div>
  );
}

export function RecycleCenter({
  cubes,
  cards,
  tirePerfs,
  images,
  tab: initialTab,
  filter: initialFilter,
  sort: initialSort,
  rarity: initialRarity,
  destroyed: initialDestroyed = false,
  view: initialView,
}: {
  cubes: number;
  cards: UserCard[];
  tirePerfs: TirePerf[];
  /** Visuel déjà résolu côté serveur (cardImageUrl lit le disque). */
  images: Record<string, string | null>;
  tab: RecycleTab;
  filter: RecycleFilter;
  /** Tri demandé dans l'URL, déjà filtré côté serveur contre les options connues. */
  sort?: string;
  /** Niveau (rareté) demandé dans l'URL, revalidé localement. */
  rarity?: string;
  /** Afficher uniquement les cartes détruites (filtre d'état, comme l'inventaire). */
  destroyed?: boolean;
  view: CardViewMode;
}) {
  // Toutes les données du centre sont déjà chargées : les onglets et filtres
  // basculent localement. Une navigation RSC pour changer `?tab=` provoquait
  // une attente serveur (et parfois l'annulation de la requête) au retour
  // sur l'inventaire.
  const [tab, setTab] = useState<RecycleTab>(initialTab);
  const [filter, setFilter] = useState<RecycleFilter>(initialFilter);
  const [view, setView] = useState<CardViewMode>(initialView);
  // Tri courant, validé à l'entrée contre les options du filtre initial : une
  // valeur d'URL obsolète retombe sur l'ordre par défaut au lieu de fausser l'affichage.
  const [sort, setSort] = useState<string>(() => trimSort(initialFilter, initialSort));
  // Niveau (rareté) courant : une valeur d'URL inconnue retombe sur « Tous ».
  const [rarity, setRarity] = useState<Rarity | "">(() => (isRarity(initialRarity) ? initialRarity : ""));
  // État « cartes détruites » : filtre indépendant du type, comme l'inventaire.
  const [destroyedOnly, setDestroyedOnly] = useState(initialDestroyed);
  // Solde local : le débit est reflété immédiatement (header de page) en attendant
  // le rafraîchissement RSC déclenché par la Server Action.
  const [cubeBalance, setCubeBalance] = useState(cubes);
  // Cartes en cours de chute : restent affichées le temps de l'animation, même si le serveur les a déjà déplacées.
  const [falling, setFalling] = useState<string[]>([]);

  useEffect(() => setCubeBalance(cubes), [cubes]);

  const syncUrl = (
    nextTab: RecycleTab,
    nextFilter: RecycleFilter,
    nextSort: string,
    nextView: CardViewMode,
    nextRarity: Rarity | "" = rarity,
    nextDestroyed = destroyedOnly,
  ) => {
    window.history.replaceState(
      null,
      "",
      recycleHref(nextTab, nextFilter, nextView, nextSort, nextRarity, nextDestroyed),
    );
  };

  const selectTab = (next: RecycleTab) => {
    setTab(next);
    setSort("");
    setRarity("");
    setDestroyedOnly(false);
    syncUrl(next, filter, "", view, "", false);
  };

  const selectSort = (next: string) => {
    setSort(next);
    syncUrl(tab, filter, next, view);
  };

  const selectFilter = (next: RecycleFilter) => {
    // Les options de tri dépendent du filtre : on repart de l'ordre par défaut.
    setFilter(next);
    setSort("");
    setRarity("");
    syncUrl(tab, next, "", view, "");
  };

  const selectRarity = (next: Rarity | "") => {
    setRarity(next);
    syncUrl(tab, filter, sort, view, next);
  };

  const selectDestroyed = (next: boolean) => {
    setDestroyedOnly(next);
    syncUrl(tab, filter, sort, view, rarity, next);
  };

  const selectView = (next: CardViewMode) => {
    setView(next);
    syncUrl(tab, filter, sort, next);
  };

  /** Vide type, niveau, état et tri pour retrouver tout l'inventaire recyclable. */
  const resetFilters = () => {
    setFilter("toutes");
    setSort("");
    setRarity("");
    setDestroyedOnly(false);
    syncUrl(tab, "toutes", "", view, "", false);
  };

  // Moteurs et boîtes par code croissant (M1A, M1B, M2…), pneus par modèle ;
  // le regroupement en badge ×N conserve cet ordre.
  const recyclable = cards
    .filter((c) => isRecyclableCategory(c.card_templates.category))
    .sort(
      (a, b) =>
        CATEGORY_ORDER[a.card_templates.category] - CATEGORY_ORDER[b.card_templates.category] ||
        (a.card_templates.category === "pneus"
          ? a.card_templates.name.localeCompare(b.card_templates.name, "fr")
          : compareTemplates(a.card_templates, b.card_templates, "ref")),
    );
  const inventoryCards = recyclable.filter((c) => (!c.in_recycle_bin && !c.is_listed) || falling.includes(c.id));
  const binCards = recyclable.filter((c) => c.in_recycle_bin);
  const summary = recycleBinSummary(binCards);
  const compact = view === "liste";

  const filterCount = (key: RecycleFilter) => {
    if (key === "toutes") return inventoryCards.length;
    const category = FILTER_CATEGORY[key];
    return inventoryCards.filter((c) => c.card_templates.category === category).length;
  };
  const filterCounts = Object.fromEntries(
    FILTERS.map(({ key }) => [key, filterCount(key)]),
  ) as Record<RecycleFilter, number>;

  const typed = inventoryCards.filter((c) => {
    if (filter === "toutes") return true;
    return c.card_templates.category === FILTER_CATEGORY[filter];
  });
  // Les compteurs de niveau portent sur le type sélectionné, avant les filtres de rareté et d'état.
  const rarityCounts = Object.fromEntries(
    RARITIES.map((key) => [key, typed.filter((c) => c.card_templates.rarity === key).length]),
  ) as Record<Rarity, number>;
  const hasRarity = RARITIES.some((key) => rarityCounts[key] > 0 || rarity === key);
  const destroyedCount = typed.filter((c) => c.is_destroyed).length;
  // Les filtres « détruites » et « niveau » se combinent avec le type.
  const filtered = typed.filter(
    (c) => (!destroyedOnly || c.is_destroyed) && (!rarity || c.card_templates.rarity === rarity),
  );
  // Tri explicite (rangée « Trier », même principe que boutique/marketplace) ;
  // sinon les cartes conservent l'ordre par défaut défini ci-dessus.
  const sortOptions = SORTS[filter];
  const activeSort = sortOptions.some((o) => o.key === sort) ? (sort as RecycleSort) : "";
  // Sur « Toutes », on garde le regroupement par catégorie (moteurs, boîtes,
  // pneus) puis on trie à l'intérieur de chacune.
  const mixed = filter === "toutes";
  const sorted =
    activeSort && filtered.length > 1
      ? filtered.slice().sort(
          (a, b) =>
            (mixed ? CATEGORY_ORDER[a.card_templates.category] - CATEGORY_ORDER[b.card_templates.category] : 0) ||
            compareCards(a, b, activeSort),
        )
      : filtered;
  // Même regroupement que l'inventaire : pneus à gomme égale, moteurs/boîtes au
  // même risque de casse actuel. Le badge ×N déplace ou retire tout le groupe.
  const inventoryGroups = groupCards(sorted, cardGroupKey);
  const binGroups = groupCards(binCards, cardGroupKey);

  const Card = compact ? CardRow : CardView;
  const gridClass = compact
    ? "grid gap-2 grid-cols-[repeat(auto-fill,minmax(max(20rem,calc((100%_-_1.5rem)/4)),1fr))]"
    : "grid gap-4 grid-cols-[repeat(auto-fill,minmax(max(16rem,calc((100%_-_3rem)/4)),1fr))]";

  const filterNav = (
    <nav
      className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1 md:justify-self-start"
      aria-label="Filtrer l'inventaire recyclable"
    >
      {FILTERS.map(({ key, label, icon: Icon }) => {
        const active = key === filter;
        return (
          <button
            key={key}
            type="button"
            onClick={() => selectFilter(key)}
            aria-current={active ? "true" : undefined}
            className={segment(active)}
          >
            <Icon size={15} strokeWidth={2} />
            {label}
            <span className={countClass(active)}>{filterCount(key)}</span>
          </button>
        );
      })}
    </nav>
  );

  const stateNav = (
    <nav
      className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1 md:justify-self-start"
      aria-label="Filtrer l'inventaire recyclable par état"
    >
      <button
        type="button"
        onClick={() => selectDestroyed(false)}
        aria-current={!destroyedOnly ? "true" : undefined}
        className={segment(!destroyedOnly)}
      >
        Toutes
      </button>
      <button
        type="button"
        onClick={() => selectDestroyed(true)}
        aria-current={destroyedOnly ? "true" : undefined}
        className={segment(destroyedOnly)}
      >
        <TriangleAlert size={15} strokeWidth={2} className={destroyedOnly ? undefined : "text-red-400"} />
        Cartes détruites
        <span className={countClass(destroyedOnly)}>{destroyedCount}</span>
      </button>
    </nav>
  );

  const rarityNav = (
    <nav
      className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1 md:justify-self-start"
      aria-label="Filtrer l'inventaire recyclable par niveau"
    >
      <button
        type="button"
        onClick={() => selectRarity("")}
        aria-current={!rarity ? "true" : undefined}
        className={segment(!rarity)}
      >
        Tous
      </button>
      {RARITIES.filter((key) => rarityCounts[key] > 0 || rarity === key).map((key) => {
        const active = key === rarity;
        return (
          <button
            key={key}
            type="button"
            onClick={() => selectRarity(key)}
            aria-current={active ? "true" : undefined}
            className={segment(active)}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${active ? "bg-black/40" : RARITY_DOT[key]}`} />
            {RARITY_LABEL[key]}
            <span className={countClass(active)}>{rarityCounts[key]}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <section className="space-y-4">
      <div className="relative min-h-[14rem] overflow-hidden rounded-2xl border border-zinc-800 bg-black sm:min-h-[16rem]">
        <Image
          src="/garage/recyclage.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center opacity-90"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05070a] via-[#05070a]/85 to-[#05070a]/15" />
        <div className="relative flex min-h-[14rem] flex-col justify-center gap-2 p-5 sm:min-h-[16rem] sm:p-7">
          <BackToGarage overlay />
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-400">Garage · Atelier</p>
          <h1 className="font-display text-3xl font-bold uppercase leading-none text-white sm:text-4xl">Centre de recyclage</h1>
          <p className="max-w-xl text-sm leading-relaxed text-zinc-300">
            Compactez vos pièces inutilisées en cubes de ferraille, puis échangez-les contre des moteurs et boîtes
            reconditionnés. Les cartes bonus restent à l&apos;écart de la benne.
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/40 bg-black/55 px-2.5 py-1 font-display text-sm font-semibold text-orange-200">
              <Boxes size={16} strokeWidth={2.1} />
              {formatCubes(cubeBalance)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-black/45 px-2.5 py-1 text-sm text-zinc-300">
              <Recycle size={15} strokeWidth={2} />
              {binCards.length} carte{binCards.length === 1 ? "" : "s"} dans la benne
            </span>
          </div>
        </div>
      </div>

      <nav className="grid grid-cols-3 gap-1 rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Sections du centre de recyclage">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = key === tab;
          const count = key === "inventaire" ? inventoryCards.length : key === "benne" ? binCards.length : null;
          return (
            <button
              key={key}
              type="button"
              onClick={() => selectTab(key)}
              aria-current={active ? "true" : undefined}
              className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 font-display text-sm font-semibold uppercase tracking-wide transition-colors ${
                active ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              <Icon size={17} strokeWidth={2} className="shrink-0" />
              <span className="truncate">{label}</span>
              {count !== null && <span className={countClass(active)}>{count}</span>}
            </button>
          );
        })}
      </nav>

      {tab === "inventaire" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-bold uppercase">Inventaire recyclable</h2>
              <p className="max-w-3xl text-sm text-zinc-400">
                Moteurs, boîtes et pneus, neufs, usés ou détruits. Une carte déposée quitte votre inventaire actif.
                Les cartes identiques (même modèle et même gomme ou même risque de casse) sont regroupées sous un badge ×N,
                et vous choisissez le nombre d’exemplaires à placer dans la benne.
              </p>
            </div>
            <nav className="inline-flex shrink-0 gap-1 rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Affichage">
              {VIEWS.map(({ key, label, icon: Icon }) => {
                const active = key === view;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectView(key)}
                    aria-current={active ? "true" : undefined}
                    className={segment(active)}
                  >
                    <Icon size={15} strokeWidth={2} />
                    {label}
                  </button>
                );
              })}
            </nav>
          </div>

          <MobileRecycleFilters
            filter={filter}
            rarity={rarity}
            destroyed={destroyedOnly}
            sort={activeSort}
            counts={filterCounts}
            rarityCounts={rarityCounts}
            destroyedCount={destroyedCount}
            sorts={sortOptions}
            resultCount={filtered.length}
            onFilter={selectFilter}
            onRarity={selectRarity}
            onDestroyed={selectDestroyed}
            onSort={selectSort}
            onReset={resetFilters}
          />

          <div className="hidden space-y-3 md:block">
            <FilterRow label="Type">{filterNav}</FilterRow>
            {hasRarity && <FilterRow label="Niveau">{rarityNav}</FilterRow>}
            <FilterRow label="État">{stateNav}</FilterRow>
          </div>

          {sortOptions.length > 0 && filtered.length > 1 && (
            <div className="hidden md:block">
              <SortRow
                options={sortOptions}
                current={sort}
                onSelect={(key) => selectSort(sort === key ? "" : key)}
                ariaLabel="Trier l'inventaire recyclable"
              />
            </div>
          )}

          {filtered.length === 0
            ? emptyState(
                "Aucune carte à recycler",
                "Ce filtre ne contient aucune carte. Les cartes en vente sont exclues de la benne.",
                rarity || destroyedOnly || filter !== "toutes"
                  ? { label: "Voir toutes les cartes", onClick: resetFilters }
                  : undefined,
              )
            : (
              <div className={gridClass}>
                {inventoryGroups.map(({ card: c, count, cards: group }) => {
                  const t = c.card_templates;
                  return (
                    <div
                      key={c.id}
                      className={falling.includes(c.id) ? "bin-drop" : undefined}
                      onSubmitCapture={() => setFalling((f) => [...f, c.id])}
                      onAnimationEnd={(e) => {
                        if (e.target === e.currentTarget) setFalling((f) => f.filter((id) => id !== c.id));
                      }}
                    >
                      <Card template={t} card={c} image={images[c.id] ?? null} tirePerfs={tirePerfs} quantity={count}>
                        <PlaceInBinForm
                          cardIds={group.map((x) => x.id)}
                          onResult={(result) => {
                            if (!result?.ok) setFalling((f) => f.filter((id) => id !== c.id));
                          }}
                        />
                      </Card>
                    </div>
                  );
                })}
              </div>
            )}
        </section>
      )}

      {tab === "benne" && (
        <section className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <Stat label="Poids total" value={formatKg(summary.weightKg)} icon={Weight} />
            <Stat label="Cubes générés" value={formatCubes(summary.cubes)} icon={Boxes} tone="text-orange-300" />
            <Stat label="Cartes dans la benne" value={summary.cards.toLocaleString("fr-FR")} icon={Recycle} />
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-zinc-800 bg-[#10131a] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold uppercase">Benne</h2>
              <p className="max-w-xl text-sm text-zinc-400">
                {summary.weightKg < 10
                  ? "Il faut au moins 10 kg pour produire un cube. Retirez ou ajoutez des cartes pour ajuster le poids."
                  : `10 kg = 1 cube. La benne produira ${formatCubes(summary.cubes)} en l'état.`}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Moteurs et boîtes : poids réel. Pneus : 4 kg par carte. L&apos;état d&apos;usure ne change pas le poids.
              </p>
            </div>
            <RecycleLaunch cardCount={summary.cards} weightKg={summary.weightKg} cubes={summary.cubes} />
          </div>

          {binCards.length === 0
            ? emptyState(
                "La benne est vide",
                "Déposez un moteur, une boîte ou des pneus depuis l'inventaire du centre de recyclage.",
                {
                  label: "Ouvrir l'inventaire",
                  onClick: () => {
                    setTab("inventaire");
                    setFilter("toutes");
                    setSort("");
                    setRarity("");
                    setDestroyedOnly(false);
                    syncUrl("inventaire", "toutes", "", view, "", false);
                  },
                },
              )
            : (
              <div className={gridClass}>
                {binGroups.map(({ card: c, count, cards: group }) => {
                  const t = c.card_templates;
                  const ids = group.map((x) => x.id);
                  return (
                    <Card key={c.id} template={t} card={c} image={images[c.id] ?? null} tirePerfs={tirePerfs} quantity={count}>
                      <div className="flex w-full flex-col gap-2">
                        <ActionForm
                          action={removeFromRecycleBin}
                          submitLabel={
                            <span className="inline-flex items-center justify-center gap-1.5">
                              <Undo2 size={13} strokeWidth={2.5} aria-hidden />
                              {count > 1 ? `Retirer les ${count} de la benne` : "Retirer de la benne"}
                            </span>
                          }
                          variant="none"
                          submitClassName="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full border border-zinc-600 bg-zinc-800/60 px-2 py-1.5 text-center text-xs font-semibold leading-tight text-zinc-200 transition hover:border-zinc-400 hover:bg-zinc-700/70 hover:text-white active:scale-95"
                          className="flex w-1/2"
                        >
                          {ids.map((id) => (
                            <input key={id} type="hidden" name="card_id" value={id} />
                          ))}
                        </ActionForm>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
        </section>
      )}

      {tab === "echanges" && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl font-bold uppercase">Atelier de reconditionnement</h2>
              <p className="max-w-2xl text-sm text-zinc-400">
                Choisissez un palier, puis la catégorie de la pièce. Chaque tirage suit sa propre table de rareté et
                produit une carte neuve, garantie et à 0 run.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/40 bg-orange-500/5 px-2.5 py-1 font-display text-sm font-semibold text-orange-200">
              <Boxes size={16} strokeWidth={2.1} />
              {formatCubes(cubeBalance)} disponible{cubeBalance === 1 ? "" : "s"}
            </span>
          </div>

          <RecycleExchangeTiers
            cubes={cubeBalance}
            action={exchangeRecycledCard}
            onCubesChange={setCubeBalance}
          />
        </section>
      )}
    </section>
  );
}
