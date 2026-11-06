import { requireUser } from "@/lib/auth";
import { QuestPing } from "@/components/QuestPing";
import { viewMode, type CardViewMode } from "@/components/ViewToggle";
import { Inventory } from "@/components/garage/Inventory";
import { loadGaragePage } from "@/lib/queries";

export const metadata = { title: "Inventaire — CarsDuel" };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; vue?: string; sort?: string }>;
}) {
  const { tab = "moteurs", vue, sort } = await searchParams;
  const view = viewMode(vue);
  const { user } = await requireUser();
  const { cards, modifiers, listings } = await loadGaragePage(user.id);
  const owned = cards.filter((c) => !c.in_recycle_bin && (!c.is_destroyed || c.card_templates.category !== "bonus"));
  const listingOf = Object.fromEntries(listings.map((l) => [l.card_id, l.id]));
  /** Même URL canonique partout : onglet, vue et tri ne se perdent pas en changeant l'un d'eux. */
  const href = (over: { tab?: string; vue?: CardViewMode; sort?: string }) => {
    const nextTab = over.tab ?? tab;
    const nextView = over.vue ?? view;
    // Changer d'onglet remet le tri à zéro : les options diffèrent d'une catégorie à l'autre.
    const nextSort = over.sort ?? (over.tab ? "" : sort ?? "");
    const params = new URLSearchParams({ tab: nextTab });
    if (nextView === "liste") params.set("vue", "liste");
    if (nextSort) params.set("sort", nextSort);
    return `/garage/inventaire?${params.toString()}`;
  };

  return (
    <>
      <QuestPing quest="inventaire" />
      <Inventory
        cards={owned}
        tab={tab}
        sort={sort ?? ""}
        hrefForTab={(t) => href({ tab: t })}
        hrefForSort={(s) => href({ sort: s })}
        view={view}
        hrefForView={(mode) => href({ vue: mode })}
        tirePerfs={modifiers}
        listings={listingOf}
      />
    </>
  );
}
