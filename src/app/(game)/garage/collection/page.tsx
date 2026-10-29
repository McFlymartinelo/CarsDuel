import { requireUser } from "@/lib/auth";
import { loadCollectorChallengeClaims, loadCollectorCollection } from "@/lib/queries";
import { cardImageUrl } from "@/lib/card-images";
import { CollectorCollection } from "@/components/CollectorCollection";
import { CollectorChallenges } from "@/components/CollectorChallenges";
import { CatalogViewProvider, CatalogViewToggle } from "@/components/CatalogView";
import { viewMode } from "@/components/ViewToggle";

export const metadata = { title: "Le coin du collectionneur — CarsDuel" };

export default async function CollectorPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const sp = await searchParams;
  const { user } = await requireUser();
  const [cards, claimedChallenges] = await Promise.all([
    loadCollectorCollection(user.id),
    loadCollectorChallengeClaims(user.id),
  ]);
  return <CatalogViewProvider initialView={viewMode(sp.vue)}><section className="min-w-0 space-y-6">
    <header>
      <h1 className="font-display text-3xl font-bold uppercase">Le coin du collectionneur</h1>
      <p className="mt-2 text-sm text-zinc-400">Retrouvez toutes les cartes du jeu et celles que vous avez déjà obtenues.</p>
    </header>
    <CollectorChallenges entries={cards} claimedChallenges={claimedChallenges} />
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Collection complète</h2>
        <CatalogViewToggle />
      </div>
      <CollectorCollection entries={cards.map((entry) => ({ ...entry, image: cardImageUrl(entry.card_templates) }))} />
    </div>
  </section></CatalogViewProvider>;
}
