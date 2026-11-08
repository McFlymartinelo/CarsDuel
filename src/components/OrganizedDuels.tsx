"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { TileBody, tileClass } from "@/components/ActionTile";
import { DuelCinema } from "@/components/DuelCinema";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/ui/Toast";
import { acceptDuel, cancelDuel, declineDuel, proposeDuel, type ArrangedPlay } from "@/app/(game)/duel/actions";
import { formatDateTime } from "@/lib/format";
import type { ActionState, DuelReport } from "@/lib/types";

export function ProposeDuel({ variant = "tile" }: { variant?: "tile" | "hero" }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(proposeDuel, null);
  const { toast } = useToast();

  useEffect(() => {
    if (state?.ok && state.data?.username) {
      setOpen(false);
      toast({ tone: "success", title: `Demande de duel envoyée à ${state.data.username}.`, key: "duel-propose" });
    }
  }, [state, toast]);

  return (
    <div className="space-y-2">
      {variant === "hero" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative flex min-h-56 w-full flex-col justify-center overflow-hidden rounded-2xl border border-amber-500/25 bg-panel p-4 text-left transition hover:border-amber-400/60"
        >
          <Image
            src="/duel/direct.webp"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover object-right opacity-30 transition group-hover:opacity-40 [mask-image:linear-gradient(to_left,#000_15%,transparent_85%)]"
          />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-panel via-panel/75 to-transparent" />
          <span className="relative z-10 flex flex-col items-start gap-2">
            <span className="font-display text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
              Défi direct
            </span>
            <span className="font-display text-2xl font-bold uppercase leading-none text-white">Organiser un duel</span>
            <span className="max-w-sm text-xs leading-relaxed text-zinc-400">
              Défiez un pilote de votre choix. Il jouera avec la config qu&apos;il aura équipée au moment d&apos;accepter.
            </span>
            <span className="flex flex-wrap gap-1.5">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] text-zinc-300">
                Gains : 2–10 pièces
              </span>
            </span>
          </span>
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={tileClass()}>
          <TileBody title="Proposer un duel" text="Défiez directement un pilote" image="/duel/direct.webp" />
        </button>
      )}
      {open && (
        <Modal labelledBy="propose-title" onClose={pending ? undefined : () => setOpen(false)}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Défi direct</p>
              <h3 id="propose-title" className="mt-1 font-display text-2xl font-bold uppercase">Proposer un duel</h3>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-lg border border-line-strong p-2 text-zinc-400 transition hover:border-zinc-500 hover:text-white">
              <X size={18} aria-hidden />
            </button>
          </div>
          <p className="mt-3 rounded-lg border border-line bg-black/20 p-3 text-sm leading-relaxed text-zinc-300">
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
                className="mt-2 min-h-12 w-full rounded-lg border border-zinc-600 bg-panel-deep px-3 text-base text-white outline-none transition placeholder:text-zinc-600 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/25"
                placeholder="Ex. AlexRacer"
                aria-describedby="duel-username-hint"
              />
              <span id="duel-username-hint" className="mt-1.5 block text-xs font-normal text-zinc-500">Entre 3 et 24 caractères.</span>
            </label>
            {state && !state.ok && <p role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-300">{state.message}</p>}
            <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
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
  const [state, setState] = useState<ActionState<ArrangedPlay>>(null);
  const lastState = useRef<ActionState<ArrangedPlay>>(null);
  const [pending, setPending] = useState(false);
  const [slow, setSlow] = useState(false);
  const [declining, startDecline] = useTransition();
  const [cancelling, startCancel] = useTransition();
  const { toast } = useToast();
  const play = !hideResult && state?.ok ? state.data : undefined;
  const report: DuelReport | undefined = play?.kind === "duel" ? play.report : undefined;
  const forfeit = play?.kind === "forfeit" ? play : undefined;
  const error = !hideResult && state && !state.ok ? state.message : undefined;
  const showModal = ask !== null || Boolean(play) || Boolean(error) || pending;

  useEffect(() => {
    if (pending) setHideResult(false);
  }, [pending]);

  // Filet de sécurité : si l'action ne revient jamais, on laisse sortir.
  useEffect(() => {
    if (!pending) {
      setSlow(false);
      return;
    }
    const id = window.setTimeout(() => setSlow(true), 15000);
    return () => window.clearTimeout(id);
  }, [pending]);

  // L'attente suit la promesse de l'action, pas `pending` de useActionState :
  // après un revalidatePath, React peut le laisser bloqué à true.
  async function accept(challengeId: string) {
    if (pending) return;
    setPending(true);
    const fd = new FormData();
    fd.set("challenge_id", challengeId);
    try {
      const next = await acceptDuel(lastState.current, fd);
      lastState.current = next;
      setState(next);
    } catch {
      const failed: ActionState<ArrangedPlay> = { ok: false, message: "Le duel n'a pas pu être lancé." };
      lastState.current = failed;
      setState(failed);
    } finally {
      setPending(false);
    }
  }

  function decline(challengeId: string) {
    if (declining) return;
    startDecline(async () => {
      const fd = new FormData();
      fd.set("challenge_id", challengeId);
      try {
        await declineDuel(fd);
        toast({ tone: "success", title: "Demande de duel refusée.", key: "duel-decline" });
      } catch {
        toast({ tone: "error", title: "La demande n'a pas pu être refusée.", key: "duel-decline" });
      }
    });
  }

  function cancel(challengeId: string) {
    if (cancelling) return;
    startCancel(async () => {
      const fd = new FormData();
      fd.set("challenge_id", challengeId);
      try {
        await cancelDuel(fd);
        toast({ tone: "success", title: "Demande de duel annulée.", key: "duel-cancel" });
      } catch {
        toast({ tone: "error", title: "La demande n'a pas pu être annulée.", key: "duel-cancel" });
      }
    });
  }

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
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel p-3">
              <div>
                <p className="font-semibold">Demande de duel par {c.name}</p>
                <p className="text-xs text-zinc-500">{formatDateTime(c.at)}</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setHideResult(true); setAsk(c.id); }} className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-black hover:bg-amber-400">
                  Accepter
                </button>
                <button
                  type="button"
                  onClick={() => decline(c.id)}
                  disabled={declining}
                  className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-50"
                >
                  Décliner
                </button>
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
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel p-3 text-sm">
                <span>En attente de {c.name} · {formatDateTime(c.at)}</span>
                <button
                  type="button"
                  onClick={() => cancel(c.id)}
                  disabled={cancelling}
                  className="rounded-lg border border-zinc-600 px-3 py-1.5 hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-50"
                >
                  Annuler
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {showModal && (
        <Modal labelledBy="accept-title" wide={Boolean(report)} onClose={pending ? undefined : close}>
          <h3 id="accept-title" className="sr-only">Accepter le duel</h3>
          {pending ? (
            <div className="space-y-4 py-8 text-center">
              <p className="font-display text-xl uppercase text-amber-300">Duel en cours…</p>
              {slow && (
                <div className="space-y-2 border-t border-line pt-4">
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
                <button
                  type="button"
                  onClick={() => accept(ask)}
                  className="min-h-12 w-full rounded-xl bg-amber-500 font-display text-lg font-bold uppercase text-black hover:bg-amber-400"
                >
                  Oui
                </button>
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
