"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  Boxes,
  Cog,
  Disc,
  LayoutGrid,
  List,
  Recycle,
  Settings2,
  TriangleAlert,
  Weight,
  type LucideIcon,
} from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { CardRow } from "@/components/CardRow";
import { CardView, type TirePerf } from "@/components/CardView";
import type { CardViewMode } from "@/components/ViewToggle";
import { RecycleExchangeTile } from "@/components/garage/RecycleExchangeTile";
import { RecycleLaunch } from "@/components/garage/RecycleLaunch";
import { addToRecycleBin, exchangeRecycledCard, removeFromRecycleBin } from "@/app/(game)/garage/actions";
import {
  formatCubes,
  formatKg,
  isRecyclableCategory,
  RECYCLE_EXCHANGE_COST,
  recycleBinSummary,
  recycleCardWeight,
} from "@/lib/recycle";
import type { Category, UserCard } from "@/lib/types";

export type RecycleTab = "inventaire" | "benne" | "echanges";
export type RecycleFilter = "toutes" | "moteurs" | "boites" | "pneus" | "detruites";

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
  { key: "detruites", label: "Cartes détruites", icon: TriangleAlert },
];

const VIEWS: { key: CardViewMode; label: string; icon: LucideIcon }[] = [
  { key: "cartes", label: "Cartes", icon: LayoutGrid },
  { key: "liste", label: "Liste", icon: List },
];

const FILTER_CATEGORY: Partial<Record<RecycleFilter, Category>> = {
  moteurs: "moteur",
  boites: "boite",
  pneus: "pneus",
};

const CATEGORY_ORDER: Record<Category, number> = { moteur: 0, boite: 1, pneus: 2, bonus: 3 };

const segment = (active: boolean) =>
  `inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
  }`;

const countClass = (active: boolean) => (active ? "tabular-nums text-black/60" : "tabular-nums text-zinc-500");

