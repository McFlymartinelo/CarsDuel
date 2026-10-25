import "server-only";
import type { PoolClient } from "pg";
import { withUser } from "@/lib/db";
import type { CatalogQuery } from "@/lib/catalog-filters";
import { LISTING_ORDER_SQL } from "@/lib/catalog-sort";
import type { DailyQuestState } from "@/lib/quests";
import type { DuelRow, Listing, MarketHistoryRow, NotificationFeed, Offer, PriceRef, Profile, UserCard, UserDeck, CardTemplate } from "@/lib/types";

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
  return (await c.query<Profile>("select id, username, coins, xp_total, last_daily_pull, last_weekly_pull from profiles where id = $1", [uid])).rows[0] ?? null;
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

async function qCatalog(c: PoolClient, filter?: CatalogQuery) {
  const where = ["s.is_active"];
  const params: unknown[] = [];
  if (filter) {
    params.push(filter.tab.category);
    where.push(`t.category = $${params.length}`);
    if (filter.rarity) {
      params.push(filter.rarity);
      where.push(`t.rarity = $${params.length}`);
    }
    if (filter.min != null) {
      params.push(filter.min);
      where.push(`s.price >= $${params.length}`);
    }
    if (filter.max != null) {
      params.push(filter.max);
      where.push(`s.price <= $${params.length}`);
    }
  }
  return (await c.query<CatalogRow>(
    `select s.id, s.price, s.stock, to_jsonb(t) as card_templates
       from shop_catalog s join card_templates t on t.id = s.template_id
      where ${where.join(" and ")} order by s.price, t.name`, params)).rows;
}

async function qCatalogCounts(c: PoolClient) {
  return (await c.query<{ category: string; rarity: string | null; n: number }>(
    `select t.category, t.rarity::text as rarity, count(*)::int as n
       from shop_catalog s join card_templates t on t.id = s.template_id
      where s.is_active
      group by t.category, t.rarity`,
  )).rows;
}

export const getShopCatalog = (uid: string) => withUser(uid, (c) => qCatalog(c));

export interface LeaderboardRow {
  user_id: string;
  username: string;
  xp: number;
  rank: number;
  period_start: string;
  period_end: string;
  player_count: number;
  prize: number;
}

export const getLeaderboard = (uid: string, period: "weekly" | "monthly") =>
  withUser(uid, async (c) =>
    (await c.query<LeaderboardRow>(
      `select * from ${period === "monthly" ? "leaderboard_monthly" : "leaderboard_weekly"}
        order by rank, username limit 100`)).rows,
  );

/** Garage : cartes, decks, annonces en cours et modificateurs pneus. */
export const loadGaragePage = (uid: string) =>
  withUser(uid, async (c) => ({
    cards: await qCards(c, uid),
    decks: await qDecks(c, uid),
    modifiers: await qModifiers(c),
    listings: (await c.query<{ id: string; card_id: string }>(
      "select id, card_id from marketplace_listings where seller_id = $1 and status = 'active'",
      [uid],
    )).rows,
  }));

export interface PullRow {
  source: string;
  acquired_at: string;
  label: string;
}

/** Tirages gratuits déjà obtenus, du plus récent au plus ancien. */
export const loadPullHistory = (uid: string) =>
  withUser(uid, async (c) =>
    (await c.query<PullRow>(
      `select uc.source, uc.acquired_at,
              t.name as label
         from user_cards uc
         join card_templates t on t.id = uc.template_id
        where uc.owner_id = $1 and uc.source in ('daily_pull', 'weekly_pull')
        order by uc.acquired_at desc
        limit 300`,
      [uid],
    )).rows,
  );

export interface DuelChallengeRow {
  id: string;
  challenger_id: string;
  target_id: string;
  created_at: string;
  status: string;
}

export const loadOrganizedPage = (uid: string) =>
  withUser(uid, async (c) => {
    const cards = await qCards(c, uid);
    const decks = await qDecks(c, uid);
    const modifiers = await qModifiers(c);
    const challenges = (await c.query<DuelChallengeRow>(
      `select id, challenger_id, target_id, created_at, status
         from duel_challenges
        where status = 'pending' and (challenger_id = $1 or target_id = $1)
        order by created_at desc`,
      [uid],
    )).rows;
    const names = await qNames(c, [...new Set(challenges.flatMap((x) => [x.challenger_id, x.target_id]))]);
    return { cards, decks, modifiers, challenges, names };
  });

export const touchQuest = (uid: string, key: string) =>
  withUser(uid, (c) => c.query("select public.touch_quest($1::uuid, $2::text)", [uid, key]));

