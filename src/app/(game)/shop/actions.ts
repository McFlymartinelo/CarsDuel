"use server";

import { callRpc, str } from "@/lib/rpc";
import type { ActionState } from "@/lib/types";

export async function buyShopItem(_p: ActionState, fd: FormData): Promise<ActionState> {
  const res = await callRpc("select public.buy_shop_item($1::uuid, $2::uuid) as r", (id) => [id, str(fd, "catalog_id")]);
  return res?.ok ? { ok: true, message: "Achat effectué, carte ajoutée à votre inventaire." } : res;
}
