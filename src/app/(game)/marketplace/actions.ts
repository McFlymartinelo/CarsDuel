"use server";

import { callRpc, int, str } from "@/lib/rpc";
import type { ActionState } from "@/lib/types";

const done = (message: string) => async (res: ActionState): Promise<ActionState> =>
  res?.ok ? { ok: true, message } : res;

export async function listCard(_p: ActionState, fd: FormData): Promise<ActionState> {
  const offers = fd.get("accepts_offers") === "on";
  return done("Carte mise en vente.")(
    await callRpc(
      "select public.create_listing($1::uuid, $2::uuid, $3::int, $4::boolean) as r",
      (id) => [id, str(fd, "card_id"), int(fd, "price"), offers],
    ),
  );
}

export async function cancelListing(_p: ActionState, fd: FormData): Promise<ActionState> {
  return done("Annonce retirée.")(
    await callRpc("select public.cancel_listing($1::uuid, $2::uuid) as r", (id) => [id, str(fd, "listing_id")]),
  );
}

export async function buyListing(_p: ActionState, fd: FormData): Promise<ActionState> {
  return done("Achat effectué !")(
    await callRpc("select public.buy_marketplace_item($1::uuid, $2::uuid) as r", (id) => [id, str(fd, "listing_id")]),
  );
}

export async function makeOffer(_p: ActionState, fd: FormData): Promise<ActionState> {
  return done("Offre envoyée (pièces mises en séquestre).")(
    await callRpc(
      "select public.make_offer($1::uuid, $2::uuid, $3::int) as r",
      (id) => [id, str(fd, "listing_id"), int(fd, "amount")],
    ),
  );
}

export async function withdrawOffer(_p: ActionState, fd: FormData): Promise<ActionState> {
  return done("Offre retirée, pièces remboursées.")(
    await callRpc("select public.withdraw_offer($1::uuid, $2::uuid) as r", (id) => [id, str(fd, "offer_id")]),
  );
}

export async function respondOffer(_p: ActionState, fd: FormData): Promise<ActionState> {
  const accept = str(fd, "accept") === "true";
  return done(accept ? "Offre acceptée." : "Offre refusée.")(
    await callRpc(
      "select public.respond_offer($1::uuid, $2::uuid, $3::boolean) as r",
      (id) => [id, str(fd, "offer_id"), accept],
    ),
  );
}
