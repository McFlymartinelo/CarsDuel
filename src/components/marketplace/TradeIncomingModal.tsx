"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ArrowRightLeft, Check, Coins, HandCoins, Loader2, Pencil, ShieldAlert, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { TradeCardTile } from "@/components/marketplace/TradeCardTile";
import { tradeResultMessage } from "@/components/marketplace/tradeMessages";
import { respondTradeOffer } from "@/app/(game)/marketplace/trade-actions";
import { formatDateTime } from "@/lib/format";
import type { TradeOffer } from "@/lib/types";

type Phase = "idle" | "checking" | "success" | "failed";

const TAX = 10;

function CardGrid({ cards }: { cards: TradeOffer["items"][number]["user_cards"][] }) {
  if (cards.length === 0) {
    return <p className="rounded-lg border border-dashed border-line-strong bg-[#0b0e13] px-3 py-6 text-center text-xs text-zinc-500">Aucune carte.</p>;
  }
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,7rem),1fr))] gap-2">
      {cards.map((card) => (
        <TradeCardTile key={card.id} card={card} />
      ))}
    </div>
  );
}

/** Détail d'une proposition reçue : accepter, refuser ou basculer en contre-offre. */
export function TradeIncomingModal({
  offer,
  senderName,
  currentCoins,
  modifying = false,
  onClose,
  onModify,
  onDone,
}: {
  offer: TradeOffer;
  senderName: string;
  currentCoins: number;
  /** Chargement de l'inventaire du partenaire pour basculer en contre-offre. */
  modifying?: boolean;
  onClose: () => void;
  onModify: () => void;
  /** Ferme la modale après une réponse (le serveur a déjà invalidé la page). */
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [refusing, startRefuse] = useTransition();

  const proposed = offer.items.filter((item) => item.side === "proposer").map((item) => item.user_cards);
  const requested = offer.items.filter((item) => item.side === "recipient").map((item) => item.user_cards);
  const canPayTax = currentCoins >= TAX;
  const busy = phase === "checking" || phase === "success" || phase === "failed" || refusing || modifying;

  async function accept() {
    if (!canPayTax || busy) return;
    setMessage(null);
    setPhase("checking");

    try {
      // Laisse l'animation de contrôle se dérouler même si la RPC répond vite.
      const [result] = await Promise.all([
        respondTradeOffer(offer.id, true),
        new Promise((resolve) => setTimeout(resolve, 900)),
      ]);

      if (!result?.ok) {
        setPhase("failed");
        setMessage(result?.message ?? "Le contrôle de l'échange a échoué.");
        setTimeout(onDone, 2200);
        return;
      }

      if (result.data?.ok) {
        setMessage(
          result.data.coins_offered && result.data.coins_offered > 0
            ? `Échange conclu ! ${result.data.coins_offered.toLocaleString("fr-FR")} pièces reçues, taxe de 10 pièces prélevée.`
            : "Échange conclu ! La taxe de 10 pièces a été prélevée sur votre solde.",
        );
        setPhase("success");
        setTimeout(onDone, 1500);
      } else {
        setPhase("failed");
        setMessage(tradeResultMessage(result.data));
        setTimeout(onDone, 2400);
      }
    } catch {
      setPhase("idle");
      setMessage("Erreur de connexion. Réessayez.");
    }
  }

  function refuse() {
    if (busy) return;
    startRefuse(async () => {
      try {
        const result = await respondTradeOffer(offer.id, false);
        if (result?.ok) onDone();
        else setMessage(result?.message ?? "Impossible de refuser cet échange.");
      } catch {
        setMessage("Erreur de connexion. Réessayez.");
      }
    });
  }

  return (
    <Modal labelledBy="trade-view-title" size="lg" onClose={busy ? undefined : onClose}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-amber-400/90">Proposition reçue</p>
          <h3 id="trade-view-title" className="font-display text-2xl font-bold uppercase leading-tight sm:text-3xl">
            Offre de <span className="text-amber-300">{senderName}</span>
          </h3>
          <p className="mt-1 text-xs text-zinc-500">Valable jusqu&apos;au {formatDateTime(offer.expires_at)}.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label="Fermer le détail de l'offre"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-strong text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-50"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <section className="rounded-xl border border-amber-500/30 bg-[linear-gradient(180deg,rgba(245,158,11,0.07),rgba(10,13,19,0.65))] p-3">
          <h4 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-amber-300">
            <HandCoins size={17} strokeWidth={1.8} /> {senderName} propose
          </h4>
          <div className="mt-3">
            <CardGrid cards={proposed} />
          </div>
          <p className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm font-semibold text-amber-200">
            <Coins size={17} strokeWidth={1.8} />
            {offer.proposer_coins > 0 ? (
              <>
                + {offer.proposer_coins.toLocaleString("fr-FR")} pièces
              </>
            ) : (
              <>Aucune pièce proposée</>
            )}
          </p>
        </section>

        <section className="rounded-xl border border-cyan-500/30 bg-[linear-gradient(180deg,rgba(34,211,238,0.07),rgba(10,13,19,0.65))] p-3">
          <h4 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-cyan-300">
            <ArrowRightLeft size={17} strokeWidth={1.8} /> {senderName} demande
          </h4>
          <div className="mt-3">
            <CardGrid cards={requested} />
          </div>
          <p className="mt-3 rounded-lg border border-line-strong bg-[#0b0e13] px-3 py-2 text-sm text-zinc-400">
            Aucune pièce demandée. Les pièces ne peuvent venir que de l&apos;initiateur de la proposition.
          </p>
        </section>
      </div>

      <div className="mt-4 flex gap-2 rounded-xl border border-red-500/60 bg-red-500/10 p-3 text-sm font-semibold text-red-300">
        <AlertTriangle size={20} strokeWidth={2} className="mt-0.5 shrink-0 text-red-400" />
        <p>Attention : une taxe forfaitaire de 10 pièces sera prélevée sur votre solde si vous acceptez cet échange.</p>
      </div>

      {phase === "checking" && (
        <div className="trade-scan relative mt-4 overflow-hidden rounded-xl border border-amber-500/50 bg-amber-500/10 p-4">
          <p className="flex items-center gap-3 font-display text-sm font-semibold uppercase tracking-wide text-amber-200">
            <Loader2 size={20} className="animate-spin" />
            Contrôle des cartes et des pièces…
          </p>
          <p className="mt-1 text-xs text-amber-200/70">Vérification en temps réel chez les deux joueurs.</p>
        </div>
      )}

      {phase === "success" && (
        <div className="mt-4 flex gap-2 rounded-xl border border-emerald-500/60 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-300">
          <Check size={20} strokeWidth={2.4} className="shrink-0" />
          <p>{message ?? "Échange conclu ! La taxe de 10 pièces a été prélevée sur votre solde."}</p>
        </div>
      )}

      {phase === "failed" && (
        <div className="mt-4 flex gap-2 rounded-xl border border-red-500/60 bg-red-500/10 p-4 text-sm font-semibold text-red-300">
          <ShieldAlert size={20} strokeWidth={2} className="shrink-0" />
          <p>{message ?? "L'échange a été supprimé."}</p>
        </div>
      )}

      {message && phase === "idle" && (
        <p role="alert" className="mt-3 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {message}
        </p>
      )}

      <div className="mt-4">
        <button
          type="button"
          onClick={accept}
          disabled={!canPayTax || busy}
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {phase === "checking" ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} strokeWidth={2.4} />}
          {phase === "checking" ? "Contrôle en cours…" : phase === "success" ? "Échange conclu" : "Accepter"}
        </button>
        {!canPayTax && (
          <p className="mt-1.5 text-center text-xs font-semibold text-red-400">Pas assez de pièces pour régler la taxe</p>
        )}
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={onModify}
          disabled={busy}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-zinc-600 px-4 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
        >
          {modifying ? <Loader2 size={16} className="animate-spin" /> : <Pencil size={16} strokeWidth={2} />}
          {modifying ? "Chargement…" : "Modifier l'offre"}
        </button>
        <button
          type="button"
          onClick={refuse}
          disabled={busy}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-red-500/70 px-4 text-sm font-semibold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
        >
          {refusing ? <Loader2 size={16} className="animate-spin" /> : <X size={16} strokeWidth={2.4} />}
          Refuser
        </button>
      </div>
    </Modal>
  );
}
