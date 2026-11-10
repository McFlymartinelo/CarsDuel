"use client";

import { Gauge } from "lucide-react";
import { useCompareEnabled } from "@/components/compare/CompareProvider";

/**
 * Barre de référence : la configuration à laquelle les pièces sont comparées,
 * avec l'interrupteur qui masque les comparaisons (préférence locale).
 */
export function CompareBar({
  equipped,
}: {
  equipped: { engine: string; gearbox: string; tire: string } | null;
}) {
  const { enabled, toggle } = useCompareEnabled();

  return (
    <div className="flex items-center gap-2 rounded-xl border border-line bg-panel px-2.5 py-2">
      <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg border border-amber-500/35 bg-amber-500/10 text-amber-300">
        <Gauge size={14} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-display text-[8px] font-bold uppercase tracking-[0.14em] text-zinc-500">Comparé à votre config</p>
        {equipped ? (
          <p className="mt-px flex flex-wrap gap-x-1.5 font-display text-[11.5px] font-bold uppercase leading-tight text-zinc-100">
            <span>{equipped.engine}</span>
            <span className="font-medium text-zinc-500">·</span>
            <span>{equipped.gearbox}</span>
            <span className="font-medium text-zinc-500">·</span>
            <span>{equipped.tire}</span>
          </p>
        ) : (
          <p className="mt-px font-display text-[11.5px] font-bold leading-tight text-zinc-500">Aucune config équipée</p>
        )}
      </div>

      {equipped && (
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Comparer à ma configuration"
          onClick={toggle}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 font-display text-[8.5px] font-bold uppercase tracking-[0.08em] ${
            enabled
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-white/10 bg-white/[0.03] text-zinc-400"
          }`}
        >
          <span
            aria-hidden
            className={`h-3.5 w-3.5 rounded-full ${
              enabled ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" : "bg-zinc-600"
            }`}
          />
          {enabled ? "Activé" : "Désactivé"}
        </button>
      )}
    </div>
  );
}
