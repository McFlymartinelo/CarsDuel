"use client";

import { useEffect, useState } from "react";
import { Car, Cog, Disc, Flag, Gauge, Settings2, Trophy, Wrench } from "lucide-react";
import { DuelResult } from "@/components/DuelResult";
import { TrackCard } from "@/components/TrackCard";
import { TIRE_LABEL } from "@/lib/format";
import type { DuelReport } from "@/lib/types";

const STEPS = ["Conditions de piste", "Config adverse", "Course", "Résultats"] as const;
type Phase = 1 | 2 | 3 | 4;
const n = (v: number, d = 0) => v.toLocaleString("fr-FR", { maximumFractionDigits: d });

function StepBar({ phase }: { phase: Phase }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-xs uppercase tracking-wider">
      {STEPS.map((label, i) => {
        const index = (i + 1) as Phase;
        const on = phase === index;
        const done = phase > index;
        return (
          <span key={label} className="flex items-center gap-2">
            {i > 0 && <span className="text-zinc-600">→</span>}
            <span className={on ? "text-amber-400" : done ? "text-zinc-300" : "text-zinc-600"}>{label}</span>
          </span>
        );
      })}
    </p>
  );
}

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Cog; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-line bg-black/30 p-3">
      <p className="flex items-center gap-1.5 text-xs uppercase text-zinc-500">
        <Icon size={14} className="text-amber-300" />
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-bold leading-tight">{value}</p>
      <p className="text-sm text-zinc-400">{hint}</p>
    </div>
  );
}

function GhostStep({ r }: { r: DuelReport }) {
  const ghostTire = TIRE_LABEL[r.ghostTireType] ?? (r.ghostTireType || "Pneus");
  return (
    <div className="duel-from-right rounded-xl border border-line-strong bg-panel p-5">
      <p className="font-display text-xs uppercase tracking-widest text-zinc-400">Config adverse</p>
      <p className="mt-1 truncate font-display text-3xl font-bold">{r.defenderName}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat icon={Cog} label="Moteur" value={`${n(r.ghostPower)} ch`} hint={`${n(r.ghostEngineWeight)} kg`} />
        <Stat icon={Settings2} label="Boîte" value={`${n(r.ghostShift)} ms`} hint={`${n(r.ghostGearWeight)} kg`} />
        <Stat icon={Disc} label="Pneus" value={ghostTire} hint={`Gomme ${n(r.ghostGum)} %`} />
      </div>
    </div>
  );
}

/** La plus rapide part en 820 ms ; l'écart est amplifié pour rester lisible, sans dépasser 1,9 s. */
const raceMs = (sp: number, best: number) => Math.min(1900, Math.round(820 * (best / Math.max(sp, 1)) ** 3));
const FIRST_LIGHT = 450;
const LIGHT_STEP = 380;
const LIGHTS_HOLD = 550;
const LIGHTS_DELAY = FIRST_LIGHT + 5 * LIGHT_STEP + LIGHTS_HOLD;

function StartLights({ lit, go }: { lit: number; go: boolean }) {
  return (
    <div aria-hidden className="flex items-center gap-2 rounded-lg border border-line-strong/80 bg-black/70 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
      {[1, 2, 3, 4, 5].map((i) => {
        const red = !go && lit >= i;
        return (
          <span
            key={i}
            className={`size-3 rounded-full transition-all duration-150 ${
              go
                ? "scale-110 bg-emerald-400 shadow-[0_0_10px_2px_rgba(52,211,153,0.7)]"
                : red
                  ? "scale-110 bg-red-500 shadow-[0_0_10px_2px_rgba(239,68,68,0.7)]"
                  : "bg-zinc-700"
            }`}
          />
        );
      })}
    </div>
  );
}

/** Gerbe d'eau (pluie) ou nuage de poussière (sec) derrière la voiture. */
function Wake({ wet, moving }: { wet: boolean; moving: boolean }) {
  return (
    <span aria-hidden className={`race-wake ${wet ? "is-wet" : "is-dry"} ${moving ? "is-on" : ""}`}>
      {[0, 1, 2, 3].map((i) => (
        <i key={i} style={{ animationDelay: `${i * 85}ms` }} />
      ))}
    </span>
  );
}

