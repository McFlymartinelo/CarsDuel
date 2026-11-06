import { requireUser } from "@/lib/auth";
import { loadCollectorChallengeClaims, loadCollectorCollection, loadTireModifiers } from "@/lib/queries";
import { cardImageUrl } from "@/lib/card-images";
import { CollectorCollection } from "@/components/CollectorCollection";
import { PageHeader } from "@/components/PageHeader";
import { CollectorChallenges } from "@/components/CollectorChallenges";
import { VisitCollectorCollection } from "@/components/VisitCollectorCollection";
import { CatalogViewProvider, CatalogViewToggle } from "@/components/CatalogView";
import { viewMode } from "@/components/ViewToggle";

export const metadata = { title: "Le coin du collectionneur — CarsDuel" };

export default async function CollectorPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const sp = await searchParams;
  const { user } = await requireUser();
  const [cards, claimedChallenges, tirePerfs] = await Promise.all([
    loadCollectorCollection(user.id),
    loadCollectorChallengeClaims(user.id),
    loadTireModifiers(user.id),
  ]);
  return <CatalogViewProvider initialView={viewMode(sp.vue)}><section className="min-w-0 space-y-6">
    <PageHeader
      back
      title="Le coin du collectionneur"
      description="Retrouvez toutes les cartes du jeu et celles que vous avez déjà obtenues."
    />
    <VisitCollectorCollection tirePerfs={tirePerfs} />
    <CollectorChallenges entries={cards} claimedChallenges={claimedChallenges} />
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Collection complète</h2>
        <CatalogViewToggle />
      </div>
      <CollectorCollection entries={cards.map((entry) => ({ ...entry, image: cardImageUrl(entry.card_templates) }))} tirePerfs={tirePerfs} />
    </div>
  </section></CatalogViewProvider>;
}
