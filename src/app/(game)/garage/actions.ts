"use server";

import type { PoolClient } from "pg";
import { requireUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { callRpc, invalidate, optStr, str } from "@/lib/rpc";
import { rpcErrorMessage } from "@/lib/errors";
import { toDrawn } from "@/lib/reveal";
import type { ActionState, CardTemplate, DrawnCard } from "@/lib/types";

async function drawnFromIds(ids: string[]): Promise<DrawnCard[]> {
  if (ids.length === 0) return [];
  const { user } = await requireUser();
  const { rows } = await withUser(user.id, (c) =>
    c.query<{ id: string; card_templates: CardTemplate }>(
      `select uc.id, to_jsonb(t) as card_templates
         from user_cards uc join card_templates t on t.id = uc.template_id
        where uc.owner_id = $1 and uc.id = any($2::uuid[])
        order by array_position($2::uuid[], uc.id)`,
      [user.id, ids],
    ),
  );
  return rows.map((r) => toDrawn(r.id, r.card_templates));
}

export async function claimDailyPull(_prev: ActionState<{ cards: DrawnCard[] }>, _fd: FormData): Promise<ActionState<{ cards: DrawnCard[] }>> {
  const res = await callRpc<{ card_ids: string[] }>(
    "select public.claim_daily_pull($1::uuid) as r",
    (id) => [id],
    ["/", "/garage", "/garage/tirages"],
  );
  if (!res?.ok) return { ok: false, message: res?.message };
  return { ok: true, data: { cards: await drawnFromIds(res.data?.card_ids ?? []) } };
}

export async function claimWeeklyPull(_prev: ActionState<{ cards: DrawnCard[] }>, fd: FormData): Promise<ActionState<{ cards: DrawnCard[] }>> {
  const category = str(fd, "category");
  if (category !== "moteur" && category !== "boite") return { ok: false, message: "Choisissez un moteur ou une boîte." };
  const res = await callRpc<{ card_ids: string[] }>(
    "select public.claim_weekly_pull($1::uuid, $2::text) as r",
    (id) => [id, category],
    ["/", "/garage", "/garage/tirages"],
  );
  if (!res?.ok) return { ok: false, message: res?.message };
  return { ok: true, data: { cards: await drawnFromIds(res.data?.card_ids ?? []) } };
}

export async function recycleCard(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const res = await callRpc<{ coins: number }>(
    "select public.recycle_card($1::uuid, $2::uuid) as r",
    (id) => [id, str(fd, "card_id")],
    ["/", "/garage", "/garage/inventaire", "/garage/casse", "/duel", "/marketplace"],
  );
  if (res?.ok) return { ok: true, message: `Recyclage : +${res.data?.coins ?? 0} pièces.` };
  return res;
}

export async function repairCard(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const res = await callRpc(
    "select public.repair_card($1::uuid, $2::uuid) as r",
    (id) => [id, str(fd, "card_id")],
    ["/garage", "/garage/inventaire", "/garage/casse", "/duel", "/duel/organises", "/marketplace"],
  );
  if (res?.ok) return { ok: true, message: "Réparation effectuée sous garantie constructeur." };
  return res;
}

export async function extendWarranty(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const res = await callRpc<{ warranty_duels: number }>(
    "select public.extend_warranty($1::uuid, $2::uuid) as r",
    (id) => [id, str(fd, "card_id")],
    ["/", "/garage", "/garage/inventaire", "/garage/casse", "/duel", "/duel/organises", "/marketplace"],
  );
  if (res?.ok) return { ok: true, message: `Garantie prolongée : ${res.data?.warranty_duels ?? 0} duels couverts.` };
  return res;
}

// Les decks sont écrits directement (RLS « propriétaire » + trigger validate_deck) : aucune logique de jeu ici.
async function deckWrite(fn: (c: PoolClient, userId: string) => Promise<void>, okMessage?: string, paths: string[] = ["/garage"]): Promise<ActionState> {
  const { user } = await requireUser();
  try {
    await withUser(user.id, (c) => fn(c, user.id));
  } catch (e) {
    return { ok: false, message: rpcErrorMessage(e) };
  }
  invalidate(paths);
  return { ok: true, message: okMessage };
}

// Colonne du deck selon la catégorie (valeurs fixes : jamais issues du formulaire).
const SLOT_COLUMN = { moteur: "engine_card_id", boite: "gearbox_card_id", pneus: "tire_card_id" } as const;
type Slot = keyof typeof SLOT_COLUMN;

/**
 * Équipe une carte dans le deck indiqué (remplace l'emplacement de sa catégorie).
 * Sans deck : en crée un avec cette carte + la première carte disponible des deux autres catégories.
 */
export async function equipCard(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const cardId = str(fd, "card_id");
  const deckId = optStr(fd, "deck_id");

  return deckWrite(async (c, uid) => {
    const { rows } = await c.query<{ category: string }>(
      `select t.category from user_cards uc join card_templates t on t.id = uc.template_id
        where uc.id = $1::uuid and uc.owner_id = $2`,
      [cardId, uid],
    );
    const category = rows[0]?.category as Slot | undefined;
    if (!category || !(category in SLOT_COLUMN)) throw new Error("invalid_deck_card");

    if (deckId) {
      const r = await c.query(`update user_decks set ${SLOT_COLUMN[category]} = $3::uuid where owner_id = $1 and id = $2::uuid`, [uid, deckId, cardId]);
      if (r.rowCount === 0) throw new Error("deck_not_found");
      return;
    }

    const pick: Record<Slot, string | undefined> = { moteur: undefined, boite: undefined, pneus: undefined };
    for (const slot of Object.keys(SLOT_COLUMN) as Slot[]) {
      if (slot === category) { pick[slot] = cardId; continue; }
      const found = await c.query<{ id: string }>(
        `select uc.id from user_cards uc join card_templates t on t.id = uc.template_id
          where uc.owner_id = $1 and t.category = $2 and not uc.is_destroyed and not uc.is_listed
          order by uc.acquired_at limit 1`,
        [uid, slot],
      );
      pick[slot] = found.rows[0]?.id;
    }
    if (!pick.moteur || !pick.boite || !pick.pneus) throw new Error("incomplete_collection");
    await c.query(
      "insert into user_decks (owner_id, name, engine_card_id, gearbox_card_id, tire_card_id) values ($1, 'Deck principal', $2, $3, $4)",
      [uid, pick.moteur, pick.boite, pick.pneus],
    );
  }, "Carte équipée.", ["/garage", "/garage/inventaire", "/duel", "/duel/organises"]);
}