/** Fumée qui s'échappe du capot quand la pièce casse. */
function Smoke() {
  return (
    <span aria-hidden className="race-smoke">
      {[0, 1, 2].map((i) => (
        <i key={i} style={{ animationDelay: `${i * 180}ms` }} />
      ))}
    </span>
  );
}

function Lane({
  label,
  you,
  pct,
  ms,
  go,
  done,
  broke,
  stopped,
  wet,
  winner,
  value,
}: {
  label: string;
  you?: boolean;
  pct: number;
  ms: number;
  go: boolean;
  done: boolean;
  broke: boolean;
  stopped: boolean;
  wet: boolean;
  winner: boolean;
  value: string;
}) {
  const tone = you ? "text-amber-400" : "text-zinc-300";
  const halted = broke ? stopped : done;
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p className={`flex min-w-0 items-center gap-1.5 font-display text-sm font-bold uppercase ${tone}`}>
          {winner && <Trophy aria-hidden size={14} className="shrink-0 text-amber-300" />}
          <span className="min-w-0 truncate">{label}</span>
          {done && winner && <span className="shrink-0 rounded-full bg-amber-500/20 px-1.5 text-[10px] tracking-wider text-amber-300">1er</span>}
        </p>
        <p
          className={`font-display text-2xl font-bold tabular-nums transition-opacity duration-300 ${broke ? "text-red-400" : tone} ${
            done ? "opacity-100" : "opacity-0"
          }`}
        >
          {value}
        </p>
      </div>

      <div
        className={`race-lane relative h-14 overflow-hidden rounded-lg border ${
          winner ? "border-amber-400/70" : you ? "border-amber-500/30" : "border-line-strong"
        } ${winner ? "is-winner" : ""}`}
      >
        <span aria-hidden className="race-asphalt" />
        <span aria-hidden className={`race-dashes ${go ? "is-running" : ""}`} />
        {wet && <span aria-hidden className={`race-wet ${go ? "is-running" : ""}`} />}
        <span aria-hidden className="race-finish" />

        <span aria-hidden className="race-car-layer">
          <span className={`race-car ${go ? "is-go" : ""}`} style={{ left: go ? `${pct}%` : "4%", transitionDuration: `${ms}ms` }}>
            <span className={`race-car-body ${go && !halted ? "is-moving" : ""}`}>
              <Wake wet={wet} moving={go && !halted} />
              {broke && stopped && <Smoke />}
              {go && !halted && <span className="race-speed" />}
              {broke && stopped ? (
                <Wrench size={26} className="text-red-400 drop-shadow-[0_0_6px_rgba(248,113,113,0.6)]" />
              ) : (
                <span className={`race-car-icon ${go && !halted ? "is-launch" : ""}`}>
                  <Car size={30} strokeWidth={1.8} className={`drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] ${tone}`} />
                </span>
              )}
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}

