"use server";

import { cardImageUrl } from "@/lib/card-images";
import { callRpc } from "@/lib/rpc";
import type { ActionState, TradePartner, TradePlayerSuggestion, TradeResult } from "@/lib/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Nettoie une liste d'identifiants reçue du client (max 5, doublons retirés). */
function cardIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((v): v is string => typeof v === "string" && UUID_RE.test(v)))].slice(0, 5);
}

function uuid(value: unknown): string | null {
  return typeof value === "string" && UUID_RE.test(value) ? value : null;
}

function coins(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.trunc(n), 1_000_000_000) : 0;
}

export interface TradeDraft {
  recipientId: string;
  proposerCardIds: string[];
  recipientCardIds: string[];
  coins: number;
}

export interface CounterDraft extends TradeDraft {
  tradeId: string;
}

/** Suggestions de pseudos pour l'autocomplétion (8 maximum, jamais soi-même). */
export async function searchTradePlayers(query: string): Promise<ActionState<TradePlayerSuggestion[]>> {
  const term = String(query ?? "").trim();
  if (!term) return { ok: true, data: [] };
  const escaped = term.replace(/[\\%_]/g, (match) => `\\${match}`);
  return callRpc<TradePlayerSuggestion[]>(
    `select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username) order by p.username), '[]'::jsonb) as r
       from (
         select id, username
           from public_profiles
          where id <> $1::uuid
            and username ilike $2 escape '\\'
          order by position(lower($3) in lower(username)), username
          limit 8
       ) p`,
    (id) => [id, `%${escaped}%`, term],
  );
}

/** Résout un pseudo et renvoie l'inventaire public du destinataire (images résolues). */
export async function lookupTradePartner(username: string): Promise<ActionState<TradePartner>> {
  const result = await callRpc<TradePartner>(
    "select public.trade_partner($1::uuid, $2::text) as r",
    (id) => [id, String(username ?? "").trim()],
  );
  if (!result?.ok || !result.data) return result;
  return {
    ...result,
    data: {
      ...result.data,
      cards: result.data.cards.map((card) => ({ ...card, image: cardImageUrl(card.card_templates) })),
    },
  };
}

export async function createTradeOffer(draft: TradeDraft): Promise<ActionState<string>> {
  const recipientId = uuid(draft?.recipientId);
  if (!recipientId) return { ok: false, message: "Destinataire invalide." };
  return callRpc<string>(
    "select public.create_trade_offer($1::uuid, $2::uuid, $3::uuid[], $4::uuid[], $5::int) as r",
    (id) => [id, recipientId, cardIds(draft?.proposerCardIds), cardIds(draft?.recipientCardIds), coins(draft?.coins)],
    ["/marketplace"],
  );
}

export async function counterTradeOffer(draft: CounterDraft): Promise<ActionState<TradeResult>> {
  const tradeId = uuid(draft?.tradeId);
  if (!tradeId) return { ok: false, message: "Échange introuvable." };
  return callRpc<TradeResult>(
    "select public.counter_trade_offer($1::uuid, $2::uuid, $3::uuid[], $4::uuid[], $5::int) as r",
    (id) => [id, tradeId, cardIds(draft?.proposerCardIds), cardIds(draft?.recipientCardIds), coins(draft?.coins)],
    ["/marketplace"],
  );
}

export async function cancelTradeOffer(tradeId: string): Promise<ActionState> {
  const id = uuid(tradeId);
  if (!id) return { ok: false, message: "Échange introuvable." };
  return callRpc(
    "select public.cancel_trade_offer($1::uuid, $2::uuid) as r",
    (uid) => [uid, id],
    ["/marketplace"],
  );
}

export async function respondTradeOffer(tradeId: string, accept: boolean): Promise<ActionState<TradeResult>> {
  const id = uuid(tradeId);
  if (!id) return { ok: false, message: "Échange introuvable." };
  return callRpc<TradeResult>(
    "select public.respond_trade_offer($1::uuid, $2::uuid, $3::boolean) as r",
    (uid) => [uid, id, accept],
    ["/", "/marketplace"],
  );
}
