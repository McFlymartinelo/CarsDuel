"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { tileClass, TileBody } from "@/components/ActionTile";
import { ClmResult } from "@/components/ClmResult";
import { Modal } from "@/components/Modal";
import { CLM_MEDALS, CLM_PARTICIPATION_COINS, formatDistance, formatLapTime } from "@/lib/clm";
import { WEATHER_LABEL } from "@/lib/format";
import type { ActionState, ClmChallenge, ClmReport } from "@/lib/types";

function countdownLabel(ms: number): string {
  if (ms <= 0) return "Rotation imminente";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${h} h ${pad(m)} min ${pad(s)} s`;
}

/** Décompte jusqu'au prochain minuit (rotation du circuit). */
function ClmCountdown({ until }: { until: string }) {
  const [text, setText] = useState("…");

  useEffect(() => {
    const tick = () => setText(countdownLabel(new Date(until).getTime() - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [until]);

  return <span className="font-display font-bold tabular-nums text-amber-300">{text}</span>;
}

/** Carte du mode + popup d'avant-course + résultat du tour. */
export function ClmForm({
  action,
  deckId,
  challenge,
  config,
}: {
  action: (prev: ActionState<ClmReport>, fd: FormData) => Promise<ActionState<ClmReport>>;
  deckId?: string;
  challenge: ClmChallenge;
  config?: { engine: string; gearbox: string; tire: string; tireGum: number | null };
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const formRef = useRef<HTMLFormElement>(null);
  const armed = useRef(false);
  const [open, setOpen] = useState(false);
  const [showRace, setShowRace] = useState(false);
  const [launching, setLaunching] = useState(false);
  const router = useRouter();
  const report = state?.ok ? state.data : undefined;
  const waiting = pending || launching;

  useEffect(() => {
    if (!pending) setLaunching(false);
  }, [pending]);

  // Au passage de minuit, le circuit et la météo changent : on recharge le défi.
  useEffect(() => {
    const delay = new Date(challenge.changes_at).getTime() - Date.now() + 1000;
    if (delay <= 0) {
      router.refresh();
      return;
    }
    const id = window.setTimeout(() => router.refresh(), delay);
    return () => window.clearTimeout(id);
  }, [challenge.changes_at, router]);

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

  function replaceBrokenPart() {
    if (report?.brokenPart !== "moteur" && report?.brokenPart !== "boite") return;
    setOpen(false);
    setShowRace(false);
    window.dispatchEvent(new CustomEvent("carsduel:change-slot", { detail: report.brokenPart }));
  }

  const canReplay = Boolean(deckId) && !report?.brokenPart && !report?.tireDestroyed;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setShowRace(false);
          setOpen(true);
        }}
        className={tileClass()}
      >
        <TileBody
          title="Contre-la-montre solo"
          text="Le circuit du jour · 3 médailles à viser"
          image="/trophees/medaille_chrono_or.png"
          imageFit="contain"
        />
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
      </form>

      {open && (
        <Modal labelledBy="clm-dialog-title" size="lg" onClose={waiting ? undefined : close}>
          <h3 id="clm-dialog-title" className="sr-only">Contre-La-Montre solo</h3>
          {showRace ? (
            waiting ? (
              <div className="space-y-4 py-10 text-center">
                <p className="font-display text-2xl font-bold uppercase text-amber-400">Tour lancé…</p>
                <p className="text-sm text-zinc-400">Chronométrage en cours sur le circuit du jour.</p>
              </div>
            ) : report ? (
              <ClmResult
                key={report.attemptId}
                r={report}
                onReplay={canReplay ? launch : undefined}
                onReplaceBrokenPart={report.brokenPart === "moteur" || report.brokenPart === "boite" ? replaceBrokenPart : undefined}
                onClose={close}
              />
            ) : (
              <div className="space-y-4">
                <p className="text-red-400">{state?.message ?? "Le tour n'a pas pu être lancé."}</p>
                <button
                  type="button"
                  onClick={() => setShowRace(false)}
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
                  <h3 className="mt-1 font-display text-2xl font-bold uppercase sm:text-3xl">Contre-La-Montre solo</h3>
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

              <div className="grid gap-3 sm:grid-cols-[1.35fr_1fr]">
                <div className="rounded-xl border border-amber-500/40 bg-[#10131a] p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-400">Circuit du jour</p>
                  <p className="mt-1 font-display text-2xl font-bold leading-tight text-amber-300">{challenge.circuit.name}</p>
                  <p className="text-sm text-zinc-300">{challenge.circuit.profile}</p>
                  <p className="mt-1 text-sm text-zinc-400">{formatDistance(challenge.circuit.distance_km)}</p>
                </div>
                <div className="rounded-xl border border-zinc-700 bg-[#10131a] p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-400">Conditions de piste</p>
                  <p className="font-display text-xl font-bold leading-tight">{WEATHER_LABEL[challenge.weather]}</p>
                  <p className="mt-3 text-xs uppercase tracking-wide text-zinc-400">Rotation</p>
                  <p className="text-sm text-zinc-300">Changement du circuit à minuit</p>
                  <p className="text-sm text-zinc-400">
                    dans <ClmCountdown until={challenge.changes_at} />
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 font-display text-sm font-bold uppercase tracking-wide text-zinc-300">Objectifs à viser</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {CLM_MEDALS.map((m) => {
                    const claimed = challenge.claimed.includes(m.key);
                    return (
                      <div
                        key={m.key}
                        className={`relative overflow-hidden rounded-xl border p-3 ${claimed ? "border-emerald-500/40" : m.border} bg-[#10131a]`}
                      >
                        <div aria-hidden className={`pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl ${m.glow}`} />
                        <div className="relative flex items-center gap-2">
                          <Image src={m.image} alt="" width={30} height={30} className="h-[30px] w-[30px] object-contain" />
                          <span className={`font-display font-bold uppercase ${m.text}`}>{m.label}</span>
                          {claimed && <span className="ml-auto text-[10px] font-semibold uppercase text-emerald-400">Validée</span>}
                        </div>
                        <p className="relative mt-2 font-display text-xl font-bold tabular-nums">{formatLapTime(challenge.circuit.medals_seconds[m.key])}</p>
                        <p className="relative text-[11px] text-zinc-400">SP final ≥ {m.threshold} · +{m.coins} 🪙</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {challenge.personal_best && (
                <p className="rounded-xl border border-zinc-800 bg-black/20 px-3 py-2 text-sm text-zinc-400">
                  Votre record sur ce circuit :{" "}
                  <span className="font-display font-bold tabular-nums text-zinc-200">{formatLapTime(challenge.personal_best.seconds)}</span>
                </p>
              )}

              <div className="rounded-xl border-2 border-red-500/50 bg-red-950/30 p-3">
                <p className="flex items-center gap-2 font-display text-sm font-bold uppercase text-red-300">
                  <AlertTriangle size={16} aria-hidden />
                  Avertissement mécanique
                </p>
                <p className="mt-1 text-sm leading-relaxed text-red-100">
                  Participations illimitées. Attention : les usures de pneus et les risques de casse mécanique sont bien réels et
                  décomptés à chaque tentative !
                </p>
              </div>

              <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
                <p className="font-display text-sm font-bold uppercase tracking-wide text-zinc-300">Récompenses du jour</p>
                <ul className="mt-2 grid gap-1 text-sm text-zinc-400 sm:grid-cols-2">
                  {CLM_MEDALS.map((m) => {
                    const claimed = challenge.claimed.includes(m.key);
                    return (
                      <li key={m.key} className="flex items-center justify-between gap-2">
                        <span className={m.text}>Médaille {m.label}</span>
                        <span className={claimed ? "text-emerald-400" : "text-zinc-500"}>{claimed ? "Déjà remportée" : "Disponible"}</span>
                      </li>
                    );
                  })}
                  <li className="flex items-center justify-between gap-2">
                    <span className="text-sky-300">Prime de participation</span>
                    <span className={challenge.participation_claimed ? "text-emerald-400" : "text-zinc-500"}>
                      {challenge.participation_claimed ? "Déjà remportée" : `Disponible · +${CLM_PARTICIPATION_COINS} 🪙`}
                    </span>
                  </li>
                </ul>
              </div>

              {config && (
                <div className="rounded-xl border border-zinc-800 bg-black/20 p-3 text-xs text-zinc-400">
                  <p className="font-display text-sm font-bold uppercase tracking-wide text-zinc-300">Config engagée</p>
                  <p className="mt-1 truncate">
                    <span className="text-zinc-200">{config.engine}</span>
                    <span className="mx-1 text-zinc-600">·</span>
                    <span className="text-zinc-200">{config.gearbox}</span>
                    <span className="mx-1 text-zinc-600">·</span>
                    <span className="text-zinc-200">{config.tire}</span>
                    {config.tireGum != null && <span> (gomme {config.tireGum} %)</span>}
                  </p>
                </div>
              )}

              {!deckId && (
                <p className="text-sm text-red-400">
                  Complétez Ma config avec un moteur, une boîte et des pneus disponibles pour lancer le tour.
                </p>
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
                  disabled={!deckId}
                  className="min-h-14 rounded-xl bg-amber-500 font-display text-lg font-bold uppercase text-black hover:bg-amber-400 disabled:opacity-50"
                >
                  Lancer le tour
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
