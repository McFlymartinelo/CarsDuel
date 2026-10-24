import "server-only";
import { withUser } from "@/lib/db";
import type { DuelRow, Listing, Offer, Profile, UserCard, UserDeck, CardTemplate } from "@/lib/types";

// Toutes les lectures passent par withUser : la RLS s'applique (rôle app_user).

const CARD_SELECT = `select uc.*, to_jsonb(t) as card_templates
  from user_cards uc join card_templates t on t.id = uc.template_id`;

export const getProfile = (uid: string) =>
  withUser(uid, async (c) =>
    (await c.query<Profile>("select id, username, coins, xp_total, last_daily_pull from profiles where id = $1", [uid])).rows[0] ?? null,
  );

export const getOwnCards = (uid: string) =>
  withUser(uid, async (c) =>
    (await c.query<UserCard>(`${CARD_SELECT} where uc.owner_id = $1 order by uc.acquired_at desc`, [uid])).rows,
  );

export const getOwnDecks = (uid: string) =>
  withUser(uid, async (c) =>
    (await c.query<UserDeck>("select * from user_decks where owner_id = $1 order by created_at", [uid])).rows,
  );

export const getDuelHistory = (uid: string, limit = 15) =>
  withUser(uid, async (c) =>
    (await c.query<DuelRow>("select * from duels_history order by created_at desc limit $1", [limit])).rows,
  );

export const getUsernames = (uid: string, ids: string[]) =>
  withUser(uid, async (c) => {
    if (ids.length === 0) return new Map<string, string>();
    const { rows } = await c.query<{ id: string; username: string }>(
      "select id, username from public_profiles where id = any($1::uuid[])", [ids]);
    return new Map(rows.map((r) => [r.id, r.username]));
  });

export const getActiveListings = (uid: string) =>
  withUser(uid, async (c) =>
    (await c.query<Listing>(
      `select l.*, (to_jsonb(uc) || jsonb_build_object('card_templates', to_jsonb(t))) as user_cards
         from marketplace_listings l
         join user_cards uc on uc.id = l.card_id
         join card_templates t on t.id = uc.template_id
        where l.status = 'active' order by l.created_at desc`)).rows,
  );

export const getPendingOffers = (uid: string) =>
  withUser(uid, async (c) =>
    (await c.query<Offer>("select * from marketplace_offers where status = 'pending'")).rows,
  );

export interface TireModifier {
  tire_type: string;
  weather: string;
  perf_bonus_pct: number;
  wear_pct: number;
}

export const getTireModifiers = (uid: string) =>
  withUser(uid, async (c) =>
    (await c.query<TireModifier>("select tire_type, weather, perf_bonus_pct, wear_pct from tire_weather_modifiers")).rows,
  );

export interface CatalogRow {
  id: string;
  price: number;
  stock: number | null;
  card_templates: CardTemplate;
}

export const getShopCatalog = (uid: string) =>
  withUser(uid, async (c) =>
    (await c.query<CatalogRow>(
      `select s.id, s.price, s.stock, to_jsonb(t) as card_templates
         from shop_catalog s join card_templates t on t.id = s.template_id
        where s.is_active order by s.price, t.name`)).rows,
  );

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
