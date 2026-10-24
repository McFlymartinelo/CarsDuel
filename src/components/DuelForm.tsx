"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { DuelResult } from "@/components/DuelResult";
import type { ActionState, DuelReport } from "@/lib/types";

type Option = { id: string; label: string };

export function DuelForm({
  action,
  decks,
  bonuses,
  defaultDeck,
  defaultBonus,
}: {
  action: (prev: ActionState<DuelReport>, fd: FormData) => Promise<ActionState<DuelReport>>;
  decks: Option[];
  bonuses: Option[];
  defaultDeck?: string;
  defaultBonus?: string;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  // Champs contrôlés : React 19 réinitialise les champs non contrôlés après une action.
  const [deck, setDeck] = useState(defaultDeck ?? "");
  const [bonus, setBonus] = useState(defaultBonus ?? "");
  const report = state?.ok ? state.data : undefined;

  // Le bonus est consommé au lancement : on le retire de la sélection pour « Rejouer ».
  useEffect(() => {
    if (state?.ok) setBonus("");
  }, [state]);

  return (
    <div className="space-y-4">
      {/* Sur mobile, le formulaire laisse la place au résultat une fois le duel joué. */}
      <form ref={formRef} action={formAction} className={`flex-wrap items-end gap-3 ${report ? "hidden md:flex" : "flex"}`}>
        <label className="flex flex-col gap-1 text-sm">
          Deck
          <select name="deck_id" required value={deck} onChange={(e) => setDeck(e.target.value)}>
            <option value="" disabled>Choisir…</option>
            {decks.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Bonus (optionnel, consommé au lancement)
          <select name="bonus_id" value={bonus} onChange={(e) => setBonus(e.target.value)}>
            <option value="">Aucun</option>
            {bonuses.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
          </select>
        </label>
        <button
          disabled={pending || decks.length === 0}
          className="min-h-11 rounded-lg bg-amber-500 px-5 py-1.5 font-display text-lg font-bold uppercase text-black hover:bg-amber-400 disabled:opacity-50"
        >
          {pending ? "Course en cours…" : "Lancer le duel"}
        </button>
      </form>

      {state && !state.ok && <p className="text-sm text-red-400">{state.message}</p>}

      {report && <DuelResult r={report} replaying={pending} onReplay={() => formRef.current?.requestSubmit()} />}
    </div>
  );
}
