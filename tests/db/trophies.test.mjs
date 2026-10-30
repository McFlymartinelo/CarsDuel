import assert from "node:assert/strict";
import { test } from "node:test";
import { asUser, createPlayer, expectError, withAdmin } from "./helpers.mjs";

test("vitrine : victoires en duel, titres de classement et médailles chrono", async () => {
  await withAdmin(async (c) => {
    const player = await createPlayer(c, 0);
    const opponent = await createPlayer(c, 0);

    await c.query(
      `insert into duels_history
         (attacker_id, defender_id, weather, defender_sp, result, attacker_coins, attacker_xp)
       values
         ($1, $2, 'sunny_cool', 10, 'attacker_win', 10, 10),
         ($1, $2, 'sunny_cool', 10, 'defender_win', 2, 2),
         ($2, $1, 'sunny_cool', 10, 'defender_win', 2, 2)`,
      [player, opponent],
    );

    await c.query(
      `insert into leaderboard_payouts (period, period_start, user_id, rank, xp, coins)
       values
         ('weekly', '2026-01-05 00:00+01', $1, 1, 100, 50),
         ('monthly', '2026-01-01 00:00+01', $1, 1, 100, 250),
         ('weekly', '2026-01-12 00:00+01', $1, 2, 90, 40)`,
      [player],
    );

    await c.query(
      `insert into trophy_medals (user_id, kind)
       values ($1, 'chrono_gold'), ($1, 'chrono_gold'), ($1, 'chrono_silver')`,
      [player],
    );

    const stats = await asUser(player, async (uc) =>
      (await uc.query("select public.my_trophy_stats($1) as r", [player])).rows[0].r,
    );

    assert.deepEqual(stats, {
      attack_wins: 1,
      defense_wins: 1,
      attack_duels: 2,
      weekly_firsts: 1,
      monthly_firsts: 1,
      chrono_gold: 2,
      chrono_silver: 1,
      chrono_bronze: 0,
    });

    await expectError(player, (uc) => uc.query("select public.my_trophy_stats($1)", [opponent]), "forbidden");
  });
});
