import "server-only";
import type { PoolClient } from "pg";
import { withUser } from "@/lib/db";
import type { DuelRow, Listing, Offer, Profile, UserCard, UserDeck, CardTemplate } from "@/lib/types";

// Toutes les lectures passent par withUser : la RLS s'applique (rôle app_user).
// Les chargeurs de page enchaînent leurs requêtes sur le MÊME client (une transaction).

export const LISTING_PAGE_SIZE = 30;
export const OFFER_LIMIT = 50;
export const DUEL_PAGE_SIZE = 15;
export const SUFFERED_LIMIT = 10;

const CARD_SELECT = `select uc.*, to_jsonb(t) as card_templates
  from user_cards uc join card_templates t on t.id = uc.template_id`;

const LISTING_SELECT = `select l.*, (to_jsonb(uc) || jsonb_build_object('card_templates', to_jsonb(t))) as user_cards
  from marketplace_listings l
  join user_cards uc on uc.id = l.card_id
  join card_templates t on t.id = uc.template_id`;

function pageIndex(page: number) {
  return Number.isFinite(page) && page >= 1 ? Math.floor(page) : 1;
}

async function qProfile(c: PoolClient, uid: string) {
  return (await c.query<Profile>("select id, username, coins, xp_total, last_daily_pull from profiles where id = $1", [uid])).rows[0] ?? null;
}

async function qCards(c: PoolClient, uid: string) {
  return (await c.query<UserCard>(`${CARD_SELECT} where uc.owner_id = $1 order by uc.acquired_at desc`, [uid])).rows;
}

async function qDecks(c: PoolClient, uid: string) {
  return (await c.query<UserDeck>("select * from user_decks where owner_id = $1 order by created_at", [uid])).rows;
}

async function qModifiers(c: PoolClient) {
  return (await c.query<TireModifier>("select tire_type, weather, perf_bonus_pct, wear_pct from tire_weather_modifiers")).rows;
}

async function qNames(c: PoolClient, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const { rows } = await c.query<{ id: string; username: string }>(
    "select id, username from public_profiles where id = any($1::uuid[])", [ids]);
  return new Map(rows.map((r) => [r.id, r.username]));
}

export const getProfile = (uid: string) => withUser(uid, (c) => qProfile(c, uid));
export const getOwnCards = (uid: string) => withUser(uid, (c) => qCards(c, uid));
export const getOwnDecks = (uid: string) => withUser(uid, (c) => qDecks(c, uid));

export const getDuelHistory = (uid: string, limit = DUEL_PAGE_SIZE, offset = 0) =>
  withUser(uid, async (c) =>
    (await c.query<DuelRow>("select * from duels_history order by created_at desc limit $1 offset $2", [limit, offset])).rows,
  );

export const getSufferedDuels = (uid: string, limit = SUFFERED_LIMIT) =>
  withUser(uid, async (c) =>
    (await c.query<DuelRow>(
      "select * from duels_history where defender_id = $1 order by created_at desc limit $2",
      [uid, limit],
    )).rows,
  );

export interface AttackStatus {
  used: number;
  cap: number;
  remaining: number;
}

export const getAttackStatus = (uid: string) =>
  withUser(uid, async (c) =>
    (await c.query<{ r: AttackStatus }>("select public.attack_status($1::uuid) as r", [uid])).rows[0].r,
  );

export const getUsernames = (uid: string, ids: string[]) => withUser(uid, (c) => qNames(c, ids));

export const getActiveListings = (uid: string, page = 1) =>
  withUser(uid, async (c) => {
    const p = pageIndex(page);
    return (await c.query<Listing>(
      `${LISTING_SELECT} where l.status = 'active' order by l.created_at desc limit $1 offset $2`,
      [LISTING_PAGE_SIZE, (p - 1) * LISTING_PAGE_SIZE],
    )).rows;
  });

