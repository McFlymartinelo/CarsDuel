import { CloudRain, Sun } from "lucide-react";
import { WEATHER_LABEL } from "@/lib/format";
import type { Weather } from "@/lib/types";

/** Encart conditions de piste : météo, risque de casse, usure des pneus équipés. */
export function TrackCard({ weather, lines }: { weather: Weather; lines: string[] }) {
  const rain = weather === "rain_hot" || weather === "rain_cool";
  return (
    <div className={`duel-rise relative overflow-hidden rounded-xl border p-5 ${rain ? "border-cyan-500/60 bg-cyan-950/30" : "border-amber-500/60 bg-amber-950/20"}`}>
      <div aria-hidden className={`pointer-events-none absolute inset-0 ${rain ? "weather-rain" : "weather-sun"}`} />
      <div className="relative flex items-center gap-3">
        {rain ? <CloudRain className="text-cyan-300" size={36} /> : <Sun className="text-amber-300" size={36} />}
        <div>
          <p className="font-display text-xs uppercase tracking-widest text-zinc-400">Conditions de piste</p>
          <p className={`font-display text-3xl font-bold ${rain ? "text-cyan-300" : "text-amber-300"}`}>{WEATHER_LABEL[weather]}</p>
        </div>
      </div>
      <ul className="relative mt-3 space-y-1 text-sm text-zinc-200">
        {lines.map((line) => <li key={line}>{line}</li>)}
      </ul>
    </div>
  );
}
