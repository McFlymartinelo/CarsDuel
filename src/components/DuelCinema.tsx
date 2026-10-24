"use client";

import { useState } from "react";
import { CloudRain, Sun } from "lucide-react";
import { DuelResult } from "@/components/DuelResult";
import { TIRE_LABEL, WEATHER_LABEL } from "@/lib/format";
import type { DuelReport } from "@/lib/types";

const STEPS = ["Conditions de piste", "Config adverse", "Résultats"] as const;
const n = (v: number, d = 0) => v.toLocaleString("fr-FR", { maximumFractionDigits: d });

function StepBar({ phase }: { phase: 1 | 2 | 3 }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-xs uppercase tracking-wider">
      {STEPS.map((label, i) => {
        const index = (i + 1) as 1 | 2 | 3;
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

function TrackStep({ r }: { r: DuelReport }) {
  const rain = r.weather === "rain_hot" || r.weather === "rain_cool";
  return (
    <div className={`duel-rise rounded-xl border p-5 ${rain ? "border-cyan-500/60 bg-cyan-950/30" : "border-amber-500/60 bg-amber-950/20"}`}>
      <div className="flex items-center gap-3">
        {rain ? <CloudRain className="text-cyan-300" size={36} /> : <Sun className="text-amber-300" size={36} />}
        <div>
          <p className="font-display text-xs uppercase tracking-widest text-zinc-400">Conditions de piste</p>
          <p className={`font-display text-3xl font-bold ${rain ? "text-cyan-300" : "text-amber-300"}`}>{WEATHER_LABEL[r.weather]}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-zinc-300">{r.weatherNote}</p>
    </div>
  );
}

function GhostStep({ r }: { r: DuelReport }) {
  const ghostTire = TIRE_LABEL[r.ghostTireType] ?? (r.ghostTireType || "Pneus");
  return (
    <div className="duel-from-right rounded-xl border border-zinc-700 bg-[#10131a] p-5">
      <p className="font-display text-xs uppercase tracking-widest text-zinc-400">Config adverse</p>
      <p className="mt-1 truncate font-display text-3xl font-bold">{r.defenderName}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase text-zinc-500">Moteur</p>
          <p className="font-semibold">{n(r.ghostPower)} ch</p>
          <p className="text-sm text-zinc-400">{n(r.ghostEngineWeight)} kg</p>
        </div>
        <div>
          <p className="text-xs uppercase text-zinc-500">Boîte</p>
          <p className="font-semibold">{n(r.ghostShift)} ms</p>
          <p className="text-sm text-zinc-400">{n(r.ghostGearWeight)} kg</p>
        </div>
        <div>
          <p className="text-xs uppercase text-zinc-500">Pneus</p>
          <p className="font-semibold">{ghostTire}</p>
          <p className="text-sm text-zinc-400">Gomme {n(r.ghostGum)} %</p>
        </div>
      </div>
    </div>
  );
}

/** Une étape à la fois : piste, puis la config du fantôme, puis le résultat. */
export function DuelCinema({ r, onReplay, replaying }: { r: DuelReport; onReplay: () => void; replaying: boolean }) {
  const [phase, setPhase] = useState<1 | 2 | 3>(1);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StepBar phase={phase} />
        {phase < 3 && (
          <button type="button" onClick={() => setPhase(3)} className="min-h-11 rounded-lg border border-zinc-700 px-3 text-xs uppercase tracking-wider text-zinc-300 hover:bg-zinc-800">
            Passer
          </button>
        )}
      </div>

      {phase === 1 && <TrackStep r={r} />}
      {phase === 2 && <GhostStep r={r} />}
      {phase === 3 && <DuelResult r={r} onReplay={onReplay} replaying={replaying} />}

      {phase < 3 && (
        <button
          type="button"
          onClick={() => setPhase((p) => (p === 1 ? 2 : 3))}
          className="min-h-14 w-full rounded-xl bg-amber-500 font-display text-xl font-bold uppercase text-black hover:bg-amber-400"
        >
          Suivant
        </button>
      )}
    </div>
  );
}