export const getPendingOffers = (uid: string) =>
  withUser(uid, async (c) =>
    (await c.query<Offer>(
      "select * from marketplace_offers where status = 'pending' order by created_at desc limit $1",
      [OFFER_LIMIT],
    )).rows,
  );

export interface TireModifier {
  tire_type: string;
  weather: string;
  perf_bonus_pct: number;
  wear_pct: number;
}

export const getTireModifiers = (uid: string) => withUser(uid, (c) => qModifiers(c));

export interface CatalogRow {
  id: string;
  price: number;
  stock: number | null;
  card_templates: CardTemplate;
}

async function qCatalog(c: PoolClient) {
  return (await c.query<CatalogRow>(
    `select s.id, s.price, s.stock, to_jsonb(t) as card_templates
       from shop_catalog s join card_templates t on t.id = s.template_id
      where s.is_active order by s.price, t.name`)).rows;
}

export const getShopCatalog = (uid: string) => withUser(uid, (c) => qCatalog(c));

export interface LeaderboardRow {
  user_id: string;
  username: string;
  xp: number;
  rank: number;
  period_start: string;
  period_end: string;
}

export const getLeaderboard = (uid: string, period: "weekly" | "monthly") =>
  withUser(uid, async (c) =>
    (await c.query<LeaderboardRow>(
      `select * from ${period === "monthly" ? "leaderboard_monthly" : "leaderboard_weekly"}
        order by rank, username limit 100`)).rows,
  );

/** Garage : cartes, decks et modificateurs pneus, une seule transaction. */
export const loadGaragePage = (uid: string) =>
  withUser(uid, async (c) => ({
    cards: await qCards(c, uid),
    decks: await qDecks(c, uid),
    modifiers: await qModifiers(c),
  }));

/** Duel : inventaire, historique paginé, duels subis, quota et pseudos. */
export const loadDuelPage = (uid: string, page = 1) =>
  withUser(uid, async (c) => {
    const p = pageIndex(page);
    const cards = await qCards(c, uid);
    const decks = await qDecks(c, uid);
    const history = (await c.query<DuelRow>(
      "select * from duels_history order by created_at desc limit $1 offset $2",
      [DUEL_PAGE_SIZE, (p - 1) * DUEL_PAGE_SIZE],
    )).rows;
    const suffered = (await c.query<DuelRow>(
      "select * from duels_history where defender_id = $1 order by created_at desc limit $2",
      [uid, SUFFERED_LIMIT],
    )).rows;
    const attacks = (await c.query<{ r: AttackStatus }>("select public.attack_status($1::uuid) as r", [uid])).rows[0].r;
    const ids = [...new Set([
      ...history.map((x) => (x.attacker_id === uid ? x.defender_id : x.attacker_id)),
      ...suffered.map((x) => x.attacker_id),
    ])];
    return { cards, decks, history, suffered, attacks, names: await qNames(c, ids), page: p };
  });

/** Marketplace : annonces (page), offres, inventaire et pseudos des vendeurs. */
export const loadMarketplacePage = (uid: string, page = 1) =>
  withUser(uid, async (c) => {
    const p = pageIndex(page);
    const listings = (await c.query<Listing>(
      `${LISTING_SELECT} where l.status = 'active' order by l.created_at desc limit $1 offset $2`,
      [LISTING_PAGE_SIZE, (p - 1) * LISTING_PAGE_SIZE],
    )).rows;
    const offers = (await c.query<Offer>(
      "select * from marketplace_offers where status = 'pending' order by created_at desc limit $1",
      [OFFER_LIMIT],
    )).rows;
    const cards = await qCards(c, uid);
    const decks = await qDecks(c, uid);
    const modifiers = await qModifiers(c);
    const names = await qNames(c, [...new Set(listings.map((x) => x.seller_id))]);
    return { listings, offers, cards, decks, modifiers, names, page: p };
  });

/** Boutique : catalogue et modificateurs pneus. */
export const loadShopPage = (uid: string) =>
  withUser(uid, async (c) => ({
    items: await qCatalog(c),
    modifiers: await qModifiers(c),
  }));
