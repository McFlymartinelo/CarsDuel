import Link from "next/link";
import { SearchX, Store } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { QuestPing } from "@/components/QuestPing";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClass } from "@/components/ui/Button";
import { CardRow } from "@/components/CardRow";
import { CardView } from "@/components/CardView";
import { CatalogFilters } from "@/components/CatalogFilters";
import { ShopBuyForm } from "@/components/ShopBuyForm";
import { viewMode } from "@/components/ViewToggle";
import { CatalogViewPanels, CatalogViewProvider, CatalogViewToggle } from "@/components/CatalogView";
import { compareTemplates } from "@/lib/catalog-sort";
import { readCatalogQuery } from "@/lib/catalog-filters";
import { compareCandidate } from "@/lib/compare";
import { CompareBar } from "@/components/compare/CompareBar";
import { CardCompare } from "@/components/compare/CardCompare";
import { CompareProvider } from "@/components/compare/CompareProvider";
import type { CardTemplate, Category, Rarity } from "@/lib/types";
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
  const { items, catalogCounts, modifiers: tirePerfs, equipped } = await loadShopPage(user.id, query);

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

  const filtered = Boolean(query.q || query.rarity || query.min != null || query.max != null || query.sort);
  const resetHref = `/shop?tab=${query.tab.key}`;

  const buy = (item: (typeof shown)[number]) => (
    <ShopBuyForm
      action={buyShopItem}
      catalogId={item.id}
      name={item.card_templates.name}
      price={item.price}
      stock={item.stock}
      balance={user.coins}
    />
  );

  // Les articles de boutique sont neufs : aucun run, gomme pleine.
  const compare = (t: CardTemplate, card: null, variant: "block" | "badge") => {
    if (!equipped) return undefined;
    const comparison = compareCandidate(t, card, equipped, tirePerfs);
    return comparison ? <CardCompare comparison={comparison} variant={variant} /> : undefined;
  };

  return (
    <CatalogViewProvider initialView={view}>
      <CompareProvider>
      <section className="min-w-0 space-y-4">
        <QuestPing quest="boutique" />
        <PageHeader
          title="Magasin de pièces neuves"
          description="Des pièces garanties, disponibles immédiatement pour compléter votre configuration."
          actions={<CatalogViewToggle />}
        />
        <CompareBar
          equipped={
            equipped
              ? { engine: equipped.engine.template.name, gearbox: equipped.gearbox.template.name, tire: equipped.tire.template.name }
              : null
          }
        />
        <CatalogFilters
          path="/shop"
          query={query}
          counts={counts as Record<Category, number>}
          rarityCounts={rarityCounts}
          showRisk={false}
          preserveCatalogView
        />
        {shown.length === 0 ? (
          <EmptyState
            icon={filtered ? SearchX : Store}
            title={filtered ? "Aucun résultat pour ces filtres" : "Aucune pièce dans cette sélection"}
            description={
              filtered
                ? "Élargissez la recherche ou réinitialisez les filtres pour retrouver le catalogue complet."
                : "Cette catégorie est momentanément vide. Les tirages gratuits peuvent vous dépanner."
            }
            action={
              filtered ? (
                <Link href={resetHref} className={buttonClass({ variant: "ghost", size: "sm" })}>
                  Réinitialiser les filtres
                </Link>
              ) : (
                <Link href="/garage/tirages" className={buttonClass({ size: "sm" })}>
                  Ouvrir les tirages
                </Link>
              )
            }
          />
        ) : (
          <CatalogViewPanels
            cards={(
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              {shown.map((it) => (
                <CardView
                  key={it.id}
                  template={it.card_templates}
                  image={cardImageUrl(it.card_templates)}
                  tirePerfs={tirePerfs}
                  compare={compare(it.card_templates, null, "block")}
                >
                  {buy(it)}
                </CardView>
              ))}
            </div>
            )}
            list={(
            <div className="grid min-w-0 gap-2">
              {shown.map((it) => (
                <CardRow
                  key={it.id}
                  template={it.card_templates}
                  image={cardImageUrl(it.card_templates)}
                  compare={compare(it.card_templates, null, "badge")}
                >
                  {buy(it)}
                </CardRow>
              ))}
            </div>
            )}
          />
        )}
      </section>
      </CompareProvider>
    </CatalogViewProvider>
  );
}
