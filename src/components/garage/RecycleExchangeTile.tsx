"use client";

import { useActionState, useEffect, useState } from "react";
import { Cog, Settings2 } from "lucide-react";
import { CardDraw } from "@/components/CardDraw";
import { RECYCLE_EXCHANGE_COST } from "@/lib/recycle";
import type { ActionState, DrawnCard } from "@/lib/types";

type ExchangeState = ActionState<{ cards: DrawnCard[] }>;
type ExchangeAction = (prev: ExchangeState, fd: FormData) => Promise<ExchangeState>;

export function RecycleExchangeTile({
  category,
  cubes,
  action,
}: {
  category: "moteur" | "boite";
  cubes: number;
  action: ExchangeAction;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  const [open, setOpen] = useState(false);
  const cards = state?.ok ? (state.data?.cards ?? []) : [];
  const revealedId = cards[0]?.id;
  const missing = Math.max(0, RECYCLE_EXCHANGE_COST - cubes);
  const disabled = pending || missing > 0;
  const isEngine = category === "moteur";
  const Icon = isEngine ? Cog : Settings2;

  useEffect(() => {
    if (revealedId) setOpen(true);
  }, [revealedId]);

  return (
    <>
      <form
        action={formAction}
        className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-b from-[#141821] to-[#0b0d12]"
      >
        <input type="hidden" name="category" value={category} />

        <div className={`flex items-center gap-3 border-b border-zinc-800 p-4 ${isEngine ? "bg-orange-500/5" : "bg-sky-500/5"}`}>
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${isEngine ? "border-orange-500/40 bg-orange-500/10 text-orange-300" : "border-sky-500/40 bg-sky-500/10 text-sky-300"}`}>
            <Icon size={26} strokeWidth={1.7} />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-lg font-bold uppercase leading-tight text-white">
              Tirage {isEngine ? "Moteur" : "Boîte"} reconditionné{isEngine ? "" : "e"}
            </h3>
            <p className="text-xs text-zinc-400">1 carte {isEngine ? "Moteur" : "Boîte de vitesses"}, garantie sans run.</p>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-zinc-400">Coût de l&apos;échange</span>
            <span className="font-display text-2xl font-bold tabular-nums text-orange-300">{RECYCLE_EXCHANGE_COST} cubes</span>
          </div>
          <p className="text-sm leading-relaxed text-zinc-300">
            L&apos;atelier reconditionne une pièce au hasard dans la catégorie choisie. La carte arrive neuve dans votre
            inventaire, avec 0 run au compteur.
          </p>

          {state && !state.ok && <p className="text-sm text-red-400">{state.message}</p>}
          {state?.ok && <p className="text-sm text-emerald-400">{state.message}</p>}

          <div className="mt-auto space-y-2">
            <button
              type="submit"
              disabled={disabled}
              className="min-h-11 w-full rounded-lg bg-amber-500 px-4 text-sm font-bold uppercase tracking-wide text-black transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {pending ? "Échange…" : `Échanger (${RECYCLE_EXCHANGE_COST} cubes)`}
            </button>
            {missing > 0 && (
              <p className="text-center text-xs text-zinc-500">
                Il vous manque {missing.toLocaleString("fr-FR")} cube{missing === 1 ? "" : "s"} de ferraille.
              </p>
            )}
          </div>
        </div>
      </form>

      {open && cards.length > 0 && (
        <CardDraw
          cards={cards}
          title={isEngine ? "Moteur reconditionné" : "Boîte reconditionnée"}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
