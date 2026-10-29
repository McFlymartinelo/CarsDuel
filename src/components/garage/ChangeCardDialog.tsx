"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { CardView, type TirePerf } from "@/components/CardView";
import { Modal } from "@/components/Modal";
import { equipCard } from "@/app/(game)/garage/actions";
import { compareTemplates, ENGINE_SORTS, GEARBOX_SORTS, type CardSort } from "@/lib/catalog-sort";
import type { UserCard } from "@/lib/types";

const SLOT_LABEL = { moteur: "moteur", boite: "boîte", pneus: "pneu", bonus: "bonus" } as const;
const SEGMENT = "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors";

/** Choisir une carte dans une grille, pas dans une liste de texte. */
export function ChangeCardDialog({
  slot,
  alternatives,
  deckId,
  tirePerfs = [],
  onPick,
}: {
  slot: "moteur" | "boite" | "pneus" | "bonus";
  alternatives: (UserCard & { image: string | null })[];
  deckId?: string;
  tirePerfs?: TirePerf[];
  /** Si présent, le choix reste local (bonus de duel) au lieu d'équiper le deck. */
  onPick?: (card: UserCard | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<CardSort | "">("");
  const title = `Choisir ${slot === "boite" || slot === "bonus" ? "une" : "un"} ${SLOT_LABEL[slot]}`;
  const sorts: readonly { key: CardSort; label: string; title: string }[] =
    slot === "moteur" ? ENGINE_SORTS : slot === "boite" ? GEARBOX_SORTS : [];
  const ordered = useMemo(
    () => (sort ? alternatives.slice().sort((a, b) => compareTemplates(a.card_templates, b.card_templates, sort)) : alternatives),
    [alternatives, sort],
  );

  useEffect(() => {
    const handleRequest = (event: Event) => {
      if ((event as CustomEvent<string>).detail === slot) setOpen(true);
    };
    window.addEventListener("carsduel:change-slot", handleRequest);
    return () => window.removeEventListener("carsduel:change-slot", handleRequest);
  }, [slot]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full cursor-pointer rounded border border-white/30 bg-black/40 py-1.5 text-center text-sm font-medium text-zinc-100 hover:bg-white/10"
      >
        Changer
      </button>
      {open && (
        <Modal labelledBy="change-card-title" size="xl" onClose={() => setOpen(false)}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 id="change-card-title" className="font-display text-2xl font-bold uppercase">{title}</h3>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800">
              Fermer
            </button>
          </div>
          {onPick && (
            <button
              type="button"
              onClick={() => { onPick(null); setOpen(false); }}
              className="mb-3 rounded-lg border border-zinc-600 px-3 py-1.5 text-sm hover:bg-zinc-800"
            >
              Aucun bonus
            </button>
          )}
          {sorts.length > 0 && alternatives.length > 1 && (
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="font-display text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Trier</span>
              <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1" role="group" aria-label="Trier les cartes">
                {sorts.map(({ key, label, title }) => {
                  const active = sort === key;
                  const Direction = key === "power" ? ArrowDown : ArrowUp;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={active}
                      title={title}
                      onClick={() => setSort(active ? "" : key)}
                      className={`${SEGMENT} ${active ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}
                    >
                      {label}
                      {key !== "ref" && <Direction size={14} strokeWidth={2.25} className={active ? "text-black/70" : "text-zinc-600"} />}
                    </button>
                  );
                })}
              </div>
              <span className="text-xs tabular-nums text-zinc-500">{alternatives.length} pièce{alternatives.length > 1 ? "s" : ""}</span>
            </div>
          )}
          {alternatives.length === 0 && <p className="text-sm text-zinc-500">Aucune autre carte disponible.</p>}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {ordered.map((alt) => (
              <CardView key={alt.id} template={alt.card_templates} card={alt} image={alt.image} tirePerfs={tirePerfs}>
                {onPick ? (
                  <button
                    type="button"
                    onClick={() => { onPick(alt); setOpen(false); }}
                    className="w-full rounded-lg bg-amber-500 py-2 font-display font-bold uppercase text-black hover:bg-amber-400"
                  >
                    Choisir
                  </button>
                ) : (
                  <ActionForm action={equipCard} submitLabel="Équiper" className="flex" onSuccess={() => setOpen(false)}>
                    <input type="hidden" name="card_id" value={alt.id} />
                    {deckId && <input type="hidden" name="deck_id" value={deckId} />}
                  </ActionForm>
                )}
              </CardView>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
