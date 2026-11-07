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
const FILTERS: RecycleFilter[] = ["toutes", "moteurs", "boites", "pneus"];
/** Valeurs acceptées pour ?sort=, revalidées une seconde fois côté composant. */
const SORT_KEYS = ["power", "weight", "shift", "ref", "gomme"];
/** Valeurs acceptées pour ?rarity=, revalidées une seconde fois côté composant. */
const RARITIES = ["commune", "rare", "tres_rare", "epique", "legendaire"];

const oneOf = <T extends string>(value: string | undefined, allowed: T[], fallback: T): T =>
  allowed.includes((value ?? "") as T) ? ((value ?? "") as T) : fallback;

export default async function RecycleCenterPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; cat?: string; sort?: string; rarity?: string; etat?: string; vue?: string }>;
}) {
  const { tab, cat, sort, rarity, etat, vue } = await searchParams;
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
      sort={oneOf(sort as string | undefined, SORT_KEYS, "" as string) || undefined}
      rarity={oneOf(rarity, RARITIES, "" as string) || undefined}
      destroyed={etat === "detruites"}
      view={viewMode(vue)}
    />
  );
}
