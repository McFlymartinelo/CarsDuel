"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { ChallengeScrollList } from "@/components/ChallengeScrollList";

/** Panneau de défis : repliable sur téléphone, toujours ouvert dès `sm`. */
export function CollectorAccordion({ icon, title, subtitle, summary, children }: {
  icon: ReactNode; title: string; subtitle: string; summary: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex w-full items-center gap-3 text-left sm:pointer-events-none sm:cursor-default">
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block font-display text-xl font-bold uppercase tracking-wide text-zinc-100">{title}</span>
        <span className="mt-0.5 block text-xs text-zinc-400">{subtitle}</span>
      </span>
      <span className="flex shrink-0 flex-col items-center gap-1 pr-1 sm:hidden">
        <span className="font-display text-xs font-bold text-amber-400">{summary}</span>
        <ChevronDown size={18} aria-hidden="true" className={`text-zinc-300 transition-transform ${open ? "rotate-180" : ""}`} />
      </span>
      <span className="hidden shrink-0 items-baseline gap-1.5 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] px-3 py-1.5 font-display text-sm font-bold tabular-nums text-amber-300 sm:flex" title="Défis complétés">
        {summary}<span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-400/60">défis</span>
      </span>
    </button>
    <ChallengeScrollList open={open}>{children}</ChallengeScrollList>
  </>;
}