function RaceStep({ r }: { r: DuelReport }) {
  const [lit, setLit] = useState(0);
  const [go, setGo] = useState(false);
  const [done, setDone] = useState(false);
  const [stopped, setStopped] = useState(false);

  const mine = r.attackerSp;
  const theirs = r.defenderSp;
  const best = Math.max(mine ?? 0, theirs ?? 0, 1);
  const myPct = mine === null ? 44 : Math.max(6, (mine / best) * 100);
  const theirPct = theirs === null ? 44 : Math.max(6, (theirs / best) * 100);
  const myMs = mine === null ? 900 : raceMs(mine, best);
  const theirMs = theirs === null ? 900 : raceMs(theirs, best);
  const longest = Math.max(myMs, theirMs);
  const wet = r.weather === "rain_hot" || r.weather === "rain_cool";

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setLit(0);
      setGo(true);
      setStopped(true);
      const t = window.setTimeout(() => setDone(true), 200);
      return () => window.clearTimeout(t);
    }

    const timers: number[] = [];
    for (let i = 1; i <= 5; i++) timers.push(window.setTimeout(() => setLit(i), FIRST_LIGHT + i * LIGHT_STEP));
    timers.push(
      window.setTimeout(() => {
        setLit(0);
        setGo(true);
      }, LIGHTS_DELAY),
    );
    if (mine === null || theirs === null) {
      timers.push(window.setTimeout(() => setStopped(true), LIGHTS_DELAY + 950));
    }
    timers.push(window.setTimeout(() => setDone(true), LIGHTS_DELAY + longest + 220));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [longest, mine, theirs]);

  const youWin = done && r.win;

  return (
    <div className="duel-rise relative overflow-hidden rounded-xl border border-line-strong bg-[#0b0e14] p-4">
      <div aria-hidden className={`race-weather ${wet ? "is-wet" : "is-dry"}`} />
      {go && <div aria-hidden className="race-start-flash" />}

      <div className="relative">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-display text-xs uppercase tracking-widest text-zinc-400">
            Course
            <span className="ml-2 hidden text-[10px] tracking-[0.18em] text-zinc-500 sm:inline">
              {wet ? "· piste humide" : "· piste sèche"}
            </span>
          </p>
          <StartLights lit={lit} go={go} />
          <p className={`flex items-center gap-1 font-display text-[10px] uppercase tracking-[0.18em] ${go ? "text-emerald-300" : "text-zinc-500"}`}>
            <Gauge size={13} />
            {go ? (done ? "Arrivée" : "En course") : "Départ"}
          </p>
        </div>

        <div className="space-y-3">
          <Lane
            label="Vous"
            you
            pct={myPct}
            ms={myMs}
            go={go}
            done={done}
            broke={mine === null}
            stopped={stopped}
            wet={wet}
            winner={youWin}
            value={mine === null ? "CASSE" : n(mine, 1)}
          />
          <Lane
            label={r.defenderName}
            pct={theirPct}
            ms={theirMs}
            go={go}
            done={done}
            broke={theirs === null}
            stopped={stopped}
            wet={wet}
            winner={done && !r.win}
            value={theirs === null ? "CASSE" : n(theirs, 1)}
          />
        </div>

        <p className="mt-3 flex items-center justify-center gap-1.5 font-display text-[11px] uppercase tracking-[0.18em] text-zinc-400">
          <Flag size={13} className={done ? "text-amber-300" : "text-zinc-600"} />
          {done
            ? r.win
              ? "Vous franchissez la ligne en tête"
              : `${r.defenderName} franchit la ligne en tête`
            : go
              ? "Ligne d'arrivée en vue…"
              : "Feux rouges… préparez-vous"}
        </p>
      </div>
    </div>
  );
}

/** Une étape à la fois : piste, config adverse, course, résultat. */
export function DuelCinema({ r, busy = false, onReplay, onReplaceBrokenPart, onClose }: { r: DuelReport; busy?: boolean; onReplay?: () => void; onReplaceBrokenPart?: () => void; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>(1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepBar phase={phase} />
        {phase < 4 && (
          <button type="button" onClick={() => setPhase(4)} className="min-h-11 rounded-lg border border-line-strong px-3 text-xs uppercase tracking-wider text-zinc-300 hover:bg-zinc-800">
            Passer
          </button>
        )}
      </div>

      {phase === 1 && <TrackCard weather={r.weather} lines={r.weatherLines} />}
      {phase === 2 && <GhostStep r={r} />}
      {phase === 3 && <RaceStep r={r} />}
      {phase === 4 && <DuelResult r={r} busy={busy} onReplay={onReplay} onReplaceBrokenPart={onReplaceBrokenPart} onClose={onClose} />}

      {phase < 4 && (
        <button
          type="button"
          onClick={() => setPhase((p) => (p + 1) as Phase)}
          className="min-h-14 w-full rounded-xl bg-amber-500 font-display text-xl font-bold uppercase text-black hover:bg-amber-400"
        >
          {phase === 3 ? "Résultats" : "Suivant"}
        </button>
      )}
    </div>
  );
}
