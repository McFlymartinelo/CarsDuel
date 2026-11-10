import "server-only";
import type { PoolClient } from "pg";
import { withUser } from "@/lib/db";
import type { CatalogQuery } from "@/lib/catalog-filters";
import { LISTING_ORDER_SQL } from "@/lib/catalog-sort";
import { cardImageUrl } from "@/lib/card-images";
import { parsePage } from "@/lib/pagination";
import { cleanSearch, isReferenceSearch } from "@/lib/search";
import { nextParisMidnight, nextUtcMidnight } from "@/lib/format";
import type { DailyQuestState } from "@/lib/quests";
import type { EquippedConfig } from "@/lib/compare";
import type {
  CardTemplate,
  ClmChallenge,
  ConfigChallenge,
  DuelRow,
  DynoChallenge,
  Listing,
  MarketHistoryRow,
  NotificationFeed,
  Offer,
  PriceRef,
  TradeCard,
  TradeItem,
  TradeOffer,
  UserCard,
  UserDeck,
} from "@/lib/types";

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

/**
 * Configuration équipée de référence (decks[0], celle utilisée par la page
 * Jouer) pour le comparateur à l'achat. `null` si le deck est absent ou
 * incomplet (carte supprimée).
 */
async function qEquipped(c: PoolClient, uid: string): Promise<EquippedConfig | null> {
  const deck = (await c.query<UserDeck>(
    "select * from user_decks where owner_id = $1 order by created_at limit 1", [uid],
  )).rows[0];
  if (!deck) return null;

  const ids = [deck.engine_card_id, deck.gearbox_card_id, deck.tire_card_id];
  const cards = (await c.query<UserCard>(
    `${CARD_SELECT} where uc.id = any($1::uuid[])`, [ids],
  )).rows;
  const byId = new Map(cards.map((x) => [x.id, x]));
  const engine = byId.get(deck.engine_card_id!);
  const gearbox = byId.get(deck.gearbox_card_id!);
  const tire = byId.get(deck.tire_card_id!);
  if (!engine || !gearbox || !tire) return null;

  return {
    engine: { card: engine, template: engine.card_templates },
    gearbox: { card: gearbox, template: gearbox.card_templates },
    tire: { card: tire, template: tire.card_templates },
  };
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

/**
 * Centre de recyclage : uniquement les cartes recyclables (moteurs, boîtes,
 * pneus) hors annonces, plus les modificateurs pneus. Évite de charger tout
 * l'inventaire (bonus, decks, annonces) pour une page qui n'en a pas besoin.
 */
export const loadRecycleCenterPage = (uid: string) =>
  withUser(uid, async (c) => ({
    cards: (await c.query<UserCard>(
      `${CARD_SELECT}
        where uc.owner_id = $1
          and not uc.is_listed
          and t.category in ('moteur', 'boite', 'pneus')
        order by uc.acquired_at desc`,
      [uid],
    )).rows,
    modifiers: await qModifiers(c),
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

/** Duel : inventaire, decks et modificateurs pneus. L'historique est chargé à part (Suspense). */
export const loadDuelPage = (uid: string) =>
  withUser(uid, async (c) => {
    const cards = await qCards(c, uid);
    const decks = await qDecks(c, uid);
    const modifiers = await qModifiers(c);
    return { cards, decks, modifiers };
  });

/** Historique paginé et pseudos des adversaires (bloc streamé de la page /duel). */
export const loadDuelHistory = (uid: string, page = 1) =>
  withUser(uid, async (c) => {
    const p = parsePage(page);
    const history = (await c.query<DuelRow>(
      "select * from duels_history order by created_at desc limit $1 offset $2",
      [DUEL_PAGE_SIZE, (p - 1) * DUEL_PAGE_SIZE],
    )).rows;
    const ids = [...new Set(history.map((x) => (x.attacker_id === uid ? x.defender_id : x.attacker_id)))];
    return { history, names: await qNames(c, ids), page: p };
  });

/** Contre-La-Montre solo : défi du jour, record personnel et récompenses déjà validées. */
export const loadClmChallenge = (uid: string) =>
  withUser(uid, async (c) => {
    const row = (await c.query<{ r: ClmChallenge }>("select public.my_clm_today($1::uuid) as r", [uid])).rows[0]?.r;
    if (!row) return null;
    return { ...row, changes_at: nextParisMidnight() };
  });

/** Banc d'essai : défi et météo du jour, meilleur SP personnel et médailles déjà validées. */
export const loadDynoChallenge = (uid: string) =>
  withUser(uid, async (c) => {
    const row = (await c.query<{ r: DynoChallenge }>("select public.my_dyno_today($1::uuid) as r", [uid])).rows[0]?.r;
    if (!row) return null;
    return { ...row, changes_at: nextUtcMidnight() };
  });

/** Configs Constructeur : défi de la semaine, teaser, progression et paires déjà validées. */
export const loadConfigChallenge = (uid: string) =>
  withUser(uid, async (c) =>
    (await c.query<{ r: ConfigChallenge }>("select public.config_challenge_status($1::uuid) as r", [uid])).rows[0]?.r ?? null,
  );

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
    const incomingTrades = (await c.query<{ n: number }>(
      "select count(*)::int as n from trade_offers where status = 'pending' and recipient_id = $1 and expires_at > now()",
      [uid],
    )).rows[0]?.n ?? 0;
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
    return { listings, offers, modifiers, names, priceRef, history, incomingTrades, page: p, counts, rarityCounts, equipped: await qEquipped(c, uid) };
  });

/** Cartes affichables dans les échanges (propriété, non détruites, hors benne, non privées). */
const TRADE_CARD_WHERE = "not uc.is_destroyed and not coalesce(uc.in_recycle_bin, false) and t.restricted_to_username is null";

const asTradeCard = (card: UserCard): TradeCard => ({ ...card, image: cardImageUrl(card.card_templates) });

interface TradeItemRow {
  id: string;
  trade_id: string;
  side: "proposer" | "recipient";
  card_id: string;
  user_cards: UserCard;
}

/**
 * Onglet Échanges : inventaire du joueur, offres en attente (envoyées et reçues)
 * avec leurs cartes, et pseudos des deux parties. Les offres expirées sont
 * marquées puis masquées.
 */
export const loadTradeCenterPage = (uid: string) =>
  withUser(uid, async (c) => {
    await c.query("select public.expire_trade_offers($1::uuid)", [uid]);

    const cards = (await c.query<UserCard>(
      `${CARD_SELECT} where uc.owner_id = $1 and ${TRADE_CARD_WHERE} order by uc.acquired_at desc`,
      [uid],
    )).rows;

    const offers = (await c.query<Omit<TradeOffer, "items">>(
      `select id, proposer_id, recipient_id, proposer_coins, status, created_at, updated_at, expires_at
         from trade_offers
        where status = 'pending' and (proposer_id = $1 or recipient_id = $1)
        order by updated_at desc`,
      [uid],
    )).rows;

    const ids = offers.map((o) => o.id);
    const items = ids.length === 0 ? [] : (await c.query<TradeItemRow>(
      `select i.id, i.trade_id, i.side, i.card_id,
              (to_jsonb(uc) || jsonb_build_object('card_templates', to_jsonb(t))) as user_cards
         from trade_offer_items i
         join user_cards uc on uc.id = i.card_id
         join card_templates t on t.id = uc.template_id
        where i.trade_id = any($1::uuid[])
        order by i.created_at, i.id`,
      [ids],
    )).rows;

    const byTrade = new Map<string, TradeItem[]>();
    for (const item of items) {
      const list = byTrade.get(item.trade_id) ?? [];
      list.push({ ...item, user_cards: asTradeCard(item.user_cards) });
      byTrade.set(item.trade_id, list);
    }

    const names = await qNames(c, [...new Set(offers.flatMap((o) => [o.proposer_id, o.recipient_id]))]);

    return {
      cards: cards.map(asTradeCard),
      offers: offers.map((o) => ({ ...o, items: byTrade.get(o.id) ?? [] })),
      names,
    };
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
    equipped: await qEquipped(c, uid),
  }));

/**
 * Collection : toutes les cartes, avec l'historique d'obtention du joueur.
 * `obtained` reste vrai même après benne, recyclage ou vente (badge « Déjà obtenue ») ;
 * `owned` reflète la possession actuelle (progression des défis du collectionneur).
 */
export const loadCollectorCollection = (uid: string) =>
  withUser(uid, async (c) => (await c.query<{ card_templates: CardTemplate; obtained: boolean; owned: boolean }>(
    `select to_jsonb(t) as card_templates,
            exists (select 1 from collector_obtained co where co.owner_id = $1 and co.template_id = t.id) as obtained,
            exists (select 1 from user_cards uc where uc.owner_id = $1 and uc.template_id = t.id) as owned
       from card_templates t
      order by t.category, t.code nulls last, t.name`, [uid])).rows);

/** Défis du collectionneur déjà réclamés par le joueur. */
export const loadCollectorChallengeClaims = (uid: string) =>
  withUser(uid, async (c) => (await c.query<{ challenge_key: string }>(
    `select challenge_key from collector_challenge_claims where owner_id = $1`, [uid])).rows.map((row) => row.challenge_key));
