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
  trade_limit: "Trop d'échanges avec ce joueur sur les dernières 24 h.",
  invalid_bonus: "Carte bonus invalide.",
  invalid_option: "Option de tirage invalide.",
  already_claimed: "Tirage du jour déjà effectué (reset à minuit, heure de Paris).",
  weekly_already_claimed: "Tirage de la semaine déjà effectué (reset le lundi, heure de Paris).",
  catalog_empty: "Le catalogue ne contient pas encore de cartes pour ce tirage.",
  insufficient_funds: "Pièces insuffisantes.",
  invalid_category: "Catégorie de tirage invalide.",
  profile_not_found: "Profil introuvable.",
  template_not_found: "Modèle de carte introuvable.",
  invalid_number: "Valeur numérique invalide.",
  price_or_offers_required: "Indiquez un prix ou activez les offres.",
  invalid_price: "Prix invalide.",
  price_too_low: "Prix minimum : 10 pièces.",
  warranty_not_applicable: "La garantie constructeur ne couvre que les moteurs et les boîtes.",
  card_not_broken: "Cette carte n'est pas cassée.",
  warranty_expired: "Garantie constructeur expirée : cette carte n'est plus couverte.",
  warranty_already_extended: "La garantie de cette carte a déjà été prolongée (une seule fois par carte).",
  card_broken_no_extension: "Impossible de prolonger la garantie d'une pièce cassée : réparez-la d'abord sous garantie.",
  card_is_listed: "Cette carte est en vente : retirez l'annonce avant de prolonger sa garantie.",
  bonus_revision_required: "Il faut une carte bonus « Révision complète » pour prolonger la garantie.",
  card_destroyed: "Cette carte est détruite.",
  already_listed: "Cette carte est déjà en vente.",
  card_in_deck: "Retirez d'abord cette carte de vos decks.",
  listing_not_found: "Annonce introuvable.",
  listing_closed: "Cette annonce est clôturée.",
  offers_only: "Cette annonce n'accepte que des offres.",
  cannot_buy_own_listing: "Vous ne pouvez pas acheter votre propre annonce.",
  invalid_amount: "Montant invalide.",
  offer_too_low: "Offre minimum : 10 pièces.",
  offers_disabled: "Cette annonce n'accepte pas les offres.",
  cannot_offer_own_listing: "Vous ne pouvez pas faire d'offre sur votre annonce.",
  offer_already_pending: "Vous avez déjà une offre en cours (retirez-la d'abord).",
  offer_not_found: "Offre introuvable.",
  offer_not_pending: "Cette offre n'est plus en attente.",
  item_not_found: "Article introuvable.",
  out_of_stock: "Rupture de stock.",
  incomplete_collection: "Il vous faut au moins un moteur, une boîte et des pneus disponibles pour créer un deck.",
  invalid_deck_card: "Carte invalide pour cet emplacement (propriété, catégorie ou mise en vente).",
  not_recyclable: "Cette carte ne se recycle pas.",
  bonus_not_sellable: "Les cartes bonus ne se vendent pas. Vous pouvez les recycler contre 1 pièce.",
  card_not_sellable: "Cette carte ne peut pas être mise en vente.",
  user_not_found: "Ce pseudo est introuvable.",
  cannot_challenge_self: "Vous ne pouvez pas vous défier vous-même.",
  challenge_pending: "Une demande est déjà en attente entre vous et ce joueur.",
  challenge_not_found: "Cette demande n'est plus disponible.",
  config_incomplete: "Votre configuration est incomplète. Équipez un moteur, une boîte et des pneus disponibles.",
  quest_unknown: "Ce défi n'est pas au programme aujourd'hui.",
  quest_not_done: "Ce défi n'est pas encore terminé.",
  quest_already_claimed: "Ces pièces ont déjà été récupérées.",
  collector_challenge_unknown: "Ce défi du collectionneur est inconnu.",
  collector_challenge_unavailable: "Ce défi n'est pas disponible dans le catalogue actuel.",
  collector_challenge_not_done: "Ce défi n'est pas encore terminé.",
  collector_challenge_already_claimed: "La récompense de ce défi a déjà été réclamée.",
};

type PgErr = { message?: string; code?: string; stack?: string };

/** Traduit un code métier connu. Tout le reste est journalisé (message, code pg, stack) et masqué. */
export function rpcErrorMessage(err: unknown): string {
  const e = (err ?? {}) as PgErr;
  const code = (e.message ?? "").trim();
  const known = MESSAGES[code];
  if (known) return known;
  console.error("[rpc]", e.message ?? "", e.code ?? "", e.stack ?? "");
  return "Une erreur est survenue. Réessayez.";
}
