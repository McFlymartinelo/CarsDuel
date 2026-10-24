import Link from "next/link";
import { CardView, type TirePerf } from "@/components/CardView";
import { RecycleDialog } from "@/components/garage/RecycleDialog";
import { SellDialog } from "@/components/garage/SellDialog";
import { recycleCard } from "@/app/(game)/garage/actions";
import { listCard } from "@/app/(game)/marketplace/actions";
import { recycleQuote } from "@/lib/game";
import type { Category, UserCard } from "@/lib/types";

export const TABS: { key: string; label: string; category: Category }[] = [
  { key: "moteurs", label: "Moteurs", category: "moteur" },
  { key: "boites", label: "Boîtes", category: "boite" },
  { key: "pneus", label: "Pneus", category: "pneus" },
  { key: "bonus", label: "Consommables", category: "bonus" },
];

const linkBtn = "flex min-h-11 flex-1 items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium sm:min-h-10";

export function Inventory({
  cards,
  tab,
  hrefForTab,
  tirePerfs = [],
}: {
  cards: UserCard[];
  tab: string;
  hrefForTab: (tabKey: string) => string;
  tirePerfs?: TirePerf[];
}) {
  const current = TABS.find((x) => x.key === tab) ?? TABS[0];
  const rows = cards.filter((c) => c.card_templates.category === current.category);

  return (
    <section className="min-w-0 space-y-3">
      <h2 className="font-display text-2xl font-bold uppercase">Inventaire</h2>
      <nav className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
        {TABS.map((x) => (
          <Link
            key={x.key}
            href={hrefForTab(x.key)}
            scroll={false}
            className={`shrink-0 whitespace-nowrap rounded-lg border px-4 py-2 text-sm ${
              x.key === current.key ? "border-zinc-500 bg-zinc-800 text-white" : "border-zinc-800 text-zinc-300 hover:text-white"
            }`}
          >
            {x.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 && <p className="rounded-xl border border-zinc-800 bg-[#0e1117] p-3 text-sm text-zinc-500">Aucune carte dans cette catégorie.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((c) => {
          const t = c.card_templates;
          const quote = recycleQuote(t, c);
          return (
            <CardView key={c.id} template={t} card={c} tirePerfs={tirePerfs}>
              {c.is_listed && <p className="text-xs text-sky-400">Carte en vente</p>}
              {!c.is_listed && (
                <div className="flex w-full items-center gap-2">
                  {t.category === "bonus" && (
                    <Link href={`/duel?bonus=${c.id}`} className={`${linkBtn} border-amber-500/70 text-amber-300 hover:bg-amber-500/10`}>
                      Utiliser
                    </Link>
                  )}
                  {quote && (
                    <RecycleDialog action={recycleCard} cardId={c.id} name={t.name} base={quote.base} pct={quote.pct} coins={quote.coins} kind={t.category} flat={quote.flat} scrap={quote.scrap} />
                  )}
                  {!c.is_destroyed && t.category !== "bonus" && <SellDialog action={listCard} cardId={c.id} name={t.name} />}
                </div>
              )}
            </CardView>
          );
        })}
      </div>
    </section>
  );
}
