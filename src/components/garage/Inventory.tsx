import Link from "next/link";
import { CardView, type TirePerf } from "@/components/CardView";
import { ActionForm } from "@/components/ActionForm";
import type { Category, UserCard } from "@/lib/types";
import { equipCard } from "@/app/(game)/garage/actions";

export const TABS: { key: string; label: string; category: Category }[] = [
  { key: "moteurs", label: "Moteurs", category: "moteur" },
  { key: "boites", label: "Boîtes", category: "boite" },
  { key: "pneus", label: "Pneus", category: "pneus" },
  { key: "bonus", label: "Consommables", category: "bonus" },
];

const linkBtn = "flex min-h-11 flex-1 items-center justify-center rounded-lg border px-3 py-1.5 text-sm font-medium sm:min-h-10 sm:flex-none sm:rounded";

export function Inventory({
  cards,
  tab,
  deckId,
  inAnyDeck,
  hrefForTab,
  tirePerfs = [],
}: {
  cards: UserCard[]; // cartes non détruites, hors cartes équipées dans le deck actif
  tab: string;
  deckId?: string;
  inAnyDeck: Set<string>;
  hrefForTab: (tabKey: string) => string;
  tirePerfs?: TirePerf[];
}) {
  const current = TABS.find((x) => x.key === tab) ?? TABS[2];
  const rows = cards.filter((c) => c.card_templates.category === current.category);

  return (
    <section className="min-w-0 space-y-3">
      <h2 className="font-display text-2xl font-bold uppercase">Inventaire &amp; cartes en réserve</h2>
      {/* Onglets : défilent horizontalement sur mobile */}
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
            {x.key === current.key && x.key === "pneus" && <span className="text-emerald-400"> (actif)</span>}
          </Link>
        ))}
      </nav>

      {rows.length === 0 && <p className="rounded-xl border border-zinc-800 bg-[#0e1117] p-3 text-sm text-zinc-500">Aucune carte dans cette catégorie.</p>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((c) => {
          const t = c.card_templates;
          const equipped = inAnyDeck.has(c.id);
          return (
            <CardView key={c.id} template={t} card={c} tirePerfs={tirePerfs}>
              <div className="flex w-full items-center gap-2">
                {c.is_listed ? null : (
                  <>
                    {t.category === "bonus" ? (
                      <Link href={`/duel?bonus=${c.id}`} className={`${linkBtn} border-red-500/70 text-red-400 hover:bg-red-500/10`}>
                        Consommer
                      </Link>
                    ) : (
                      <ActionForm action={equipCard} submitLabel="Équiper" variant="outline" className="flex flex-1 [&>button]:min-h-11 [&>button]:flex-1 [&>button]:rounded-lg sm:[&>button]:min-h-10 sm:[&>button]:rounded">
                        <input type="hidden" name="card_id" value={c.id} />
                        {deckId && <input type="hidden" name="deck_id" value={deckId} />}
                      </ActionForm>
                    )}
                    {equipped ? (
                      <span className="px-2 text-xs text-zinc-500" title="Retirez la carte de vos decks pour la vendre">En deck</span>
                    ) : (
                      <Link href={`/marketplace?sell=${c.id}`} className={`${linkBtn} border-red-500/70 text-red-400 hover:bg-red-500/10`}>
                        Vendre
                      </Link>
                    )}
                  </>
                )}
              </div>
            </CardView>
          );
        })}
      </div>
    </section>
  );
}
