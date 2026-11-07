import { Suspense } from "react";
import { requireUser } from "@/lib/auth";
import { loadCollectorChallengeClaims, loadCollectorCollection, loadTireModifiers } from "@/lib/queries";
import { cardImageUrl } from "@/lib/card-images";
import { CollectorCollection } from "@/components/CollectorCollection";
import { PageHeader } from "@/components/PageHeader";
import { CollectorChallenges } from "@/components/CollectorChallenges";
import { VisitCollectorCollection } from "@/components/VisitCollectorCollection";
import { CatalogViewProvider, CatalogViewToggle } from "@/components/CatalogView";
import { Skeleton } from "@/components/ui/Skeleton";
import { viewMode } from "@/components/ViewToggle";

export const metadata = { title: "Le coin du collectionneur — CarsDuel" };

export default async function CollectorPage({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const sp = await searchParams;
  return (
    <CatalogViewProvider initialView={viewMode(sp.vue)}>
      <section className="min-w-0 space-y-6">
        <PageHeader
          back
          title="Le coin du collectionneur"
          description="Retrouvez toutes les cartes du jeu et celles que vous avez déjà obtenues."
        />
        <Suspense fallback={<CollectorFallback />}>
          <CollectorContent />
        </Suspense>
      </section>
    </CatalogViewProvider>
  );
}

/** Chargé dans son propre Suspense : le titre de la page s'affiche immédiatement. */
async function CollectorContent() {
  const { user } = await requireUser();
  const [cards, claimedChallenges, tirePerfs] = await Promise.all([
    loadCollectorCollection(user.id),
    loadCollectorChallengeClaims(user.id),
    loadTireModifiers(user.id),
  ]);

  return (
    <>
      <VisitCollectorCollection tirePerfs={tirePerfs} />
      <CollectorChallenges entries={cards} claimedChallenges={claimedChallenges} />
      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold uppercase tracking-wide">Collection complète</h2>
          <CatalogViewToggle />
        </div>
        <CollectorCollection entries={cards.map((entry) => ({ ...entry, image: cardImageUrl(entry.card_templates) }))} tirePerfs={tirePerfs} />
      </div>
    </>
  );
}

function CollectorFallback() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-28 rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <Skeleton key={i} className="h-64 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
