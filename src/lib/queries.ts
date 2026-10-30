import "server-only";
import type { PoolClient } from "pg";
import { withUser } from "@/lib/db";
import type { CatalogQuery } from "@/lib/catalog-filters";
import { LISTING_ORDER_SQL } from "@/lib/catalog-sort";
import { parsePage } from "@/lib/pagination";
import { cleanSearch, isReferenceSearch } from "@/lib/search";
import type { DailyQuestState } from "@/lib/quests";
import type { DuelRow, Listing, MarketHistoryRow, NotificationFeed, Offer, PriceRef, UserCard, UserDeck, CardTemplate } from "@/lib/types";

// Toutes les lectures passent par withUser : la RLS s'applique (rôle app_user).
// Les chargeurs de page enchaînent leurs requêtes sur le MÊME client (une transaction).

export const LISTING_PAGE_SIZE = 30;
export const OFFER_LIMIT = 50;
export const DUEL_PAGE_SIZE = 20;

const CARD_SELECT = `select uc.*, to_jsonb(t) as card_templates
  from user_cards uc join card_templates t on t.id = uc.template_id`;

const LISTING_SELECT = `select l.*, (to_jsonb(uc) || jsonb_build_object('card_templates', to_jsonb(t))) as user_cards
  from marketplace_listings l
  join user_cards uc on uc.id = l.card_id
  join card_templates t on t.id = uc.template_id`;

/** Clause de recherche nom / code / référence, ajoutée aux paramètres fournis. */
function searchClause(params: unknown[], q: string | undefined): string | null {
  const term = cleanSearch(q);
  if (!term) return null;
  const like = `%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  if (isReferenceSearch(term)) {
    // Référence : « 1 » → #1, #1A, #1B mais pas #10 ; « 1A » → #1A, pas #21A.
    params.push(term);
    const reference = `$${params.length}`;
    const code = `t.code ~* ('^[mb]_?' || ${reference} || '[a-z]*$')`;
    if (/[a-z]/i.test(term)) {
      params.push(like);
      return `(${code} or t.name ilike $${params.length} escape '\\')`;
    }
    return `(${code})`;
  }
  params.push(like);
  const p = `$${params.length}`;
  return `(t.name ilike ${p} escape '\\' or t.code ilike ${p} escape '\\')`;
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

export const getDuelHistory = (uid: string, limit = DUEL_PAGE_SIZE, offset = 0) =>
  withUser(uid, async (c) =>
    (await c.query<DuelRow>("select * from duels_history order by created_at desc limit $1 offset $2", [limit, offset])).rows,
  );

export interface TireModifier {
  tire_type: string;
  weather: string;
  perf_bonus_pct: number;
  wear_pct: number;
}

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
    const search = searchClause(params, filter.q);
    if (search) where.push(search);
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

export interface TrophyStats {
  attack_wins: number;
  defense_wins: number;
  attack_duels: number;
  weekly_firsts: number;
  monthly_firsts: number;
  chrono_gold: number;
  chrono_silver: number;
  chrono_bronze: number;
}

/** Compteurs de la vitrine de trophées (calculés en base). */
export const loadTrophyStats = (uid: string) =>
  withUser(uid, async (c) =>
    (await c.query<{ r: TrophyStats }>("select public.my_trophy_stats($1::uuid) as r", [uid])).rows[0].r,
  );

/** Modificateurs pneus × météo (performances et usure affichées sur les cartes). */
export const loadTireModifiers = (uid: string) => withUser(uid, (c) => qModifiers(c));

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

/** Demandes de duel en attente et pseudos associés (page /duel uniquement). */
export const loadOrganizedChallenges = (uid: string) =>
  withUser(uid, async (c) => {
    const challenges = (await c.query<DuelChallengeRow>(
      `select id, challenger_id, target_id, created_at, status
         from duel_challenges
        where status = 'pending' and (challenger_id = $1 or target_id = $1)
        order by created_at desc`,
      [uid],
    )).rows;
    const names = await qNames(c, [...new Set(challenges.flatMap((x) => [x.challenger_id, x.target_id]))]);
    return { challenges, names };
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

/** Duel : inventaire, historique paginé et pseudos des adversaires. */
export const loadDuelPage = (uid: string, page = 1) =>
  withUser(uid, async (c) => {
    const p = parsePage(page);
    const cards = await qCards(c, uid);
    const decks = await qDecks(c, uid);
    const history = (await c.query<DuelRow>(
      "select * from duels_history order by created_at desc limit $1 offset $2",
      [DUEL_PAGE_SIZE, (p - 1) * DUEL_PAGE_SIZE],
    )).rows;
    const modifiers = await qModifiers(c);
    const ids = [...new Set(history.map((x) => (x.attacker_id === uid ? x.defender_id : x.attacker_id)))];
    return { cards, decks, modifiers, history, names: await qNames(c, ids), page: p };
  });

/** Marketplace : annonces filtrées (page), offres, inventaire et pseudos des vendeurs. */
export const loadMarketplacePage = (uid: string, page = 1, filter?: CatalogQuery | null) =>
  withUser(uid, async (c) => {
    const p = parsePage(page);
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
      const search = searchClause(params, filter.q);
      if (search) where.push(search);
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

/** Collection : toutes les cartes, avec l'historique d'obtention du joueur. */
export const loadCollectorCollection = (uid: string) =>
  withUser(uid, async (c) => (await c.query<{ card_templates: CardTemplate; obtained: boolean }>(
    `select to_jsonb(t) as card_templates,
            exists (select 1 from user_cards uc where uc.owner_id = $1 and uc.template_id = t.id) as obtained
       from card_templates t
      order by t.category, t.code nulls last, t.name`, [uid])).rows);

/** Défis du collectionneur déjà réclamés par le joueur. */
export const loadCollectorChallengeClaims = (uid: string) =>
  withUser(uid, async (c) => (await c.query<{ challenge_key: string }>(
    `select challenge_key from collector_challenge_claims where owner_id = $1`, [uid])).rows.map((row) => row.challenge_key));
