"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CardDraw, DrawProgress } from "@/components/CardDraw";
import { Cog, Settings2 } from "lucide-react";
import { PullCountdown } from "@/components/PullCountdown";
import { TileBody, tileClass } from "@/components/ActionTile";
import type { ActionState, DrawnCard } from "@/lib/types";
import { RARITY_LABEL } from "@/lib/format";

type PullState = ActionState<{ cards: DrawnCard[] }>;
type PullAction = (prev: PullState, fd: FormData) => Promise<PullState>;
const RARITY_GLOW: Record<NonNullable<DrawnCard["rarity"]>, string> = {
  commune: "#d4d4d8",
  rare: "#60a5fa",
  tres_rare: "#22d3ee",
  epique: "#c084fc",
  legendaire: "#fb923c",
};

function PullCard({
  title,
  description,
  claimed,
  claimedText,
  nextAt,
  drawTitle,
  action,
  image,
  weekly = false,
}: {
  title: string;
  description: string;
  claimed: boolean;
  claimedText: string;
  nextAt?: string;
  drawTitle: string;
  action: PullAction;
  image: string;
  weekly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [open, setOpen] = useState(false);
  const [chooseOpen, setChooseOpen] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [category, setCategory] = useState<"moteur" | "boite">("moteur");
  const formRef = useRef<HTMLFormElement>(null);
  const cards = state?.ok ? state.data?.cards ?? [] : [];
  const revealedRarity = cards[0]?.rarity ?? "commune";
  const rarityGlow = RARITY_GLOW[revealedRarity];

  useEffect(() => {
    if (state?.ok && (state.data?.cards.length ?? 0) > 0) {
      if (weekly) setOpen(true);
      else setShowCard(true);
    }
  }, [state, weekly]);

  return (
    <form ref={formRef} action={formAction} className={`${tileClass()} pull-tile`}>
      {weekly && <input type="hidden" name="category" value={category} />}
      <TileBody
        title={title}
        text={description}
        image={image}
        imageFit="contain"
        badge={claimed ? (
          <span className="mt-2 flex flex-col gap-1 text-left text-xs text-zinc-300">
            <span>{claimedText}</span>
            {nextAt && <PullCountdown until={nextAt} />}
          </span>
        ) : (
          <button
            type={weekly ? "button" : "submit"}
            onClick={weekly ? () => setChooseOpen(true) : undefined}
            disabled={pending}
            className="mt-2 min-h-10 rounded-lg border border-amber-400/70 bg-black/75 px-4 py-2 text-sm font-bold uppercase tracking-wide text-amber-200 shadow-[0_0_18px_rgba(255,138,31,0.22)] transition hover:border-amber-300 hover:bg-amber-500/15 disabled:cursor-wait disabled:opacity-50"
          >
            {pending ? "Tirage…" : "Lancer le tirage"}
          </button>
        )}
      />
      {state && !state.ok && <p className="mt-2 text-sm text-red-400">{state.message}</p>}
      {chooseOpen && weekly && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#030507]/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Choisir la carte hebdomadaire">
          <div className="draw-modal w-full max-w-lg space-y-5 rounded-3xl border border-amber-500/35 p-5 shadow-[0_24px_100px_rgba(0,0,0,0.8)] sm:p-7">
            <p className="text-center font-display text-xl font-bold uppercase tracking-wide text-white">Tirage <span className="text-amber-400">hebdomadaire</span></p>
            <DrawProgress step={1} />
            <div className="text-center">
              <h3 className="font-display text-2xl font-bold uppercase">Choisissez votre carte</h3>
              <p className="mt-1 text-sm text-zinc-400">Vous pourrez la découvrir après le tirage de rareté.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(["moteur", "boite"] as const).map((item) => (
                <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)} className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border p-3 font-display text-lg font-bold uppercase transition ${category === item ? "border-amber-400 bg-amber-500/10 text-amber-200 shadow-[0_0_24px_rgba(245,158,11,0.13)]" : "border-zinc-700 bg-black/20 text-zinc-300 hover:border-zinc-500 hover:bg-white/5"}`}>
                  {item === "boite" ? <Settings2 size={28} strokeWidth={1.6} /> : <Cog size={28} strokeWidth={1.6} />}
                  {item === "boite" ? "Boîte" : "Moteur"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4">
              <button type="button" onClick={() => setChooseOpen(false)} className="min-h-12 rounded-xl border border-zinc-600 font-display font-bold uppercase text-zinc-200 transition hover:bg-zinc-800">Annuler</button>
              <button type="button" disabled={pending} onClick={() => { setChooseOpen(false); formRef.current?.requestSubmit(); }} className="min-h-12 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 font-display font-bold uppercase text-black shadow-[0_6px_24px_rgba(245,158,11,0.25)] transition hover:brightness-110 disabled:opacity-50">{pending ? "Tirage…" : "Valider"}</button>
            </div>
          </div>
        </div>
      )}
      {open && weekly && cards[0] && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#030507]/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Révéler la rareté">
          <div className="draw-modal w-full max-w-xl space-y-4 rounded-3xl border border-amber-500/35 p-5 text-center shadow-[0_24px_100px_rgba(0,0,0,0.8)] sm:space-y-5 sm:p-7">
            <p className="font-display text-xl font-bold uppercase tracking-wide text-white">Tirage <span className="text-amber-400">hebdomadaire</span></p>
            <DrawProgress step={2} />
            <div className="flex justify-center py-1 sm:py-2">
              <div className="draw-card-glow flex h-[min(42dvh,23rem)] w-56 flex-col items-center overflow-hidden rounded-2xl border-2 border-[color:var(--rarity-glow)] bg-gradient-to-b from-[#1b1922] via-[#100d15] to-[#08090d] p-4" style={{ ["--rarity-glow" as string]: rarityGlow }}>
                <span className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400">{category === "boite" ? "Boîte" : "Moteur"}</span>
                {cards[0].image ? <img src={cards[0].image} alt="" className="my-auto h-40 w-full object-contain mix-blend-lighten" /> : <span className="my-auto text-amber-400">{category === "boite" ? <Settings2 size={72} /> : <Cog size={72} />}</span>}
                <span className="draw-rarity-text font-display text-xl font-bold uppercase tracking-[0.16em]" style={{ ["--rarity-glow" as string]: rarityGlow }}>{RARITY_LABEL[revealedRarity]}</span>
              </div>
            </div>
            <p className="text-sm text-zinc-300">La rareté est révélée. Découvrez le nom et les détails de votre carte.</p>
            <button type="button" onClick={() => { setOpen(false); setShowCard(true); }} className="min-h-12 w-full rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 px-5 font-display text-lg font-bold uppercase text-black shadow-[0_6px_24px_rgba(245,158,11,0.25)] transition hover:brightness-110">Révéler la carte</button>
          </div>
        </div>
      )}
      {showCard && cards.length > 0 && <CardDraw cards={cards} title={drawTitle} weekly={weekly} onClose={() => setShowCard(false)} />}
    </form>
  );
}

export function DailyPull({
  dailyClaimed,
  weeklyClaimed,
  dailyAction,
  weeklyAction,
  nextDaily,
  nextWeekly,
}: {
  dailyClaimed: boolean;
  weeklyClaimed: boolean;
  dailyAction: PullAction;
  weeklyAction: PullAction;
  nextDaily: string;
  nextWeekly: string;
}) {
  return (
    <section id="tirage" className="scroll-mt-28 space-y-3">
      <h2 className="font-display text-2xl font-bold uppercase">Tirages gratuits</h2>
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
        <PullCard
          title="Quotidien"
          description="3 cartes bonus tirées au sort."
          claimed={dailyClaimed}
          claimedText="Déjà effectué aujourd'hui."
          nextAt={nextDaily}
          drawTitle="Tirage quotidien"
          action={dailyAction}
          image="/pulls/daily-cards.webp"
        />
        <PullCard
          title="Hebdomadaire"
          description="Un moteur ou une boîte (raretés 70 / 20 / 7 / 2,5 / 0,5 %)."
          claimed={weeklyClaimed}
          claimedText="Déjà effectué cette semaine."
          nextAt={nextWeekly}
          drawTitle="Tirage hebdomadaire"
          action={weeklyAction}
          image="/pulls/weekly-engine-gearbox.webp"
          weekly
        />
      </div>
    </section>
  );
}
