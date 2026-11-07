"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ShieldAlert, ShieldCheck, X } from "lucide-react";
import { TileBody, tileClass } from "@/components/ActionTile";
import { Modal } from "@/components/Modal";
import type { ActionState, ConfigChallenge, ConfigReport } from "@/lib/types";

const SCAN_MS = 1400;

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function countdownLabel(ms: number): string {
  if (ms <= 0) return "fin imminente";
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return days > 0 ? `${days} j ${pad(h)} h ${pad(m)} min` : `${pad(h)} h ${pad(m)} min ${pad(s)} s`;
}

/** Compte à rebours jusqu'à la fin de la session (lundi 00:00 UTC). */
function Countdown({ until }: { until: string }) {
  const [text, setText] = useState("…");

  useEffect(() => {
    const tick = () => setText(countdownLabel(new Date(until).getTime() - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [until]);

  return <span className="font-display font-bold tabular-nums text-amber-300">{text}</span>;
}

function Verdict({ r }: { r: ConfigReport }) {
  if (r.status === "validated") {
    return (
      <div className="space-y-1">
        <p className="flex items-center justify-center gap-2 font-display text-xl font-bold uppercase text-emerald-300">
          <ShieldCheck size={20} aria-hidden />
          Paire validée
        </p>
        <p className="text-sm text-amber-300">+{r.coins} 🪙 · +{r.xp} XP</p>
      </div>
    );
  }
  if (r.status === "duplicate") {
    return (
      <p className="flex items-center justify-center gap-2 text-sm text-amber-300">
        <Check size={16} aria-hidden />
        Cette paire est déjà validée cette semaine.
      </p>
    );
  }
  const both = !r.engine_ok && !r.gearbox_ok;
  const detail = both
    ? "Ni le moteur ni la boîte ne correspondent à ce constructeur."
    : r.engine_ok
      ? "La boîte ne correspond pas à ce constructeur."
      : "Le moteur ne correspond pas à ce constructeur.";
  return (
    <div className="space-y-1">
      <p className="flex items-center justify-center gap-2 font-display text-xl font-bold uppercase text-red-300">
        <ShieldAlert size={20} aria-hidden />
        Incompatibilité
      </p>
      <p className="text-sm text-red-200">{detail}</p>
    </div>
  );
}

/** Tuile du mode sur la page Jouer et popup d'analyse de la paire équipée. */
export function ConfigConstructeurForm({
  action,
  challenge,
}: {
  action: (prev: ActionState<ConfigReport>, fd: FormData) => Promise<ActionState<ConfigReport>>;
  challenge: ConfigChallenge;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "scanning" | "done">("idle");
  const [result, setResult] = useState<ConfigReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scanning = phase === "scanning";
  const equipped = challenge.equipped;
  const brokenPart = equipped ? !equipped.engine.ok || !equipped.gearbox.ok : false;
  const canScan = Boolean(challenge.challenge && equipped && !brokenPart) && !scanning;
  const total = result?.total ?? challenge.total;

  // Le compteur ne bouge qu'une fois le verdict affiché : le chiffre monte jusqu'à sa valeur.
  const found = result?.found ?? challenge.found;
  const [shownFound, setShownFound] = useState(challenge.found);
  const shownRef = useRef(challenge.found);
  const [pop, setPop] = useState(false);
  const ratio = total > 0 ? Math.min(100, (shownFound / total) * 100) : 0;

  useEffect(() => {
    const from = shownRef.current;
    if (found === from) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      shownRef.current = found;
      setShownFound(found);
      setPop(true);
      return;
    }
    let frame = 0;
    const timer = window.setTimeout(() => {
      const start = performance.now();
      const duration = 450;
      const step = (now: number) => {
        const k = Math.min(1, (now - start) / duration);
        const value = Math.round(from + (found - from) * k);
        shownRef.current = value;
        setShownFound(value);
        if (k < 1) frame = window.requestAnimationFrame(step);
        else setPop(true);
      };
      frame = window.requestAnimationFrame(step);
    }, 1000);
    return () => {
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
    };
  }, [found]);

  useEffect(() => {
    if (!pop) return;
    const id = window.setTimeout(() => setPop(false), 900);
    return () => window.clearTimeout(id);
  }, [pop]);

  const stateClass =
    phase === "done" && result?.status === "validated"
      ? "cfg-ok border-emerald-400/60 bg-emerald-500/5"
      : phase === "done" && result?.status === "mismatch"
        ? "cfg-ko border-red-500/60 bg-red-500/5"
        : phase === "done" && result?.status === "duplicate"
          ? "border-amber-500/50 bg-amber-500/5"
          : phase === "done" && error
            ? "border-red-500/60 bg-red-500/5"
            : scanning
              ? "border-amber-500/40 bg-panel-deep"
              : "border-line-strong bg-panel-deep";

  function openModal() {
    setPhase("idle");
    setResult(null);
    setError(null);
    setPop(false);
    shownRef.current = challenge.found;
    setShownFound(challenge.found);
    setOpen(true);
  }

  function close() {
    setOpen(false);
    router.refresh();
  }

  async function scan() {
    if (!canScan) return;
    setPhase("scanning");
    setResult(null);
    setError(null);
    setPop(false);
    const run = action(null, new FormData()).catch(
      (): ActionState<ConfigReport> => ({ ok: false, message: "L'analyse n'a pas pu être lancée." }),
    );
    const [next] = await Promise.all([run, wait(SCAN_MS)]);
    if (next?.ok && next.data) setResult(next.data);
    else setError(next?.message ?? "L'analyse n'a pas pu être lancée.");
    setPhase("done");
  }

  return (
    <>
      <button type="button" onClick={openModal} className={tileClass()}>
        <TileBody
          title="Configs Constructeur"
          text={challenge.challenge ? "Défi de la semaine · une paire, une marque" : "Aucun défi cette semaine"}
          image="/duel/config-constructeur.webp"
        />
      </button>

      {open && (
        <Modal labelledBy="config-dialog-title" size="lg" onClose={scanning ? undefined : close}>
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Défi de la semaine</p>
                <h3 id="config-dialog-title" className="mt-1 font-display text-2xl font-bold uppercase sm:text-3xl">
                  Configs Constructeur
                </h3>
              </div>
              <button
                type="button"
                onClick={close}
                disabled={scanning}
                aria-label="Fermer"
                className="rounded-lg border border-line-strong p-2 text-zinc-400 transition hover:border-zinc-500 hover:text-white disabled:opacity-40"
              >
                <X size={18} aria-hidden />
              </button>
            </div>

            {challenge.challenge ? (
              <div className="rounded-xl border border-amber-500/40 bg-panel p-4">
                <p className="text-xs uppercase tracking-wide text-zinc-400">Énigme du constructeur</p>
                <p className="mt-1 font-display text-2xl font-bold leading-tight text-amber-300">
                  « {challenge.challenge.riddle} »
                </p>
                <p className="mt-3 text-sm text-zinc-400">
                  Fin de session dans <Countdown until={challenge.ends_at} />
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-line-strong p-4 text-sm text-zinc-400">
                Aucun défi n&apos;est disponible cette semaine.
              </p>
            )}

            {challenge.next && (
              <p className="text-xs text-zinc-500">
                Énigme de la semaine prochaine : <span className="italic text-zinc-400">« {challenge.next.riddle} »</span>
              </p>
            )}

            {challenge.challenge && (
              <div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-400">Configs validées</p>
                    <p className={`font-display text-3xl font-bold leading-tight tabular-nums text-amber-300 ${pop ? "cfg-count-pop" : ""}`}>
                      {shownFound}
                    </p>
                  </div>
                  <div className="rounded-xl border border-line-strong bg-panel px-4 py-3">
                    <p className="text-xs uppercase tracking-wide text-zinc-400">Configs possibles</p>
                    <p className="font-display text-3xl font-bold leading-tight tabular-nums text-zinc-100">{total}</p>
                  </div>
                </div>
                <div
                  role="progressbar"
                  aria-label="Progression des configs validées"
                  aria-valuemin={0}
                  aria-valuemax={total}
                  aria-valuenow={found}
                  className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-800"
                >
                  <div className="h-full rounded-full bg-amber-400 transition-[width] duration-500" style={{ width: `${ratio}%` }} />
                </div>
              </div>
            )}

            <div className="rounded-xl border border-line p-3 text-xs text-zinc-400">
              <p className="uppercase tracking-wide text-zinc-500">Configuration équipée</p>
              {equipped ? (
                <p className="mt-1 text-zinc-300">
                  {equipped.engine.name}
                  {!equipped.engine.ok && " (indisponible)"} · {equipped.gearbox.name}
                  {!equipped.gearbox.ok && " (indisponible)"}
                </p>
              ) : (
                <p className="mt-1">Aucune configuration : équipez un moteur et une boîte dans Ma config.</p>
              )}
            </div>

            <div
              aria-live="polite"
              className={`relative flex min-h-28 items-center justify-center overflow-hidden rounded-xl border p-4 text-center transition-colors ${stateClass}`}
            >
              {scanning && <span aria-hidden className="cfg-scan-line" />}
              {scanning && <p className="font-display text-lg font-bold uppercase text-amber-300">Analyse des pièces…</p>}
              {!scanning && phase === "idle" && (
                <p className="text-sm text-zinc-400">Lancez l&apos;analyse de la paire équipée.</p>
              )}
              {!scanning && phase === "done" && error && <p className="text-sm text-red-400">{error}</p>}
              {!scanning && phase === "done" && result && <Verdict r={result} />}
            </div>

            {challenge.history.length > 0 && (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">Validées cette semaine</p>
                <ul className="flex flex-wrap gap-2">
                  {challenge.history.map((h) => (
                    <li key={`${h.engine}-${h.gearbox}`} className="rounded-md border border-line-strong px-2 py-0.5 font-mono text-xs text-zinc-300">
                      {h.engine} &amp; {h.gearbox}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!equipped && <p className="text-sm text-red-400">Équipez un moteur et une boîte dans Ma config pour lancer l&apos;analyse.</p>}
            {brokenPart && (
              <p className="text-sm text-red-400">Une pièce équipée est indisponible : équipez-en une autre dans le garage.</p>
            )}

            <p className="text-xs text-zinc-500">
              Chaque paire inédite rapporte +{challenge.reward.coins} 🪙 et +{challenge.reward.xp} XP. Une même paire ne rapporte qu&apos;une fois par semaine.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={close}
                disabled={scanning}
                className="min-h-14 rounded-xl border border-zinc-600 font-display text-lg font-bold uppercase hover:bg-zinc-800 disabled:opacity-50"
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={scan}
                disabled={!canScan}
                className="min-h-14 rounded-xl bg-amber-500 font-display text-lg font-bold uppercase text-black hover:bg-amber-400 disabled:opacity-50"
              >
                {scanning ? "Analyse…" : "Lancer l'analyse"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
