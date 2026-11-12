"use client";

import type { CardComparison, CompareChip } from "@/lib/compare";
import { useCompareEnabled } from "@/components/compare/CompareProvider";

const CHIP_TONE: Record<CompareChip["tone"], string> = {
  good: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  bad: "border-red-400/30 bg-red-500/10 text-red-300",
  neutral: "border-white/10 text-zinc-400",
};

/**
 * Écart avec la config équipée : bloc complet sous les stats d'une carte,
 * ou pastille compacte à droite dans la vue liste.
 */
export function CardCompare({
  comparison,
  variant = "block",
}: {
  comparison: CardComparison;
  variant?: "block" | "badge";
}) {
  const { enabled } = useCompareEnabled();
  if (!enabled) return null;

  const good = comparison.tone === "good";
  const toneText = good ? "text-emerald-400" : "text-red-400";

  if (variant === "badge") {
    // Pastille compacte : seuls les écarts de score méca ont un chiffre principal.
    if (comparison.kind !== "meca" || !comparison.headline) return null;
    // On retire l'unité (pts), la légende dit de quoi il s'agit.
    const value = comparison.headline.replace(/\s+(pts?|%)$/, "");
    return (
      <span className="flex flex-col items-end text-right">
        <b className={`font-display text-base font-bold leading-none ${toneText}`}>{value}</b>
        <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-zinc-500">score méca</span>
      </span>
    );
  }

  return (
    <div className={`mt-3 rounded-xl border p-2.5 ${good ? "border-emerald-400/30 bg-emerald-500/[0.07]" : "border-red-400/30 bg-red-500/[0.07]"}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-[8px] font-bold uppercase tracking-[0.14em] text-zinc-500">Vs votre config</span>
        <span className="truncate font-display text-[10px] font-bold uppercase text-zinc-200">{comparison.reference}</span>
      </div>
      {comparison.headline && (
        <p className={`mt-1 flex items-baseline gap-1.5 font-display text-xl font-bold leading-none ${toneText}`}>
          {comparison.headline}
          <small className="text-[10px] font-medium text-zinc-400">{comparison.caption}</small>
        </p>
      )}
      <div className={`flex flex-wrap gap-1 ${comparison.headline ? "mt-2" : "mt-1.5"}`}>
        {comparison.chips.map((chip) => (
          <span
            key={chip.label}
            className={`inline-flex items-center rounded-full border px-1.5 py-0.5 font-display text-[9px] font-bold uppercase tracking-wide ${CHIP_TONE[chip.tone]}`}
          >
            {chip.label}
          </span>
        ))}
      </div>
    </div>
  );
}
