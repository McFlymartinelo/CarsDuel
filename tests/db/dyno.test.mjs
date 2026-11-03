import assert from "node:assert/strict";
import { test } from "node:test";
import { asUser, createPlayer, ensureTemplates, expectError, makeDeck, neutralizeWeather, withAdmin } from "./helpers.mjs";

async function dyno(uid, deckId) {
  const { rows } = await asUser(uid, (c) =>
    c.query("select public.execute_dyno($1::uuid, $2::uuid) as r", [uid, deckId]));
  return rows[0].r;
}

async function today(uid) {
  const { rows } = await asUser(uid, (c) =>
    c.query("select public.my_dyno_today($1::uuid) as r", [uid]));
  return rows[0].r;
}

async function setDaily(c, configId, weather = "sunny_hot") {
  await c.query(
    `insert into dyno_daily (day, config_id, weather)
     values ((now() at time zone 'UTC')::date, $1, $2)
     on conflict (day) do update set config_id = excluded.config_id, weather = excluded.weather`,
    [configId, weather],
  );
}

async function dynoTemplates(c) {
  await c.query(`
    insert into card_templates (code, category, name, rarity, architecture, power_hp, weight_kg, base_break_risk, wear_sensitivity)
    values
      ('t_eng_dyno_silver', 'moteur', 'Moteur banc argent', 'commune', '4 cylindres', 300, 100, 0, 0),
      ('t_eng_dyno_gold',   'moteur', 'Moteur banc or',     'commune', '4 cylindres', 450, 100, 0, 0)
    on conflict (code) do update set
      power_hp = excluded.power_hp,
      weight_kg = excluded.weight_kg,
      base_break_risk = excluded.base_break_risk,
      wear_sensitivity = 0`);
}

test("Banc d'essai : le défi du jour est stable et le catalogue contient les 16 configurations", async () => {
  await withAdmin(async (c) => {
    const player = await createPlayer(c, 0);
    await c.query("delete from dyno_daily");

    const first = await today(player);
    const second = await today(player);

    assert.equal(first.day, second.day);
    assert.equal(first.config.id, second.config.id);
    assert.equal(first.weather, second.weather);
    assert.equal(first.attempts, 0);
    assert.deepEqual(first.claimed, []);
    assert.equal(first.personal_best, null);
    assert.ok(first.config.name.length > 0);
    assert.ok(first.config.medals_sp.bronze < first.config.medals_sp.silver);
    assert.ok(first.config.medals_sp.silver < first.config.medals_sp.gold);

    const count = await c.query("select count(*)::int as n from dyno_configs");
    assert.equal(count.rows[0].n, 16);
  });
});

test("Banc d'essai : record du jour, cascade Or + Argent + Bronze et relance sans nouvelle récompense", async () => {
  await withAdmin(async (c) => {
    await ensureTemplates(c);
    await dynoTemplates(c);
    await neutralizeWeather(c);
    await setDaily(c, "dyno_free_run", "sunny_hot");

    const player = await createPlayer(c, 0);
    const smallDeck = await makeDeck(c, player, "t_eng");
    const goldDeck = await makeDeck(c, player, "t_eng_dyno_gold");

    const first = await dyno(player, smallDeck.deckId);
    assert.equal(first.previous_best, null);
    assert.equal(first.is_new_record, false);
    assert.equal(first.medal, null);
    assert.deepEqual(first.new_medals, []);
    assert.equal(first.medals_coins, 0);
    assert.equal(first.participation_coins, 10);
    assert.equal(first.coins, 10);
    assert.equal(first.participation_claimed, true);
    assert.equal(first.personal_best, first.sp_final);

    const second = await dyno(player, goldDeck.deckId);
    assert.ok(second.sp_final > first.sp_final);
    assert.equal(second.previous_best, first.sp_final);
    assert.equal(second.is_new_record, true);
    assert.equal(second.medal, "gold");
    assert.deepEqual(second.new_medals, ["bronze", "silver", "gold"]);
    assert.equal(second.medals_coins, 170);
    assert.equal(second.participation_coins, 0);
    assert.equal(second.coins, 170);
    assert.equal(second.personal_best, second.sp_final);
    assert.deepEqual(second.claimed, ["bronze", "silver", "gold"]);

    const coins = await c.query("select coins from profiles where id = $1", [player]);
    assert.equal(coins.rows[0].coins, 180);

    const third = await dyno(player, goldDeck.deckId);
    assert.equal(third.is_new_record, false);
    assert.deepEqual(third.new_medals, []);
    assert.equal(third.participation_coins, 0);
    assert.equal(third.coins, 0);
    assert.equal(third.personal_best, second.sp_final);

    const medals = await c.query("select kind from trophy_medals where user_id = $1 order by kind", [player]);
    assert.deepEqual(medals.rows.map((r) => r.kind), ["dyno_bronze", "dyno_gold", "dyno_silver"]);

    const best = await c.query("select best_sp from dyno_daily_bests where user_id = $1", [player]);
    assert.equal(Number(best.rows[0].best_sp), second.sp_final);

    const attempts = await c.query("select count(*)::int as n from dyno_attempts where user_id = $1", [player]);
    assert.equal(attempts.rows[0].n, 3);
  });
});

