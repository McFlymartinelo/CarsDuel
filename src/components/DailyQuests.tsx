"use client";

import { useActionState, useState } from "react";
import Image from "next/image";
import { Bolt, ChevronRight } from "lucide-react";
import { tileClass, TileBody } from "@/components/ActionTile";
import { Modal } from "@/components/Modal";
import { Button, buttonClass } from "@/components/ui/Button";
import { panelClass } from "@/components/ui/Panel";
import { claimQuest } from "@/app/(game)/quests";
import { QUEST_COPY, questDone, type DailyQuestState } from "@/lib/quests";
import type { ActionState } from "@/lib/types";

function Claim({ quest }: { quest: string }) {
  const [state, formAction, pending] = useActionState(claimQuest, null as ActionState<{ coins: number }>);
  if (state?.ok) return <p className="text-sm font-semibold text-emerald-400">+5 pièces</p>;
  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="quest" value={quest} />
      <Button type="submit" size="sm" className="text-sm" disabled={pending}>
        {pending ? "Récupération…" : "Récupérer mes 5 pièces"}
      </Button>
      {state && !state.ok && <p className="text-xs text-red-400">{state.message}</p>}
    </form>
  );
}

function QuestLine({ id, progress, claimed }: { id: string; progress: Record<string, number>; claimed: string[] }) {
  const copy = QUEST_COPY[id];
  if (!copy) return null;
  const done = questDone(id, progress);
  const got = claimed.includes(id);
  return (
    <li className={panelClass({ className: "p-3" })}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display font-bold uppercase">{copy.title}</p>
          <p className="text-sm text-zinc-400">{copy.detail}</p>
        </div>
        <span className={`shrink-0 text-xs font-semibold uppercase ${got ? "text-emerald-400" : done ? "text-amber-300" : "text-zinc-500"}`}>
          {got ? "Récupéré" : done ? "Terminé" : "En cours"}
        </span>
      </div>
      {done && !got && <div className="mt-2"><Claim quest={id} /></div>}
    </li>
  );
}

export function DailyQuests({
  state,
  layout = "tile",
}: {
  state: DailyQuestState | null;
  layout?: "tile" | "row" | "hero";
}) {
  const [open, setOpen] = useState(false);
  const ids = state ? ["pointage", state.second, state.third] : [];
  const done = state ? ids.filter((id) => questDone(id, state.progress)).length : 0;
  const claimable = state
    ? ids.filter((id) => questDone(id, state.progress) && !state.claimed.includes(id)).length
    : 0;

  return (
    <>
      {layout === "hero" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative flex min-h-56 w-full flex-col justify-end overflow-hidden rounded-2xl border border-amber-500/25 bg-panel p-4 text-left transition hover:border-amber-400/60"
        >
          <Image
            src="/duel/defis.webp"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 45vw, 100vw"
            className="object-cover object-right opacity-25 transition group-hover:opacity-35 [mask-image:linear-gradient(to_left,#000_15%,transparent_85%)]"
          />
          <span aria-hidden className="absolute inset-0 bg-gradient-to-r from-panel via-panel/75 to-transparent" />
          <span className="relative z-10 flex flex-col items-start gap-2">
            <span className="flex items-center gap-2 font-display text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
              <Bolt size={14} aria-hidden /> Mode quotidien
            </span>
            <span className="font-display text-2xl font-bold uppercase leading-none text-white">Défis quotidiens</span>
            <span className="max-w-sm text-xs leading-relaxed text-zinc-400">
              Trois défis renouvelés chaque jour. Chaque défi rapporte 5 pièces.
            </span>
            <span className="flex w-full max-w-xs items-center justify-between gap-3 text-[10px] text-zinc-400">
              <span>
                {claimable > 0
                  ? `${claimable} récompense${claimable > 1 ? "s" : ""} à récupérer`
                  : state
                    ? "3 défis par jour · 5 pièces chacun"
                    : "Défis indisponibles"}
              </span>
              <span className="font-semibold tabular-nums text-zinc-500">{done}/3</span>
            </span>
            <span className="block h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-white/[0.06]">
              <span
                className={`block h-full rounded-full ${claimable > 0 ? "bg-emerald-400" : "bg-amber-500"}`}
                style={{ width: `${(done / 3) * 100}%` }}
              />
            </span>
            <span className={buttonClass({ size: "md", className: "mt-1" })}>Voir mes défis</span>
          </span>
        </button>
      ) : layout === "row" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-2xl border border-line bg-panel p-4 text-left transition hover:border-zinc-700"
        >
          <span className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300">
              <Bolt size={18} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="font-display text-lg font-bold uppercase leading-tight">Défis quotidiens</span>
                <span className="text-[10px] font-semibold tabular-nums text-zinc-500">{done}/3</span>
              </span>
              <span className="mt-0.5 block text-xs text-zinc-400">
                {claimable > 0
                  ? `${claimable} récompense${claimable > 1 ? "s" : ""} à récupérer`
                  : "3 défis par jour · 5 pièces chacun"}
              </span>
              <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <span
                  className={`block h-full rounded-full ${claimable > 0 ? "bg-emerald-400" : "bg-amber-500"}`}
                  style={{ width: `${(done / 3) * 100}%` }}
                />
              </span>
            </span>
            <ChevronRight size={16} className="mt-1 shrink-0 text-zinc-600" />
          </span>
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className={tileClass()}>
          <TileBody title="Défis quotidiens" text="3 défis par jour · 5 pièces chacun" image="/duel/defis.webp" />
        </button>
      )}
      {open && (
        <Modal labelledBy="quests-title" wide onClose={() => setOpen(false)}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 id="quests-title" className="font-display text-2xl font-bold uppercase">Défis quotidiens</h3>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800">Fermer</button>
          </div>
          <p className="mb-3 text-sm text-zinc-400">Trois défis, renouvelés à minuit (heure de Paris). Chacun rapporte 5 pièces.</p>
          {!state && <p className="text-sm text-zinc-500">Les défis ne sont pas disponibles pour le moment.</p>}
          {state && (
            <ul className="space-y-2">
              {ids.map((id) => <QuestLine key={id} id={id} progress={state.progress} claimed={state.claimed} />)}
            </ul>
          )}
        </Modal>
      )}
    </>
  );
}
