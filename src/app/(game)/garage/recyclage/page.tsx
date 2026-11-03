import { requireUser } from "@/lib/auth";
import { loadRecycleCenterPage } from "@/lib/queries";
import { viewMode } from "@/components/ViewToggle";
import { cardImageUrl } from "@/lib/card-images";
import {
  RecycleCenter,
  type RecycleFilter,
  type RecycleTab,
} from "@/components/garage/RecycleCenter";

export const metadata = { title: "Centre de recyclage — CarsDuel" };

const TABS: RecycleTab[] = ["inventaire", "benne", "echanges"];
const FILTERS: RecycleFilter[] = ["toutes", "moteurs", "boites", "pneus", "detruites"];

const oneOf = <T extends string>(value: string | undefined, allowed: T[], fallback: T): T =>
  allowed.includes((value ?? "") as T) ? ((value ?? "") as T) : fallback;

export default async function RecycleCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; cat?: string; vue?: string }>;
}) {
  const { tab, cat, vue } = await searchParams;
  const { user } = await requireUser();
  const { cards, modifiers } = await loadRecycleCenterPage(user.id);

  // Les visuels sont résolus ici : cardImageUrl lit le disque (server-only).
  const images: Record<string, string | null> = {};
  for (const card of cards) images[card.id] = cardImageUrl(card.card_templates);

  return (
    <RecycleCenter
      cubes={user.scrap_cubes}
      cards={cards}
      tirePerfs={modifiers}
      images={images}
      tab={oneOf(tab, TABS, "inventaire")}
      filter={oneOf(cat, FILTERS, "toutes")}
      view={viewMode(vue)}
    />
  );
}
