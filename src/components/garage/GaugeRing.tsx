import type { TireState } from "@/lib/game";

const TONE = {
  ok: { stroke: "stroke-emerald-500", text: "text-emerald-400" },
  worn: { stroke: "stroke-amber-500", text: "text-amber-400" },
  critical: { stroke: "stroke-red-500", text: "text-red-400" },
} as const;

/** Jauge circulaire de gomme restante + libellé d'état. */
export function GaugeRing({ percent, state }: { percent: number; state: TireState }) {
  const r = 24;
  const c = 2 * Math.PI * r;
  const tone = TONE[state.tone];
  return (
    <div className="flex items-center justify-center gap-3">
      <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`Gomme restante ${percent}%`}>
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-zinc-800" />
        <circle
          cx="32" cy="32" r={r} fill="none" strokeWidth="6" strokeLinecap="round"
          className={tone.stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.max(0, Math.min(100, percent)) / 100)}
          transform="rotate(-90 32 32)"
        />
        <text x="32" y="36" textAnchor="middle" className={`fill-current text-[13px] font-bold ${tone.text}`}>
          {Math.round(percent)}%
        </text>
      </svg>
      <span className={`font-display text-lg font-bold ${tone.text}`}>{state.label}</span>
    </div>
  );
}
