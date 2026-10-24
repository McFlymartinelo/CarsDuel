"use client";

import { useEffect, useState } from "react";
import { CloudRain, Sun } from "lucide-react";
import { DuelResult } from "@/components/DuelResult";
import { TIRE_LABEL, WEATHER_LABEL } from "@/lib/format";
import type { DuelReport } from "@/lib/types";

const n = (v: number, d = 0) => v.toLocaleString("fr-FR", { maximumFractionDigits: d });

function usePhase(duelId: string) {
  const [phase, setPhase] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPhase(reduce ? 3 : 1);
  }, [duelId]);

  useEffect(() => {
    if (phase >= 3) return;
    const ms = phase === 1 ? 1800 : 2400;
    const t = window.setTimeout(() => setPhase((p) => (p === 1 ? 2 : 3)), ms);
    return () => window.clearTimeout(t);
  }, [phase, duelId]);

  return [phase, setPhase] as const;
}

/** Piste, puis les deux configs, puis le résultat détaillé. */
export function DuelCinema({ r, onReplay, replaying }: { r: DuelReport; onReplay: () => void; replaying: boolean }) {
  const [phase, setPhase] = usePhase(r.duelId);
  const rain = r.weather === "rain_hot" || r.weather === "rain_cool";
  const ghostTire = TIRE_LABEL[r.ghostTireType] ?? (r.ghostTireType || "Pneus");

  if (phase === 3) return <DuelResult r={r} onReplay={onReplay} replaying={replaying} />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-wider text-zinc-500">
        <span className={phase === 1 ? "text-amber-400" : ""}>1 · Piste</span>
        <span className={phase === 2 ? "text-amber-400" : ""}>2 · Configs</span>
        <span>3 · Résultat</span>
        <button type="button" onClick={() => setPhase(3)} className="min-h-11 rounded-lg border border-zinc-700 px-3 text-zinc-300 hover:bg-zinc-800">
          Passer
        </button>
      </div>

      <button type="button" onClick={() => setPhase((p) => (p === 1 ? 2 : 3))} className="block w-full text-left">
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

        {phase === 2 && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="duel-from-left rounded-xl border-2 border-amber-500 bg-[#10131a] p-3">
              <p className="font-display text-sm font-bold uppercase text-amber-400">Vous</p>
              <p className="mt-3 text-xs uppercase text-zinc-500">Moteur</p>
              <p className="font-semibold leading-tight">{r.engineName}</p>
              <p className="text-sm text-zinc-400">{n(r.yourPower)} ch · {n(r.yourEngineWeight)} kg</p>
              <p className="mt-3 text-xs uppercase text-zinc-500">Boîte</p>
              <p className="font-semibold leading-tight">{r.gearboxName}</p>
              <p className="text-sm text-zinc-400">{n(r.yourShift)} ms · {n(r.yourGearWeight)} kg</p>
              <p className="mt-3 text-xs uppercase text-zinc-500">Pneus</p>
              <p className="font-semibold leading-tight">{r.tireName}</p>
              <p className="text-sm text-zinc-400">Gomme {n(r.gumBefore)} %</p>
            </div>
            <div className="duel-from-right rounded-xl border border-zinc-700 bg-[#10131a] p-3">
              <p className="truncate font-display text-sm font-bold uppercase text-zinc-400">Fantôme · {r.defenderName}</p>
              <p className="mt-3 text-xs uppercase text-zinc-500">Moteur</p>
              <p className="font-semibold">{n(r.ghostPower)} ch</p>
              <p className="text-sm text-zinc-400">{n(r.ghostEngineWeight)} kg</p>
              <p className="mt-3 text-xs uppercase text-zinc-500">Boîte</p>
              <p className="font-semibold">{n(r.ghostShift)} ms</p>
              <p className="text-sm text-zinc-400">{n(r.ghostGearWeight)} kg</p>
              <p className="mt-3 text-xs uppercase text-zinc-500">Pneus</p>
              <p className="font-semibold">{ghostTire}</p>
              <p className="text-sm text-zinc-400">Gomme {n(r.ghostGum)} %</p>
            </div>
          </div>
        )}
      </button>
    </div>
  );
}
