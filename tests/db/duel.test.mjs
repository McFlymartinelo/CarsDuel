import assert from "node:assert/strict";
import { before, test } from "node:test";
import { clearArena, createPlayer, duel, ensureTemplates, expectError, giveCard, makeDeck, neutralizeWeather, withAdmin } from "./helpers.mjs";

before(async () => {
  await withAdmin(async (c) => {
    await neutralizeWeather(c);
    await ensureTemplates(c);
  });
});

test("égalité de SP : le défenseur gagne", async () => {
  const { attacker, deckId } = await withAdmin(async (c) => {
    await clearArena(c);
    const attacker = await createPlayer(c);
    const defender = await createPlayer(c);
    const deck = await makeDeck(c, attacker, "t_eng");
    await makeDeck(c, defender, "t_eng");
    return { attacker, deckId: deck.deckId };
  });
  const r = await duel(attacker, deckId);
  assert.equal(r.result, "defender_win");
  assert.equal(r.broken_part, null);
  assert.equal(Number(r.attacker_sp), Number(r.defender_sp));
});

test("casse : fin immédiate, pas d'usure, bonus consommé", async () => {
  const fx = await withAdmin(async (c) => {
    await clearArena(c);
    const attacker = await createPlayer(c);
    const defender = await createPlayer(c);
    const deck = await makeDeck(c, attacker, "t_eng_break");
    await makeDeck(c, defender, "t_eng");
    const bonus = await giveCard(c, attacker, "bonus_revision_express");
    const tire = (await c.query("select tire_wear from user_cards where id = $1", [deck.tire])).rows[0];
    const engine = (await c.query("select runs_count from user_cards where id = $1", [deck.engine])).rows[0];
    return { attacker, deck, bonus, tire: Number(tire.tire_wear), runs: engine.runs_count };
  });
  const r = await duel(fx.attacker, fx.deck.deckId, fx.bonus);
  assert.equal(r.broken_part, "moteur");
  assert.equal(r.result, "defender_win");
  assert.equal(r.tire_gum_after, null);
  await withAdmin(async (c) => {
    const tire = (await c.query("select tire_wear, is_destroyed from user_cards where id = $1", [fx.deck.tire])).rows[0];
    const engine = (await c.query("select runs_count, is_destroyed from user_cards where id = $1", [fx.deck.engine])).rows[0];
    const bonus = (await c.query("select is_destroyed from user_cards where id = $1", [fx.bonus])).rows[0];
    assert.equal(Number(tire.tire_wear), fx.tire);
    assert.equal(tire.is_destroyed, false);
    assert.equal(engine.runs_count, fx.runs);
    assert.equal(engine.is_destroyed, true);
    assert.equal(bonus.is_destroyed, true);
  });
});

test("plafond de défense : 5 récompenses, la 6e est à zéro", async () => {
  const { attacker, defender, deckId } = await withAdmin(async (c) => {
    await clearArena(c);
    const attacker = await createPlayer(c);
    const defender = await createPlayer(c);
    const deck = await makeDeck(c, attacker, "t_eng");
    await makeDeck(c, defender, "t_eng");
    return { attacker, defender, deckId: deck.deckId };
  });
  for (let i = 0; i < 6; i++) await duel(attacker, deckId);
  await withAdmin(async (c) => {
    const { rows } = await c.query(
      "select defender_rewarded, defender_coins from duels_history where defender_id = $1 order by created_at, id",
      [defender],
    );
    assert.equal(rows.length, 6);
    assert.deepEqual(rows.slice(0, 5).map((r) => r.defender_rewarded), [true, true, true, true, true]);
    assert.equal(rows[5].defender_rewarded, false);
    assert.equal(Number(rows[5].defender_coins), 0);
  });
});

test("20 attaques puis daily_attack_limit, sans consommer le bonus", async () => {
  const fx = await withAdmin(async (c) => {
    await clearArena(c);
    const attacker = await createPlayer(c);
    const defender = await createPlayer(c);
    const deck = await makeDeck(c, attacker, "t_eng");
    await makeDeck(c, defender, "t_eng");
    return { attacker, deckId: deck.deckId };
  });
  for (let i = 0; i < 20; i++) await duel(fx.attacker, fx.deckId);
  const bonus = await withAdmin((c) => giveCard(c, fx.attacker, "bonus_revision_express"));
  const before = await withAdmin(async (c) =>
    Number((await c.query("select coins from profiles where id = $1", [fx.attacker])).rows[0].coins));
  await expectError(
    fx.attacker,
    (c) => c.query("select public.execute_duel($1::uuid, $2::uuid, $3::uuid)", [fx.attacker, fx.deckId, bonus]),
    "daily_attack_limit",
  );
  await withAdmin(async (c) => {
    const dead = (await c.query("select is_destroyed from user_cards where id = $1", [bonus])).rows[0];
    const coins = Number((await c.query("select coins from profiles where id = $1", [fx.attacker])).rows[0].coins);
    const n = Number((await c.query("select count(*)::int as n from duels_history where attacker_id = $1", [fx.attacker])).rows[0].n);
    assert.equal(dead.is_destroyed, false);
    assert.equal(coins, before);
    assert.equal(n, 20);
  });
});

test("no_opponent ne consomme ni bonus, ni pièces, ni quota", async () => {
  const fx = await withAdmin(async (c) => {
    await clearArena(c);
    const attacker = await createPlayer(c, 7);
    const deck = await makeDeck(c, attacker, "t_eng");
    const bonus = await giveCard(c, attacker, "bonus_revision_express");
    return { attacker, deckId: deck.deckId, bonus };
  });
  await expectError(
    fx.attacker,
    (c) => c.query("select public.execute_duel($1::uuid, $2::uuid, $3::uuid)", [fx.attacker, fx.deckId, fx.bonus]),
    "no_opponent",
  );
  await withAdmin(async (c) => {
    const bonus = (await c.query("select is_destroyed from user_cards where id = $1", [fx.bonus])).rows[0];
    const coins = Number((await c.query("select coins from profiles where id = $1", [fx.attacker])).rows[0].coins);
    const n = Number((await c.query("select count(*)::int as n from duels_history where attacker_id = $1", [fx.attacker])).rows[0].n);
    assert.equal(bonus.is_destroyed, false);
    assert.equal(coins, 7);
    assert.equal(n, 0);
  });
});

test("le fantôme dans la bande ±25 % est choisi de préférence au deck éloigné", async () => {
  const fx = await withAdmin(async (c) => {
    await clearArena(c);
    const attacker = await createPlayer(c);
    const close = await createPlayer(c);
    const far = await createPlayer(c);
    const deck = await makeDeck(c, attacker, "t_eng");
    await makeDeck(c, close, "t_eng");
    await makeDeck(c, far, "t_eng_far");
    return { attacker, close, deckId: deck.deckId };
  });
  const r = await duel(fx.attacker, fx.deckId);
  await withAdmin(async (c) => {
    const row = (await c.query("select defender_id from duels_history where id = $1", [r.duel_id])).rows[0];
    assert.equal(row.defender_id, fx.close);
  });
});
