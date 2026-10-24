"use client";

import { useState } from "react";
import { ActionForm } from "@/components/ActionForm";
import { Modal } from "@/components/Modal";
import type { ActionState } from "@/lib/types";

const openBtn =
  "flex min-h-11 flex-1 items-center justify-center rounded-lg border border-red-500/70 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/10 sm:min-h-10";
const cancelBtn =
  "mt-3 flex min-h-11 w-full items-center justify-center rounded-lg border border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800";

export function SellDialog({
  action,
  cardId,
  name,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  cardId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={openBtn}>
        Vendre
      </button>
      {open && (
        <Modal labelledBy="sell-title">
            <h3 id="sell-title" className="font-display text-2xl font-bold uppercase">Vendre</h3>
            <p className="mt-2 text-zinc-200">{name}</p>
            <ActionForm action={action} submitLabel="Mettre en vente" className="mt-4 flex flex-col items-stretch gap-3">
              <input type="hidden" name="card_id" value={cardId} />
              <label className="flex flex-col gap-1 text-sm text-zinc-300">
                Prix (min. 1)
                <input name="price" type="number" min={1} placeholder="Pièces" className="w-full" />
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-200">
                <input type="checkbox" name="accepts_offers" className="size-4" />
                Accepter les offres
              </label>
              <p className="text-xs text-zinc-500">
                Laissez le prix vide pour une vente par offres uniquement. Taxe de 10 % prélevée sur le vendeur à la vente.
              </p>
            </ActionForm>
            <button type="button" onClick={() => setOpen(false)} className={cancelBtn}>
              Annuler
            </button>
        </Modal>
      )}
    </>
  );
}
