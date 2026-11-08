"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { CardDraw } from "@/components/CardDraw";
import { useDialogA11y } from "@/lib/use-dialog-a11y";
import type { DrawnCard } from "@/lib/types";

export function WelcomeDraw({ cards, username }: { cards: DrawnCard[]; username: string }) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const { setPanel: setDialogPanel, onKeyDown: onDialogKeyDown } = useDialogA11y<HTMLDivElement>({
    open: !started && cards.length > 0,
  });
  if (cards.length === 0) return null;

  if (started) {
    return <CardDraw cards={cards} title="Tirage de bienvenue" onClose={() => router.replace("/garage")} />;
  }

  const count = (category: DrawnCard["category"]) => cards.filter((c) => c.category === category).length;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-[#030507]/85 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-sm"
      role="dialog"
      aria-modal
      aria-labelledby="welcome-title"
    >
      <div
        ref={setDialogPanel}
        tabIndex={-1}
        onKeyDown={onDialogKeyDown}
        className="draw-modal relative my-auto w-full max-w-lg space-y-5 rounded-3xl border border-amber-500/35 p-6 text-center shadow-[0_24px_100px_rgba(0,0,0,0.8)] outline-none sm:p-8"
      >
        <div aria-hidden className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />
        <span
          aria-hidden
          className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-amber-400/40 bg-amber-500/10 text-amber-300"
        >
          <Sparkles size={26} />
        </span>
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-400">Bienvenue dans le paddock</p>
          <h2 id="welcome-title" className="font-display text-3xl font-bold uppercase leading-none text-white">
            {username}
          </h2>
        </div>
        <p className="text-sm text-zinc-300">
          Votre garage est prêt. Le kit de départ vous attend : {count("moteur")} moteurs, {count("boite")} boîtes,{" "}
          {count("bonus")} cartes bonus et {count("pneus")} pneus.
        </p>
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="min-h-12 w-full rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 px-5 font-display text-lg font-bold uppercase text-black shadow-[0_6px_24px_rgba(245,158,11,0.25)] transition hover:brightness-110"
        >
          Réaliser mon tirage de bienvenue
        </button>
        <p className="text-xs text-zinc-500">Vous pourrez ensuite composer votre configuration dans le garage.</p>
      </div>
    </div>
  );
}
