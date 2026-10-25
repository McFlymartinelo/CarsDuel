import { requireUser } from "@/lib/auth";
import { QuestPing } from "@/components/QuestPing";
import { viewMode } from "@/components/ViewToggle";
import { Inventory } from "@/components/garage/Inventory";
import { loadGaragePage } from "@/lib/queries";

export const metadata = { title: "Inventaire — CarsDuel" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ tab?: string; vue?: string }> }) {
  const { tab = "moteurs", vue } = await searchParams;
  const view = viewMode(vue);
  const { user } = await requireUser();
  const { cards, modifiers, listings } = await loadGaragePage(user.id);
  const owned = cards.filter((c) => !c.is_destroyed || c.card_templates.category !== "bonus");
  const listingOf = Object.fromEntries(listings.map((l) => [l.card_id, l.id]));
  const href = (over: Record<string, string>) =>
    `/garage/inventaire?${new URLSearchParams({ tab, ...(view === "liste" ? { vue: "liste" } : {}), ...over }).toString()}`;

  return (
    <>
      <QuestPing quest="inventaire" />
      <Inventory
        cards={owned}
        tab={tab}
        hrefForTab={(t) => href({ tab: t })}
        view={view}
        hrefForView={(mode) => `/garage/inventaire?${new URLSearchParams({ tab, ...(mode === "liste" ? { vue: "liste" } : {}) }).toString()}`}
        tirePerfs={modifiers}
        listings={listingOf}
      />
    </>
  );
}
