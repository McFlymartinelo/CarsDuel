"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ArrowUpDown, ChevronDown, SlidersHorizontal, X, type LucideIcon } from "lucide-react";
import type { Rarity } from "@/lib/types";

/** Teinte de chaque rareté, reprise des cartes, pour retrouver le code couleur du jeu. */
export const RARITY_TONE: Record<Rarity, { dot: string; on: string }> = {
  commune: { dot: "bg-zinc-400", on: "border-zinc-400/60 bg-zinc-400/10 text-zinc-100" },
  rare: { dot: "bg-blue-400", on: "border-blue-400/60 bg-blue-400/10 text-blue-100" },
  tres_rare: { dot: "bg-cyan-400", on: "border-cyan-400/60 bg-cyan-400/10 text-cyan-100" },
  epique: { dot: "bg-purple-400", on: "border-purple-400/60 bg-purple-400/10 text-purple-100" },
  legendaire: { dot: "bg-amber-400", on: "border-amber-400/60 bg-amber-400/10 text-amber-100" },
};

export const FILTER_RESET_CLASS = "inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 text-[11px] font-semibold text-zinc-300 transition active:bg-white/10";
export const FILTER_CHIPS_CLASS = "mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
export const FILTER_BODY_CLASS = "min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 pb-5";
export const FILTER_FOOTER_CLASS = "border-t border-white/[0.08] bg-[#0a0d12]/85 px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-3";
export const FILTER_SUBMIT_CLASS = "group inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-400 px-5 font-display text-base font-bold uppercase tracking-wide text-black shadow-[0_12px_30px_-12px_rgba(245,158,11,0.9)] transition active:scale-[0.99]";

export const FILTER_TYPE_TILE = "flex min-h-13 items-center gap-2.5 overflow-hidden rounded-xl border px-3 transition active:scale-[0.98]";
export const FILTER_TYPE_ON = "border-amber-400 bg-gradient-to-br from-amber-400 to-amber-500 text-black shadow-[0_8px_22px_-10px_rgba(245,158,11,0.9)]";
export const FILTER_TYPE_OFF = "border-white/[0.07] bg-gradient-to-b from-[#1a1e27] to-[#12151c] text-zinc-200";
export const FILTER_COUNT_ON = "bg-black/15 text-black/70";
export const FILTER_COUNT_OFF = "bg-white/[0.05] text-zinc-500";

export const FILTER_RARITY_TILE = "flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm transition active:scale-[0.98]";
export const FILTER_RARITY_OFF = "border-white/[0.07] bg-[#151922] text-zinc-300";
export const FILTER_RARITY_ON = "border-amber-400/60 bg-amber-400/10 font-semibold text-amber-100";

export function FilterSectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="h-3 w-1 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]" />
      <h3 className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">{children}</h3>
      <span className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
      {hint && <span className="text-[10px] font-medium tabular-nums text-zinc-500">{hint}</span>}
    </div>
  );
}

