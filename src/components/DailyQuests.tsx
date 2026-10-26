"use client";

import { useActionState, useState } from "react";
import { tileClass, TileBody } from "@/components/ActionTile";
import { Modal } from "@/components/Modal";
import { claimQuest } from "@/app/(game)/quests";
import { QUEST_COPY, questDone, type DailyQuestState } from "@/lib/quests";
import type { ActionState } from "@/lib/types";

function Claim({ quest }: { quest: string }) {
  const [state, formAction, pending] = useActionState(claimQuest, null as ActionState<{ coins: number }>);
  if (state?.ok) return <p className="text-sm font-semibold text-emerald-400">+5 pièces</p>;
  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="quest" value={quest} />
      <button disabled={pending} className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-black hover:bg-amber-400 disabled:opacity-50">
        {pending ? "Récupération…" : "Récupérer mes 5 pièces"}
      </button>
      {state && !state.ok && <p className="text-xs text-red-400">{state.message}</p>}
    </form>
  );
}

function QuestLine({ id, progress, claimed }: { id: string; progress: Record<string, number>; claimed: string[] }) {
  const copy = QUEST_COPY[id];
  if (!copy) return null;
  const done = questDone(id, progress);
  const got = claimed.includes(id);
  return (
    <li className="rounded-xl border border-zinc-800 bg-[#10131a] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display font-bold uppercase">{copy.title}</p>
          <p className="text-sm text-zinc-400">{copy.detail}</p>
        </div>
        <span className={`shrink-0 text-xs font-semibold uppercase ${got ? "text-emerald-400" : done ? "text-amber-300" : "text-zinc-500"}`}>
          {got ? "Récupéré" : done ? "Terminé" : "En cours"}
        </span>
      </div>
      {done && !got && <div className="mt-2"><Claim quest={id} /></div>}
    </li>
  );
}

export function DailyQuests({ state }: { state: DailyQuestState | null }) {
  const [open, setOpen] = useState(false);
  const ids = state ? ["pointage", state.second, state.third] : [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={tileClass()}
      >
        <TileBody title="Défis quotidiens" text="3 défis par jour · 5 pièces chacun" image="/duel/defis.webp" />
      </button>
      {open && (
        <Modal labelledBy="quests-title" wide>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 id="quests-title" className="font-display text-2xl font-bold uppercase">Défis quotidiens</h3>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800">Fermer</button>
          </div>
          <p className="mb-3 text-sm text-zinc-400">Trois défis, renouvelés à minuit (heure de Paris). Chacun rapporte 5 pièces.</p>
          {!state && <p className="text-sm text-zinc-500">Les défis ne sont pas disponibles pour le moment.</p>}
          {state && (
            <ul className="space-y-2">
              {ids.map((id) => <QuestLine key={id} id={id} progress={state.progress} claimed={state.claimed} />)}
            </ul>
          )}
        </Modal>
      )}
    </>
  );
}