test("Banc d'essai : une médaille déjà validée n'est jamais repayée, même après une amélioration", async () => {
  await withAdmin(async (c) => {
    await ensureTemplates(c);
    await dynoTemplates(c);
    await neutralizeWeather(c);
    await setDaily(c, "dyno_free_run", "sunny_hot");

    const player = await createPlayer(c, 0);
    const silverDeck = await makeDeck(c, player, "t_eng_dyno_silver");
    const goldDeck = await makeDeck(c, player, "t_eng_dyno_gold");

    const silver = await dyno(player, silverDeck.deckId);
    assert.equal(silver.medal, "silver");
    assert.deepEqual(silver.new_medals, ["bronze", "silver"]);
    assert.equal(silver.medals_coins, 70);
    assert.equal(silver.participation_coins, 10);
    assert.equal(silver.coins, 80);

    const gold = await dyno(player, goldDeck.deckId);
    assert.equal(gold.medal, "gold");
    assert.deepEqual(gold.new_medals, ["gold"]);
    assert.equal(gold.coins, 100);

    const coins = await c.query("select coins from profiles where id = $1", [player]);
    assert.equal(coins.rows[0].coins, 180);
  });
});

test("Banc d'essai : zéro usure, zéro run et zéro garantie consommés", async () => {
  await withAdmin(async (c) => {
    await ensureTemplates(c);
    await neutralizeWeather(c);
    await setDaily(c, "dyno_free_run", "sunny_hot");

    const player = await createPlayer(c, 0);
    const deck = await makeDeck(c, player, "t_eng");

    const before = await c.query(
      `select tire_wear from user_cards where id = $1`,
      [deck.tire],
    );
    const mechanicalBefore = await c.query(
      `select runs_count, runs_total, warranty_used, is_destroyed
         from user_cards where id = any($1::uuid[]) order by id`,
      [[deck.engine, deck.gearbox]],
    );

    await dyno(player, deck.deckId);

    const after = await c.query("select tire_wear from user_cards where id = $1", [deck.tire]);
    const mechanicalAfter = await c.query(
      `select runs_count, runs_total, warranty_used, is_destroyed
         from user_cards where id = any($1::uuid[]) order by id`,
      [[deck.engine, deck.gearbox]],
    );

    assert.equal(after.rows[0].tire_wear, before.rows[0].tire_wear);
    assert.deepEqual(mechanicalAfter.rows, mechanicalBefore.rows);
  });
});

test("Banc d'essai : les contraintes du jour sont vérifiées côté base", async () => {
  await withAdmin(async (c) => {
    await ensureTemplates(c);
    await neutralizeWeather(c);
    await setDaily(c, "dyno_max_power_120", "sunny_hot");

    const player = await createPlayer(c, 0);
    const tooPowerful = await makeDeck(c, player, "t_eng_far");
    const valid = await makeDeck(c, player, "t_eng");

    await expectError(
      player,
      (c2) => c2.query("select public.execute_dyno($1::uuid, $2::uuid) as r", [player, tooPowerful.deckId]),
      "dyno_constraint_failed",
    );

    const ok = await dyno(player, valid.deckId);
    assert.equal(ok.medal, "silver");

    await setDaily(c, "dyno_tire_sport", "sunny_hot");
    const wrongTire = await makeDeck(c, player, "t_eng");
    const sportTire = await makeDeck(c, player, "t_eng", "t_gb", "tire_sport");

    await expectError(
      player,
      (c2) => c2.query("select public.execute_dyno($1::uuid, $2::uuid) as r", [player, wrongTire.deckId]),
      "dyno_constraint_failed",
    );

    const sport = await dyno(player, sportTire.deckId);
    assert.ok(sport.sp_final > 0);
  });
});