/** Barre repliée : bouton « Filtres » + sélecteur de tri. */
export function FilterTrigger({
  activeCount,
  open,
  onOpen,
  sorts,
  sort,
  onSortChange,
}: {
  activeCount: number;
  open: boolean;
  onOpen: () => void;
  sorts: readonly { key: string; label: string }[];
  sort: string;
  onSortChange: (key: string | null) => void;
}) {
  return (
    <div className="flex items-stretch gap-1.5 rounded-2xl border border-white/[0.07] bg-[#0f1218] p-1.5 shadow-[0_14px_34px_-24px_rgba(0,0,0,0.9)]">
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 px-3.5 text-sm font-semibold text-black shadow-[0_6px_18px_-8px_rgba(245,158,11,0.95)] transition active:scale-[0.98]"
      >
        <SlidersHorizontal size={16} strokeWidth={2.25} />
        Filtres
        {activeCount > 0 && (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-black/20 px-1 text-[11px] font-bold tabular-nums">{activeCount}</span>
        )}
      </button>
      <div className="relative flex min-w-0 flex-1 items-center">
        <ArrowUpDown size={14} strokeWidth={2} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
        <ChevronDown size={14} strokeWidth={2.25} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500" />
        <select
          aria-label="Trier les résultats"
          value={sort}
          onChange={(event) => onSortChange(event.target.value || null)}
          className="!h-11 !w-full appearance-none truncate rounded-xl border border-white/[0.06] !bg-[#0a0d12] !py-0 !pl-9 !pr-8 text-zinc-200"
        >
          <option value="">Par défaut</option>
          {sorts.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
        </select>
      </div>
    </div>
  );
}

/** Puce d'un filtre actif, cliquable pour le retirer. */
export function FilterChip({
  label,
  icon: Icon,
  dot,
  href,
  onClick,
}: {
  label: string;
  icon?: LucideIcon;
  dot?: string;
  href?: string;
  onClick?: () => void;
}) {
  const content = (
    <>
      {Icon ? <Icon size={12} strokeWidth={2.25} className="text-amber-300/90" /> : dot ? <span className={`h-1.5 w-1.5 rounded-full ${dot}`} /> : null}
      {label}
      <span className="grid h-5 w-5 place-items-center rounded-full bg-white/[0.06] text-amber-300/80">
        <X size={11} strokeWidth={2.5} />
      </span>
    </>
  );
  const className = "inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/[0.08] py-1 pl-2.5 pr-1.5 text-[11px] font-medium text-amber-200 transition active:bg-amber-400/15";
  const ariaLabel = `Retirer le filtre ${label}`;

  if (href) {
    return <Link href={href} scroll={false} aria-label={ariaLabel} className={className}>{content}</Link>;
  }
  return <button type="button" onClick={onClick} aria-label={ariaLabel} className={className}>{content}</button>;
}

/** Feuille mobile commune : portail, fond, poignée, en-tête et fermeture au clavier. */
export function FilterSheet({
  open,
  onClose,
  labelId,
  activeCount,
  reset,
  children,
}: {
  open: boolean;
  onClose: () => void;
  labelId: string;
  activeCount: number;
  reset: ReactNode;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startY: number; startTime: number } | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => setMounted(true), []);

  // Réinitialise le glissement à chaque fermeture pour rouvrir la feuille bien en place.
  useEffect(() => {
    if (open) return;
    dragRef.current = null;
    setDragging(false);
    setDragY(0);
  }, [open]);

  /** Poignée : on suit le doigt, puis on ferme au-delà du seuil ou on revient en place. */
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragRef.current = { startY: event.clientY, startTime: event.timeStamp };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    setDragY(Math.max(0, event.clientY - dragRef.current.startY));
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    if (!start) return;
    dragRef.current = null;
    const elapsed = Math.max(event.timeStamp - start.startTime, 1);
    const flicked = dragY > 32 && dragY / elapsed > 0.6;
    if (dragY > 96 || flicked) {
      closeRef.current();
      return;
    }
    setDragging(false);
    requestAnimationFrame(() => setDragY(0));
  };

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end">
      <button
        type="button"
        onClick={() => closeRef.current()}
        aria-label="Fermer les filtres"
        style={dragY > 0 ? { opacity: Math.max(0.35, 1 - dragY / 480) } : undefined}
        className="filter-backdrop-in absolute inset-0 bg-black/75 backdrop-blur-[2px] transition-opacity duration-200"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        style={dragging || dragY > 0 ? { transform: `translateY(${dragY}px)`, transition: dragging ? "none" : undefined } : undefined}
        className="filter-sheet filter-sheet-in relative z-10 flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border border-b-0 border-white/10 shadow-[0_-24px_70px_-24px_rgba(0,0,0,0.95)] transition-transform duration-200 ease-out"
      >
        <div
          aria-hidden="true"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="group flex h-7 shrink-0 touch-none select-none items-center justify-center"
        >
          <span className="h-1.5 w-12 rounded-full bg-zinc-700 transition-colors group-active:bg-amber-400/70" />
        </div>
        <header className="flex items-center justify-between gap-2 px-4 pb-3 pt-1">
          <div className="min-w-0">
            <p className="font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-400/70">Affiner</p>
            <div className="mt-0.5 flex items-center gap-2">
              <h2 id={labelId} className="font-display text-2xl font-bold uppercase leading-none tracking-wide">Filtres</h2>
              {activeCount > 0 && (
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-semibold text-amber-300">
                  {activeCount} actif{activeCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {reset}
            <button
              type="button"
              onClick={() => closeRef.current()}
              aria-label="Fermer les filtres"
              className="grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-zinc-400 transition active:bg-white/10 active:text-white"
            >
              <X size={18} />
            </button>
          </div>
        </header>
        {children}
      </section>
    </div>,
    document.body,
  );
}
