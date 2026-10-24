import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { CardView } from "@/components/CardView";
import { LISTING_PAGE_SIZE, loadMarketplacePage } from "@/lib/queries";
import { buyListing, cancelListing, listCard, makeOffer, respondOffer, withdrawOffer } from "./actions";

export const metadata = { title: "Marketplace — CarsDuel" };

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<{ sell?: string; page?: string }> }) {
  const { sell, page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const { user } = await requireUser();
  const { listings, offers, cards, decks, modifiers: tirePerfs, names: nameOf } = await loadMarketplacePage(user.id, page);
  const inDeck = new Set(decks.flatMap((x) => [x.engine_card_id, x.gearbox_card_id, x.tire_card_id]));
  const sellableCards = cards.filter((x) => !x.is_destroyed && !x.is_listed && !inDeck.has(x.id));

  const mine = listings.filter((x) => x.seller_id === user.id);
  const others = listings.filter((x) => x.seller_id !== user.id);
  const myOffers = offers.filter((x) => x.buyer_id === user.id);
  const offersOn = (listingId: string) => offers.filter((x) => x.listing_id === listingId && x.buyer_id !== user.id);
  const pageHref = (n: number) => {
    const q = new URLSearchParams();
    if (sell) q.set("sell", sell);
    if (n > 1) q.set("page", String(n));
    const s = q.toString();
    return s ? `/marketplace?${s}` : "/marketplace";
  };

  return (
    <>
      <section className="space-y-3">
        <h1 className="text-xl font-bold">Vendre une carte</h1>
        <p className="text-sm text-zinc-400">Prix minimum 1 pièce. Taxe de 10 % prélevée sur le vendeur à la vente. La carte est verrouillée tant que l&apos;annonce est active.</p>
        <ActionForm action={listCard} submitLabel="Mettre en vente">
          <select name="card_id" required defaultValue={sellableCards.find((x) => x.id === sell)?.id ?? ""}>
            <option value="" disabled>Carte…</option>
            {sellableCards.map((x) => (
              <option key={x.id} value={x.id}>
                {x.card_templates.name}{x.card_templates.category === "pneus" ? ` (${x.tire_wear}%)` : ""}
              </option>
            ))}
          </select>
          <input name="price" type="number" min={1} placeholder="Prix (min. 1)" className="w-36" />
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" name="accepts_offers" /> Accepter les offres
          </label>
        </ActionForm>
        <p className="text-xs text-zinc-500">Laissez le prix vide pour une vente par offres uniquement.</p>
      </section>

      {mine.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl font-bold">Mes annonces</h2>
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
      )}

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Annonces ({others.length})</h2>
        {others.length === 0 && <p className="text-sm text-zinc-500">Aucune annonce pour le moment.</p>}
        <div className="grid gap-3 md:grid-cols-2">
          {others.map((x) => {
            const myOffer = myOffers.find((m) => m.listing_id === x.id);
            return (
              <CardView key={x.id} template={x.user_cards.card_templates} card={x.user_cards} tirePerfs={tirePerfs}>
                <p className="mb-2 text-xs text-zinc-500">Vendeur : {nameOf.get(x.seller_id) ?? "?"}</p>
                {x.price !== null && (
                  <ActionForm action={buyListing} submitLabel={`Acheter — ${x.price} 🪙`} confirmText={`Acheter pour ${x.price} pièces ?`} className="flex">
                    <input type="hidden" name="listing_id" value={x.id} />
                  </ActionForm>
                )}
                {x.accepts_offers && !myOffer && (
                  <ActionForm action={makeOffer} submitLabel="Faire une offre" variant="ghost" className="mt-2 flex items-end gap-2">
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
