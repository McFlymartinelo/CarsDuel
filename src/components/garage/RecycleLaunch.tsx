"use client";

import { useActionState, useEffect, useState } from "react";
import { Boxes, Recycle } from "lucide-react";
import { Modal } from "@/components/Modal";
import { processRecycleBin } from "@/app/(game)/garage/actions";
import { formatKg, RECYCLE_CUBE_WEIGHT_KG } from "@/lib/recycle";

export function RecycleLaunch({
  cardCount,
  weightKg,
  cubes,
}: {
  cardCount: number;
  weightKg: number;
  cubes: number;
}) {
  const [state, formAction, pending] = useActionState(processRecycleBin, null);
  const [open, setOpen] = useState(false);
  const disabled = cubes < 1;
  const missingKg = Math.max(0, Math.round((RECYCLE_CUBE_WEIGHT_KG - (weightKg % RECYCLE_CUBE_WEIGHT_KG)) * 100) / 100);

  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  return (
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-amber-500 px-4 font-display text-sm font-bold uppercase tracking-wide text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
      >
        <Recycle size={18} strokeWidth={2} />
        {cubes > 0 ? `Lancer le recyclage (+${cubes} cube${cubes === 1 ? "" : "s"})` : "Lancer le recyclage"}
      </button>

      {disabled && cardCount > 0 && (
        <p className="text-xs text-zinc-500">
          Encore {formatKg(missingKg)} pour générer 1 cube de ferraille.
        </p>
      )}
      {disabled && cardCount === 0 && (
        <p className="text-xs text-zinc-500">Déposez des pièces dans la benne pour commencer.</p>
      )}

      {state?.message && (
        <p className={`max-w-sm text-sm ${state.ok ? "text-emerald-400" : "text-red-400"}`}>{state.message}</p>
      )}

      {open && (
        <Modal labelledBy="recycle-confirm-title" onClose={pending ? undefined : () => setOpen(false)}>
          <h3 id="recycle-confirm-title" className="font-display text-2xl font-bold uppercase">
            Lancer le recyclage
          </h3>
          <p className="mt-2 text-sm text-zinc-300">
            Les cartes de la benne seront définitivement détruites. Cette action est irréversible.
          </p>

          <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-zinc-800 bg-[#0b0d12] p-3 text-center">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-zinc-500">Cartes</dt>
              <dd className="font-display text-xl font-bold tabular-nums text-white">{cardCount}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-zinc-500">Poids</dt>
              <dd className="font-display text-xl font-bold tabular-nums text-white">{formatKg(weightKg)}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-zinc-500">Gain</dt>
              <dd className="inline-flex items-center gap-1 font-display text-xl font-bold tabular-nums text-orange-300">
                <Boxes size={18} strokeWidth={2.1} />
                {cubes}
              </dd>
            </div>
          </dl>

          {state && !state.ok && <p className="mt-3 text-sm text-red-400">{state.message}</p>}

          <form action={formAction} className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={pending}
              className="min-h-12 rounded-lg border border-zinc-600 px-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={pending}
              className="min-h-12 rounded-lg bg-amber-500 px-3 text-sm font-bold text-black hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? "Recyclage…" : `Confirmer (+${cubes} cube${cubes === 1 ? "" : "s"})`}
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
