import Link from "next/link";
import { Cog, Disc, Settings2, Zap, type LucideIcon } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { CardRow } from "@/components/CardRow";
import { CardView, type TirePerf } from "@/components/CardView";
import { FilterRow } from "@/components/FilterRow";
import { SortRow } from "@/components/SortRow";
import { ViewToggle, type CardViewMode } from "@/components/ViewToggle";
import { PageHeader } from "@/components/PageHeader";
import { MobileInventoryFilters } from "@/components/garage/MobileInventoryFilters";
import { SellDialog } from "@/components/garage/SellDialog";
import { ExtendWarrantyDialog } from "@/components/garage/ExtendWarrantyDialog";
import { extendWarranty, repairCard } from "@/app/(game)/garage/actions";
import { cancelListing, listCard } from "@/app/(game)/marketplace/actions";
import { cardImageUrl } from "@/lib/card-images";
import { INVENTORY_SORTS, cardGroupKey, groupCards, sortCardGroups, type GroupSort } from "@/lib/card-groups";
import { RARITY_LABEL } from "@/lib/format";
import { warrantyState } from "@/lib/game";
import type { Category, Rarity, UserCard } from "@/lib/types";

export const TABS: { key: string; label: string; category: Category; icon: LucideIcon }[] = [
  { key: "moteurs", label: "Moteurs", category: "moteur", icon: Cog },
  { key: "boites", label: "Boîtes", category: "boite", icon: Settings2 },
  { key: "pneus", label: "Pneus", category: "pneus", icon: Disc },
  { key: "bonus", label: "Bonus", category: "bonus", icon: Zap },
];

const seg = (active: boolean) =>
  `inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
  }`;

const countClass = (active: boolean) => (active ? "tabular-nums text-black/60" : "tabular-nums text-zinc-500");

const RARITIES = Object.keys(RARITY_LABEL) as Rarity[];

const RARITY_DOT: Record<Rarity, string> = {
  commune: "bg-zinc-400",
  rare: "bg-blue-400",
  tres_rare: "bg-cyan-400",
  epique: "bg-purple-400",
  legendaire: "bg-amber-400",
};

