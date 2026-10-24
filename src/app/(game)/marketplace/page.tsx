import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { CardRow } from "@/components/CardRow";
import { CardView } from "@/components/CardView";
import { SortLinks } from "@/components/SortLinks";
import { ViewToggle, viewMode, type CardViewMode } from "@/components/ViewToggle";
import { ENGINE_SORTS, GEARBOX_SORTS, marketFilter } from "@/lib/catalog-sort";
import { CATEGORY_LABEL, formatDateTime } from "@/lib/format";
import { LISTING_PAGE_SIZE, loadMarketplacePage } from "@/lib/queries";
import type { Listing, PriceRef } from "@/lib/types";
import { buyListing, cancelListing, makeOffer, respondOffer, withdrawOffer } from "./actions";

export const metadata = { title: "Marketplace — CarsDuel" };

const GOOD_DEAL = 0.85;
const ABOVE_MARKET = 1.3;

/** Prix moyen des dernières ventes du même modèle, avec un repère « bonne affaire » / « au-dessus du marché ». */
function PriceHint({ price, reference }: { price: number | null; reference: PriceRef | undefined }) {
  if (!reference) return null;
  const ratio = price !== null && reference.avg_price > 0 ? price / reference.avg_price : null;
  return (
    <p className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-400">
      <span>
        Prix moyen constaté : <b className="text-zinc-200">{reference.avg_price.toLocaleString("fr-FR")} 🪙</b> ({reference.sales} vente{reference.sales > 1 ? "s" : ""})
      </span>
      {ratio !== null && ratio <= GOOD_DEAL && <span className="rounded border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-300">Bonne affaire</span>}
      {ratio !== null && ratio >= ABOVE_MARKET && <span className="rounded border border-orange-500/50 bg-orange-500/10 px-1.5 py-0.5 font-semibold text-orange-300">Au-dessus du marché</span>}
    </p>
  );
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; cat?: string; sort?: string; vue?: string }>;
}) {
  const { page: pageParam, cat, sort, vue } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);
  const filter = marketFilter(cat, sort);
  const view = viewMode(vue);
  const { user } = await requireUser();
  const { listings, offers, modifiers: tirePerfs, names: nameOf, priceRef, history } = await loadMarketplacePage(user.id, page, filter);

  const mine = listings.filter((x) => x.seller_id === user.id);
  const others = listings.filter((x) => x.seller_id !== user.id);
  const myOffers = offers.filter((x) => x.buyer_id === user.id);
  const offersOn = (listingId: string) => offers.filter((x) => x.listing_id === listingId && x.buyer_id !== user.id);

  const href = (o: { cat?: string; sort?: string; page?: number; view?: CardViewMode }) => {
    const q = new URLSearchParams();
    if (o.cat && o.sort) {
      q.set("cat", o.cat);
      q.set("sort", o.sort);
    }
    if (o.page && o.page > 1) q.set("page", String(o.page));
    if ((o.view ?? view) === "liste") q.set("vue", "liste");
    const s = q.toString();
    return s ? `/marketplace?${s}` : "/marketplace";
  };
  const pageHref = (n: number) => href({ cat: filter?.category, sort: filter?.sort, page: n });
  const sortHref = (category: "moteur" | "boite", key: string | null) => (key ? href({ cat: category, sort: key }) : href({}));

  const grid = view === "liste" ? "grid gap-2 xl:grid-cols-2" : "grid gap-3 md:grid-cols-2";
  const card = (x: Listing, children: React.ReactNode, note?: React.ReactNode) =>
    view === "liste" ? (
      <CardRow key={x.id} template={x.user_cards.card_templates} card={x.user_cards} note={note}>
        {children}
      </CardRow>
    ) : (
      <CardView key={x.id} template={x.user_cards.card_templates} card={x.user_cards} tirePerfs={tirePerfs}>
        {note}
        {children}
      </CardView>
    );

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
          <ViewToggle current={view} hrefFor={(mode) => href({ cat: filter?.category, sort: filter?.sort, page, view: mode })} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Mes annonces</h2>
        {mine.length === 0 && (
          <p className="text-sm text-zinc-500">
            {filter ? "Aucune de vos annonces dans cette sélection." : "Aucune annonce en cours. La mise en vente se fait depuis le garage."}
          </p>
        )}
        <div className={view === "liste" ? grid : "grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"}>
          {mine.map((x) =>
            card(
              x,
              <>
                {view === "cartes" && <p className="text-sm">{x.price !== null ? `${x.price} 🪙` : "Offres uniquement"}</p>}
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
              </>,
              view === "liste" ? <p className="text-sm text-amber-300">{x.price !== null ? `${x.price} 🪙` : "Offres uniquement"}</p> : undefined,
            ),
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-bold">Annonces</h2>
        {others.length === 0 && <p className="text-sm text-zinc-500">Aucune annonce pour le moment.</p>}
        <div className={grid}>
          {others.map((x) => {
            const myOffer = myOffers.find((m) => m.listing_id === x.id);
            return card(
              x,
              <>
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
                    confirmText="Envoyer une offre de {amount} pièces ?"
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
              </>,
              <>
                <p className="mb-1 text-xs text-zinc-500">Vendeur : {nameOf.get(x.seller_id) ?? "?"}</p>
                <PriceHint price={x.price} reference={priceRef.get(x.user_cards.template_id)} />
              </>,
            );
          })}
        </div>
      </section>

      <div className="flex gap-4 text-sm">
        {page > 1 && <Link href={pageHref(page - 1)} className="text-amber-400 hover:underline">Page précédente</Link>}
        {listings.length === LISTING_PAGE_SIZE && <Link href={pageHref(page + 1)} className="text-amber-400 hover:underline">Voir plus</Link>}
      </div>

      {history.length > 0 && (
        <details className="group rounded-xl border border-zinc-800 bg-[#0e1117]">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-display text-lg font-bold uppercase [&::-webkit-details-marker]:hidden">
            Mes transactions
            <span className="text-sm font-normal normal-case text-zinc-500 group-open:hidden">{history.length} dernières</span>
          </summary>
          <ul className="divide-y divide-zinc-800 border-t border-zinc-800 px-4 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{h.card_name}</span>
                  <span className="text-xs text-zinc-500">
                    {h.role === "sale" ? "Vente" : "Achat"} · {CATEGORY_LABEL[h.category]} · {formatDateTime(h.closed_at)}
                  </span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  {h.role === "sale" ? (
                    <>
                      <b className="text-emerald-400">+{h.net.toLocaleString("fr-FR")} 🪙</b>
                      <span className="block text-xs text-zinc-500">prix {h.price.toLocaleString("fr-FR")}, taxe {(h.price - h.net).toLocaleString("fr-FR")}</span>
                    </>
                  ) : (
                    <b className="text-red-400">−{h.price.toLocaleString("fr-FR")} 🪙</b>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
