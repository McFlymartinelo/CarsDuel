"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { tileClass, TileBody } from "@/components/ActionTile";
import { DuelCinema } from "@/components/DuelCinema";
import { ChangeCardDialog } from "@/components/garage/ChangeCardDialog";
import { Modal } from "@/components/Modal";
import type { TirePerf } from "@/components/CardView";
import type { ActionState, DuelReport, UserCard } from "@/lib/types";

/** Affronter un adversaire au hasard : résumé, choix du bonus, puis la course. */
export function DuelForm({
  action,
  deckId,
  bonuses,
  tirePerfs,
  children,
}: {
  action: (prev: ActionState<DuelReport>, fd: FormData) => Promise<ActionState<DuelReport>>;
  deckId?: string;
  bonuses: (UserCard & { image: string | null })[];
  tirePerfs?: TirePerf[];
  children?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const armed = useRef(false);
  const [bonus, setBonus] = useState<UserCard | null>(null);
  const [open, setOpen] = useState(false);
  const [showRace, setShowRace] = useState(false);
  const [launching, setLaunching] = useState(false);
  const router = useRouter();
  const report = state?.ok ? state.data : undefined;
  const waiting = pending || launching;

  useEffect(() => {
    if (state?.ok) setBonus(null);
  }, [state]);

  useEffect(() => {
    if (!pending) setLaunching(false);
  }, [pending]);

  function launch() {
    setShowRace(true);
    setLaunching(true);
    armed.current = true;
    formRef.current?.requestSubmit();
  }

  function close() {
    setOpen(false);
    setShowRace(false);
    router.refresh();
  }

  const effect = bonus?.card_templates.name;

  return (
    <>
      <button
        type="button"
        disabled={!deckId}
        onClick={() => { setShowRace(false); setOpen(true); }}
        className={tileClass()}
      >
        <TileBody title="Affronter au hasard" text="Défiez le fantôme d'un pilote" image="/duel/hasard.webp" />
      </button>

      <form
        ref={formRef}
        action={formAction}
        className="hidden"
        onSubmit={(e) => {
          if (armed.current) {
            armed.current = false;
            return;
          }
          e.preventDefault();
        }}
      >
        <input type="hidden" name="deck_id" value={deckId ?? ""} />
        <input type="hidden" name="bonus_id" value={bonus?.id ?? ""} />
      </form>

      {open && (
        <Modal labelledBy="duel-dialog-title" wide>
          <h3 id="duel-dialog-title" className="sr-only">Affronter au hasard</h3>
          {showRace ? (
            waiting ? (
              <p className="py-10 text-center font-display text-2xl font-bold uppercase text-amber-400">Course en cours…</p>
            ) : report ? (
              <DuelCinema
                key={report.duelId}
                r={report}
                onReplay={deckId && !report.brokenPart ? launch : undefined}
                onClose={close}
              />
            ) : (
              <div className="space-y-4">
                <p className="text-red-400">{state?.message ?? "Le duel n'a pas pu être lancé."}</p>
                <button type="button" onClick={() => setShowRace(false)} className="min-h-12 w-full rounded-xl border border-zinc-600 font-display text-lg font-bold uppercase hover:bg-zinc-800">
                  Retour
                </button>
              </div>
            )
          ) : (
            <div className="space-y-4">
              <p className="font-display text-2xl font-bold uppercase">Affronter au hasard</p>
              {children}
              <div className="rounded-2xl border-2 border-dashed border-amber-500/40 bg-[#10131a] p-3">
                <p className="font-display text-sm uppercase tracking-wide text-zinc-300">Bonus</p>
                <p className="my-2 min-h-10 text-sm text-zinc-200">{effect ?? "Aucun bonus"}</p>
                <ChangeCardDialog slot="bonus" alternatives={bonuses} tirePerfs={tirePerfs} onPick={setBonus} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={close} className="min-h-14 rounded-xl border border-zinc-600 font-display text-xl font-bold uppercase hover:bg-zinc-800">
                  Annuler
                </button>
                <button type="button" onClick={launch} disabled={!deckId} className="min-h-14 rounded-xl bg-amber-500 font-display text-xl font-bold uppercase text-black hover:bg-amber-400 disabled:opacity-50">
                  Lancer le duel
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
