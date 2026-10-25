import { requireUser } from "@/lib/auth";
import { QuestPing } from "@/components/QuestPing";
import { ActionForm } from "@/components/ActionForm";
import { CardView } from "@/components/CardView";
import { CatalogFilters } from "@/components/CatalogFilters";
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
  searchParams: Promise<{ tab?: string; rarity?: string; sort?: string; min?: string; max?: string; risk?: string }>;
}) {
  const sp = await searchParams;
  const query = readCatalogQuery(sp);
  const { user } = await requireUser();
  const { items, modifiers: tirePerfs } = await loadShopPage(user.id);

  const counts: Record<string, number> = {};
  for (const it of items) counts[it.card_templates.category] = (counts[it.card_templates.category] ?? 0) + 1;
  const inTab = items.filter((it) => it.card_templates.category === query.tab.category);
  const rarityCounts: Partial<Record<Rarity, number>> = {};
  for (const it of inTab) {
    const r = it.card_templates.rarity;
    if (r) rarityCounts[r] = (rarityCounts[r] ?? 0) + 1;
  }
  const shown = inTab
    .filter((it) => !query.rarity || it.card_templates.rarity === query.rarity)
    .filter((it) => query.min == null || it.price >= query.min)
    .filter((it) => query.max == null || it.price <= query.max)
    .filter((it) => query.risk == null || (it.card_templates.base_break_risk ?? 101) <= query.risk)
    .slice()
    .sort((a, b) => {
      if (query.sort === "price") return a.price - b.price || a.card_templates.name.localeCompare(b.card_templates.name, "fr");
      return query.sort ? compareTemplates(a.card_templates, b.card_templates, query.sort) : 0;
    });

  return (
    <section className="space-y-4">
      <QuestPing quest="boutique" />
      <h1 className="text-xl font-bold">Magasin de pièces neuves</h1>
      <CatalogFilters path="/shop" query={query} counts={counts as Record<Category, number>} rarityCounts={rarityCounts} />
      {shown.length === 0 ? (
        <p className="text-sm text-zinc-400">Aucune pièce dans cette sélection pour le moment.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {shown.map((it) => (
            <CardView key={it.id} template={it.card_templates} image={cardImageUrl(it.card_templates)} tirePerfs={tirePerfs}>
              <p className="mb-2 text-sm">
                {it.price} 🪙 {it.stock !== null && <span className="text-zinc-500">· stock {it.stock}</span>}
              </p>
              <ActionForm
                action={buyShopItem}
                submitLabel="Acheter"
                confirmText={`Acheter ${it.card_templates.name} pour ${it.price} pièces ?`}
                className="flex flex-wrap gap-2"
              >
                <input type="hidden" name="catalog_id" value={it.id} />
              </ActionForm>
            </CardView>
          ))}
        </div>
      )}
    </section>
  );
}
