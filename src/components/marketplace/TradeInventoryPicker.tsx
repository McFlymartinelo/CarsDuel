"use client";

import { useId, useMemo, useState } from "react";
import { PackageSearch, Search, X } from "lucide-react";
import { Modal } from "@/components/Modal";
import { TradeCardTile } from "@/components/marketplace/TradeCardTile";
import { CATEGORY_LABEL } from "@/lib/format";
import type { Category, TradeCard } from "@/lib/types";

const FILTERS: { key: Category | "toutes"; label: string }[] = [
  { key: "toutes", label: "Toutes" },
  { key: "moteur", label: CATEGORY_LABEL.moteur },
  { key: "boite", label: CATEGORY_LABEL.boite },
  { key: "pneus", label: CATEGORY_LABEL.pneus },
  { key: "bonus", label: CATEGORY_LABEL.bonus },
];

const seg = (active: boolean) =>
  `inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
    active ? "bg-amber-500 text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
  }`;

/** Inventaire en modale : une carte cliquée est ajoutée à l'emplacement courant. */
export function TradeInventoryPicker({
  ownerName,
  cards,
  excludedIds,
  onPick,
  onClose,
}: {
  ownerName: string;
  cards: TradeCard[];
  /** Cartes déjà placées dans les autres emplacements (non sélectionnables). */
  excludedIds: Set<string>;
  onPick: (card: TradeCard) => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "toutes">("toutes");

  const available = useMemo(() => cards.filter((card) => !excludedIds.has(card.id)), [cards, excludedIds]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return available.filter((card) => {
      if (category !== "toutes" && card.card_templates.category !== category) return false;
      if (!q) return true;
      const t = card.card_templates;
      return t.name.toLowerCase().includes(q) || (t.code ?? "").toLowerCase().includes(q);
    });
  }, [available, category, query]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { toutes: available.length };
    for (const card of available) map[card.card_templates.category] = (map[card.card_templates.category] ?? 0) + 1;
    return map;
  }, [available]);

  return (
    <Modal labelledBy={titleId} size="lg" onClose={onClose}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-amber-400/90">Sélection de carte</p>
          <h3 id={titleId} className="font-display text-2xl font-bold uppercase leading-tight">
            Inventaire de {ownerName}
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer l'inventaire"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Rechercher une carte</span>
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une carte…"
            className="w-full !py-2 !pl-9 !pr-3"
          />
        </label>
        <nav className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-[#10131a] p-1" aria-label="Catégories de l'inventaire">
          {FILTERS.map((filter) => {
            const on = category === filter.key;
            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setCategory(filter.key)}
                aria-pressed={on}
                className={seg(on)}
              >
                {filter.label}
                <span className={on ? "tabular-nums text-black/60" : "tabular-nums text-zinc-500"}>{counts[filter.key] ?? 0}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {visible.length === 0 ? (
        <div className="mt-5 rounded-xl border border-zinc-800 bg-[#0e1117] px-4 py-10 text-center">
          <PackageSearch size={34} strokeWidth={1.4} className="mx-auto text-zinc-600" />
          <p className="mt-3 text-sm text-zinc-400">
            {available.length === 0 ? "Aucune carte disponible pour cet échange." : "Aucune carte ne correspond à cette recherche."}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {visible.map((card) => (
            <TradeCardTile
              key={card.id}
              card={card}
              onClick={() => onPick(card)}
              label={`Choisir ${card.card_templates.name}`}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}
