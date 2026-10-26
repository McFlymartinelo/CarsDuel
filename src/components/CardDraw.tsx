"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { CATEGORY_LABEL, RARITY_LABEL, TIRE_LABEL, TIRE_THEME } from "@/lib/format";
import type { DrawnCard } from "@/lib/types";

const RARITY_FRAME: Record<string, string> = {
  commune: "border-zinc-300/70",
  rare: "border-blue-400/80",
  tres_rare: "border-cyan-400/80",
  epique: "border-purple-400/80",
  legendaire: "border-orange-400/90",
};

// Mise en scène par rareté : couleur de l'aura, attente avant le retournement, durée d'affichage, étincelles.
interface Fx {
  color: string;
  flipAt: number;
  dwell: number;
  sparks: number;
  shake: boolean;
}
const FX: Record<string, Fx> = {
  commune: { color: "#d4d4d8", flipAt: 280, dwell: 1300, sparks: 0, shake: false },
  rare: { color: "#60a5fa", flipAt: 650, dwell: 1500, sparks: 0, shake: false },
  tres_rare: { color: "#22d3ee", flipAt: 800, dwell: 1700, sparks: 8, shake: false },
  epique: { color: "#c084fc", flipAt: 950, dwell: 2000, sparks: 12, shake: false },
  legendaire: { color: "#fb923c", flipAt: 1200, dwell: 2600, sparks: 18, shake: true },
};
const FX_NONE: Fx = { color: "#a1a1aa", flipAt: 280, dwell: 1300, sparks: 0, shake: false };
const fxOf = (c: DrawnCard | undefined): Fx => (c?.rarity ? FX[c.rarity] : undefined) ?? FX_NONE;

function Sparks({ fx }: { fx: Fx }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span className="draw-burst absolute h-48 w-48 rounded-full border-2" style={{ borderColor: fx.color }} />
      {Array.from({ length: fx.sparks }, (_, i) => {
        const angle = (i / fx.sparks) * Math.PI * 2;
        const dist = 150 + (i % 3) * 30;
        return (
          <span
            key={i}
            className="draw-spark absolute h-2 w-2 rounded-full"
            style={{
              background: fx.color,
              boxShadow: `0 0 8px ${fx.color}`,
              ["--dx" as string]: `${Math.cos(angle) * dist}px`,
              ["--dy" as string]: `${Math.sin(angle) * dist}px`,
            }}
          />
        );
      })}
    </span>
  );
}

function Face({ card }: { card: DrawnCard }) {
  const tire = card.category === "pneus" ? TIRE_THEME[card.tireType ?? ""] : undefined;
  const frame = tire?.frame ?? RARITY_FRAME[card.rarity ?? ""] ?? "border-zinc-500/70";
  const badge = card.rarity ? RARITY_LABEL[card.rarity] : card.tireType ? (TIRE_LABEL[card.tireType] ?? card.tireType) : null;
  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-2xl border-2 bg-[#0b0d12] p-4 ${frame}`}>
      <p className="font-display text-xs font-semibold uppercase tracking-wider text-zinc-400">{CATEGORY_LABEL[card.category]}</p>
      {card.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.image} alt="" className="mx-auto my-4 h-40 w-full object-contain mix-blend-lighten" />
      ) : (
        <div className="my-4 h-40" />
      )}
      <h3 className="font-display text-2xl font-bold uppercase leading-tight text-white">{card.name}</h3>
      {badge && <p className={`mt-auto pt-4 font-display text-lg font-semibold uppercase ${tire?.accent ?? "text-amber-300"}`}>{badge}</p>}
    </div>
  );
}

function Back({ fx }: { fx: Fx }) {
  const hint = fx !== FX.commune && fx !== FX_NONE;
  return (
    <div
      className={`flex h-full flex-col items-center justify-center rounded-2xl border-2 border-amber-500/80 bg-gradient-to-b from-[#1a1408] to-[#0b0d12] ${hint ? "draw-aura" : ""} ${fx.shake ? "draw-shake" : ""}`}
      style={{ ["--aura" as string]: fx.color }}
    >
      <p className="font-display text-4xl font-bold uppercase leading-none tracking-wide text-amber-400">
        Cars<br />
        <span className="text-zinc-400">Duel</span>
      </p>
    </div>
  );
}

