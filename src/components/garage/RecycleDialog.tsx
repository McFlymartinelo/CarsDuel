"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { Modal } from "@/components/Modal";
import type { ActionState } from "@/lib/types";

const btn =
  "flex min-h-11 flex-1 items-center justify-center rounded-lg border border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 sm:min-h-10";

export function RecycleDialog({
  action,
  cardId,
  name,
  base,
  pct,
  coins,
  kind,
  flat = false,
  scrap = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  cardId: string;
  name: string;
  base: number;
  pct: number;
  coins: number;
  kind: "pneus" | "moteur" | "boite" | "bonus";
  flat?: boolean;
  scrap?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pctText = pct.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  const detail = scrap
    ? "Un moteur cassé, une boîte cassée ou un pneu mort se recycle contre 1 pièce."
    : flat
      ? "Une carte bonus se recycle contre 1 pièce. Elle ne se vend pas."
      : kind === "pneus"
        ? "Le pourcentage est la gomme restante."
        : "Le pourcentage est l'état restant : 100 % moins le risque de casse actuel.";

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn}>
        Recycler
      </button>
      {open && (
        <Modal labelledBy="recycle-title">
            <h3 id="recycle-title" className="font-display text-2xl font-bold uppercase">Recycler</h3>
            <p className="mt-2 text-zinc-200">{name}</p>
            <p className="mt-4 font-display text-4xl font-bold text-amber-400">+{coins.toLocaleString("fr-FR")} {coins > 1 ? "pièces" : "pièce"}</p>
            {!flat && (
              <p className="mt-1 text-sm text-zinc-300">
                {base} pièces × {pctText} % = {coins.toLocaleString("fr-FR")} pièces
              </p>
            )}
            <p className="mt-2 text-sm text-zinc-500">{detail}</p>
            <div className="mt-5 flex items-start gap-2">
              <button type="button" onClick={() => setOpen(false)} className={`${btn} flex-1`}>
                Annuler
              </button>
              <ActionForm action={action} submitLabel="Confirmer" className="flex flex-1 [&>button]:min-h-11 [&>button]:flex-1 [&>button]:rounded-lg sm:[&>button]:min-h-10">
                <input type="hidden" name="card_id" value={cardId} />
              </ActionForm>
            </div>
        </Modal>
      )}
    </>
  );
}
