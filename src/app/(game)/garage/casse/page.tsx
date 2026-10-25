import { requireUser } from "@/lib/auth";
import { viewMode } from "@/components/ViewToggle";
import { Inventory } from "@/components/garage/Inventory";
import { loadGaragePage } from "@/lib/queries";

export const metadata = { title: "Musée de la casse — CarsDuel" };

export default async function ScrapPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { vue } = await searchParams;
  const view = viewMode(vue);
  const { user } = await requireUser();
  const { cards, modifiers } = await loadGaragePage(user.id);

  return (
    <>
      <Inventory
        museum
        cards={cards}
        tab="moteurs"
        hrefForTab={() => "/garage/casse"}
        view={view}
        hrefForView={(mode) => (mode === "liste" ? "/garage/casse?vue=liste" : "/garage/casse")}
        tirePerfs={modifiers}
      />
    </>
  );
}
