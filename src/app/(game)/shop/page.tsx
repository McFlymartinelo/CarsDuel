import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { CardView } from "@/components/CardView";
import { RARITY_LABEL } from "@/lib/format";
import { loadShopPage } from "@/lib/queries";
import type { Category, Rarity } from "@/lib/types";
import { buyShopItem } from "./actions";

export const metadata = { title: "Boutique — CarsDuel" };

const TABS: { key: string; label: string; category: Category }[] = [
  { key: "moteurs", label: "Moteurs", category: "moteur" },
  { key: "boites", label: "Boîtes", category: "boite" },
  { key: "pneus", label: "Pneus", category: "pneus" },
];

const RARITIES = Object.keys(RARITY_LABEL) as Rarity[];

const chip = (active: boolean) =>
  `shrink-0 whitespace-nowrap rounded-lg border px-4 py-2 text-sm ${
    active ? "border-zinc-500 bg-zinc-800 text-white" : "border-zinc-800 text-zinc-300 hover:text-white"
  }`;

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ tab?: string; rarity?: string }> }) {
  const { tab: tabParam, rarity: rarityParam } = await searchParams;
  const { user } = await requireUser();
  const { items, modifiers: tirePerfs } = await loadShopPage(user.id);

  const tab = TABS.find((t) => t.key === tabParam) ?? TABS[0];
  const inTab = items.filter((it) => it.card_templates.category === tab.category);
  // Les pneus n'ont pas de rareté : pas de filtre sur cet onglet.
  const hasRarity = tab.category !== "pneus";
  const rarity = hasRarity ? RARITIES.find((r) => r === rarityParam) : undefined;
  const shown = rarity ? inTab.filter((it) => it.card_templates.rarity === rarity) : inTab;

  const href = (over: { tab?: string; rarity?: string }) => {
    const q = new URLSearchParams({ tab: over.tab ?? tab.key, ...(over.rarity ? { rarity: over.rarity } : {}) });
    return `/shop?${q.toString()}`;
  };
  const count = (r: Rarity) => inTab.filter((it) => it.card_templates.rarity === r).length;

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-bold">Magasin de pièces neuves</h1>

      <nav className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <Link key={t.key} href={href({ tab: t.key })} scroll={false} className={chip(t.key === tab.key)}>
            {t.label} <span className="text-zinc-500">({items.filter((it) => it.card_templates.category === t.category).length})</span>
          </Link>
        ))}
      </nav>

      {hasRarity && (
        <nav className="-mx-3 flex items-center gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0" aria-label="Filtrer par rareté">
          <span className="shrink-0 text-sm text-zinc-400">Niveau :</span>
          <Link href={href({})} scroll={false} className={chip(!rarity)}>Tous</Link>
          {RARITIES.filter((r) => count(r) > 0 || r === rarity).map((r) => (
            <Link key={r} href={href({ rarity: r })} scroll={false} className={chip(r === rarity)}>
              {RARITY_LABEL[r]} <span className="text-zinc-500">({count(r)})</span>
            </Link>
          ))}
        </nav>
      )}

      {shown.length === 0 ? (
        <p className="text-sm text-zinc-400">Aucune pièce dans cette sélection pour le moment.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {shown.map((it) => (
            <CardView key={it.id} template={it.card_templates} tirePerfs={tirePerfs}>
              <p className="mb-2 text-sm">
                {it.price} 🪙 {it.stock !== null && <span className="text-zinc-500">· stock {it.stock}</span>}
              </p>
              <ActionForm action={buyShopItem} submitLabel="Acheter" className="flex flex-wrap gap-2">
                <input type="hidden" name="catalog_id" value={it.id} />
              </ActionForm>
            </CardView>
          ))}
        </div>
      )}
    </section>
  );
}
