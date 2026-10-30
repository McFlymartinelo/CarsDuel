import { requireUser } from "@/lib/auth";
import { QuestPing } from "@/components/QuestPing";
import { ActionForm } from "@/components/ActionForm";
import { CardRow } from "@/components/CardRow";
import { CardView } from "@/components/CardView";
import { CatalogFilters } from "@/components/CatalogFilters";
import { viewMode, type CardViewMode } from "@/components/ViewToggle";
import { CatalogViewPanels, CatalogViewProvider, CatalogViewToggle } from "@/components/CatalogView";
import { compareTemplates } from "@/lib/catalog-sort";
import { readCatalogQuery } from "@/lib/catalog-filters";
import type { Category, Rarity } from "@/lib/types";
import { cardImageUrl } from "@/lib/card-images";
import { loadShopPage } from "@/lib/queries";
import { buyShopItem } from "./actions";

export const metadata = { title: "Boutique — CarsDuel" };

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; rarity?: string; sort?: string; min?: string; max?: string; q?: string; vue?: string }>;
}) {
  const sp = await searchParams;
  const query = readCatalogQuery({ ...sp, risk: undefined });
  const view = viewMode(sp.vue);
  const { user } = await requireUser();
  const { items, catalogCounts, modifiers: tirePerfs } = await loadShopPage(user.id, query);

  const counts: Record<string, number> = {};
  const rarityCounts: Partial<Record<Rarity, number>> = {};
  for (const row of catalogCounts) {
    counts[row.category] = (counts[row.category] ?? 0) + row.n;
    if (row.category === query.tab.category && row.rarity) {
      rarityCounts[row.rarity as Rarity] = row.n;
    }
  }
  const shown = items
    .filter((it) => !query.rarity || it.card_templates.rarity === query.rarity)
    .filter((it) => query.min == null || it.price >= query.min)
    .filter((it) => query.max == null || it.price <= query.max)
    .slice()
    .sort((a, b) => {
      if (query.sort === "price") return a.price - b.price || a.card_templates.name.localeCompare(b.card_templates.name, "fr");
      return query.sort ? compareTemplates(a.card_templates, b.card_templates, query.sort) : 0;
    });

  const buy = (id: string, name: string, price: number) => (
    <ActionForm action={buyShopItem} submitLabel="Acheter" confirmText={`Acheter ${name} pour ${price} pièces ?`} className="flex flex-wrap gap-2">
      <input type="hidden" name="catalog_id" value={id} />
    </ActionForm>
  );

  return (
    <CatalogViewProvider initialView={view}>
      <section className="min-w-0 space-y-4">
        <QuestPing quest="boutique" />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold">Magasin de pièces neuves</h1>
          <CatalogViewToggle />
        </div>
        <CatalogFilters
          path="/shop"
          query={query}
          counts={counts as Record<Category, number>}
          rarityCounts={rarityCounts}
          showRisk={false}
          preserveCatalogView
        />
        {shown.length === 0 ? (
          <p className="text-sm text-zinc-400">
            {query.q ? `Aucune pièce ne correspond à « ${query.q} » dans cette sélection.` : "Aucune pièce dans cette sélection pour le moment."}
          </p>
        ) : (
          <CatalogViewPanels
            cards={(
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              {shown.map((it) => (
                <CardView key={it.id} template={it.card_templates} image={cardImageUrl(it.card_templates)} tirePerfs={tirePerfs}>
                  <p className="mb-2 text-sm">
                    {it.price} 🪙 {it.stock !== null && <span className="text-zinc-500">· stock {it.stock}</span>}
                  </p>
                  {buy(it.id, it.card_templates.name, it.price)}
                </CardView>
              ))}
            </div>
            )}
            list={(
            <div className="grid min-w-0 gap-2">
              {shown.map((it) => (
                <CardRow key={it.id} template={it.card_templates} image={cardImageUrl(it.card_templates)} note={<p className="text-sm text-amber-300">{it.price} 🪙{it.stock !== null ? ` · stock ${it.stock}` : ""}</p>}>
                  {buy(it.id, it.card_templates.name, it.price)}
                </CardRow>
              ))}
            </div>
            )}
          />
        )}
      </section>
    </CatalogViewProvider>
  );
}
