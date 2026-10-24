/** Les RPC lèvent des codes courts (RAISE EXCEPTION 'code') : on les traduit pour l'UI. */
const MESSAGES: Record<string, string> = {
  forbidden: "Action non autorisée.",
  deck_not_found: "Deck introuvable.",
  card_not_owned: "Cette carte ne vous appartient pas.",
  tire_destroyed: "Pneu détruit : équipez un nouveau pneu avant de rouler.",
  engine_destroyed: "Moteur détruit.",
  gearbox_destroyed: "Boîte détruite.",
  card_listed: "Une carte du deck est en vente.",
  no_opponent: "Aucun adversaire disponible pour le moment.",
  invalid_bonus: "Carte bonus invalide.",
  invalid_option: "Option de tirage invalide.",
  already_claimed: "Tirage du jour déjà effectué (reset à minuit, heure de Paris).",
  catalog_empty: "Le catalogue ne contient pas encore de cartes pour ce tirage.",
  insufficient_funds: "Pièces insuffisantes.",
  price_or_offers_required: "Indiquez un prix ou activez les offres.",
  invalid_price: "Prix invalide.",
  card_destroyed: "Cette carte est détruite.",
  already_listed: "Cette carte est déjà en vente.",
  card_in_deck: "Retirez d'abord cette carte de vos decks.",
  listing_not_found: "Annonce introuvable.",
  listing_closed: "Cette annonce est clôturée.",
  offers_only: "Cette annonce n'accepte que des offres.",
  cannot_buy_own_listing: "Vous ne pouvez pas acheter votre propre annonce.",
  invalid_amount: "Montant invalide.",
  offers_disabled: "Cette annonce n'accepte pas les offres.",
  cannot_offer_own_listing: "Vous ne pouvez pas faire d'offre sur votre annonce.",
  offer_already_pending: "Vous avez déjà une offre en cours (retirez-la d'abord).",
  offer_not_found: "Offre introuvable.",
  offer_not_pending: "Cette offre n'est plus en attente.",
  item_not_found: "Article introuvable.",
  out_of_stock: "Rupture de stock.",
  incomplete_collection: "Il vous faut au moins un moteur, une boîte et des pneus disponibles pour créer un deck.",
  invalid_deck_card: "Carte invalide pour cet emplacement (propriété, catégorie ou mise en vente).",
};

export function rpcErrorMessage(err: { message: string }): string {
  const code = err.message.trim();
  return MESSAGES[code] ?? "Une erreur est survenue. Réessayez.";
}
