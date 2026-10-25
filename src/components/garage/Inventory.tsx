import Link from "next/link";
import { Cog, Disc, Settings2, Zap, type LucideIcon } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { CardRow } from "@/components/CardRow";
import { CardView, type TirePerf } from "@/components/CardView";
import { ViewToggle, type CardViewMode } from "@/components/ViewToggle";
import { RecycleDialog } from "@/components/garage/RecycleDialog";
import { SellDialog } from "@/components/garage/SellDialog";
import { recycleCard } from "@/app/(game)/garage/actions";
import { cancelListing, listCard } from "@/app/(game)/marketplace/actions";
import { cardImageUrl } from "@/lib/card-images";
import { recycleQuote } from "@/lib/game";
import type { Category, UserCard } from "@/lib/types";

export const TABS: { key: string; label: string; category: Category; icon: LucideIcon }[] = [
  { key: "moteurs", label: "Moteurs", category: "moteur", icon: Cog },
  { key: "boites", label: "Boîtes", category: "boite", icon: Settings2 },
  { key: "pneus", label: "Pneus", category: "pneus", icon: Disc },
  { key: "bonus", label: "Bonus", category: "bonus", icon: Zap },
];

const PARTS: Category[] = ["moteur", "boite", "pneus"];

const seg = (active: boolean) =>
  `inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
  }`;

const countClass = (active: boolean) => (active ? "tabular-nums text-black/60" : "tabular-nums text-zinc-500");

export function Inventory({
  cards,
  tab,
  hrefForTab,
  view,
  hrefForView,
  tirePerfs = [],
  museum = false,
  listings = {},
}: {
  cards: UserCard[];
  tab: string;
  hrefForTab: (tabKey: string) => string;
  view: CardViewMode;
  hrefForView: (mode: CardViewMode) => string;
  tirePerfs?: TirePerf[];
  museum?: boolean;
  listings?: Record<string, string>;
}) {
  const compact = view === "liste";
  const current = TABS.find((x) => x.key === tab) ?? TABS[0];
  const scrap = cards.filter((c) => c.is_destroyed && PARTS.includes(c.card_templates.category));
  const rows = museum
    ? scrap
    : cards.filter((c) => c.card_templates.category === current.category && !c.is_destroyed);

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold uppercase">{museum ? "Musée de la casse" : "Inventaire"}</h2>
        <ViewToggle current={view} hrefFor={hrefForView} />
      </div>
      {!museum && (
        <nav className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Catégories de l'inventaire">
          {TABS.map((x) => {
            const on = x.key === current.key;
            const n = cards.filter((c) => !c.is_destroyed && c.card_templates.category === x.category).length;
            return (
              <Link key={x.key} href={hrefForTab(x.key)} scroll={false} aria-current={on ? "true" : undefined} className={seg(on)}>
                <x.icon size={15} strokeWidth={2} />
                {x.label}
                <span className={countClass(on)}>{n}</span>
              </Link>
            );
          })}
        </nav>
      )}

      {museum && (
        <p className="text-sm text-zinc-400">
          Les moteurs, boîtes et pneus détruits arrivent ici. Chacun se recycle pour 1 pièce.
        </p>
      )}

      {rows.length === 0 && (
        <p className="rounded-xl border border-zinc-800 bg-[#0e1117] p-3 text-sm text-zinc-500">
          {museum ? "Aucune carte détruite." : "Aucune carte dans cette catégorie."}
        </p>
      )}
      <div className={compact ? "grid gap-2 xl:grid-cols-2" : "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"}>
        {rows.map((c) => {
          const t = c.card_templates;
          const quote = recycleQuote(t, c);
          const Card = compact ? CardRow : CardView;
          return (
            <Card key={c.id} template={t} card={c} image={cardImageUrl(t)} tirePerfs={tirePerfs}>
              {c.is_listed && listings[c.id] && (
                <ActionForm action={cancelListing} submitLabel="Retirer de la vente" variant="danger" className="flex">
                  <input type="hidden" name="listing_id" value={listings[c.id]} />
                </ActionForm>
              )}
              {c.is_listed && !listings[c.id] && <p className="text-xs text-sky-400">Carte en vente</p>}
              {!c.is_listed && (
                <div className="flex w-full items-center gap-2">
                  {quote && (
                    <RecycleDialog action={recycleCard} cardId={c.id} name={t.category === "bonus" ? (t.description?.trim() || t.name) : t.name} base={quote.base} pct={quote.pct} coins={quote.coins} kind={t.category} flat={quote.flat} scrap={quote.scrap} />
                  )}
                  {!c.is_destroyed && t.category !== "bonus" && <SellDialog action={listCard} cardId={c.id} name={t.name} />}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
