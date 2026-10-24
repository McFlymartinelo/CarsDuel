import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { CardView } from "@/components/CardView";
import { SortLinks } from "@/components/SortLinks";
import { ENGINE_SORTS, GEARBOX_SORTS, marketFilter } from "@/lib/catalog-sort";
import { LISTING_PAGE_SIZE, loadMarketplacePage } from "@/lib/queries";
import { buyListing, cancelListing, makeOffer, respondOffer, withdrawOffer } from "./actions";

export const metadata = { title: "Marketplace — CarsDuel" };

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<{ page?: string; cat?: string; sort?: string }> }) {
  const { page: pageParam, cat, sort } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const filter = marketFilter(cat, sort);
  const { user } = await requireUser();
  const { listings, offers, modifiers: tirePerfs, names: nameOf } = await loadMarketplacePage(user.id, page, filter);

  const mine = listings.filter((x) => x.seller_id === user.id);
  const others = listings.filter((x) => x.seller_id !== user.id);
  const myOffers = offers.filter((x) => x.buyer_id === user.id);
  const offersOn = (listingId: string) => offers.filter((x) => x.listing_id === listingId && x.buyer_id !== user.id);

  const pageHref = (n: number) => {
    const q = new URLSearchParams();
    if (filter) {
      q.set("cat", filter.category);
      q.set("sort", filter.sort);
    }
    if (n > 1) q.set("page", String(n));
    const s = q.toString();
    return s ? `/marketplace?${s}` : "/marketplace";
  };
  const sortHref = (category: "moteur" | "boite", key: string | null) => {
    if (!key) return "/marketplace";
    return `/marketplace?${new URLSearchParams({ cat: category, sort: key })}`;
  };

  return (
    <>
      <section className="space-y-3">
        <h2 className="text-xl font-bold">Trier les annonces</h2>
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center xl:gap-x-8">
          <SortLinks
            label="Moteurs"
            options={ENGINE_SORTS}
            current={filter?.category === "moteur" ? filter.sort : undefined}
            hrefFor={(key) => sortHref("moteur", key)}
          />
          <SortLinks
            label="Boîtes"
            options={GEARBOX_SORTS}
            current={filter?.category === "boite" ? filter.sort : undefined}
            hrefFor={(key) => sortHref("boite", key)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Mes annonces</h2>
        {mine.length === 0 && (
          <p className="text-sm text-zinc-500">
            {filter ? "Aucune de vos annonces dans cette sélection." : "Aucune annonce en cours. La mise en vente se fait depuis le garage."}
          </p>
        )}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {mine.map((x) => (
            <CardView key={x.id} template={x.user_cards.card_templates} card={x.user_cards} tirePerfs={tirePerfs}>
              <p className="text-sm">{x.price !== null ? `${x.price} 🪙` : "Offres uniquement"}</p>
              {offersOn(x.id).map((off) => (
                <div key={off.id} className="mt-2 flex flex-wrap items-center gap-2 rounded bg-zinc-800 p-2 text-sm">
                  <span>Offre : <b>{off.amount} 🪙</b></span>
                  <ActionForm action={respondOffer} submitLabel="Accepter" className="flex">
                    <input type="hidden" name="offer_id" value={off.id} />
                    <input type="hidden" name="accept" value="true" />
                  </ActionForm>
                  <ActionForm action={respondOffer} submitLabel="Refuser" variant="ghost" className="flex">
                    <input type="hidden" name="offer_id" value={off.id} />
                    <input type="hidden" name="accept" value="false" />
                  </ActionForm>
                </div>
              ))}
              <ActionForm action={cancelListing} submitLabel="Retirer l'annonce" variant="danger" className="mt-2 flex">
                <input type="hidden" name="listing_id" value={x.id} />
              </ActionForm>
            </CardView>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Annonces</h2>
        {others.length === 0 && <p className="text-sm text-zinc-500">Aucune annonce pour le moment.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {others.map((x) => {
            const myOffer = myOffers.find((m) => m.listing_id === x.id);
            return (
              <CardView key={x.id} template={x.user_cards.card_templates} card={x.user_cards} tirePerfs={tirePerfs}>
                <p className="mb-2 text-xs text-zinc-500">Vendeur : {nameOf.get(x.seller_id) ?? "?"}</p>
                {x.price !== null && (
                  <ActionForm
                    action={buyListing}
                    submitLabel={`Acheter — ${x.price} 🪙`}
                    confirmText={`Acheter ${x.user_cards.card_templates.name} pour ${x.price} pièces ?`}
                    className="flex"
                  >
                    <input type="hidden" name="listing_id" value={x.id} />
                  </ActionForm>
                )}
                {x.accepts_offers && !myOffer && (
                  <ActionForm
                    action={makeOffer}
                    submitLabel="Faire une offre"
                    variant="ghost"
                    confirmText={(form) => `Envoyer une offre de ${new FormData(form).get("amount")} pièces ?`}
                    className="mt-2 flex items-end gap-2"
                  >
                    <input type="hidden" name="listing_id" value={x.id} />
                    <input name="amount" type="number" min={1} required placeholder="Montant" className="w-28" />
                  </ActionForm>
                )}
                {myOffer && (
                  <ActionForm action={withdrawOffer} submitLabel="Retirer mon offre" variant="ghost" className="mt-2 flex items-center gap-2">
                    <input type="hidden" name="offer_id" value={myOffer.id} />
                    <span className="text-sm text-amber-300">Offre en cours : {myOffer.amount} 🪙 (séquestre)</span>
                  </ActionForm>
                )}
              </CardView>
            );
          })}
        </div>
      </section>
      <div className="flex gap-4 text-sm">
        {page > 1 && <Link href={pageHref(page - 1)} className="text-amber-400 hover:underline">Page précédente</Link>}
        {listings.length === LISTING_PAGE_SIZE && <Link href={pageHref(page + 1)} className="text-amber-400 hover:underline">Voir plus</Link>}
      </div>
    </>
  );
}
