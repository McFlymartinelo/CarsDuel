"use client";

import { useEffect, useState } from "react";
import { Car, Cog, Disc, Flag, Settings2, Wrench } from "lucide-react";
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
    <div className="rounded-xl border border-zinc-800 bg-black/30 p-3">
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
    <div className="duel-from-right rounded-xl border border-zinc-700 bg-[#10131a] p-5">
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

/** La plus rapide arrive en moins d'une seconde. La plus lente est plafonnée. */
const raceMs = (sp: number, best: number) => Math.min(900, Math.round(480 * (best / Math.max(sp, 1)) ** 1.15));

function Lane({ label, you, pct, ms, go, broke, value }: { label: string; you?: boolean; pct: number; ms: number; go: boolean; broke?: boolean; value: string }) {
  const tone = you ? "text-amber-400" : "text-zinc-300";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <p className={`min-w-0 truncate font-display text-sm font-bold uppercase ${tone}`}>{label}</p>
        <p
          className={`font-display text-2xl font-bold tabular-nums transition-opacity duration-300 ${broke ? "text-red-400" : tone} ${go ? "opacity-100" : "opacity-0"}`}
          style={{ transitionDelay: `${ms}ms` }}
        >
          {value}
        </p>
      </div>
      <div className="relative h-11 overflow-hidden rounded-lg border border-zinc-700 bg-[#0b0d12]">
        <div aria-hidden className="absolute inset-y-0 left-0 right-0 bg-[repeating-linear-gradient(90deg,transparent_0_calc(10%-1px),rgba(255,255,255,0.05)_calc(10%-1px)_10%)]" />
        <Flag aria-hidden size={16} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <div
          className={`race-lane flex h-full items-center justify-end rounded-r-lg pr-1 ${you ? "bg-gradient-to-r from-amber-900/10 to-amber-500/50" : "bg-gradient-to-r from-zinc-800/10 to-zinc-500/40"}`}
          style={{ width: go ? `${pct}%` : "0%", transitionDuration: `${ms}ms` }}
        >
          {broke && go ? <Wrench size={22} className="text-red-400" /> : <Car size={24} className={tone} />}
        </div>
      </div>
    </div>
  );
}

function RaceStep({ r }: { r: DuelReport }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setGo(true), 80);
    return () => window.clearTimeout(t);
  }, []);

  const mine = r.attackerSp;
  const theirs = r.defenderSp;
  const best = Math.max(mine ?? 0, theirs ?? 0, 1);
  const myPct = mine === null ? 55 : Math.max(8, (mine / best) * 100);
  const theirPct = theirs === null ? 55 : Math.max(8, (theirs / best) * 100);

  return (
    <div className="duel-rise space-y-4 rounded-xl border border-zinc-700 bg-[#10131a] p-5">
      <p className="font-display text-xs uppercase tracking-widest text-zinc-400">Course</p>
      <Lane label="Vous" you pct={myPct} ms={mine === null ? 700 : raceMs(mine, best)} go={go} broke={mine === null} value={mine === null ? "CASSE" : n(mine, 1)} />
      <Lane label={r.defenderName} pct={theirPct} ms={theirs === null ? 700 : raceMs(theirs, best)} go={go} broke={theirs === null} value={theirs === null ? "CASSE" : n(theirs, 1)} />
    </div>
  );
}

/** Une étape à la fois : piste, config adverse, course, résultat. */
export function DuelCinema({ r, onReplay, onClose }: { r: DuelReport; onReplay?: () => void; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>(1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepBar phase={phase} />
        {phase < 4 && (
          <button type="button" onClick={() => setPhase(4)} className="min-h-11 rounded-lg border border-zinc-700 px-3 text-xs uppercase tracking-wider text-zinc-300 hover:bg-zinc-800">
            Passer
          </button>
        )}
      </div>

      {phase === 1 && <TrackCard weather={r.weather} lines={r.weatherLines} />}
      {phase === 2 && <GhostStep r={r} />}
      {phase === 3 && <RaceStep r={r} />}
      {phase === 4 && <DuelResult r={r} onReplay={onReplay} onClose={onClose} />}

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
