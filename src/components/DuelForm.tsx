"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { DuelCinema } from "@/components/DuelCinema";
import type { ActionState, DuelReport } from "@/lib/types";

type Option = { id: string; label: string };

export function DuelForm({
  action,
  deckId,
  bonuses,
  defaultBonus,
}: {
  action: (prev: ActionState<DuelReport>, fd: FormData) => Promise<ActionState<DuelReport>>;
  deckId?: string;
  bonuses: Option[];
  defaultBonus?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const armed = useRef(false);
  const [bonus, setBonus] = useState(defaultBonus ?? "");
  const [ask, setAsk] = useState(false);
  const [show, setShow] = useState(false);
  const [launching, setLaunching] = useState(false);
  const report = state?.ok ? state.data : undefined;
  const waiting = pending || launching;

  useEffect(() => {
    if (state?.ok) setBonus("");
  }, [state]);

  useEffect(() => {
    if (!pending) setLaunching(false);
  }, [pending]);

  function launch() {
    setAsk(false);
    setShow(true);
    setLaunching(true);
    armed.current = true;
    formRef.current?.requestSubmit();
  }

  function close() {
    setShow(false);
    setAsk(false);
  }

  return (
    <div className="space-y-4">
      <form
        ref={formRef}
        action={formAction}
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          if (armed.current) {
            armed.current = false;
            return;
          }
          e.preventDefault();
          if (!deckId) return;
          setAsk(true);
          setShow(true);
        }}
      >
        <input type="hidden" name="deck_id" value={deckId ?? ""} />
        <label className="flex flex-col gap-1 text-sm">
          Bonus (optionnel, consommé au lancement)
          <select name="bonus_id" value={bonus} onChange={(e) => setBonus(e.target.value)}>
            <option value="">Aucun</option>
            {bonuses.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </label>
        <button
          disabled={pending || !deckId}
          className="min-h-11 rounded-lg bg-amber-500 px-5 py-1.5 font-display text-lg font-bold uppercase text-black hover:bg-amber-400 disabled:opacity-50"
        >
          {pending ? "Course en cours…" : "Lancer le duel"}
        </button>
      </form>

      {state && !state.ok && !show && <p className="text-sm text-red-400">{state.message}</p>}

      {show && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-3 sm:items-center sm:p-6" role="dialog" aria-modal aria-labelledby="duel-dialog-title">
          <div className="max-h-[min(92vh,52rem)] w-full max-w-3xl overflow-y-auto overscroll-contain rounded-2xl border border-zinc-700 bg-[#0e1117] p-4 shadow-2xl sm:p-5">
            <h3 id="duel-dialog-title" className="sr-only">Duel</h3>
            {ask ? (
              <div className="space-y-4">
                <p className="font-display text-3xl font-bold uppercase">Lancer le duel ?</p>
                <p className="text-sm text-zinc-300">Un fantôme est tiré au hasard. Le résultat est calculé côté serveur.</p>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={close} className="min-h-14 rounded-xl border border-zinc-600 font-display text-xl font-bold uppercase hover:bg-zinc-800">
                    Non
                  </button>
                  <button type="button" onClick={launch} className="min-h-14 rounded-xl bg-amber-500 font-display text-xl font-bold uppercase text-black hover:bg-amber-400">
                    Oui
                  </button>
                </div>
              </div>
            ) : waiting ? (
              <p className="py-10 text-center font-display text-2xl font-bold uppercase text-amber-400">Course en cours…</p>
            ) : report ? (
              <DuelCinema key={report.duelId} r={report} onReplay={launch} onClose={close} />
            ) : (
              <div className="space-y-4">
                <p className="text-red-400">{state?.message ?? "Le duel n'a pas pu être lancé."}</p>
                <button type="button" onClick={close} className="min-h-14 w-full rounded-xl border border-zinc-600 font-display text-xl font-bold uppercase hover:bg-zinc-800">
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
