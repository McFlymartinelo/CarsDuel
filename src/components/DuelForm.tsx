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
  // Champ contrôlé : React 19 réinitialise les champs non contrôlés après une action.
  const [bonus, setBonus] = useState(defaultBonus ?? "");
  const report = state?.ok && !pending ? state.data : undefined;

  // Le bonus est consommé au lancement : on le retire de la sélection pour « Rejouer ».
  useEffect(() => {
    if (state?.ok) setBonus("");
  }, [state]);

  return (
    <div className="space-y-4">
      {/* Sur mobile, le formulaire laisse la place au résultat une fois le duel joué. */}
      <form ref={formRef} action={formAction} className={`flex-wrap items-end gap-3 ${report ? "hidden md:flex" : "flex"}`}>
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

      {state && !state.ok && <p className="text-sm text-red-400">{state.message}</p>}

      {report && <DuelCinema r={report} replaying={pending} onReplay={() => formRef.current?.requestSubmit()} />}
    </div>
  );
}
