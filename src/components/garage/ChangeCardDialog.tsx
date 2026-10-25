"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { CardView, type TirePerf } from "@/components/CardView";
import { Modal } from "@/components/Modal";
import { equipCard } from "@/app/(game)/garage/actions";
import type { UserCard } from "@/lib/types";

const SLOT_LABEL = { moteur: "moteur", boite: "boîte", pneus: "pneu", bonus: "bonus" } as const;

/** Choisir une carte dans une grille, pas dans une liste de texte. */
export function ChangeCardDialog({
  slot,
  alternatives,
  deckId,
  tirePerfs = [],
  onPick,
}: {
  slot: "moteur" | "boite" | "pneus" | "bonus";
  alternatives: (UserCard & { image: string | null })[];
  deckId?: string;
  tirePerfs?: TirePerf[];
  /** Si présent, le choix reste local (bonus de duel) au lieu d'équiper le deck. */
  onPick?: (card: UserCard | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const title = `Choisir ${slot === "boite" || slot === "bonus" ? "une" : "un"} ${SLOT_LABEL[slot]}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full cursor-pointer rounded border border-white/30 bg-black/40 py-1.5 text-center text-sm font-medium text-zinc-100 hover:bg-white/10"
      >
        Changer
      </button>
      {open && (
        <Modal labelledBy="change-card-title" size="xl">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 id="change-card-title" className="font-display text-2xl font-bold uppercase">{title}</h3>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800">
              Fermer
            </button>
          </div>
          {onPick && (
            <button
              type="button"
              onClick={() => { onPick(null); setOpen(false); }}
              className="mb-3 rounded-lg border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800"
            >
              Aucun bonus
            </button>
          )}
          {alternatives.length === 0 && <p className="text-sm text-zinc-500">Aucune autre carte disponible.</p>}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {alternatives.map((alt) => (
              <CardView key={alt.id} template={alt.card_templates} card={alt} image={alt.image} tirePerfs={tirePerfs}>
                {onPick ? (
                  <button
                    type="button"
                    onClick={() => { onPick(alt); setOpen(false); }}
                    className="w-full rounded-lg bg-amber-500 py-2 font-display font-bold uppercase text-black hover:bg-amber-400"
                  >
                    Choisir
                  </button>
                ) : (
                  <ActionForm action={equipCard} submitLabel="Équiper" className="flex">
                    <input type="hidden" name="card_id" value={alt.id} />
                    {deckId && <input type="hidden" name="deck_id" value={deckId} />}
                  </ActionForm>
                )}
              </CardView>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
