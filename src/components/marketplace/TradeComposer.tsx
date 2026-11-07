"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowRightLeft, Coins, HandCoins, Info, Send, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { TradeCardTile, TradeEmptySlot } from "@/components/marketplace/TradeCardTile";
import { TradeInventoryPicker } from "@/components/marketplace/TradeInventoryPicker";
import { counterTradeOffer, createTradeOffer } from "@/app/(game)/marketplace/trade-actions";
import { tradeFailureMessage } from "@/components/marketplace/tradeMessages";
import type { TradeCard, TradePartner } from "@/lib/types";

type Side = "proposer" | "recipient";
type Slots = (TradeCard | null)[];

const EMPTY_SLOTS: Slots = [null, null, null, null, null];

function fill(cards: TradeCard[] | undefined): Slots {
  const slots = [...EMPTY_SLOTS];
  (cards ?? []).slice(0, 5).forEach((card, index) => {
    slots[index] = card;
  });
  return slots;
}

function compact(slots: Slots): TradeCard[] {
  return slots.filter((card): card is TradeCard => card !== null);
}

function mergeCards(...lists: TradeCard[][]): TradeCard[] {
  const seen = new Set<string>();
  const result: TradeCard[] = [];
  for (const list of lists) {
    for (const card of list) {
      if (seen.has(card.id)) continue;
      seen.add(card.id);
      result.push(card);
    }
  }
  return result;
}

/**
 * Modale de composition : 5 emplacements « JE PROPOSE » + 5 « JE DEMANDE ».
 * En contre-offre les listes sont préremplies à l'envers et les pièces repartent à zéro.
 */
