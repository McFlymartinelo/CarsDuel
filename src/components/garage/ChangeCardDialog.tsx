"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, PackageOpen, SearchX } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { CardView, type TirePerf } from "@/components/CardView";
import { Modal } from "@/components/Modal";
import { buttonClass } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SortRow } from "@/components/SortRow";
import { equipCard } from "@/app/(game)/garage/actions";
import { compareTemplates, ENGINE_SORTS, GEARBOX_SORTS, type CardSort } from "@/lib/catalog-sort";
import { RARITY_LABEL } from "@/lib/format";
import { RARITY_KEYS, RARITY_PALETTE } from "@/lib/rarity-theme";
import type { Rarity, UserCard } from "@/lib/types";

const RARITIES = RARITY_KEYS;

const SLOT_LABEL = { moteur: "moteur", boite: "boîte", pneus: "pneu", bonus: "bonus" } as const;

type SortKey = Exclude<CardSort, "price"> | "gomme";

/** Tri propre à chaque emplacement : les pneus se comparent par gomme, pas par référence. */
const SLOT_SORTS: Record<"moteur" | "boite" | "pneus" | "bonus", readonly { key: SortKey; label: string; title: string }[]> = {
  moteur: ENGINE_SORTS,
  boite: GEARBOX_SORTS,
  pneus: [{ key: "gomme", label: "Gomme", title: "Plus de gomme restante d'abord" }],
  bonus: [],
};

const CHIP = "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors";
const CHIP_ON = "bg-amber-500 text-black";
const CHIP_OFF = "text-zinc-400 hover:bg-zinc-800 hover:text-white";

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
  const [rarity, setRarity] = useState<Rarity | "">("");
  // Moteurs et boîtes s'affichent d'office par code croissant (M1A, M1B, M2, …).
  const [sort, setSort] = useState<SortKey | "">(slot === "moteur" || slot === "boite" ? "ref" : "");
  const title = `Choisir ${slot === "boite" || slot === "bonus" ? "une" : "un"} ${SLOT_LABEL[slot]}`;
  const sorts = SLOT_SORTS[slot];

  // Les pneus et les bonus n'ont pas de rareté : le filtre n'apparaît que si au
  // moins deux niveaux sont représentés dans les pièces proposées.
  const rarityCounts = useMemo(
    () => Object.fromEntries(
      RARITIES.map((key) => [key, alternatives.filter((alt) => alt.card_templates.rarity === key).length]),
    ) as Record<Rarity, number>,
    [alternatives],
  );
  const availableRarities = RARITIES.filter((key) => rarityCounts[key] > 0);
  const ordered = useMemo(() => {
    const filtered = rarity ? alternatives.filter((alt) => alt.card_templates.rarity === rarity) : alternatives;
    return sort
      ? filtered.slice().sort((a, b) =>
          sort === "gomme"
            ? Number(b.tire_wear ?? 0) - Number(a.tire_wear ?? 0)
            : compareTemplates(a.card_templates, b.card_templates, sort),
        )
      : filtered;
  }, [alternatives, rarity, sort]);

  const openDialog = () => {
    // Chaque ouverture repart de toutes les raretés : le filtre reste un choix
    // de circonstance, pas une préférence mémorisée.
    setRarity("");
    setOpen(true);
  };

  useEffect(() => {
    const handleRequest = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== slot) return;
      setRarity("");
      setOpen(true);
    };
    window.addEventListener("carsduel:change-slot", handleRequest);
    return () => window.removeEventListener("carsduel:change-slot", handleRequest);
  }, [slot]);

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
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
          {alternatives.length === 0 ? (
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
          ) : (
            <>
              {availableRarities.length > 1 && (
                <div className="mb-3 md:grid md:grid-cols-[6.5rem_minmax(0,1fr)] md:items-center md:gap-x-3">
                  <span className="mb-1.5 block font-display text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 md:mb-0">
                    Niveau
                  </span>
                  <nav
                    className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-panel p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    aria-label="Filtrer par niveau de rareté"
                  >
                    <button
                      type="button"
                      aria-pressed={!rarity}
                      onClick={() => setRarity("")}
                      className={`${CHIP} ${!rarity ? CHIP_ON : CHIP_OFF}`}
                    >
                      Tous
                      <span className={!rarity ? "tabular-nums text-black/60" : "tabular-nums text-zinc-500"}>
                        {alternatives.length}
                      </span>
                    </button>
                    {availableRarities.map((key) => {
                      const on = key === rarity;
                      return (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setRarity(on ? "" : key)}
                          className={`${CHIP} ${on ? CHIP_ON : CHIP_OFF}`}
                        >
                          <span className={`h-2 w-2 shrink-0 rounded-full ${on ? "bg-black/40" : RARITY_PALETTE[key].dot}`} />
                          {RARITY_LABEL[key]}
                          <span className={on ? "tabular-nums text-black/60" : "tabular-nums text-zinc-500"}>
                            {rarityCounts[key]}
                          </span>
                        </button>
                      );
                    })}
                  </nav>
                </div>
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
                    {ordered.length} pièce{ordered.length > 1 ? "s" : ""}
                    {rarity ? ` sur ${alternatives.length}` : ""}
                  </p>
                </div>
              )}
              {ordered.length === 0 ? (
                <EmptyState
                  icon={SearchX}
                  title="Aucune pièce à ce niveau"
                  description="Aucune pièce de cette rareté n’est disponible pour cet emplacement."
                  action={
                    <button type="button" onClick={() => setRarity("")} className={buttonClass({ variant: "ghost", size: "sm" })}>
                      Voir tous les niveaux
                    </button>
                  }
                />
              ) : (
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
              )}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
