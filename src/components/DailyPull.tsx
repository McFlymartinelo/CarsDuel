"use client";

import { useActionState, useEffect, useState } from "react";
import { CardDraw } from "@/components/CardDraw";
import type { ActionState, DrawnCard } from "@/lib/types";

type PullState = ActionState<{ cards: DrawnCard[] }>;
type PullAction = (prev: PullState, fd: FormData) => Promise<PullState>;

function PullCard({
  title,
  description,
  claimed,
  claimedText,
  drawTitle,
  action,
  variant,
}: {
  title: string;
  description: string;
  claimed: boolean;
  claimedText: string;
  drawTitle: string;
  action: PullAction;
  variant: "primary" | "ghost";
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [open, setOpen] = useState(false);
  const cards = state?.ok ? state.data?.cards ?? [] : [];

  useEffect(() => {
    if (state?.ok && (state.data?.cards.length ?? 0) > 0) setOpen(true);
  }, [state]);

  return (
    <form action={formAction} className="rounded-xl border border-zinc-800 bg-[#0e1117] p-4">
      <h3 className="font-semibold">{title}</h3>
      {claimed ? (
        <p className="mt-2 text-sm text-zinc-400">{claimedText}</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-zinc-400">{description}</p>
          <button
            disabled={pending}
            className={`min-h-11 rounded-lg px-4 py-1.5 text-sm font-medium disabled:opacity-50 ${
              variant === "primary"
                ? "bg-amber-500 text-black hover:bg-amber-400"
                : "border border-zinc-600 text-zinc-200 hover:bg-zinc-800"
            }`}
          >
            {pending ? "Tirage…" : "Tirer"}
          </button>
        </>
      )}
      {state && !state.ok && <p className="mt-2 text-sm text-red-400">{state.message}</p>}
      {open && cards.length > 0 && <CardDraw cards={cards} title={drawTitle} onClose={() => setOpen(false)} />}
    </form>
  );
}

export function DailyPull({
  dailyClaimed,
  weeklyClaimed,
  dailyAction,
  weeklyAction,
}: {
  dailyClaimed: boolean;
  weeklyClaimed: boolean;
  dailyAction: PullAction;
  weeklyAction: PullAction;
}) {
  return (
    <section id="tirage" className="scroll-mt-28 space-y-3">
      <h2 className="font-display text-2xl font-bold uppercase">Tirages gratuits</h2>
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-1">
        <PullCard
          title="Quotidien"
          description="3 cartes bonus tirées au sort."
          claimed={dailyClaimed}
          claimedText="Déjà effectué aujourd'hui. Prochain tirage à minuit (heure de Paris)."
          drawTitle="Tirage quotidien"
          action={dailyAction}
          variant="primary"
        />
        <PullCard
          title="Hebdomadaire"
          description="Un moteur ou une boîte (raretés 70 / 20 / 7 / 2,5 / 0,5 %)."
          claimed={weeklyClaimed}
          claimedText="Déjà effectué cette semaine. Prochain tirage lundi (heure de Paris)."
          drawTitle="Tirage hebdomadaire"
          action={weeklyAction}
          variant="ghost"
        />
      </div>
    </section>
  );
}
