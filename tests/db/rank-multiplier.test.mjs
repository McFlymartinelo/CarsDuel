import assert from "node:assert/strict";
import { before, test } from "node:test";
import { asUser, clearArena, createPlayer, duel, ensureTemplates, makeDeck, neutralizeWeather, withAdmin } from "./helpers.mjs";

before(async () => {
  await withAdmin(async (c) => {
    await neutralizeWeather(c);
    await ensureTemplates(c);
    await c.query(`
      insert into card_templates (code, category, name, rarity, architecture, power_hp, weight_kg, base_break_risk, wear_sensitivity)
      values
        ('t_eng_mult_clm_silver', 'moteur', 'Moteur CLM multiplicateur', 'commune', '4 cylindres', 300, 100, 0, 0),
        ('t_eng_mult_dyno_gold',   'moteur', 'Moteur banc multiplicateur', 'commune', '4 cylindres', 450, 100, 0, 0)
      on conflict (code) do update set
        power_hp = excluded.power_hp,
        weight_kg = excluded.weight_kg,
        base_break_risk = 0,
        wear_sensitivity = 0`);
  });
});

/** Ajoute de l'XP au mois courant pour fixer le rang visé. */
async function grantMonthXp(user, amount) {
  await withAdmin((c) =>
    c.query(
      "insert into xp_events (user_id, amount, source, created_at) values ($1, $2, 'attack', now())",
      [user, amount],
    ));
}

async function rankedCoins(user, base) {
  return withAdmin(async (c) => Number(
    (await c.query("select private.ranked_coins($1::uuid, $2::int) as n", [user, base])).rows[0].n,
  ));
}

test("multiplicateur de rang : grille sur l'XP du mois calendaire", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  const cases = [
    [0, 10],
    [119, 10],
    [120, 15],
    [299, 15],
    [300, 20],
    [599, 20],
    [600, 25],
    [889, 25],
    [890, 30],
  ];
  for (const [xp, expected] of cases) {
    await withAdmin((c) => c.query("delete from xp_events where user_id = $1", [user]));
    if (xp > 0) await grantMonthXp(user, xp);
    assert.equal(await rankedCoins(user, 10), expected, `XP ${xp}`);
  }
});

test("duel : attaquant et défenseur touchent chacun leur multiplicateur", async () => {
  const fx = await withAdmin(async (c) => {
    await clearArena(c);
    const attacker = await createPlayer(c);
    const defender = await createPlayer(c);
    const deck = await makeDeck(c, attacker, "t_eng_far");
    await makeDeck(c, defender, "t_eng");
    return { attacker, defender, deckId: deck.deckId };
  });
  await grantMonthXp(fx.attacker, 890); // ×3
  const lead = await duel(fx.attacker, fx.deckId);
  assert.equal(lead.result, "attacker_win");
  assert.equal(lead.coins, 30);
  assert.equal(lead.xp, 10); // l'XP n'est jamais multipliée

  await withAdmin(async (c) => {
    const row = (await c.query(
      "select attacker_coins, defender_coins from duels_history where id = $1",
      [lead.duel_id],
    )).rows[0];
    assert.equal(Number(row.attacker_coins), 30);
    assert.equal(Number(row.defender_coins), 1);
    const coins = new Map((await c.query(
      "select id, coins from profiles where id = any($1::uuid[])",
      [[fx.attacker, fx.defender]],
    )).rows.map((r) => [r.id, Number(r.coins)]));
    assert.equal(coins.get(fx.attacker), 30);
    assert.equal(coins.get(fx.defender), 1);
  });

  // Le défenseur classé ×2,5 touche son bonus de victoire multiplié (4 × 2,5).
  const other = await withAdmin(async (c) => {
    await clearArena(c);
    const attacker = await createPlayer(c);
    const defender = await createPlayer(c);
    const deck = await makeDeck(c, attacker, "t_eng");
    await makeDeck(c, defender, "t_eng_far");
    return { attacker, defender, deckId: deck.deckId };
  });
  await grantMonthXp(other.defender, 600);
  const out = await duel(other.attacker, other.deckId);
  assert.equal(out.result, "defender_win");
  await withAdmin(async (c) => {
    const row = (await c.query(
      "select defender_coins from duels_history where id = $1",
      [out.duel_id],
    )).rows[0];
    assert.equal(Number(row.defender_coins), 10);
    const coins = Number((await c.query("select coins from profiles where id = $1", [other.defender])).rows[0].coins);
    assert.equal(coins, 10);
  });
});

test("Contre-La-Montre : médailles et participation multipliées", async () => {
  const fx = await withAdmin(async (c) => {
    const player = await createPlayer(c);
    const deck = await makeDeck(c, player, "t_eng_mult_clm_silver");
    return { player, deckId: deck.deckId };
  });
  await grantMonthXp(fx.player, 300); // ×2

  const result = (await asUser(fx.player, (c) =>
    c.query("select public.execute_clm($1::uuid, $2::uuid, null) as r", [fx.player, fx.deckId]))).rows[0].r;

  assert.equal(result.medal, "silver");
  assert.deepEqual(result.new_medals, ["bronze", "silver"]);
  assert.equal(result.medals_coins, 140); // (20 + 50) × 2
  assert.equal(result.participation_coins, 20); // 10 × 2
  assert.equal(result.coins, 160);
  assert.equal(result.xp_gained, 80); // (20 + 50 + 10) sans multiplicateur
  assert.equal(result.rank_multiplier, 2);

  const coins = Number((await withAdmin((c) =>
    c.query("select coins from profiles where id = $1", [fx.player]))).rows[0].coins);
  assert.equal(coins, 160);
});

test("Banc d'essai : médailles et participation multipliées", async () => {
  const fx = await withAdmin(async (c) => {
    await c.query(
      `insert into dyno_daily (day, config_id, weather)
       values ((now() at time zone 'UTC')::date, 'dyno_free_run', 'sunny_hot')
       on conflict (day) do update set config_id = excluded.config_id, weather = excluded.weather`,
    );
    const player = await createPlayer(c);
    const deck = await makeDeck(c, player, "t_eng_mult_dyno_gold");
    return { player, deckId: deck.deckId };
  });
  await grantMonthXp(fx.player, 600); // ×2,5

  const result = (await asUser(fx.player, (c) =>
    c.query("select public.execute_dyno($1::uuid, $2::uuid) as r", [fx.player, fx.deckId]))).rows[0].r;

  assert.equal(result.medal, "gold");
  assert.deepEqual(result.new_medals, ["bronze", "silver", "gold"]);
  assert.equal(result.medals_coins, 425); // (20 + 50 + 100) × 2,5
  assert.equal(result.participation_coins, 25); // 10 × 2,5
  assert.equal(result.coins, 450);
  assert.equal(result.xp_gained, 180); // (20 + 50 + 100 + 10) sans multiplicateur
  assert.equal(result.rank_multiplier, 2.5);

  const coins = Number((await withAdmin((c) =>
    c.query("select coins from profiles where id = $1", [fx.player]))).rows[0].coins);
  assert.equal(coins, 450);
});