/** URL canonique du centre de recyclage (partage, rechargement). */
const recycleHref = (tab: RecycleTab, filter: RecycleFilter, view: CardViewMode) => {
  const params = new URLSearchParams({ tab });
  if (tab === "inventaire") params.set("cat", filter);
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

export function RecycleCenter({
  cubes,
  cards,
  tirePerfs,
  images,
  tab: initialTab,
  filter: initialFilter,
  view: initialView,
}: {
  cubes: number;
  cards: UserCard[];
  tirePerfs: TirePerf[];
  /** Visuel déjà résolu côté serveur (cardImageUrl lit le disque). */
  images: Record<string, string | null>;
  tab: RecycleTab;
  filter: RecycleFilter;
  view: CardViewMode;
}) {
  // Toutes les données du centre sont déjà chargées : les onglets et filtres
  // basculent localement. Une navigation RSC pour changer `?tab=` provoquait
  // une attente serveur (et parfois l'annulation de la requête) au retour
  // sur l'inventaire.
  const [tab, setTab] = useState<RecycleTab>(initialTab);
  const [filter, setFilter] = useState<RecycleFilter>(initialFilter);
  const [view, setView] = useState<CardViewMode>(initialView);

  const syncUrl = (nextTab: RecycleTab, nextFilter: RecycleFilter, nextView: CardViewMode) => {
    window.history.replaceState(null, "", recycleHref(nextTab, nextFilter, nextView));
  };

  const selectTab = (next: RecycleTab) => {
    setTab(next);
    syncUrl(next, filter, view);
  };

  const selectFilter = (next: RecycleFilter) => {
    setFilter(next);
    syncUrl(tab, next, view);
  };

  const selectView = (next: CardViewMode) => {
    setView(next);
    syncUrl(tab, filter, next);
  };

  const recyclable = cards
    .filter((c) => isRecyclableCategory(c.card_templates.category))
    .sort(
      (a, b) =>
        CATEGORY_ORDER[a.card_templates.category] - CATEGORY_ORDER[b.card_templates.category] ||
        a.card_templates.name.localeCompare(b.card_templates.name, "fr"),
    );
  const inventoryCards = recyclable.filter((c) => !c.in_recycle_bin && !c.is_listed);
  const binCards = recyclable.filter((c) => c.in_recycle_bin);
  const summary = recycleBinSummary(binCards);
  const compact = view === "liste";

  const filterCount = (key: RecycleFilter) => {
    if (key === "toutes") return inventoryCards.length;
    if (key === "detruites") return inventoryCards.filter((c) => c.is_destroyed).length;
    const category = FILTER_CATEGORY[key];
    return inventoryCards.filter((c) => c.card_templates.category === category).length;
  };

  const filtered = inventoryCards.filter((c) => {
    if (filter === "toutes") return true;
    if (filter === "detruites") return c.is_destroyed;
    return c.card_templates.category === FILTER_CATEGORY[filter];
  });

  const Card = compact ? CardRow : CardView;
  const gridClass = compact ? "grid gap-2 xl:grid-cols-2" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";

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
          <Link href="/garage" className="mb-1 inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-white">
            <ArrowLeft size={14} /> Retour au garage
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-400">Garage · Atelier</p>
          <h1 className="font-display text-3xl font-bold uppercase leading-none text-white sm:text-4xl">Centre de recyclage</h1>
          <p className="max-w-xl text-sm leading-relaxed text-zinc-300">
            Compactez vos pièces inutilisées en cubes de ferraille, puis échangez-les contre des moteurs et boîtes
            reconditionnés. Les cartes bonus restent à l&apos;écart de la benne.
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/40 bg-black/55 px-2.5 py-1 font-display text-sm font-semibold text-orange-200">
              <Boxes size={16} strokeWidth={2.1} />
              {formatCubes(cubes)}
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
            <div>
              <h2 className="font-display text-2xl font-bold uppercase">Inventaire recyclable</h2>
              <p className="text-sm text-zinc-400">
                Moteurs, boîtes et pneus, neufs, usés ou détruits. Une carte déposée quitte votre inventaire actif.
              </p>
            </div>
            <nav className="inline-flex gap-1 rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Affichage">
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

          <nav className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Filtrer l'inventaire recyclable">
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
                  <Icon size={15} strokeWidth={2} className={key === "detruites" ? "text-red-400" : undefined} />
                  {label}
                  <span className={countClass(active)}>{filterCount(key)}</span>
                </button>
              );
            })}
          </nav>

          {filtered.length === 0
            ? emptyState(
                "Aucune carte à recycler",
                "Ce filtre ne contient aucune carte. Les cartes en vente sont exclues de la benne.",
                filter !== "toutes" ? { label: "Voir toutes les cartes", onClick: () => selectFilter("toutes") } : undefined,
              )
            : (
              <div className={gridClass}>
                {filtered.map((c) => {
                  const t = c.card_templates;
                  const weight = recycleCardWeight(t);
                  return (
                    <Card key={c.id} template={t} card={c} image={images[c.id] ?? null} tirePerfs={tirePerfs}>
                      <div className="flex w-full flex-col gap-2">
                        <p className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                          <span className="inline-flex items-center gap-1">
                            <Weight size={13} /> {t.category === "pneus" ? "Poids forfaitaire" : "Poids"}
                          </span>
                          <span className="font-display text-sm font-semibold tabular-nums text-zinc-200">{formatKg(weight)}</span>
                        </p>
                        <ActionForm
                          action={addToRecycleBin}
                          submitLabel="Placer dans la benne"
                          variant="outline"
                          submitClassName="min-h-10 w-full rounded-lg px-3 text-sm font-semibold"
                          className="flex w-full"
                        >
                          <input type="hidden" name="card_id" value={c.id} />
                        </ActionForm>
                      </div>
                    </Card>
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
                    setFilter("toutes");
                    setTab("inventaire");
                    syncUrl("inventaire", "toutes", view);
                  },
                },
              )
            : (
              <div className={gridClass}>
                {binCards.map((c) => {
                  const t = c.card_templates;
                  const weight = recycleCardWeight(t);
                  return (
                    <Card key={c.id} template={t} card={c} image={images[c.id] ?? null} tirePerfs={tirePerfs}>
                      <div className="flex w-full flex-col gap-2">
                        <p className="flex items-center justify-between gap-2 text-xs text-zinc-400">
                          <span className="inline-flex items-center gap-1">
                            <Weight size={13} /> {t.category === "pneus" ? "Poids forfaitaire" : "Poids"}
                          </span>
                          <span className="font-display text-sm font-semibold tabular-nums text-zinc-200">{formatKg(weight)}</span>
                        </p>
                        <ActionForm
                          action={removeFromRecycleBin}
                          submitLabel="Retirer de la benne"
                          variant="ghost"
                          submitClassName="min-h-10 w-full rounded-lg px-3 text-sm font-semibold"
                          className="flex w-full"
                        >
                          <input type="hidden" name="card_id" value={c.id} />
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
                Échangez {RECYCLE_EXCHANGE_COST} cubes de ferraille contre une pièce mécanique aléatoire de la catégorie
                choisie. La carte est garantie et arrive avec 0 run.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/40 bg-orange-500/5 px-2.5 py-1 font-display text-sm font-semibold text-orange-200">
              <Boxes size={16} strokeWidth={2.1} />
              {formatCubes(cubes)} disponible{cubes === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <RecycleExchangeTile category="moteur" cubes={cubes} action={exchangeRecycledCard} />
            <RecycleExchangeTile category="boite" cubes={cubes} action={exchangeRecycledCard} />
          </div>
        </section>
      )}
    </section>
  );
}
