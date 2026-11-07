"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { ActionForm } from "@/components/ActionForm";
import type { ActionState } from "@/lib/types";

/** Même plafond que la RPC buy_shop_item (garde-fou anti-achat massif). */
const MAX_QUANTITY = 999;

const stepBtn =
  "flex size-10 shrink-0 items-center justify-center rounded-lg border border-line-strong bg-[#12151b] text-zinc-200 transition hover:border-amber-500/60 hover:text-amber-300 disabled:opacity-40 disabled:hover:border-line-strong disabled:hover:text-zinc-200";
const field =
  "min-w-0 flex-1 rounded-lg border border-line-strong bg-[#12151b] px-2 py-1.5 text-center text-sm font-semibold tabular-nums text-white [appearance:textfield] focus:border-amber-500/60 focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
const buyBtn =
  "inline-flex min-h-9 w-full items-center justify-center rounded-full bg-amber-500 px-3 py-1.5 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50";
const disabledBtn =
  "inline-flex min-h-9 w-full items-center justify-center rounded-full border border-line-strong px-3 py-1.5 text-sm font-medium text-zinc-500";

const coins = (n: number) => n.toLocaleString("fr-FR");

/**
 * Sélecteur de quantité de la boutique : une même pièce peut être achetée
 * plusieurs fois en une seule transaction. Le maximum tient compte du stock
 * et des pièces disponibles ; le prix total est calculé en base.
 */
export function ShopBuyForm({
  action,
  catalogId,
  name,
  price,
  stock,
  balance,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  catalogId: string;
  name: string;
  price: number;
  /** NULL = stock illimité. */
  stock: number | null;
  /** Pièces du joueur, pour plafonner le sélecteur. */
  balance: number;
}) {
  const affordable = price > 0 ? Math.floor(balance / price) : Number.POSITIVE_INFINITY;
  const stockMax = Math.min(MAX_QUANTITY, stock ?? Number.POSITIVE_INFINITY);
  const max = Math.min(stockMax, affordable);
  const soldOut = stock !== null && stock <= 0;

  const [raw, setRaw] = useState("1");
  const qty = Math.min(Math.max(1, max), Math.max(1, Math.floor(Number(raw)) || 1));
  const total = price * qty;

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-sm">
        <span className="font-semibold text-amber-300">{coins(price)} 🪙</span>
        {stock !== null && <span className="text-zinc-500"> · stock {coins(stock)}</span>}
      </p>

      {soldOut ? (
        <button type="button" disabled className={disabledBtn}>
          Épuisé
        </button>
      ) : max < 1 ? (
        <button type="button" disabled className={disabledBtn}>
          Pièces insuffisantes
        </button>
      ) : (
        <>
          {stockMax > 1 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Retirer un exemplaire"
                  className={stepBtn}
                  disabled={qty <= 1}
                  onClick={() => setRaw(String(qty - 1))}
                >
                  <Minus size={15} strokeWidth={2.5} aria-hidden />
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={max}
                  aria-label="Quantité à acheter"
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  onBlur={() => setRaw(String(qty))}
                  className={field}
                />
                <button
                  type="button"
                  aria-label="Ajouter un exemplaire"
                  className={stepBtn}
                  disabled={qty >= max}
                  onClick={() => setRaw(String(qty + 1))}
                >
                  <Plus size={15} strokeWidth={2.5} aria-hidden />
                </button>
              </div>
              {max < stockMax && (
                <p className="text-xs text-zinc-500">
                  {max > 1
                    ? `Maximum ${max} avec votre solde.`
                    : "Votre solde ne couvre qu'un seul exemplaire."}
                </p>
              )}
            </div>
          )}

          {qty > 1 && (
            <p className="text-xs text-zinc-400">
              Total : <span className="font-semibold tabular-nums text-amber-300">{coins(total)} 🪙</span>
            </p>
          )}

          <ActionForm
            action={action}
            submitLabel={qty > 1 ? `Acheter ×${qty}` : "Acheter"}
            confirmText={`Acheter ${qty > 1 ? `${qty} × ` : ""}${name} pour ${coins(total)} pièces ?`}
            className="flex flex-wrap gap-2"
            variant="none"
            submitClassName={buyBtn}
            onResult={(state) => {
              if (state?.ok) setRaw("1");
            }}
          >
            <input type="hidden" name="catalog_id" value={catalogId} />
            <input type="hidden" name="quantity" value={qty} />
          </ActionForm>
        </>
      )}
    </div>
  );
}
