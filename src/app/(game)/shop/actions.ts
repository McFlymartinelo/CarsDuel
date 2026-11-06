"use server";

import { rpcErrorMessage } from "@/lib/errors";
import { callRpc, int, str } from "@/lib/rpc";
import type { ActionState } from "@/lib/types";

export async function buyShopItem(_p: ActionState, fd: FormData): Promise<ActionState> {
  let quantity: number;
  try {
    quantity = int(fd, "quantity", "invalid_quantity") ?? 1;
  } catch (e) {
    return { ok: false, message: rpcErrorMessage(e) };
  }
  if (quantity < 1) return { ok: false, message: rpcErrorMessage(new Error("invalid_quantity")) };

  const res = await callRpc<unknown[]>(
    "select public.buy_shop_item($1::uuid, $2::uuid, $3::integer) as r",
    (id) => [id, str(fd, "catalog_id"), quantity],
    ["/", "/shop", "/garage"],
  );
  if (!res?.ok) return res;

  return {
    ok: true,
    message:
      quantity > 1
        ? `${quantity} cartes ajoutées à votre inventaire.`
        : "Achat effectué, carte ajoutée à votre inventaire.",
  };
}
