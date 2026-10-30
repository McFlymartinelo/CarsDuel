"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { Modal } from "@/components/Modal";
import type { ActionState } from "@/lib/types";

const btn =
  "flex min-h-11 flex-1 items-center justify-center rounded-lg border border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800 sm:min-h-10";

/** Prolongation de la garantie constructeur : +2 runs contre une Révision complète + 5 pièces. */
export function ExtendWarrantyDialog({
  action,
  cardId,
  name,
  remaining,
  limit,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  cardId: string;
  name: string;
  remaining: number;
  limit: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={btn}>
        Étendre la garantie
      </button>
      {open && (
        <Modal labelledBy="warranty-title" onClose={() => setOpen(false)}>
          <h3 id="warranty-title" className="font-display text-2xl font-bold uppercase">Étendre la garantie</h3>
          <p className="mt-2 text-zinc-200">{name}</p>
          <p className="mt-4 font-display text-2xl font-bold text-emerald-400">+2 runs de garantie</p>
          <p className="mt-1 text-sm text-zinc-300">
            Garantie actuelle : {remaining} run{remaining === 1 ? "" : "s"} restant{remaining === 1 ? "" : "s"} sur {limit}.
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            Coût : 1 carte bonus <b className="text-zinc-200">« Révision complète »</b> et <b className="text-zinc-200">5 pièces</b>.
            Une seule prolongation par carte, avant qu&apos;elle ne soit cassée ou que la garantie expire.
          </p>
          <div className="mt-5 flex items-start gap-2">
            <button type="button" onClick={() => setOpen(false)} className={`${btn} flex-1`}>
              Annuler
            </button>
            <ActionForm
              action={action}
              submitLabel="Prolonger"
              onSuccess={() => setOpen(false)}
              className="flex flex-1 flex-wrap items-end gap-2 [&>button]:min-h-11 [&>button]:flex-1 [&>button]:rounded-lg sm:[&>button]:min-h-10"
            >
              <input type="hidden" name="card_id" value={cardId} />
            </ActionForm>
          </div>
        </Modal>
      )}
    </>
  );
}
