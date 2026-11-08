"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, PackageOpen } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { CardView, type TirePerf } from "@/components/CardView";
import { Modal } from "@/components/Modal";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SortRow } from "@/components/SortRow";
import { equipCard } from "@/app/(game)/garage/actions";
import { compareTemplates, ENGINE_SORTS, GEARBOX_SORTS, type CardSort } from "@/lib/catalog-sort";
import type { UserCard } from "@/lib/types";

const SLOT_LABEL = { moteur: "moteur", boite: "boîte", pneus: "pneu", bonus: "bonus" } as const;

type SortKey = Exclude<CardSort, "price"> | "gomme";

/** Tri propre à chaque emplacement : les pneus se comparent par gomme, pas par référence. */
const SLOT_SORTS: Record<"moteur" | "boite" | "pneus" | "bonus", readonly { key: SortKey; label: string; title: string }[]> = {
  moteur: ENGINE_SORTS,
  boite: GEARBOX_SORTS,
  pneus: [{ key: "gomme", label: "Gomme", title: "Plus de gomme restante d'abord" }],
  bonus: [],
};

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
  // Moteurs et boîtes s'affichent d'office par code croissant (M1A, M1B, M2, …).
  const [sort, setSort] = useState<SortKey | "">(slot === "moteur" || slot === "boite" ? "ref" : "");
  const title = `Choisir ${slot === "boite" || slot === "bonus" ? "une" : "un"} ${SLOT_LABEL[slot]}`;
  const sorts = SLOT_SORTS[slot];
  const ordered = useMemo(
    () =>
      sort
        ? alternatives.slice().sort((a, b) =>
            sort === "gomme"
              ? Number(b.tire_wear ?? 0) - Number(a.tire_wear ?? 0)
              : compareTemplates(a.card_templates, b.card_templates, sort),
          )
        : alternatives,
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
        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 py-2 font-display text-sm font-bold uppercase tracking-wide text-amber-300 transition-colors hover:border-amber-400 hover:bg-amber-500 hover:text-black"
      >
        <ArrowLeftRight size={16} strokeWidth={2.25} aria-hidden />
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
            <div className="mb-4 space-y-2">
              <SortRow
                options={sorts}
                current={sort}
                onSelect={(key) => setSort(sort === key ? "" : (key as SortKey))}
                ariaLabel="Trier les cartes"
              />
              <p className="text-right text-xs tabular-nums text-zinc-500">
                {alternatives.length} pièce{alternatives.length > 1 ? "s" : ""}
              </p>
            </div>
          )}
          {alternatives.length === 0 && (
            <EmptyState
              icon={PackageOpen}
              title="Aucune autre carte disponible"
              description="Votre inventaire ne contient pas d’autre pièce pour cet emplacement."
              action={
                <Link href="/shop" className={buttonClass({ variant: "ghost", size: "sm" })}>
                  Voir la boutique
                </Link>
              }
            />
          )}
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
                  <ActionForm
                    action={equipCard}
                    submitLabel="Équiper"
                    className="flex"
                    feedback="toast"
                    toastKey={`equip-${slot}`}
                    onSuccess={() => setOpen(false)}
                  >
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
