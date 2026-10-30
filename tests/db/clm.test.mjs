import assert from "node:assert/strict";
import { test } from "node:test";
import { asUser, createPlayer, ensureTemplates, makeDeck, neutralizeWeather, withAdmin } from "./helpers.mjs";

async function clm(uid, deckId) {
  const { rows } = await asUser(uid, (c) =>
    c.query("select public.execute_clm($1::uuid, $2::uuid) as r", [uid, deckId]));
  return rows[0].r;
}

async function today(uid) {
  const { rows } = await asUser(uid, (c) =>
    c.query("select public.my_clm_today($1::uuid) as r", [uid]));
  return rows[0].r;
}

async function clmTemplates(c) {
  await c.query(`
    insert into card_templates (code, category, name, rarity, architecture, power_hp, weight_kg, base_break_risk, wear_sensitivity)
    values
      ('t_eng_clm_bronze', 'moteur', 'Moteur CLM bronze', 'commune', '4 cylindres', 150, 100, 0, 0),
      ('t_eng_clm_silver', 'moteur', 'Moteur CLM argent', 'commune', '4 cylindres', 300, 100, 0, 0),
      ('t_eng_clm_gold',   'moteur', 'Moteur CLM or',     'commune', '4 cylindres', 450, 100, 0, 0),
      ('t_eng_clm_break',  'moteur', 'Moteur CLM casse',  'commune', '4 cylindres', 300, 100, 100, 0)
    on conflict (code) do update set
      power_hp = excluded.power_hp,
      weight_kg = excluded.weight_kg,
      base_break_risk = excluded.base_break_risk,
      wear_sensitivity = 0`);
}

test("CLM : le défi du jour est stable et le catalogue contient les 15 circuits", async () => {
  await withAdmin(async (c) => {
    const player = await createPlayer(c, 0);
    await c.query("delete from clm_daily");

    const first = await today(player);
    const second = await today(player);

    assert.equal(first.day, second.day);
    assert.equal(first.circuit.id, second.circuit.id);
    assert.equal(first.weather, second.weather);
    assert.equal(first.attempts, 0);
    assert.deepEqual(first.claimed, []);
    assert.equal(first.participation_claimed, false);
    assert.equal(first.personal_best, null);
    assert.ok(first.circuit.name.length > 0);
    assert.ok(first.circuit.medals_seconds.gold < first.circuit.medals_seconds.silver);
    assert.ok(first.circuit.medals_seconds.silver < first.circuit.medals_seconds.bronze);

    const count = await c.query("select count(*)::int as n from clm_circuits");
    assert.equal(count.rows[0].n, 15);
  });
});

