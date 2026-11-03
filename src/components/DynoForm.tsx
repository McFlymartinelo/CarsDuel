"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ShieldCheck, X } from "lucide-react";
import { tileClass, TileBody } from "@/components/ActionTile";
import { DynoResult } from "@/components/DynoResult";
import { Modal } from "@/components/Modal";
import {
  DYNO_MEDALS,
  dynoConstraintChecks,
  dynoConstraintsSatisfied,
  dynoDeckReady,
  dynoDeckStats,
} from "@/lib/dyno";
import { TIRE_LABEL, WEATHER_LABEL } from "@/lib/format";
import type { ActionState, DynoChallenge, DynoReport, UserCard } from "@/lib/types";

function countdownLabel(ms: number): string {
  if (ms <= 0) return "Rotation imminente";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h} h ${pad(m)} min ${pad(s)} s`;
}

/** Décompte jusqu'au prochain minuit UTC (rotation du banc). */
function DynoCountdown({ until }: { until: string }) {
  const [text, setText] = useState("…");

  useEffect(() => {
    const tick = () => setText(countdownLabel(new Date(until).getTime() - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [until]);

  return <span className="font-display font-bold tabular-nums text-amber-300">{text}</span>;
}

/** Carte du mode + popup d'avant-test + résultat du passage au banc. */
export function DynoForm({
  action,
  deckId,
  challenge,
  engine,
  gearbox,
  tire,
}: {
  action: (prev: ActionState<DynoReport>, fd: FormData) => Promise<ActionState<DynoReport>>;
  deckId?: string;
  challenge: DynoChallenge;
  engine?: UserCard;
  gearbox?: UserCard;
  tire?: UserCard;
}) {
  const [state, setState] = useState<ActionState<DynoReport>>(null);
  const lastState = useRef<ActionState<DynoReport>>(null);
  const [open, setOpen] = useState(false);
  const [showRun, setShowRun] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [slow, setSlow] = useState(false);
  const router = useRouter();
  const report = state?.ok ? state.data : undefined;
  const waiting = launching;

  const stats = dynoDeckStats(engine, gearbox, tire);
  const deckReady = dynoDeckReady(engine, gearbox, tire);
  const checks = dynoConstraintChecks(challenge.config.constraints, stats);
  const constraintsOk = dynoConstraintsSatisfied(checks);
  const canLaunch = Boolean(deckId) && deckReady && constraintsOk;

  // Filet de sécurité : si la requête ne revient jamais, on laisse sortir le joueur.
  useEffect(() => {
    if (!launching) {
      setSlow(false);
      return;
    }
    const id = window.setTimeout(() => setSlow(true), 15000);
    return () => window.clearTimeout(id);
  }, [launching]);

  // Au passage de minuit UTC, le défi et la météo changent : on recharge la page.
  useEffect(() => {
    const delay = new Date(challenge.changes_at).getTime() - Date.now() + 1000;
    if (delay <= 0) {
      router.refresh();
      return;
    }
    const id = window.setTimeout(() => router.refresh(), delay);
    return () => window.clearTimeout(id);
  }, [challenge.changes_at, router]);

  async function launch() {
    if (!deckId || launching || !canLaunch) return;
    setShowRun(true);
    setLaunching(true);
    const fd = new FormData();
    fd.set("deck_id", deckId);
    try {
      const next = await action(lastState.current, fd);
      lastState.current = next;
      setState(next);
    } catch {
      const failed: ActionState<DynoReport> = { ok: false, message: "Le passage au banc n'a pas pu être lancé." };
      lastState.current = failed;
      setState(failed);
    } finally {
      setLaunching(false);
    }
  }

  function close() {
    setOpen(false);
    setShowRun(false);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setShowRun(false);
          setState(null);
          setOpen(true);
        }}
        className={tileClass()}
      >
        <TileBody
          title="Banc d'essai"
          text="Le défi du jour · 3 médailles à viser"
          image="/duel/banc-essai.webp"
        />
      </button>

      {open && (
        <Modal labelledBy="dyno-dialog-title" size="lg" onClose={waiting ? undefined : close}>
          <h3 id="dyno-dialog-title" className="sr-only">Banc d&apos;essai</h3>
          {showRun ? (
            report ? (
              <div className="space-y-4">
                <DynoResult
                  key={report.attemptId}
                  r={report}
                  thresholds={challenge.config.medals_sp}
                  busy={launching}
                  onReplay={canLaunch ? launch : undefined}
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
                <p className="font-display text-2xl font-bold uppercase text-amber-400">Passage au banc…</p>
                <p className="text-sm text-zinc-400">L&apos;aiguille monte en régime sur le banc du jour.</p>
                {slow && (
                  <div className="space-y-2 border-t border-zinc-800 pt-4">
                    <p className="text-xs text-zinc-500">Le serveur tarde à répondre. Votre passage est peut-être déjà enregistré.</p>
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
                <p className="text-red-400">{state?.message ?? "Le passage au banc n'a pas pu être lancé."}</p>
                <button
                  type="button"
                  onClick={() => setShowRun(false)}
                  className="min-h-12 w-full rounded-xl border border-zinc-600 font-display text-lg font-bold uppercase hover:bg-zinc-800"
                >
                  Retour
                </button>
              </div>
            )
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Défi du jour</p>
                  <h3 className="mt-1 font-display text-2xl font-bold uppercase sm:text-3xl">Banc d&apos;essai</h3>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Fermer"
                  className="rounded-lg border border-zinc-700 p-2 text-zinc-400 transition hover:border-zinc-500 hover:text-white"
                >
                  <X size={18} aria-hidden />
                </button>
              </div>

              <div className="rounded-xl border border-amber-500/40 bg-[#10131a] p-4">
                <div className="grid gap-3 sm:grid-cols-[1.35fr_1fr]">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-zinc-400">Défi du banc du jour</p>
                    <p className="mt-1 font-display text-2xl font-bold leading-tight text-amber-300">{challenge.config.name}</p>
                    <p className="mt-1 text-sm text-zinc-400">{challenge.config.description}</p>
                  </div>
                  <div className="sm:border-l sm:border-white/10 sm:pl-4">
                    <p className="text-xs uppercase tracking-wide text-zinc-400">Météo active du jour</p>
                    <p className="mt-1 font-display text-xl font-bold leading-tight">{WEATHER_LABEL[challenge.weather]}</p>
                    {tire && (
                      <p className="mt-1 text-xs text-zinc-500">
                        Pneus équipés : {TIRE_LABEL[tire.card_templates.tire_type ?? ""] ?? tire.card_templates.tire_type}
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-3 border-t border-white/10 pt-3">
                  <p className="text-xs uppercase tracking-wide text-zinc-400">Rotation</p>
                  <p className="text-sm text-zinc-300">Changement du banc d&apos;essai à minuit</p>
                  <p className="text-sm text-zinc-400">
                    dans <DynoCountdown until={challenge.changes_at} />
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-zinc-300">Contraintes imposées</p>
                {checks.length === 0 ? (
                  <p className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-300">
                    <Check size={16} aria-hidden />
                    Aucune contrainte : toutes les configurations sont acceptées.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {checks.map((c) => (
                      <li
                        key={c.key}
                        className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${
                          c.ok ? "border-emerald-500/30 bg-emerald-500/5" : "border-red-500/40 bg-red-500/5"
                        }`}
                      >
                        <span className="text-zinc-300">{c.label}</span>
                        <span className={`flex items-center gap-1.5 text-right tabular-nums ${c.ok ? "text-emerald-300" : "text-red-300"}`}>
                          {c.value}
                          {c.ok ? <Check size={15} aria-hidden /> : <X size={15} aria-hidden />}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {!deckReady && (
                  <p className="mt-2 text-sm text-red-400">
                    Complétez Ma config avec un moteur, une boîte et des pneus disponibles pour lancer le passage.
                  </p>
                )}
                {deckReady && !constraintsOk && (
                  <p className="mt-2 text-sm text-red-400">
                    Corrigez les contraintes en rouge dans Ma config pour lancer le passage.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-3">
                <p className="flex items-center gap-2 font-display text-sm font-bold uppercase text-emerald-300">
                  <ShieldCheck size={16} aria-hidden />
                  Environnement de test certifié
                </p>
                <p className="mt-1 text-sm leading-relaxed text-emerald-100">
                  0 % d&apos;usure de pneus et 0 % de risque de casse mécanique. Relances illimitées : votre garage ne
                  subit aucune contrepartie.
                </p>
              </div>

              <div>
                <p className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-zinc-300">Objectifs à viser</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {DYNO_MEDALS.map((m) => {
                    const claimed = challenge.claimed.includes(m.key);
                    const threshold = challenge.config.medals_sp[m.key];
                    return (
                      <div
                        key={m.key}
                        className={`relative overflow-hidden rounded-xl border p-3 ${claimed ? "border-emerald-500/40" : m.border} bg-[#10131a]`}
                      >
                        <div aria-hidden className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl ${m.glow}`} />
                        <div className="relative flex items-center gap-2">
                          <Image src={m.image} alt="" width={30} height={30} className="h-[30px] w-[30px] object-contain" />
                          <span className={`font-display font-bold uppercase ${m.text}`}>{m.label}</span>
                          <span className={`ml-auto text-[10px] font-semibold uppercase ${claimed ? "text-emerald-400" : "text-zinc-500"}`}>
                            {claimed ? "Validée" : "À viser"}
                          </span>
                        </div>
                        <div className="relative mt-2 flex items-baseline justify-between gap-2">
                          <p className="font-display text-xl font-bold tabular-nums">{threshold} SP</p>
                          <p className="font-display text-sm font-bold text-amber-300">+{m.coins} 🪙</p>
                        </div>
                        <p className="relative text-[11px] text-zinc-400">SP final requis</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {challenge.personal_best && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 to-[#10131a] px-3 py-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/10 text-amber-300">
                    <ShieldCheck size={18} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-zinc-400">Votre meilleur SP du jour</p>
                    <p className="font-display text-xl font-bold leading-tight tabular-nums text-zinc-100">
                      {challenge.personal_best.sp.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SP
                    </p>
                  </div>
                  <span className="ml-auto text-xs text-zinc-500">{challenge.attempts} passage{challenge.attempts > 1 ? "s" : ""} aujourd&apos;hui</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={close}
                  className="min-h-14 rounded-xl border border-zinc-600 font-display text-lg font-bold uppercase hover:bg-zinc-800"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={launch}
                  disabled={!canLaunch}
                  className="min-h-14 rounded-xl bg-amber-500 font-display text-lg font-bold uppercase text-black hover:bg-amber-400 disabled:opacity-50"
                >
                  Lancer le passage au banc
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