export function Inventory({
  cards,
  tab,
  sort,
  rarity,
  hrefForTab,
  hrefForSort,
  hrefForRarity,
  view,
  hrefForView,
  tirePerfs = [],
  listings = {},
}: {
  cards: UserCard[];
  tab: string;
  /** Tri demandé dans l'URL, revalidé contre les options de la catégorie. */
  sort: string;
  /** Niveau (rareté) demandé dans l'URL, revalidé localement. */
  rarity: string;
  hrefForTab: (tabKey: string) => string;
  hrefForSort: (sortKey: string) => string;
  hrefForRarity: (rarityKey: string) => string;
  view: CardViewMode;
  hrefForView: (mode: CardViewMode) => string;
  tirePerfs?: TirePerf[];
  listings?: Record<string, string>;
}) {
  const compact = view === "liste";
  const current = TABS.find((x) => x.key === tab) ?? TABS[0];
  const categoryCards = cards.filter((c) => c.card_templates.category === current.category);
  const activeRarity = (RARITIES as string[]).includes(rarity) ? (rarity as Rarity) : "";
  // Les compteurs de niveau portent sur toute la catégorie, avant le filtre de rareté.
  const rarityCounts = Object.fromEntries(
    RARITIES.map((key) => [key, categoryCards.filter((c) => c.card_templates.rarity === key).length]),
  ) as Record<Rarity, number>;
  const hasRarity = RARITIES.some((key) => rarityCounts[key] > 0 || activeRarity === key);
  const visible = activeRarity ? categoryCards.filter((c) => c.card_templates.rarity === activeRarity) : categoryCards;
  const sorts = INVENTORY_SORTS[current.category];
  const activeSort = sorts.some((o) => o.key === sort) ? (sort as GroupSort) : "";
  // Bonus : mêmes cartes interchangeables. Pneus : même modèle ET même gomme restante.
  // Moteurs et boîtes : même modèle, même risque de casse actuel et même garantie.
  // Les cartes détruites restent dans l'inventaire classique, séparées des exemplaires roulants.
  // Une carte en vente garde sa propre fiche (action « Retirer de la vente » liée à l'annonce).
  const entries = sortCardGroups(
    groupCards(visible, (card) => cardGroupKey(card, true)),
    current.category,
    activeSort,
  );
  const unitLabel =
    current.category === "pneus"
      ? `pneu${visible.length === 1 ? "" : "s"}`
      : current.category === "bonus"
        ? `carte${visible.length === 1 ? "" : "s"} bonus`
        : `pièce${visible.length === 1 ? "" : "s"}`;

  const tabCounts = Object.fromEntries(
    TABS.map((x) => [x.key, cards.filter((c) => c.card_templates.category === x.category).length]),
  ) as Record<string, number>;
  const tabHrefs = Object.fromEntries(TABS.map((x) => [x.key, hrefForTab(x.key)])) as Record<string, string>;
  const rarityHrefs = { "": hrefForRarity(""), ...Object.fromEntries(RARITIES.map((key) => [key, hrefForRarity(key)])) } as Record<string, string>;
  const sortHrefs = { "": hrefForSort(""), ...Object.fromEntries(sorts.map((o) => [o.key, hrefForSort(o.key)])) } as Record<string, string>;

  const rarityNav = (
    <nav className="inline-flex max-w-full justify-self-start gap-1 overflow-x-auto rounded-xl border border-line bg-panel p-1" aria-label="Filtrer l'inventaire par niveau">
      <Link href={hrefForRarity("")} scroll={false} aria-current={!activeRarity ? "true" : undefined} className={seg(!activeRarity)}>
        Tous
      </Link>
      {RARITIES.filter((key) => rarityCounts[key] > 0 || activeRarity === key).map((key) => {
        const on = key === activeRarity;
        return (
          <Link key={key} href={hrefForRarity(key)} scroll={false} aria-current={on ? "true" : undefined} className={seg(on)}>
            <span className={`h-2 w-2 shrink-0 rounded-full ${on ? "bg-black/40" : RARITY_DOT[key]}`} />
            {RARITY_LABEL[key]}
            <span className={countClass(on)}>{rarityCounts[key]}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <section className="min-w-0 space-y-3">
      <PageHeader
        back
        title="Inventaire"
        description="Toutes les pièces de votre garage, prêtes à être équipées, vendues ou recyclées."
        actions={<ViewToggle current={view} hrefFor={hrefForView} />}
      />
      <MobileInventoryFilters
        tab={current.key}
        rarity={activeRarity}
        sort={activeSort}
        counts={tabCounts}
        rarityCounts={rarityCounts}
        sorts={sorts}
        tabHrefs={tabHrefs}
        rarityHrefs={rarityHrefs}
        sortHrefs={sortHrefs}
        resetHref={hrefForTab(TABS[0].key)}
        resultCount={visible.length}
        unitLabel={unitLabel}
      />
      <div className="hidden md:block">
        <FilterRow label="Type">
          <nav className="inline-flex max-w-full justify-self-start gap-1 overflow-x-auto rounded-xl border border-line bg-panel p-1" aria-label="Catégories de l'inventaire">
            {TABS.map((x) => {
              const on = x.key === current.key;
              const n = cards.filter((c) => c.card_templates.category === x.category).length;
              return (
                <Link key={x.key} href={hrefForTab(x.key)} scroll={false} aria-current={on ? "true" : undefined} className={seg(on)}>
                  <x.icon size={15} strokeWidth={2} />
                  {x.label}
                  <span className={countClass(on)}>{n}</span>
                </Link>
              );
            })}
          </nav>
        </FilterRow>
      </div>

      {hasRarity && (
        <div className="hidden md:block">
          <FilterRow label="Niveau">{rarityNav}</FilterRow>
        </div>
      )}

      {visible.length > 1 && (
        <div className="hidden md:block">
          <SortRow
            options={sorts}
            current={activeSort}
            hrefs={{
              "": hrefForSort(""),
              ...Object.fromEntries(sorts.map((o) => [o.key, hrefForSort(activeSort === o.key ? "" : o.key)])),
            }}
            ariaLabel="Trier l'inventaire"
          />
        </div>
      )}

      {visible.length > 0 && (
        <p className="text-sm text-zinc-400">
          <span className="font-semibold text-zinc-200">{entries.length}</span> groupe{entries.length === 1 ? "" : "s"} ·{" "}
          <span className="font-semibold text-zinc-200">{visible.length}</span> {unitLabel}.{" "}
          {current.category === "pneus" ? (
            <>
              Les pneus du même modèle avec la même gomme restante sont regroupés sous un badge{" "}
              <span className="font-semibold text-amber-300">×N</span>.
            </>
          ) : current.category === "bonus" ? (
            <>
              Les exemplaires identiques sont regroupés sous un badge <span className="font-semibold text-amber-300">×N</span>.
            </>
          ) : (
            <>
              Les pièces du même modèle avec le même risque de casse actuel et le même état de garantie sont regroupées
              sous un badge <span className="font-semibold text-amber-300">×N</span>.
            </>
          )}
        </p>
      )}

      {entries.length === 0 && (
        <p className="rounded-xl border border-line bg-panel-mid p-3 text-sm text-zinc-500">
          {activeRarity ? (
            <>
              Aucune carte de niveau <span className="font-semibold text-zinc-300">{RARITY_LABEL[activeRarity]}</span> dans
              cette catégorie.{" "}
              <Link href={hrefForRarity("")} scroll={false} className="font-semibold text-amber-300 hover:text-amber-200">
                Voir tous les niveaux
              </Link>
            </>
          ) : (
            "Aucune carte dans cette catégorie."
          )}
        </p>
      )}
      <div
        className={
          compact
            ? "grid gap-2 grid-cols-[repeat(auto-fill,minmax(max(20rem,calc((100%_-_1.5rem)/4)),1fr))]"
            : "grid gap-4 grid-cols-[repeat(auto-fill,minmax(max(16rem,calc((100%_-_3rem)/4)),1fr))]"
        }
      >
        {entries.map(({ card: c, count, cards: group }) => {
          const t = c.card_templates;
          const warranty = warrantyState(t, c);
          const Card = compact ? CardRow : CardView;
          return (
            <Card key={c.id} template={t} card={c} image={cardImageUrl(t)} tirePerfs={tirePerfs} quantity={count}>
              {c.is_listed && listings[c.id] && (
                <ActionForm action={cancelListing} submitLabel="Retirer de la vente" variant="danger" className="flex">
                  <input type="hidden" name="listing_id" value={listings[c.id]} />
                </ActionForm>
              )}
              {c.is_listed && !listings[c.id] && <p className="text-xs text-sky-400">Carte en vente</p>}
              {!c.is_listed && (
                <div className="flex w-full flex-col gap-2">
                  {warranty?.repairable && (
                    <ActionForm
                      action={repairCard}
                      submitLabel="Réparation sous garantie constructeur"
                      submitClassName="w-full rounded-lg border border-emerald-500/70 px-3 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10"
                      className="flex w-full"
                    >
                      <input type="hidden" name="card_id" value={c.id} />
                    </ActionForm>
                  )}
                  <div className="grid w-full grid-cols-2 gap-2">
                    <SellDialog action={listCard} cardIds={group.map((x) => x.id)} name={t.name} />
                    {warranty?.extendable && (
                      <ExtendWarrantyDialog
                        action={extendWarranty}
                        cardId={c.id}
                        name={t.name}
                        remaining={warranty.remaining}
                        limit={warranty.limit}
                      />
                    )}
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
