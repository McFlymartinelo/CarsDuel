import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createPlayer, ensureTemplates, giveCard, withAdmin } from "./helpers.mjs";

before(async () => {
  await withAdmin(ensureTemplates);
});

test("garage : les index complets existent et servent le plan de qCards", async () => {
  const user = await withAdmin(async (c) => {
    const id = await createPlayer(c);
    for (let i = 0; i < 50; i++) await giveCard(c, id, "t_eng");
    return id;
  });

  const indexes = await withAdmin(async (c) => {
    const { rows } = await c.query(
      `select indexname from pg_indexes
        where schemaname = 'public' and tablename = 'user_cards'
        order by indexname`,
    );
    return rows.map((r) => r.indexname);
  });
  assert.ok(indexes.includes("idx_user_cards_owner_acquired"));
  assert.ok(indexes.includes("idx_user_cards_owner_template"));
  // L'index partiel existant doit rester disponible pour les requêtes filtrées.
  assert.ok(indexes.includes("idx_user_cards_owner"));

  const plan = await withAdmin(async (c) => {
    await c.query("set enable_seqscan = off");
    await c.query("set enable_bitmapscan = off");
    const { rows } = await c.query(
      `explain (costs off)
       select uc.id from user_cards uc
        where uc.owner_id = $1
        order by uc.acquired_at desc`,
      [user],
    );
    return rows.map((r) => r["QUERY PLAN"]).join("\n");
  });
  assert.match(plan, /idx_user_cards_owner_acquired/);
});

test("notifications : les index des branches récentes existent et sont utilisés", async () => {
  const user = await withAdmin((c) => createPlayer(c));

  const plans = await withAdmin(async (c) => {
    await c.query("set enable_seqscan = off");
    await c.query("set enable_bitmapscan = off");
    const explain = async (sql, params) =>
      (await c.query(`explain (costs off) ${sql}`, params)).rows.map((r) => r["QUERY PLAN"]).join("\n");
    return {
      sale: await explain(
        `select 1 from marketplace_listings l
          where l.seller_id = $1 and l.status = 'sold' and l.closed_at > now() - interval '30 days'`,
        [user],
      ),
      offer: await explain(
        `select 1 from marketplace_offers o
          where o.buyer_id = $1 and o.status in ('accepted', 'rejected')
            and o.resolved_at > now() - interval '30 days'`,
        [user],
      ),
      payout: await explain(
        `select 1 from leaderboard_payouts pp
          where pp.user_id = $1 and pp.created_at > now() - interval '30 days'`,
        [user],
      ),
      duel: await explain(
        `select 1 from duels_history d
          where d.defender_id = $1 and d.created_at > now() - interval '30 days'`,
        [user],
      ),
      challenge: await explain(
        `select 1 from duel_challenges c
          where c.target_id = $1 and c.status = 'pending'
            and c.created_at > now() - interval '30 days'`,
        [user],
      ),
    };
  });

  assert.match(plans.sale, /idx_listings_seller_status_closed|idx_listings_sold_seller_buyer/);
  assert.match(plans.offer, /idx_offers_buyer_status_resolved/);
  assert.match(plans.payout, /idx_payouts_user_created/);
  assert.match(plans.duel, /idx_duels_defender/);
  assert.match(plans.challenge, /idx_duel_challenges_pending/);
});
