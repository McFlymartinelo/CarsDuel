import assert from "node:assert/strict";
import { test } from "node:test";
import { createPlayer, withAdmin } from "./helpers.mjs";

const coinsOf = async (c, id) => Number((await c.query("select coins from profiles where id = $1", [id])).rows[0].coins);

test("primes de classement : podium, top 5 % hors podium, égalités, une seule fois", async () => {
  await withAdmin(async (c) => {
    const before = (await c.query("select value from app_meta where key = 'leaderboard_rewards_from'")).rows[0].value;
    try {
      assert.equal(await c.query("select public.leaderboard_prize('weekly', 1, 1) as n").then((r) => r.rows[0].n), 50);
      assert.equal(await c.query("select public.leaderboard_prize('weekly', 4, 80) as n").then((r) => r.rows[0].n), 10);
      assert.equal(await c.query("select public.leaderboard_prize('weekly', 5, 80) as n").then((r) => r.rows[0].n), 0);
      assert.equal(await c.query("select public.leaderboard_prize('weekly', 4, 61) as n").then((r) => r.rows[0].n), 10);
      assert.equal(await c.query("select public.leaderboard_prize('weekly', 4, 60) as n").then((r) => r.rows[0].n), 0);
      assert.equal(await c.query("select public.leaderboard_prize('monthly', 1, 3) as n").then((r) => r.rows[0].n), 250);
      assert.equal(await c.query("select public.leaderboard_prize('monthly', 4, 80) as n").then((r) => r.rows[0].n), 50);

      await c.query("update app_meta set value = '2026-01-06 12:00+01' where key = 'leaderboard_rewards_from'");

      const field = [];
      for (let i = 0; i < 80; i++) {
        const id = await createPlayer(c, 0);
        field.push(id);
        await c.query(
          "insert into xp_events (user_id, amount, source, created_at) values ($1, $2, 'attack', '2026-01-07 15:00+01')",
          [id, 1000 - i],
        );
      }

      const tiedA = await createPlayer(c, 0);
      const tiedB = await createPlayer(c, 0);
      const third = await createPlayer(c, 0);
      for (const [id, amount] of [[tiedA, 500], [tiedB, 500], [third, 100]]) {
        await c.query(
          "insert into xp_events (user_id, amount, source, created_at) values ($1, $2, 'attack', '2026-03-04 15:00+01')",
          [id, amount],
        );
      }

      const tooEarly = await createPlayer(c, 0);
      await c.query(
        "insert into xp_events (user_id, amount, source, created_at) values ($1, 9000, 'attack', '2025-12-30 15:00+01')",
        [tooEarly],
      );
      const outsider = await createPlayer(c, 0);
      await c.query("insert into xp_events (user_id, amount, source) values ($1, 9000, 'attack')", [outsider]);

      const paid = Number((await c.query("select public.settle_leaderboard_rewards() as n")).rows[0].n);
      assert.ok(paid >= 4 + 3);

      assert.equal(await coinsOf(c, field[0]), 900);
      assert.equal(await coinsOf(c, field[1]), 720);
      assert.equal(await coinsOf(c, field[2]), 540);
      assert.equal(await coinsOf(c, field[3]), 180);
      assert.equal(await coinsOf(c, field[4]), 0);
      assert.equal(await coinsOf(c, tiedA), 600);
      assert.equal(await coinsOf(c, tiedB), 600);
      assert.equal(await coinsOf(c, third), 180);
      assert.equal(await coinsOf(c, tooEarly), 0);
      assert.equal(await coinsOf(c, outsider), 0);

      const ties = await c.query(
        "select period, rank, coins from leaderboard_payouts where user_id = $1 order by period",
        [tiedA],
      );
      assert.deepEqual(
        ties.rows.map((r) => [r.period, Number(r.rank), Number(r.coins)]),
        [["monthly", 1, 500], ["weekly", 1, 100]],
      );

      const week = await c.query(
        `select player_count, paid_coins from leaderboard_settlements
          where period = 'weekly' and period_start = (timestamp '2026-01-05 00:00' at time zone 'Europe/Paris')`,
      );
      assert.equal(Number(week.rows[0].player_count), 80);
      assert.equal(Number(week.rows[0].paid_coins), 390);

      const again = Number((await c.query("select public.settle_leaderboard_rewards() as n")).rows[0].n);
      assert.equal(again, 0);
      assert.equal(await coinsOf(c, field[0]), 900);

      const allowed = await c.query(
        "select has_function_privilege('app_user', 'public.settle_leaderboard_rewards()', 'execute') as ok",
      );
      assert.equal(allowed.rows[0].ok, false);
    } finally {
      await c.query("update app_meta set value = $1 where key = 'leaderboard_rewards_from'", [before]);
    }
  });
});

test("coefficient de rang : grille XP et primes multipliées", async () => {
  await withAdmin(async (c) => {
    const coeff = async (monthXp) =>
      Number((await c.query("select public.rank_coefficient($1) as n", [monthXp])).rows[0].n);
    assert.equal(await coeff(0), 1);
    assert.equal(await coeff(119), 1);
    assert.equal(await coeff(120), 1.5);
    assert.equal(await coeff(299), 1.5);
    assert.equal(await coeff(300), 2);
    assert.equal(await coeff(599), 2);
    assert.equal(await coeff(600), 2.5);
    assert.equal(await coeff(889), 2.5);
    assert.equal(await coeff(890), 3);

    const prize = async (period, rank, players, monthXp) =>
      Number(
        (await c.query("select public.leaderboard_prize($1, $2, $3, $4) as n", [period, rank, players, monthXp]))
          .rows[0].n,
      );
    assert.equal(await prize("weekly", 1, 10, 0), 50);
    assert.equal(await prize("weekly", 1, 10, 120), 75);
    assert.equal(await prize("weekly", 1, 10, 300), 100);
    assert.equal(await prize("weekly", 1, 10, 600), 125);
    assert.equal(await prize("weekly", 1, 10, 890), 150);
    assert.equal(await prize("monthly", 1, 10, 890), 750);
    assert.equal(await prize("monthly", 4, 80, 120), 75);
    assert.equal(await prize("weekly", 5, 80, 890), 0);
  });
});
