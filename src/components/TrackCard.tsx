import { CloudLightning, CloudRain, Sun } from "lucide-react";
import { WEATHER_LABEL } from "@/lib/format";
import type { Weather } from "@/lib/types";

/** Encart conditions de piste : mini-scène météo animée + ruban d'asphalte. */
export function TrackCard({ weather, lines }: { weather: Weather; lines: string[] }) {
  const rain = weather === "rain_hot" || weather === "rain_cool";
  const storm = weather === "rain_cool";
  const heat = weather === "sunny_hot" || weather === "rain_hot";

  return (
    <div className={`duel-rise relative overflow-hidden rounded-xl border bg-[#090d14] ${rain ? "border-cyan-500/60" : "border-amber-500/60"}`}>
      {/* Ciel : pluie en deux couches avec éclairs, ou soleil avec brume de chaleur. */}
      <div aria-hidden className={`track-sky ${rain ? "is-rain" : "is-sun"} ${heat ? "is-hot" : "is-cool"}`}>
        {rain ? (
          <>
            <span className="rain-sheet rain-sheet-far" />
            <span className="rain-sheet rain-sheet-near" />
            <span className="rain-mist" />
            {storm && <span className="rain-bolt" />}
          </>
        ) : (
          <>
            <span className="sun-halo" />
            <span className="sun-disc" />
            <span className="heat-wave" />
            <span className="dust dust-a" />
            <span className="dust dust-b" />
          </>
        )}
      </div>

      {/* Ruban d'asphalte : lignes qui défilent, reflet mouillé ou poussière. */}
      <div aria-hidden className="track-road">
        <span className="track-road-edge" />
        <span className="track-road-dashes" />
        <span className={`track-road-sheen ${rain ? "is-wet" : "is-dry"}`} />
      </div>

      <div className="relative z-10 p-5 pb-16">
        <div className="flex items-center gap-3">
          <span
            className={`grid size-12 shrink-0 place-items-center rounded-full border ${
              rain ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-300" : "border-amber-400/40 bg-amber-500/10 text-amber-300"
            }`}
          >
            {rain ? (storm ? <CloudLightning size={26} /> : <CloudRain size={26} />) : <Sun size={26} />}
          </span>
          <div className="min-w-0">
            <p className="font-display text-[11px] uppercase tracking-[0.2em] text-zinc-400">Conditions de piste</p>
            <p className={`truncate font-display text-2xl font-bold sm:text-3xl ${rain ? "text-cyan-300" : "text-amber-300"}`}>
              {WEATHER_LABEL[weather]}
            </p>
          </div>
          <span
            className={`ml-auto hidden shrink-0 rounded-full border px-2 py-0.5 font-display text-[10px] uppercase tracking-[0.18em] sm:inline-block ${
              rain ? "border-cyan-400/40 text-cyan-200/80" : "border-amber-400/40 text-amber-200/80"
            }`}
          >
            {rain ? "Humide" : "Sèche"}
          </span>
        </div>

        <ul className="relative mt-3 space-y-1 text-sm text-zinc-200">
          {lines.map((line, i) => (
            <li key={line} className="track-line" style={{ animationDelay: `${120 + i * 90}ms` }}>
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