test("CLM : cascade des médailles, prime de participation, plafond quotidien et meilleur temps", async () => {
  await withAdmin(async (c) => {
    await ensureTemplates(c);
    await clmTemplates(c);
    await neutralizeWeather(c);

    const player = await createPlayer(c, 0);

    const silverDeck = await makeDeck(c, player, "t_eng_clm_silver");
    const silver1 = await clm(player, silverDeck.deckId);

    assert.equal(silver1.medal, "silver");
    assert.deepEqual(silver1.new_medals, ["bronze", "silver"]);
    assert.equal(silver1.medals_coins, 100);
    assert.equal(silver1.participation_coins, 10);
    assert.equal(silver1.coins, 110);
    assert.equal(silver1.previous_best, null);
    assert.equal(silver1.is_new_record, false);
    assert.ok(silver1.lap_seconds > 0);
    assert.equal(silver1.claimed.includes("bronze"), true);
    assert.equal(silver1.claimed.includes("silver"), true);
    assert.equal(silver1.participation_claimed, true);

    const coins1 = await c.query("select coins from profiles where id = $1", [player]);
    assert.equal(coins1.rows[0].coins, 110);

    const silver2 = await clm(player, silverDeck.deckId);
    assert.equal(silver2.medal, "silver");
    assert.deepEqual(silver2.new_medals, []);
    assert.equal(silver2.medals_coins, 0);
    assert.equal(silver2.participation_coins, 0);
    assert.equal(silver2.coins, 0);
    assert.equal(silver2.personal_best, Math.min(silver1.lap_seconds, silver2.lap_seconds));

    const goldDeck = await makeDeck(c, player, "t_eng_clm_gold");
    const gold = await clm(player, goldDeck.deckId);
    assert.equal(gold.medal, "gold");
    assert.deepEqual(gold.new_medals, ["gold"]);
    assert.equal(gold.medals_coins, 150);
    assert.equal(gold.participation_coins, 0);
    assert.equal(gold.coins, 150);

    const coins2 = await c.query("select coins from profiles where id = $1", [player]);
    assert.equal(coins2.rows[0].coins, 260);

    const pb = await c.query("select best_seconds from clm_personal_bests where user_id = $1", [player]);
    assert.equal(Number(pb.rows[0].best_seconds), Math.min(silver1.lap_seconds, silver2.lap_seconds, gold.lap_seconds));

    const attempts = await c.query("select count(*)::int as n from clm_attempts where user_id = $1", [player]);
    assert.equal(attempts.rows[0].n, 3);

    const medals = await c.query("select kind from trophy_medals where user_id = $1 order by kind", [player]);
    assert.deepEqual(medals.rows.map((r) => r.kind), ["chrono_bronze", "chrono_gold", "chrono_silver"]);
  });
});

test("CLM : décrocher l'Or d'entrée verse la cascade complète Or + Argent + Bronze", async () => {
  await withAdmin(async (c) => {
    await ensureTemplates(c);
    await clmTemplates(c);
    await neutralizeWeather(c);

    const player = await createPlayer(c, 0);
    const goldDeck = await makeDeck(c, player, "t_eng_clm_gold");
    const result = await clm(player, goldDeck.deckId);

    assert.equal(result.medal, "gold");
    assert.deepEqual(result.new_medals, ["bronze", "silver", "gold"]);
    assert.equal(result.medals_coins, 250);
    assert.equal(result.participation_coins, 10);
    assert.equal(result.coins, 260);
    assert.equal(result.claimed.includes("bronze"), true);
    assert.equal(result.claimed.includes("silver"), true);
    assert.equal(result.claimed.includes("gold"), true);

    const coins = await c.query("select coins from profiles where id = $1", [player]);
    assert.equal(coins.rows[0].coins, 260);
  });
});

test("CLM : une casse ne produit ni chrono, ni récompense, mais consomme la garantie", async () => {
  await withAdmin(async (c) => {
    await ensureTemplates(c);
    await clmTemplates(c);
    await neutralizeWeather(c);

    const player = await createPlayer(c, 0);
    const deck = await makeDeck(c, player, "t_eng_clm_break");

    const gumBefore = await c.query("select tire_wear from user_cards where id = $1", [deck.tire]);
    const result = await clm(player, deck.deckId);

    assert.equal(result.broken_part, "moteur");
    assert.equal(result.sp_final, null);
    assert.equal(result.lap_seconds, null);
    assert.deepEqual(result.new_medals, []);
    assert.equal(result.coins, 0);
    assert.equal(result.participation_claimed, false);

    const cards = await c.query(
      "select runs_count, runs_total, warranty_used, is_destroyed, tire_wear from user_cards where id = $1",
      [deck.engine],
    );
    assert.deepEqual(cards.rows[0], {
      runs_count: 0,
      runs_total: 1,
      warranty_used: 1,
      is_destroyed: true,
      tire_wear: null,
    });

    const gumAfter = await c.query("select tire_wear from user_cards where id = $1", [deck.tire]);
    assert.equal(gumAfter.rows[0].tire_wear, gumBefore.rows[0].tire_wear);

    const claims = await c.query("select count(*)::int as n from clm_daily_claims where user_id = $1", [player]);
    assert.equal(claims.rows[0].n, 0);
  });
});
