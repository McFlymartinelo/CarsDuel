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

function Back() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-2xl border-2 border-amber-500/80 bg-gradient-to-b from-[#1a1408] to-[#0b0d12]">
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

  useEffect(() => {
    setReduce(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (reduce || done) return;
    setFaceUp(false);
    const flip = window.setTimeout(() => setFaceUp(true), 280);
    const next = window.setTimeout(() => setIndex((n) => n + 1), 1600);
    return () => {
      window.clearTimeout(flip);
      window.clearTimeout(next);
    };
  }, [index, reduce, done]);

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
                <Back />
              </span>
              <span className="card-face card-face-front absolute inset-0">
                <Face card={card} />
              </span>
            </span>
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
