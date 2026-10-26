"use client";

import { useActionState, useEffect, useState } from "react";
import { X } from "lucide-react";
import { TileBody, tileClass } from "@/components/ActionTile";
import { DuelCinema } from "@/components/DuelCinema";
import { Modal } from "@/components/Modal";
import { acceptDuel, cancelDuel, declineDuel, proposeDuel, type ArrangedPlay } from "@/app/(game)/duel/actions";
import { formatDateTime } from "@/lib/format";
import type { ActionState, DuelReport } from "@/lib/types";

export function ProposeDuel() {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(proposeDuel, null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    if (state?.ok && state.data?.username) {
      setSent(state.data.username);
      setOpen(false);
    }
  }, [state]);

  return (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen(true)} className={tileClass()}>
        <TileBody title="Proposer un duel" text="Défiez directement un pilote" image="/duel/direct.webp" />
      </button>
      {sent && <p className="text-sm text-emerald-400">Demande envoyée à {sent}.</p>}
      {open && (
        <Modal labelledBy="propose-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Défi direct</p>
              <h3 id="propose-title" className="mt-1 font-display text-2xl font-bold uppercase">Proposer un duel</h3>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-lg border border-zinc-700 p-2 text-zinc-400 transition hover:border-zinc-500 hover:text-white">
              <X size={18} aria-hidden />
            </button>
          </div>
          <p className="mt-3 rounded-lg border border-zinc-800 bg-black/20 p-3 text-sm leading-relaxed text-zinc-300">
            Votre adversaire jouera avec la configuration qu&apos;il aura équipée au moment d&apos;accepter.
          </p>
          <form action={formAction} className="mt-5 space-y-5">
            <label className="block text-sm font-medium text-zinc-200">
              Pseudo du pilote
              <input
                type="text"
                name="username"
                required
                minLength={3}
                maxLength={24}
                autoComplete="username"
                autoFocus
                className="mt-2 min-h-12 w-full rounded-lg border border-zinc-600 bg-[#0b0d12] px-3 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25"
                placeholder="Ex. AlexRacer"
                aria-describedby="duel-username-hint"
              />
              <span id="duel-username-hint" className="mt-1.5 block text-xs font-normal text-zinc-500">Entre 3 et 24 caractères.</span>
            </label>
            {state && !state.ok && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-300">{state.message}</p>}
            <div className="grid grid-cols-2 gap-3 border-t border-zinc-800 pt-4">
              <button type="button" onClick={() => setOpen(false)} className="min-h-12 rounded-xl border border-zinc-600 font-display text-base font-bold uppercase text-zinc-200 transition hover:border-zinc-400 hover:bg-zinc-800">
                Annuler
              </button>
              <button disabled={pending} className="min-h-12 rounded-xl bg-amber-500 font-display text-base font-bold uppercase text-black transition hover:bg-amber-400 disabled:cursor-wait disabled:opacity-60">
                {pending ? "Envoi…" : "Valider"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function ChallengeList({
  incoming,
  outgoing,
}: {
  incoming: { id: string; name: string; at: string }[];
  outgoing: { id: string; name: string; at: string }[];
}) {
  const [ask, setAsk] = useState<string | null>(null);
  const [hideResult, setHideResult] = useState(false);
  const [state, formAction, pending] = useActionState(acceptDuel, null as ActionState<ArrangedPlay>);
  const play = !hideResult && state?.ok ? state.data : undefined;
  const report: DuelReport | undefined = play?.kind === "duel" ? play.report : undefined;
  const forfeit = play?.kind === "forfeit" ? play : undefined;
  const error = !hideResult && state && !state.ok ? state.message : undefined;
  const showModal = ask !== null || Boolean(play) || Boolean(error) || pending;

  useEffect(() => {
    if (pending) setHideResult(false);
  }, [pending]);

  function close() {
    setAsk(null);
    setHideResult(true);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="font-display text-2xl font-bold uppercase">Demandes de duels en attente</h2>
        {incoming.length === 0 && <p className="text-sm text-zinc-500">Aucune demande en attente.</p>}
        <ul className="space-y-2">
          {incoming.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-[#10131a] p-3">
              <div>
                <p className="font-semibold">Demande de duel par {c.name}</p>
                <p className="text-xs text-zinc-500">{formatDateTime(c.at)}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setHideResult(true); setAsk(c.id); }} className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-black hover:bg-amber-400">
                  Accepter
                </button>
                <form action={declineDuel}>
                  <input type="hidden" name="challenge_id" value={c.id} />
                  <button className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800">Décliner</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
      {outgoing.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold uppercase">Demandes envoyées</h2>
          <ul className="space-y-2">
            {outgoing.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-[#10131a] p-3 text-sm">
                <span>En attente de {c.name} · {formatDateTime(c.at)}</span>
                <form action={cancelDuel}>
                  <input type="hidden" name="challenge_id" value={c.id} />
                  <button className="rounded-lg border border-zinc-600 px-3 py-1.5 hover:bg-zinc-800">Annuler</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
      {showModal && (
        <Modal labelledBy="accept-title" wide={Boolean(report)}>
          <h3 id="accept-title" className="sr-only">Accepter le duel</h3>
          {pending ? (
            <p className="py-8 text-center font-display text-xl uppercase text-amber-300">Duel en cours…</p>
          ) : report ? (
            <DuelCinema r={report} onClose={close} />
          ) : forfeit ? (
            <div className="space-y-4 text-center">
              <p className="font-display text-4xl font-bold uppercase text-emerald-400">Victoire</p>
              <p className="text-sm text-zinc-300">La configuration de {forfeit.name} est incomplète.</p>
              <p className="font-display text-lg"><span className="text-amber-400">+{forfeit.coins} pièces</span> · <span className="text-sky-400">+{forfeit.xp} XP</span></p>
              <button type="button" onClick={close} className="min-h-12 w-full rounded-xl border border-zinc-600 font-display font-bold uppercase hover:bg-zinc-800">Fermer</button>
            </div>
          ) : ask ? (
            <div className="space-y-4">
              <p className="font-display text-2xl font-bold uppercase">Accepter le duel ?</p>
              <p className="text-sm text-zinc-300">Avez-vous bien vérifié votre configuration avant d&apos;accepter ?</p>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={close} className="min-h-12 rounded-xl border border-zinc-600 font-display text-lg font-bold uppercase hover:bg-zinc-800">Non</button>
                <form action={formAction}>
                  <input type="hidden" name="challenge_id" value={ask} />
                  <button className="min-h-12 w-full rounded-xl bg-amber-500 font-display text-lg font-bold uppercase text-black hover:bg-amber-400">Oui</button>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-center text-red-400">{error}</p>
              {!pending && <button type="button" onClick={close} className="min-h-12 w-full rounded-xl border border-zinc-600 font-display font-bold uppercase hover:bg-zinc-800">Fermer</button>}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
