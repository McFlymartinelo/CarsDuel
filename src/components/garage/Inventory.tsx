import Link from "next/link";
import { Cog, Disc, Settings2, Zap, type LucideIcon } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { CardRow } from "@/components/CardRow";
import { CardView, type TirePerf } from "@/components/CardView";
import { FilterRow } from "@/components/FilterRow";
import { SortRow } from "@/components/SortRow";
import { ViewToggle, type CardViewMode } from "@/components/ViewToggle";
import { PageHeader } from "@/components/PageHeader";
import { SellDialog } from "@/components/garage/SellDialog";
import { ExtendWarrantyDialog } from "@/components/garage/ExtendWarrantyDialog";
import { extendWarranty, repairCard } from "@/app/(game)/garage/actions";
import { cancelListing, listCard } from "@/app/(game)/marketplace/actions";
import { cardImageUrl } from "@/lib/card-images";
import { INVENTORY_SORTS, cardGroupKey, groupCards, sortCardGroups, type GroupSort } from "@/lib/card-groups";
import { warrantyState } from "@/lib/game";
import type { Category, UserCard } from "@/lib/types";

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

export function Inventory({
  cards,
  tab,
  sort,
  hrefForTab,
  hrefForSort,
  view,
  hrefForView,
  tirePerfs = [],
  listings = {},
}: {
  cards: UserCard[];
  tab: string;
  /** Tri demandé dans l'URL, revalidé contre les options de la catégorie. */
  sort: string;
  hrefForTab: (tabKey: string) => string;
  hrefForSort: (sortKey: string) => string;
  view: CardViewMode;
  hrefForView: (mode: CardViewMode) => string;
  tirePerfs?: TirePerf[];
  listings?: Record<string, string>;
}) {
  const compact = view === "liste";
  const current = TABS.find((x) => x.key === tab) ?? TABS[0];
  const visible = cards.filter((c) => c.card_templates.category === current.category);
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

  return (
    <section className="min-w-0 space-y-3">
      <PageHeader
        back
        title="Inventaire"
        description="Toutes les pièces de votre garage, prêtes à être équipées, vendues ou recyclées."
        actions={<ViewToggle current={view} hrefFor={hrefForView} />}
      />
      <div className="hidden md:block">
        <FilterRow label="Type">
          <nav className="inline-flex max-w-full justify-self-start gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Catégories de l'inventaire">
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
      <nav className="grid grid-cols-4 gap-1 rounded-xl border border-zinc-800 bg-[#10131a] p-1 md:hidden" aria-label="Catégories de l'inventaire">
        {TABS.map((x) => {
          const on = x.key === current.key;
          const n = cards.filter((c) => c.card_templates.category === x.category).length;
          return (
            <Link
              key={x.key}
              href={hrefForTab(x.key)}
              scroll={false}
              aria-current={on ? "true" : undefined}
              aria-label={`${x.label}, ${n} carte${n === 1 ? "" : "s"}`}
              className={`relative inline-flex min-h-11 min-w-0 items-center justify-center gap-1 rounded-lg px-1 pt-1 text-[10px] font-semibold ${on ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}
            >
              <x.icon size={14} strokeWidth={2} className="shrink-0" />
              <span className="truncate">{x.label}</span>
              <span aria-hidden className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[#10131a] px-1 text-[10px] font-bold leading-none tabular-nums shadow-sm ${n > 0 ? "bg-amber-500 text-black" : "bg-zinc-700 text-zinc-200"}`}>
                {n}
              </span>
            </Link>
          );
        })}
      </nav>

      {visible.length > 1 && (
        <SortRow
          options={sorts}
          current={activeSort}
          hrefs={{
            "": hrefForSort(""),
            ...Object.fromEntries(sorts.map((o) => [o.key, hrefForSort(activeSort === o.key ? "" : o.key)])),
          }}
          ariaLabel="Trier l'inventaire"
        />
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
        <p className="rounded-xl border border-zinc-800 bg-[#0e1117] p-3 text-sm text-zinc-500">
          Aucune carte dans cette catégorie.
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
