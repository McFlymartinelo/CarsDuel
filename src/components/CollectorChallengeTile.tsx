"use client";

import type { ReactNode } from "react";
import { Check, Coins, Star } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { useChallengeDensity } from "@/components/ChallengeDensity";
import { claimCollectorChallenge } from "@/app/(game)/garage/collection/actions";

type Props = {
  challengeKey: string;
  name: string;
  condition: string;
  item: string;
  reward: string;
  owned: number;
  total: number;
  complete: boolean;
  claimed: boolean;
  icon: ReactNode;
};

const CARD_IDLE = "border-zinc-700/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";
const CARD_READY = "border-amber-400/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(251,191,36,0.12),0_18px_34px_-24px_rgba(251,191,36,0.5)]";
const CARD_CLAIMED = "border-emerald-400/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

const CTA = "inline-flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-gradient-to-b from-amber-300 to-amber-500 font-display text-[13px] font-bold uppercase tracking-[0.09em] text-[#1c1203] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_20px_-10px_rgba(251,191,36,0.65)] transition-[filter] hover:brightness-105";
const CTA_COMPACT = "max-sm:ml-auto max-sm:h-9 max-sm:w-auto max-sm:gap-1.5 max-sm:px-3 max-sm:text-[11px]";

const PILL = "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md border px-2 font-display text-[10px] font-bold uppercase tracking-wide";

/** Jauge en segments (6 max) : chaque segment se remplit proportionnellement. */
function SegmentBar({ owned, total, complete }: { owned: number; total: number; complete: boolean }) {
  const count = Math.max(1, Math.min(total || 1, 6));
  const ratio = total ? owned / total : 0;
  return <div className="flex min-w-0 flex-1 gap-[3px]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={owned}>
    {Array.from({ length: count }, (_, i) => {
      const fill = Math.max(0, Math.min(1, ratio * count - i));
      return <span key={i} className="h-[7px] flex-1 overflow-hidden rounded-full bg-zinc-700/60">
        <span className={`block h-full rounded-full ${complete ? "bg-gradient-to-b from-emerald-300 to-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-gradient-to-b from-amber-300 to-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.55)]"}`} style={{ width: `${fill * 100}%` }} />
      </span>;
    })}
  </div>;
}

export function ChallengeTile({ challengeKey, name, condition, item, reward, owned, total, complete, claimed, icon }: Props) {
  const { compact } = useChallengeDensity();
  const ready = complete && !claimed;
  const cardState = claimed ? CARD_CLAIMED : ready ? CARD_READY : CARD_IDLE;
  const missing = Math.max(0, total - owned);

  return <article className={`relative flex min-w-0 shrink-0 overflow-hidden rounded-xl border bg-gradient-to-b from-[#12161f] to-[#0c0f16] ${cardState}`}>
    {ready && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-amber-300 to-amber-600" />}
    <div className="min-w-0 flex-1 p-3 sm:p-3.5 lg:p-3">
      <div className="flex items-start gap-2.5 sm:gap-3">
        <span aria-hidden="true" className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border sm:h-12 sm:w-12 lg:h-10 lg:w-10 ${claimed ? "border-emerald-400/30 text-emerald-300 shadow-[inset_0_0_18px_rgba(52,211,153,0.1)]" : "border-amber-400/25 text-amber-400 shadow-[inset_0_0_18px_rgba(251,191,36,0.08)]"}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-baseline gap-2">
            <h4 className="min-w-0 flex-1 font-display text-[15px] font-bold uppercase leading-tight tracking-wide text-zinc-50 lg:text-[14px]">{name}</h4>
            <span className={`font-display text-xs font-bold text-zinc-100 ${compact ? "hidden max-sm:inline" : "hidden"}`}>{owned} <span className="font-semibold text-zinc-500">/ {total}</span></span>
          </div>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-400 lg:text-[10.5px]" title={condition}>{condition}</p>
          {item !== "Aucune" && <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-amber-300/75 lg:text-[10px]" title={item}>+ {item}</p>}
        </div>
      </div>

      <div className="mt-2.5 flex min-w-0 items-center gap-2.5 lg:mt-2">
        <span className={`shrink-0 font-display text-[13px] font-bold text-zinc-100 lg:text-xs ${compact ? "max-sm:hidden" : ""}`}>{owned} <span className="font-semibold text-zinc-500">/ {total}</span></span>
        <SegmentBar owned={owned} total={total} complete={complete} />
        {!ready && (claimed
          ? <span className={`${PILL} border-emerald-400/45 bg-emerald-500/10 text-emerald-300`}><Check size={12} strokeWidth={2.5} aria-hidden="true" />Réclamé</span>
          : <span className={`${PILL} border-amber-400/50 bg-black/30 text-amber-300 shadow-[inset_0_0_10px_rgba(251,191,36,0.12)]`}><span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_currentColor]" />En cours</span>)}
        {!ready && <span className="ml-auto hidden shrink-0 text-[10px] text-zinc-500 sm:block">{claimed ? `+${reward} pièces` : total === 0 ? "Aucune carte éligible" : `${missing} carte${missing > 1 ? "s" : ""} restante${missing > 1 ? "s" : ""}`}</span>}
        {!ready && compact && <span aria-label={`Récompense : ${reward} pièces`} className="ml-auto flex shrink-0 items-center gap-1 sm:hidden">
          <Coins size={12} strokeWidth={1.7} aria-hidden="true" className="text-amber-400" />
          <strong className="font-display text-xs font-bold text-amber-300">{reward}</strong>
        </span>}
      </div>

      {ready && <div className="mt-2.5 flex items-center gap-3 lg:mt-2">
        <span className={`items-baseline gap-1.5 ${compact ? "hidden max-sm:flex" : "hidden"}`}>
          <Coins size={15} strokeWidth={1.6} aria-hidden="true" className="self-center text-amber-400" />
          <strong className="font-display text-sm font-bold text-amber-300">{reward}</strong>
          <span className="font-display text-[8px] font-bold uppercase tracking-[0.12em] text-amber-400/70">pièces</span>
        </span>
        <ActionForm action={claimCollectorChallenge} submitLabel={<><Star size={14} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />Réclamer</>} submitClassName={`${CTA} lg:h-8 lg:w-auto lg:gap-1.5 lg:px-4 lg:text-[11px] ${compact ? CTA_COMPACT : ""}`} variant="none" className="contents">
          <input type="hidden" name="challenge" value={challengeKey} />
        </ActionForm>
      </div>}
    </div>

    <div className={`flex w-[64px] shrink-0 flex-col items-center justify-center gap-0.5 border-l sm:w-[84px] lg:w-[72px] ${compact ? "max-sm:hidden" : ""} ${claimed ? "border-emerald-400/20 bg-gradient-to-b from-emerald-400/10 to-emerald-400/[0.02]" : ready ? "border-amber-400/35 bg-gradient-to-b from-amber-400/20 to-amber-400/5" : "border-amber-400/15 bg-gradient-to-b from-amber-400/10 to-amber-400/[0.02]"}`}>
      {claimed
        ? <Check size={20} strokeWidth={2} aria-hidden="true" className="text-emerald-300" />
        : <Coins size={20} strokeWidth={1.6} aria-hidden="true" className="text-amber-400" />}
      <span className={`font-display text-[17px] font-bold leading-none lg:text-[15px] ${claimed ? "text-emerald-300" : "text-amber-300"}`}>{reward}</span>
      <span className={`font-display text-[8px] font-bold uppercase tracking-[0.14em] ${claimed ? "text-emerald-400/70" : "text-amber-400/70"}`}>pièces</span>
    </div>
  </article>;
}