export const getDailyQuests = (uid: string) =>
  withUser(uid, async (c) => {
    const row = (await c.query<{ r: DailyQuestState }>("select public.my_daily_quests($1::uuid) as r", [uid])).rows[0]?.r;
    if (!row) return null;
    const progress: Record<string, number> = {};
    for (const [k, v] of Object.entries(row.progress ?? {})) progress[k] = Number(v);
    return { second: row.second, third: row.third, progress, claimed: row.claimed ?? [] };
  });

/** Duel : inventaire, historique paginé, duels subis et pseudos. */
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
    const modifiers = await qModifiers(c);
    const ids = [...new Set([
      ...history.map((x) => (x.attacker_id === uid ? x.defender_id : x.attacker_id)),
      ...suffered.map((x) => x.attacker_id),
    ])];
    return { cards, decks, modifiers, history, suffered, names: await qNames(c, ids), page: p };
  });

/** Marketplace : annonces filtrées (page), offres, inventaire et pseudos des vendeurs. */
export const loadMarketplacePage = (uid: string, page = 1, filter?: CatalogQuery | null) =>
  withUser(uid, async (c) => {
    const p = pageIndex(page);
    const where = ["l.status = 'active'"];
    const params: unknown[] = [LISTING_PAGE_SIZE, (p - 1) * LISTING_PAGE_SIZE];
    if (filter) {
      params.push(filter.tab.category);
      where.push(`t.category = $${params.length}`);
      if (filter.rarity) {
        params.push(filter.rarity);
        where.push(`t.rarity = $${params.length}`);
      }
      if (filter.min != null) {
        params.push(filter.min);
        where.push(`l.price >= $${params.length}`);
      }
      if (filter.max != null) {
        params.push(filter.max);
        where.push(`l.price <= $${params.length}`);
      }
      if (filter.risk != null) {
        params.push(filter.risk);
        where.push(`(coalesce(t.base_break_risk, 0) + uc.runs_count * coalesce(t.wear_sensitivity, 0)) <= $${params.length}`);
      }
    }
    const order = filter?.sort ? LISTING_ORDER_SQL[filter.sort] : "l.created_at desc";
    const listings = (await c.query<Listing>(
      `${LISTING_SELECT} where ${where.join(" and ")} order by ${order} limit $1 offset $2`,
      params,
    )).rows;
    const offers = (await c.query<Offer>(
      "select * from marketplace_offers where status = 'pending' order by created_at desc limit $1",
      [OFFER_LIMIT],
    )).rows;
    const modifiers = await qModifiers(c);
    const names = await qNames(c, [...new Set(listings.map((x) => x.seller_id))]);
    const templateIds = [...new Set(listings.map((x) => x.user_cards.template_id))];
    const priceRef = new Map<string, PriceRef>();
    if (templateIds.length > 0) {
      const { rows } = await c.query<PriceRef & { template_id: string }>(
        "select template_id, avg_price, sales from market_price_ref where template_id = any($1::uuid[])", [templateIds]);
      for (const r of rows) priceRef.set(r.template_id, { avg_price: r.avg_price, sales: r.sales });
    }
    const history = p === 1
      ? (await c.query<MarketHistoryRow>("select * from public.my_market_history($1::uuid, 15)", [uid])).rows
      : [];
    const counts: Record<string, number> = {};
    for (const row of (await c.query<{ category: string; n: string | number }>(
      `select t.category, count(*)::int as n
         from marketplace_listings l
         join user_cards uc on uc.id = l.card_id
         join card_templates t on t.id = uc.template_id
        where l.status = 'active'
        group by t.category`,
    )).rows) counts[row.category] = Number(row.n);
    const rarityCounts: Record<string, number> = {};
    if (filter && (filter.tab.category === "moteur" || filter.tab.category === "boite")) {
      for (const row of (await c.query<{ rarity: string; n: string | number }>(
        `select t.rarity::text as rarity, count(*)::int as n
           from marketplace_listings l
           join user_cards uc on uc.id = l.card_id
           join card_templates t on t.id = uc.template_id
          where l.status = 'active' and t.category = $1 and t.rarity is not null
          group by t.rarity`,
        [filter.tab.category],
      )).rows) rarityCounts[row.rarity] = Number(row.n);
    }
    return { listings, offers, modifiers, names, priceRef, history, page: p, counts, rarityCounts };
  });

/** Notifications du Nav : une seule lecture, calculée en base (cf. migration 018). */
export const getNotifications = (uid: string) =>
  withUser(uid, async (c) =>
    (await c.query<{ r: NotificationFeed }>("select public.my_notifications($1::uuid) as r", [uid])).rows[0].r,
  );

/** Boutique : catalogue et modificateurs pneus. */
export const loadShopPage = (uid: string, filter: CatalogQuery) =>
  withUser(uid, async (c) => ({
    items: await qCatalog(c, filter),
    catalogCounts: await qCatalogCounts(c),
    modifiers: await qModifiers(c),
  }));
