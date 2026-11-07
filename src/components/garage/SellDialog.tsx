"use client";

import { useState } from "react";
import { Minus, Plus, Tag } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import { Modal } from "@/components/Modal";
import type { ActionState } from "@/lib/types";

const openBtn =
  "inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-1.5 text-center text-xs font-semibold leading-tight text-red-300 transition hover:border-red-400 hover:bg-red-500/20 hover:text-red-200 active:scale-95";
const cancelBtn =
  "flex min-h-11 w-full items-center justify-center rounded-lg border border-zinc-600 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800";
const stepBtn =
  "flex size-11 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-[#12151b] text-zinc-200 transition hover:border-amber-500/60 hover:text-amber-300 disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:text-zinc-200";
const field = "ring-amber-500/40 focus:outline-none focus:ring-2";
const TAX_RATE = 0.1;
const PRICE_PRESETS = [10, 15, 25, 50, 100];

export function SellDialog({
  action,
  cardIds,
  name,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  /** Exemplaires identiques disponibles à la vente (un seul pour une carte unique). */
  cardIds: string[];
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  const [offers, setOffers] = useState(false);
  const max = cardIds.length;
  const qty = Math.min(max, Math.max(1, Math.floor(Number(quantity)) || 1));
  const unit = Math.floor(Number(price));
  const net = unit >= 10 ? Math.floor(unit * (1 - TAX_RATE)) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setQuantity("1");
          setPrice("");
          setOffers(false);
          setOpen(true);
        }}
        className={openBtn}
      >
        <Tag size={13} strokeWidth={2.5} aria-hidden />
        Vendre sur la marketplace
      </button>
      {open && (
        <Modal labelledBy="sell-title" onClose={() => setOpen(false)}>
          <div className="flex items-center gap-2 text-red-300">
            <Tag size={18} strokeWidth={2.25} aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-widest">Marketplace</span>
          </div>
          <h3 id="sell-title" className="mt-1 font-display text-2xl font-bold uppercase">Nouvelle annonce</h3>
          <p className="mt-1 text-zinc-200">{name}</p>

          <ActionForm
            action={action}
            submitLabel={
              <span className="inline-flex items-center justify-center gap-2">
                <Tag size={16} strokeWidth={2.25} aria-hidden />
                Publier sur la marketplace
              </span>
            }
            variant="none"
            submitClassName="mt-5 flex min-h-12 w-full items-center justify-center rounded-lg bg-gradient-to-b from-amber-400 to-amber-500 px-3 text-sm font-bold uppercase tracking-wide text-black shadow-lg shadow-amber-950/40 transition hover:from-amber-300 hover:to-amber-400 disabled:opacity-50"
            onSuccess={() => setOpen(false)}
            className="mt-4 flex flex-col items-stretch gap-4"
          >
            {Array.from({ length: qty }, (_, i) => (
              <input key={cardIds[i]} type="hidden" name="card_id" value={cardIds[i]} />
            ))}

            {max > 1 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm text-zinc-300">Quantité à mettre en vente</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Retirer un exemplaire"
                    className={stepBtn}
                    disabled={qty <= 1}
                    onClick={() => setQuantity(String(qty - 1))}
                  >
                    <Minus size={16} strokeWidth={2.5} aria-hidden />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={max}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className={`${field} w-full min-w-0 text-center text-base font-semibold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                  />
                  <button
                    type="button"
                    aria-label="Ajouter un exemplaire"
                    className={stepBtn}
                    disabled={qty >= max}
                    onClick={() => setQuantity(String(qty + 1))}
                  >
                    <Plus size={16} strokeWidth={2.5} aria-hidden />
                  </button>
                </div>
                <span className="text-xs text-zinc-500">
                  {max} exemplaire{max === 1 ? "" : "s"} disponible{max === 1 ? "" : "s"}
                </span>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-zinc-300">Prix {max > 1 ? "par carte" : "de vente"}</span>
              <div className="flex flex-wrap gap-2">
                {PRICE_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPrice(String(p))}
                    className={`min-h-10 min-w-14 rounded-lg border px-3 text-sm font-semibold tabular-nums transition ${
                      price === String(p)
                        ? "border-amber-500 bg-amber-500/15 text-amber-300"
                        : "border-line-strong bg-[#12151b] text-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  name="price"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Autre montant"
                  value={price}
                  onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
                  className={`${field} w-full min-w-0 font-semibold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
                />
                <span className="shrink-0 text-sm text-zinc-500">pièces</span>
              </div>
              <span className="text-xs text-zinc-500">Minimum 10 pièces.</span>
            </div>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${
                offers ? "border-amber-500/60 bg-amber-500/10" : "border-line-strong hover:bg-zinc-800/50"
              }`}
            >
              <input
                type="checkbox"
                name="accepts_offers"
                checked={offers}
                onChange={(e) => setOffers(e.target.checked)}
                className="mt-0.5 size-4 accent-amber-500"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-zinc-100">Accepter les offres</span>
                <span className="text-xs text-zinc-500">
                  Laissez le prix vide pour une vente par offres uniquement.
                </span>
              </span>
            </label>

            <div className="flex items-center justify-between gap-3 rounded-lg bg-zinc-900/70 px-3 py-2.5 text-sm">
              <span className="text-zinc-400">
                {net != null && qty > 1 ? `Gain net total (${qty} cartes)` : "Gain net"}
              </span>
              <span className="font-semibold tabular-nums text-emerald-300">
                {net != null ? `${net * qty} pièces` : "—"}
              </span>
            </div>
            <p className="-mt-2 text-xs text-zinc-500">Taxe de 10 % prélevée sur le vendeur à la vente.</p>
          </ActionForm>

          <button type="button" onClick={() => setOpen(false)} className={`${cancelBtn} mt-2`}>
            Annuler
          </button>
        </Modal>
      )}
    </>
  );
}