export function DrawProgress({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Choix", "Rareté", "Carte"];
  return (
    <div className="mx-auto grid w-full max-w-lg grid-cols-[1fr_auto_1fr_auto_1fr] items-center">
      {labels.map((label, i) => {
        const number = i + 1;
        const active = number === step;
        const complete = number < step;
        return (
          <Fragment key={label}>
            <div className="flex min-w-0 flex-col items-center gap-1.5">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full border-2 font-display text-base font-bold ${active ? "border-amber-400 bg-amber-400 text-black shadow-[0_0_18px_rgba(245,158,11,0.55)]" : complete ? "border-amber-500/70 bg-amber-500/15 text-amber-300" : "border-zinc-600 bg-[#090b10] text-zinc-500"}`}>
                {complete ? "✓" : number}
              </span>
              <span className={`whitespace-nowrap font-display text-xs font-bold uppercase tracking-wide sm:text-sm ${active ? "text-amber-300" : complete ? "text-zinc-300" : "text-zinc-500"}`}>
                {number}. {label}
              </span>
            </div>
            {number < labels.length && <span aria-hidden className={`mb-5 h-0.5 w-8 sm:w-16 ${number < step ? "bg-amber-500" : "bg-zinc-700"}`} />}
          </Fragment>
        );
      })}
    </div>
  );
}

/** Tirage carte par carte. Un clic avance. Mouvement réduit : toutes les cartes d'un coup. */
export function CardDraw({
  cards,
  title,
  onClose,
  weekly = false,
}: {
  cards: DrawnCard[];
  title: string;
  onClose: () => void;
  weekly?: boolean;
}) {
  const [reduce, setReduce] = useState(false);
  const [index, setIndex] = useState(0);
  const [faceUp, setFaceUp] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const advanceTimer = useRef<number | null>(null);
  const done = index >= cards.length;
  const card = cards[index];
  const fx = fxOf(card);

  useEffect(() => {
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => () => {
    if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current);
  }, []);

  function advance() {
    if (advanceTimer.current !== null) return;
    setFaceUp(false);
    setAdvancing(true);
    advanceTimer.current = window.setTimeout(() => {
      advanceTimer.current = null;
      setIndex((n) => n + 1);
      setAdvancing(false);
    }, 700);
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-[#030507]/80 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal aria-label={title}>
      <div className="draw-modal relative my-auto flex max-h-[94dvh] w-full max-w-4xl flex-col items-center gap-4 overflow-y-auto rounded-3xl border border-amber-500/35 p-4 shadow-[0_24px_100px_rgba(0,0,0,0.8)] sm:gap-5 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
        <header className="relative flex w-full items-center justify-center">
          <p className="font-display text-center text-lg font-bold uppercase tracking-[0.12em] text-white sm:text-2xl">
            {weekly ? <>Tirage <span className="text-amber-400">hebdomadaire</span></> : title}
          </p>
        </header>
        {weekly && <DrawProgress step={3} />}
        {reduce || done ? (
          <div className="grid max-h-[58dvh] w-full grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
            {cards.map((c) => (
              <div key={c.id} className="min-h-72">
                <Face card={c} />
              </div>
            ))}
          </div>
        ) : (
          <div className="relative flex min-h-0 flex-col items-center justify-center">
            <div className="draw-platform pointer-events-none absolute bottom-0 left-1/2 h-16 w-[140%] -translate-x-1/2" />
            <div className="card-scene draw-card-glow relative z-10 h-[min(52dvh,27rem)] w-64 max-w-full rounded-2xl" style={{ ["--rarity-glow" as string]: fx.color }}>
            <span className="sr-only">{card.name}</span>
            <span className={`card-flip absolute inset-0 ${faceUp ? "is-flipped" : ""}`}>
              <span className="card-face absolute inset-0">
                <Back fx={fx} />
              </span>
              <span className="card-face card-face-front absolute inset-0">
                <Face card={card} />
              </span>
            </span>
            {faceUp && fx.sparks > 0 && <Sparks key={index} fx={fx} />}
            </div>
            {faceUp && card.rarity && <p className="draw-rarity-text relative z-10 mt-2 font-display text-xl font-bold uppercase tracking-[0.2em]" style={{ ["--rarity-glow" as string]: fx.color }}>{RARITY_LABEL[card.rarity]}</p>}
          </div>
        )}
        <div className="flex w-full flex-wrap items-center justify-center gap-3 border-t border-white/10 pt-4">
          {!done && !reduce && (
            <p className="text-sm text-zinc-400">
              {index + 1} / {cards.length}
            </p>
          )}
          {!done && !reduce && <button
            type="button"
            onClick={() => faceUp ? advance() : setFaceUp(true)}
            disabled={advancing}
            className="min-h-12 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 px-6 font-display text-lg font-bold uppercase text-black shadow-[0_6px_24px_rgba(245,158,11,0.25)] transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70"
          >
            {advancing ? "…" : faceUp ? (index + 1 < cards.length ? "Suivante" : "Terminer") : "Révéler"}
          </button>}
          <button type="button" onClick={onClose}
            className="min-h-12 rounded-xl border border-zinc-600 bg-[#11141a]/80 px-5 font-display text-base font-bold uppercase text-zinc-200 transition hover:border-zinc-400 hover:bg-zinc-800"
          >
            {done || reduce ? "Fermer" : "Passer le tirage"}
          </button>
        </div>
      </div>
    </div>
  );
}