export function TradeComposer({
  mode,
  tradeId,
  me,
  partner,
  initialProposed = [],
  initialRequested = [],
  onClose,
  onSubmitted,
}: {
  mode: "create" | "counter";
  tradeId?: string;
  me: { id: string; username: string; coins: number; cards: TradeCard[] };
  partner: TradePartner;
  initialProposed?: TradeCard[];
  initialRequested?: TradeCard[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [proposed, setProposed] = useState<Slots>(() => fill(initialProposed));
  const [requested, setRequested] = useState<Slots>(() => fill(initialRequested));
  const [coins, setCoins] = useState("0");
  const [picker, setPicker] = useState<{ side: Side; index: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const proposedCards = compact(proposed);
  const requestedCards = compact(requested);
  const coinValue = Math.max(0, Math.trunc(Number(coins) || 0));
  const hasContent = proposedCards.length + requestedCards.length > 0 || coinValue > 0;

  // L'inventaire du partenaire peut ne pas contenir une carte déjà demandée
  // (carte détruite ou recyclée depuis) : on la garde visible pour que le
  // joueur puisse la retirer explicitement avant d'envoyer.
  const partnerInventory = useMemo(
    () => mergeCards(partner.cards, requestedCards, initialRequested),
    [partner.cards, requestedCards, initialRequested],
  );

  const pickerCards = picker?.side === "proposer" ? me.cards : partnerInventory;
  const pickerOwner = picker?.side === "proposer" ? me.username : partner.user.username;
  const pickerExcluded = useMemo(() => {
    if (!picker) return new Set<string>();
    const all = [...proposedCards, ...requestedCards];
    const current = picker.side === "proposer" ? proposed[picker.index] : requested[picker.index];
    return new Set(all.filter((card) => card.id !== current?.id).map((card) => card.id));
  }, [picker, proposed, requested, proposedCards, requestedCards]);

  function choose(card: TradeCard) {
    if (!picker) return;
    const setter = picker.side === "proposer" ? setProposed : setRequested;
    setter((slots) => slots.map((current, index) => (index === picker.index ? card : current)));
    setPicker(null);
    setError(null);
  }

  function remove(side: Side, index: number) {
    const setter = side === "proposer" ? setProposed : setRequested;
    setter((slots) => slots.map((card, i) => (i === index ? null : card)));
    setError(null);
  }

  function submit() {
    setError(null);
    if (!hasContent) {
      setError("Ajoutez au moins une carte ou des pièces à votre proposition.");
      return;
    }
    const draft = {
      recipientId: partner.user.id,
      proposerCardIds: proposedCards.map((card) => card.id),
      recipientCardIds: requestedCards.map((card) => card.id),
      coins: coinValue,
    };
    startTransition(async () => {
      try {
        if (mode === "counter" && tradeId) {
          const result = await counterTradeOffer({ ...draft, tradeId });
          if (!result?.ok) {
            setError(result?.message ?? "Impossible d'envoyer la contre-offre.");
            return;
          }
          if (result.data && !result.data.ok) {
            setError(tradeFailureMessage(result.data.reason));
            return;
          }
        } else {
          const result = await createTradeOffer(draft);
          if (!result?.ok) {
            setError(result?.message ?? "Impossible d'envoyer la proposition.");
            return;
          }
        }
        onSubmitted();
      } catch {
        setError("Erreur de connexion. Réessayez.");
      }
    });
  }

  return (
    <>
      <Modal labelledBy="trade-composer-title" size="xl" onClose={pending || picker ? undefined : onClose}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-amber-400/90">
              {mode === "counter" ? "Contre-offre" : "Nouvelle proposition"}
            </p>
            <h3 id="trade-composer-title" className="font-display text-2xl font-bold uppercase leading-tight sm:text-3xl">
              Échange avec <span className="text-amber-300">{partner.user.username}</span>
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              Composez les deux côtés du troc. Aucune carte ni pièce n&apos;est bloquée tant que l&apos;échange n&apos;est pas accepté.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Fermer la composition"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line-strong text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {/* JE PROPOSE */}
          <section className="rounded-xl border border-amber-500/30 bg-[linear-gradient(180deg,rgba(245,158,11,0.06),rgba(10,13,19,0.6))] p-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-amber-300">
                <HandCoins size={17} strokeWidth={1.8} /> Je propose
              </h4>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-amber-200">
                {proposedCards.length}/5 cartes
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {proposed.map((card, index) =>
                card ? (
                  <TradeCardTile
                    key={`p-${index}`}
                    card={card}
                    onClick={() => setPicker({ side: "proposer", index })}
                    onRemove={() => remove("proposer", index)}
                  />
                ) : (
                  <TradeEmptySlot key={`p-${index}`} onClick={() => setPicker({ side: "proposer", index })} label="Ajouter" />
                ),
              )}
            </div>

            <div className="mt-4 rounded-lg border border-amber-500/30 bg-[#0b0e13] p-3">
              <label className="block">
                <span className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wide text-amber-200">
                  <Coins size={15} strokeWidth={1.8} /> Pièces ajoutées à mon offre
                </span>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    aria-label="Somme de pièces ajoutée à mon offre"
                    value={coins}
                    onChange={(event) => {
                      setCoins(event.target.value);
                      setError(null);
                    }}
                    className="!w-32 !py-2 text-right font-display text-lg tabular-nums"
                  />
                  <span className="text-sm text-zinc-400">🪙</span>
                  <span className="ml-auto text-xs text-zinc-500">
                    Solde : <b className="text-zinc-200">{me.coins.toLocaleString("fr-FR")} 🪙</b>
                  </span>
                </div>
              </label>
              <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                Les pièces sont prélevées uniquement si l&apos;échange est accepté. Elles ne sont pas mises en séquestre.
              </p>
            </div>
          </section>

          {/* JE DEMANDE */}
          <section className="rounded-xl border border-cyan-500/30 bg-[linear-gradient(180deg,rgba(34,211,238,0.06),rgba(10,13,19,0.6))] p-3">
            <div className="flex items-center justify-between gap-2">
              <h4 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-cyan-300">
                <ArrowRightLeft size={17} strokeWidth={1.8} /> Je demande
              </h4>
              <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-cyan-200">
                {requestedCards.length}/5 cartes
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
              {requested.map((card, index) =>
                card ? (
                  <TradeCardTile
                    key={`r-${index}`}
                    card={card}
                    onClick={() => setPicker({ side: "recipient", index })}
                    onRemove={() => remove("recipient", index)}
                  />
                ) : (
                  <TradeEmptySlot key={`r-${index}`} onClick={() => setPicker({ side: "recipient", index })} label="Choisir" />
                ),
              )}
            </div>

            <div className="mt-4 rounded-lg border border-cyan-500/30 bg-[#0b0e13] p-3">
              <p className="flex items-center gap-2 font-display text-xs font-semibold uppercase tracking-wide text-cyan-200">
                <Info size={15} strokeWidth={1.8} /> Pièces demandées
              </p>
              <p className="mt-2 text-sm text-zinc-300">
                Aucune pièce ne peut être exigée dans cette colonne. Seul l&apos;initiateur de la proposition peut ajouter
                des pièces de sa poche.
              </p>
              {mode === "counter" && (
                <p className="mt-2 text-xs leading-relaxed text-cyan-200/80">
                  Les pièces de la proposition initiale ont été remises à zéro pour cette contre-offre.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="mt-4 flex gap-2 rounded-xl border border-red-500/60 bg-red-500/10 p-3 text-sm font-semibold text-red-300">
          <AlertTriangle size={20} strokeWidth={2} className="mt-0.5 shrink-0 text-red-400" />
          <p>
            Attention : une taxe forfaitaire de 10 pièces sera prélevée à chacune des deux parties (10 pièces chacun)
            si l&apos;échange est accepté.
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={submit}
            disabled={pending || !hasContent}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 text-sm font-semibold text-black transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={17} strokeWidth={2} />
            {pending ? "Envoi…" : "Envoyer ma proposition"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="min-h-11 rounded-lg border border-zinc-600 px-4 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            Annuler ma proposition
          </button>
        </div>
      </Modal>

      {picker && (
        <TradeInventoryPicker
          ownerName={pickerOwner}
          cards={pickerCards}
          excludedIds={pickerExcluded}
          onPick={choose}
          onClose={() => setPicker(null)}
        />
      )}
    </>
  );
}
