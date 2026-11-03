"use client";

import { useEffect, useRef, useState } from "react";
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
  const [state, setState] = useState<ActionState<DuelReport>>(null);
  const lastState = useRef<ActionState<DuelReport>>(null);
  const [bonus, setBonus] = useState<UserCard | null>(null);
  const [open, setOpen] = useState(false);
  const [showRace, setShowRace] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [slow, setSlow] = useState(false);
  const router = useRouter();
  const report = state?.ok ? state.data : undefined;
  // Le loader suit la promesse de l'action, pas `pending` de useActionState :
  // après un revalidatePath, React peut laisser `pending` bloqué à true alors
  // que le duel est terminé et que le résultat est déjà revenu.
  const waiting = launching;

  useEffect(() => {
    if (state?.ok) setBonus(null);
  }, [state]);

  // Filet de sécurité : si la requête ne revient jamais (réseau perdu, serveur muet),
  // on laisse le joueur sortir de l'écran d'attente.
  useEffect(() => {
    if (!launching) {
      setSlow(false);
      return;
    }
    const id = window.setTimeout(() => setSlow(true), 15000);
    return () => window.clearTimeout(id);
  }, [launching]);

  async function launch() {
    if (!deckId || launching) return;
    setShowRace(true);
    setLaunching(true);
    const fd = new FormData();
    fd.set("deck_id", deckId);
    fd.set("bonus_id", bonus?.id ?? "");
    try {
      const next = await action(lastState.current, fd);
      lastState.current = next;
      setState(next);
    } catch {
      const failed: ActionState<DuelReport> = { ok: false, message: "Le duel n'a pas pu être lancé." };
      lastState.current = failed;
      setState(failed);
    } finally {
      // Toujours exécuté : l'écran d'attente ne peut plus rester bloqué.
      setLaunching(false);
    }
  }

  function close() {
    setOpen(false);
    setShowRace(false);
    router.refresh();
  }

  function replaceBrokenPart() {
    const brokenPart = report?.brokenPart;
    if (brokenPart !== "moteur" && brokenPart !== "boite") return;
    setOpen(false);
    setShowRace(false);
    window.dispatchEvent(new CustomEvent("carsduel:change-slot", { detail: brokenPart }));
  }

  const effect = bonus?.card_templates.name;

  return (
    <>
      <button
        type="button"
        disabled={!deckId}
        onClick={() => { setShowRace(false); setState(null); setOpen(true); }}
        className={tileClass()}
      >
        <TileBody title="Affronter au hasard" text="Défiez le fantôme d'un pilote" image="/duel/hasard.webp" />
      </button>

      {open && (
        <Modal labelledBy="duel-dialog-title" wide onClose={waiting ? undefined : close}>
          <h3 id="duel-dialog-title" className="sr-only">Affronter au hasard</h3>
          {showRace ? (
            report ? (
              <div className="space-y-4">
                <DuelCinema
                  key={report.duelId}
                  r={report}
                  busy={launching}
                  onReplay={deckId && !report.brokenPart ? launch : undefined}
                  onReplaceBrokenPart={report.brokenPart === "moteur" || report.brokenPart === "boite" ? replaceBrokenPart : undefined}
                  onClose={close}
                />
                {launching && slow && (
                  <p className="text-center text-xs text-zinc-500">
                    Le serveur tarde à répondre.{" "}
                    <button type="button" onClick={() => window.location.reload()} className="underline hover:text-zinc-300">
                      Recharger la page
                    </button>
                  </p>
                )}
              </div>
            ) : waiting ? (
              <div className="space-y-4 py-10 text-center">
                <p className="font-display text-2xl font-bold uppercase text-amber-400">Course en cours…</p>
                {slow && (
                  <div className="space-y-2 border-t border-zinc-800 pt-4">
                    <p className="text-xs text-zinc-500">Le serveur tarde à répondre. Votre duel est peut-être déjà enregistré.</p>
                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="min-h-12 w-full rounded-xl border border-zinc-600 font-display text-base font-bold uppercase hover:bg-zinc-800"
                    >
                      Recharger la page
                    </button>
                  </div>
                )}
              </div>
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
