import type { TradeResult } from "@/lib/types";

/** Message affiché après l'animation de contrôle d'une acceptation. */
export function tradeResultMessage(result: TradeResult | null | undefined): string {
  if (!result) return "Le contrôle de l'échange a échoué.";
  switch (result.reason) {
    case "cards_unavailable":
      return "Une carte ou des pièces ne sont plus disponibles. L'échange a été supprimé : recréez une proposition.";
    case "insufficient_funds":
      return "Le solde de pièces est insuffisant pour régler la taxe ou les pièces promises. L'échange a été supprimé.";
    case "expired":
      return "Cette proposition a expiré : elle a été retirée du système.";
    default:
      return "L'échange n'a pas pu être conclu et a été supprimé.";
  }
}

export function tradeFailureMessage(reason: string | undefined): string {
  switch (reason) {
    case "cards_unavailable":
      return "Des cartes ne sont plus disponibles chez l'un des joueurs. L'échange a été supprimé.";
    case "insufficient_funds":
      return "Solde insuffisant pour régler la taxe ou les pièces promises. L'échange a été supprimé.";
    case "expired":
      return "Cette proposition a expiré. Elle a été retirée du système.";
    default:
      return "L'échange a échoué et a été supprimé.";
  }
}
