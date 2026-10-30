"use server";

import { requireUser } from "@/lib/auth";
import { cardImageUrl } from "@/lib/card-images";
import { withUser } from "@/lib/db";
import { rpcErrorMessage } from "@/lib/errors";
import { callRpc, str } from "@/lib/rpc";
import type { ActionState, CardTemplate } from "@/lib/types";

export async function claimCollectorChallenge(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return callRpc(
    "select public.claim_collector_challenge($1::uuid, $2::text) as r",
    (id) => [id, str(fd, "challenge")],
    ["/", "/garage/collection"],
  );
}

export type VisitedCollection = {
  username: string;
  cards: { card_templates: CardTemplate; image: string | null }[];
};

type CollectionPayload = {
  username: string;
  cards: { card_templates: CardTemplate }[];
};

/** Collection publique d'un autre pilote, résolue par pseudo (insensible à la casse). */
export async function visitCollectorCollection(
  _prev: ActionState<VisitedCollection>,
  fd: FormData,
): Promise<ActionState<VisitedCollection>> {
  const { user } = await requireUser();
  const username = str(fd, "username");
  if (!username) return { ok: false, message: "Indiquez le pseudo du collectionneur." };

  try {
    const { rows } = await withUser(user.id, (c) =>
      c.query<{ r: CollectionPayload }>(
        "select public.collector_collection($1::uuid, $2::text) as r",
        [user.id, username],
      ));
    const result = rows[0]?.r;
    if (!result) return { ok: false, message: "Ce pseudo est introuvable." };

    return {
      ok: true,
      data: {
        username: result.username,
        cards: result.cards.map(({ card_templates }) => ({
          card_templates,
          image: cardImageUrl(card_templates),
        })),
      },
    };
  } catch (e) {
    return { ok: false, message: rpcErrorMessage(e) };
  }
}
