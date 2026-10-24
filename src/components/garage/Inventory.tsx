import Link from "next/link";
import { Cog, Disc, Settings2, Zap, type LucideIcon } from "lucide-react";
import { CardView, type TirePerf } from "@/components/CardView";
import { RecycleDialog } from "@/components/garage/RecycleDialog";
import { SellDialog } from "@/components/garage/SellDialog";
import { recycleCard } from "@/app/(game)/garage/actions";
import { listCard } from "@/app/(game)/marketplace/actions";
import { recycleQuote } from "@/lib/game";
import type { Category, UserCard } from "@/lib/types";

export const TABS: { key: string; label: string; category: Category; icon: LucideIcon }[] = [
  { key: "moteurs", label: "Moteurs", category: "moteur", icon: Cog },
  { key: "boites", label: "Boîtes", category: "boite", icon: Settings2 },
  { key: "pneus", label: "Pneus", category: "pneus", icon: Disc },
  { key: "bonus", label: "Consommables", category: "bonus", icon: Zap },
];

const MUSEUM = "casse";
const PARTS: Category[] = ["moteur", "boite", "pneus"];

const seg = (active: boolean) =>
  `inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
    active ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
  }`;

const countClass = (active: boolean) => (active ? "tabular-nums text-black/60" : "tabular-nums text-zinc-500");

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
  const museum = tab === MUSEUM;
  const current = TABS.find((x) => x.key === tab) ?? TABS[0];
  const scrap = cards.filter((c) => c.is_destroyed && PARTS.includes(c.card_templates.category));
  const rows = museum
    ? scrap
    : cards.filter((c) => c.card_templates.category === current.category && !c.is_destroyed);
  const active = museum ? MUSEUM : current.key;

  return (
    <section className="min-w-0 space-y-3">
      <h2 className="font-display text-2xl font-bold uppercase">Inventaire</h2>
      <nav className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Catégories de l'inventaire">
        {TABS.map((x) => {
          const on = x.key === active;
          const n = cards.filter((c) => !c.is_destroyed && c.card_templates.category === x.category).length;
          return (
            <Link key={x.key} href={hrefForTab(x.key)} scroll={false} aria-current={on ? "true" : undefined} className={seg(on)}>
              <x.icon size={15} strokeWidth={2} />
              {x.label}
              <span className={countClass(on)}>{n}</span>
            </Link>
          );
        })}
        <Link href={hrefForTab(MUSEUM)} scroll={false} aria-current={museum ? "true" : undefined} className={seg(museum)}>
          <span className={`h-2 w-2 shrink-0 rounded-full ${museum ? "bg-black/40" : "bg-red-500"}`} />
          Musée de la casse
          <span className={countClass(museum)}>{scrap.length}</span>
        </Link>
      </nav>

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
