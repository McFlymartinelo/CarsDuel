"use client";

import { useActionState, useEffect, useState } from "react";
import { Boxes, Recycle } from "lucide-react";
import { Modal } from "@/components/Modal";
import { processRecycleBin } from "@/app/(game)/garage/actions";
import { formatKg, RECYCLE_CUBE_WEIGHT_KG } from "@/lib/recycle";
import type { ActionState } from "@/lib/types";

const CRUSH_MS = 5000;

/** Pile de cubes de ferraille qui remplit le bac : 5 rangées de 22 px, face haute plane (la presse s'y pose). */
const PILE_COLS = 17;
const PILE_ROWS = 5;
const TONES = [
  "from-zinc-200 to-zinc-500",
  "from-zinc-300 to-zinc-600",
  "from-zinc-400 to-zinc-700",
  "from-zinc-300 to-zinc-500",
  "from-zinc-500 to-zinc-800",
];
const PILE = Array.from({ length: PILE_COLS * PILE_ROWS }, (_, k) => ({
  key: k,
  tone: TONES[(k * 7 + Math.floor(k / PILE_COLS)) % TONES.length],
}));

async function recycleWithCrush(prev: ActionState, fd: FormData): Promise<ActionState> {
  const [res] = await Promise.all([
    processRecycleBin(prev, fd),
    new Promise((resolve) => setTimeout(resolve, CRUSH_MS)),
  ]);
  return res;
}

function CrushAnimation() {
  return (
    <div className="mt-5">
      <div className="relative h-44 overflow-hidden rounded-xl border border-zinc-800 bg-[#07090d]">
        <div className="crush-box absolute inset-0">
          <div
            className="crush-pile absolute inset-x-2 bottom-2 grid grid-cols-[repeat(17,minmax(0,1fr))] grid-rows-[repeat(5,22px)]"
          >
            {PILE.map(({ key, tone }) => (
              <span
                key={key}
                className={`block rounded-[3px] border border-black/50 bg-gradient-to-br ${tone} shadow-[inset_0_2px_0_rgba(255,255,255,0.35),inset_0_-2px_0_rgba(0,0,0,0.35)]`}
              />
            ))}
          </div>
          <div className="crush-plate absolute inset-x-0 top-0 h-9 border-b-4 border-amber-500 bg-gradient-to-b from-zinc-500 to-zinc-700" />
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2">
            <div className="crush-cube flex size-16 items-center justify-center rounded-lg border border-orange-400/60 bg-orange-500/20 text-orange-200 shadow-lg shadow-orange-950/50">
              <Boxes size={28} strokeWidth={2} />
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-sm text-zinc-300">Compactage de la ferraille…</p>
    </div>
  );
}

export function RecycleLaunch({
  cardCount,
  weightKg,
  cubes,
}: {
  cardCount: number;
  weightKg: number;
  cubes: number;
}) {
  const [state, formAction, pending] = useActionState(recycleWithCrush, null);
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

          {pending ? (
            <CrushAnimation />
          ) : (
            <form action={formAction} className="mt-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-12 rounded-lg border border-zinc-600 px-3 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="min-h-12 rounded-lg bg-amber-500 px-3 text-sm font-bold text-black hover:bg-amber-400"
              >
                Confirmer (+{cubes} cube{cubes === 1 ? "" : "s"})
              </button>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
