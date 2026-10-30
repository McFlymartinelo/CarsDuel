import { requireUser } from "@/lib/auth";
import { ActionForm } from "@/components/ActionForm";
import { CardRow } from "@/components/CardRow";
import { CardView } from "@/components/CardView";
import { viewMode, type CardViewMode } from "@/components/ViewToggle";
import { CatalogViewLink, CatalogViewPanels, CatalogViewProvider, CatalogViewToggle } from "@/components/CatalogView";
import { QuestPing } from "@/components/QuestPing";
import { CatalogFilters } from "@/components/CatalogFilters";
import { readCatalogQuery } from "@/lib/catalog-filters";
import type { Rarity } from "@/lib/types";
import { CATEGORY_LABEL, formatDateTime } from "@/lib/format";
import { cardImageUrl } from "@/lib/card-images";
import { parsePage } from "@/lib/pagination";
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
  searchParams: Promise<{ page?: string; tab?: string; rarity?: string; sort?: string; min?: string; max?: string; risk?: string; q?: string; vue?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const nextPage = parsePage(page + 1);
  const query = readCatalogQuery(sp);
  const view = viewMode(sp.vue);
  const { user } = await requireUser();
  const { listings, offers, modifiers: tirePerfs, names: nameOf, priceRef, history, counts, rarityCounts } = await loadMarketplacePage(user.id, page, query);

  const mine = listings.filter((x) => x.seller_id === user.id);
  const others = listings.filter((x) => x.seller_id !== user.id);
  const myOffers = offers.filter((x) => x.buyer_id === user.id);
  const offersOn = (listingId: string) => offers.filter((x) => x.listing_id === listingId && x.buyer_id !== user.id);

  const href = (o: { page?: number; view?: CardViewMode }) => {
    const q = new URLSearchParams();
    q.set("tab", query.tab.key);
    if (query.rarity) q.set("rarity", query.rarity);
    if (query.sort) q.set("sort", query.sort);
    if (query.min != null) q.set("min", String(query.min));
    if (query.max != null) q.set("max", String(query.max));
    if (query.risk != null) q.set("risk", String(query.risk));
    if (query.q) q.set("q", query.q);
    if (o.page && o.page > 1) q.set("page", String(o.page));
    if ((o.view ?? view) === "liste") q.set("vue", "liste");
    return `/marketplace?${q.toString()}`;
  };
  const pageHref = (n: number) => href({ page: n });

  const card = (x: Listing, mode: CardViewMode, children: React.ReactNode, note?: React.ReactNode) =>
    mode === "liste" ? (
      <CardRow key={x.id} template={x.user_cards.card_templates} card={x.user_cards} note={note}>
        {children}
      </CardRow>
    ) : (
      <CardView key={x.id} template={x.user_cards.card_templates} card={x.user_cards} image={cardImageUrl(x.user_cards.card_templates)} tirePerfs={tirePerfs}>
        {note}
        {children}
      </CardView>
    );

  const mineGrid = (mode: CardViewMode) => (
    <div className={mode === "liste" ? "grid gap-2 xl:grid-cols-2" : "grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"}>
      {mine.map((x) =>
        card(
          x,
          mode,
          <>
            {mode === "cartes" && <p className="text-sm">{x.price !== null ? `${x.price} 🪙` : "Offres uniquement"}</p>}
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
          mode === "liste" ? <p className="text-sm text-amber-300">{x.price !== null ? `${x.price} 🪙` : "Offres uniquement"}</p> : undefined,
        ),
      )}
    </div>
  );

  const othersGrid = (mode: CardViewMode) => (
    <div className={mode === "liste" ? "grid gap-2 xl:grid-cols-2" : "grid gap-3 md:grid-cols-2"}>
      {others.map((x) => {
        const myOffer = myOffers.find((m) => m.listing_id === x.id);
        return card(
          x,
          mode,
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
  );

  return (
    <CatalogViewProvider initialView={view}>
    <>
      <QuestPing quest="marketplace" />
      <section className="space-y-3">
        <header>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Marketplace</h1>
            <CatalogViewToggle />
          </div>
          <p className="mt-0.5 text-sm text-zinc-400">Achetez et vendez des pièces entre joueurs.</p>
        </header>
        <CatalogFilters path="/marketplace" query={query} counts={counts} rarityCounts={rarityCounts as Partial<Record<Rarity, number>>} preserveCatalogView />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Mes annonces</h2>
        {mine.length === 0 && (
          <p className="rounded-xl border border-zinc-800 bg-[#10131a] px-4 py-6 text-center text-sm text-zinc-500">
            Aucune de vos annonces dans cette sélection.
          </p>
        )}
        <CatalogViewPanels cards={mineGrid("cartes")} list={mineGrid("liste")} />
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-bold uppercase tracking-wide">Annonces</h2>
        {others.length === 0 && (
          <p className="rounded-xl border border-zinc-800 bg-[#10131a] px-4 py-6 text-center text-sm text-zinc-500">
            {query.q ? `Aucune annonce ne correspond à « ${query.q} ».` : "Aucune annonce pour le moment."}
          </p>
        )}
        <CatalogViewPanels cards={othersGrid("cartes")} list={othersGrid("liste")} />
      </section>

      <div className="flex gap-4 text-sm">
        {page > 1 && <CatalogViewLink href={pageHref(page - 1)} className="text-amber-400 hover:underline">Page précédente</CatalogViewLink>}
        {listings.length === LISTING_PAGE_SIZE && nextPage > page && <CatalogViewLink href={pageHref(nextPage)} className="text-amber-400 hover:underline">Voir plus</CatalogViewLink>}
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
    </CatalogViewProvider>
  );
}
