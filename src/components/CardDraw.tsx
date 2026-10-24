"use client";

import { useEffect, useState } from "react";
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
  const badge = card.rarity ? RARITY_LABEL[card.rarity] : card.tireType ? (TIRE_LABEL[card.tireType] ?? card.tireType) : "Consommable";
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
      <p className={`mt-auto pt-4 font-display text-lg font-semibold uppercase ${tire?.accent ?? "text-amber-300"}`}>{badge}</p>
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

/** Tirage carte par carte. Un clic avance. Mouvement réduit : toutes les cartes d'un coup. */
export function CardDraw({
  cards,
  title,
  onClose,
}: {
  cards: DrawnCard[];
  title: string;
  onClose: () => void;
}) {
  const [reduce, setReduce] = useState(false);
  const [index, setIndex] = useState(0);
  const [faceUp, setFaceUp] = useState(false);
  const done = index >= cards.length;
  const card = cards[index];
  const fx = fxOf(card);

  useEffect(() => {
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reduce || done) return;
    setFaceUp(false);
    const flip = window.setTimeout(() => setFaceUp(true), fx.flipAt);
    const next = window.setTimeout(() => setIndex((n) => n + 1), fx.flipAt + fx.dwell);
    return () => {
      window.clearTimeout(flip);
      window.clearTimeout(next);
    };
  }, [index, reduce, done, fx]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal aria-label={title}>
      <div className="flex w-full max-w-3xl flex-col items-center gap-4">
        <p className="font-display text-sm font-semibold uppercase tracking-widest text-amber-400">{title}</p>
        {reduce || done ? (
          <div className="grid max-h-[70vh] w-full grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
            {cards.map((c) => (
              <div key={c.id} className="min-h-72">
                <Face card={c} />
              </div>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIndex((n) => n + 1)}
            className="card-scene relative h-[28rem] w-72 max-w-full"
            aria-label="Carte suivante"
          >
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
          </button>
        )}
        <div className="flex items-center gap-3">
          {!done && !reduce && (
            <p className="text-sm text-zinc-400">
              {index + 1} / {cards.length}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg bg-amber-500 px-5 font-display text-lg font-bold uppercase text-black hover:bg-amber-400"
          >
            {done || reduce ? "Fermer" : "Passer"}
          </button>
        </div>
      </div>
    </div>
  );
}
