import assert from "node:assert/strict";
import { before, test } from "node:test";
import {
  asUser,
  createPlayer,
  ensureTemplates,
  expectError,
  makeDeck,
  neutralizeWeather,
  withAdmin,
} from "./helpers.mjs";

before(async () => {
  await withAdmin(async (c) => {
    await neutralizeWeather(c);
    await ensureTemplates(c);
  });
});

async function usernameOf(id) {
  return (await withAdmin((c) => c.query("select username from profiles where id = $1", [id]))).rows[0].username;
}

async function propose(challenger, username) {
  const { rows } = await asUser(challenger, (c) =>
    c.query("select public.propose_duel($1::uuid, $2::text) as r", [challenger, username]));
  return rows[0].r;
}

async function challengeRow(id) {
  return (await withAdmin((c) => c.query(
    "select id, challenger_id, target_id, status, resolved_at from duel_challenges where id = $1",
    [id],
  ))).rows[0];
}

test("propose_duel crée une demande pending et refuse une seconde demande entre les mêmes joueurs", async () => {
  const fx = await withAdmin(async (c) => {
    const challenger = await createPlayer(c);
    const target = await createPlayer(c);
    return { challenger, target };
  });
  const username = await usernameOf(fx.target);

  const created = await propose(fx.challenger, username);
  assert.ok(created.challenge_id);

  const row = await challengeRow(created.challenge_id);
  assert.equal(row.challenger_id, fx.challenger);
  assert.equal(row.target_id, fx.target);
  assert.equal(row.status, "pending");
  assert.equal(row.resolved_at, null);

  await expectError(
    fx.challenger,
    (c) => c.query("select public.propose_duel($1::uuid, $2::text)", [fx.challenger, username]),
    "challenge_pending",
  );
});

test("decline_duel passe la demande à declined", async () => {
  const fx = await withAdmin(async (c) => {
    const challenger = await createPlayer(c);
    const target = await createPlayer(c);
    return { challenger, target };
  });
  const created = await propose(fx.challenger, await usernameOf(fx.target));
  await asUser(fx.target, (c) =>
    c.query("select public.decline_duel($1::uuid, $2::uuid)", [fx.target, created.challenge_id]));

  const row = await challengeRow(created.challenge_id);
  assert.equal(row.status, "declined");
  assert.ok(row.resolved_at);
});

test("cancel_duel passe la demande à cancelled", async () => {
  const fx = await withAdmin(async (c) => {
    const challenger = await createPlayer(c);
    const target = await createPlayer(c);
    return { challenger, target };
  });
  const created = await propose(fx.challenger, await usernameOf(fx.target));
  await asUser(fx.challenger, (c) =>
    c.query("select public.cancel_duel($1::uuid, $2::uuid)", [fx.challenger, created.challenge_id]));

  const row = await challengeRow(created.challenge_id);
  assert.equal(row.status, "cancelled");
  assert.ok(row.resolved_at);
});

test("un autre joueur ne peut pas accepter une demande", async () => {
  const fx = await withAdmin(async (c) => {
    const challenger = await createPlayer(c);
    const target = await createPlayer(c);
    const outsider = await createPlayer(c);
    return { challenger, target, outsider };
  });
  const created = await propose(fx.challenger, await usernameOf(fx.target));

  await expectError(
    fx.outsider,
    (c) => c.query("select public.accept_duel($1::uuid, $2::uuid)", [fx.outsider, created.challenge_id]),
    "challenge_not_found",
  );
});

test("accept_duel enregistre un duel arrangé et verse les récompenses du duel", async () => {
  const fx = await withAdmin(async (c) => {
    const attacker = await createPlayer(c);
    const defender = await createPlayer(c);
    await makeDeck(c, attacker, "t_eng");
    await makeDeck(c, defender, "t_eng");
    return { attacker, defender };
  });
  const created = await propose(fx.attacker, await usernameOf(fx.defender));

  const outcome = (await asUser(fx.defender, (c) =>
    c.query("select public.accept_duel($1::uuid, $2::uuid) as r", [fx.defender, created.challenge_id]))).rows[0].r;
  assert.equal(outcome.forfeit, false);

  const duel = (await withAdmin((c) => c.query(
    "select * from duels_history where id = $1",
    [outcome.duel_id],
  ))).rows[0];
  assert.equal(duel.snapshot.arranged, true);
  assert.equal(duel.snapshot.forfeit, false);
  assert.equal(duel.attacker_id, fx.attacker);
  assert.equal(duel.defender_id, fx.defender);

  const after = await withAdmin(async (c) => {
    const coins = (await c.query(
      "select id, coins from profiles where id = any($1::uuid[])",
      [[fx.attacker, fx.defender]],
    )).rows;
    return new Map(coins.map((r) => [r.id, Number(r.coins)]));
  });
  assert.equal(after.get(fx.attacker), Number(duel.attacker_coins));
  assert.equal(after.get(fx.defender), Number(duel.defender_coins));
});

test("accept_duel crédite aussi les victoires du demandeur", async () => {
  const fx = await withAdmin(async (c) => {
    const attacker = await createPlayer(c);
    const defender = await createPlayer(c);
    const deck = await makeDeck(c, attacker, "t_eng_far");
    await makeDeck(c, defender, "t_eng");
    return { attacker, defender, deck };
  });
  const created = await propose(fx.attacker, await usernameOf(fx.defender));
  const outcome = (await asUser(fx.defender, (c) =>
    c.query("select public.accept_duel($1::uuid, $2::uuid) as r", [fx.defender, created.challenge_id]))).rows[0].r;
  assert.equal(outcome.result, "attacker_win");
  await withAdmin(async (c) => {
    for (const id of [fx.deck.engine, fx.deck.gearbox]) {
      const row = (await c.query("select runs_count, wins_count from user_cards where id = $1", [id])).rows[0];
      assert.equal(row.runs_count, 1);
      assert.equal(row.wins_count, 1);
    }
  });
});

test("forfait : demandeur sans deck valide, récompenses réellement versées", async () => {
  const fx = await withAdmin(async (c) => {
    const attacker = await createPlayer(c);
    const defender = await createPlayer(c);
    await makeDeck(c, defender, "t_eng");
    return { attacker, defender };
  });
  const created = await propose(fx.attacker, await usernameOf(fx.defender));

  const outcome = (await asUser(fx.defender, (c) =>
    c.query("select public.accept_duel($1::uuid, $2::uuid) as r", [fx.defender, created.challenge_id]))).rows[0].r;
  assert.equal(outcome.forfeit, true);

  const duel = (await withAdmin((c) => c.query(
    "select * from duels_history where id = $1",
    [outcome.duel_id],
  ))).rows[0];
  assert.equal(duel.snapshot.arranged, true);
  assert.equal(duel.snapshot.forfeit, true);
  assert.equal(duel.attacker_deck_id, null);
  assert.equal(Number(duel.attacker_coins), 2);
  assert.equal(Number(duel.defender_coins), 10);

  const after = await withAdmin(async (c) => {
    const coins = (await c.query(
      "select id, coins from profiles where id = any($1::uuid[])",
      [[fx.attacker, fx.defender]],
    )).rows;
    return new Map(coins.map((r) => [r.id, Number(r.coins)]));
  });
  assert.equal(after.get(fx.attacker), 2);
  assert.equal(after.get(fx.defender), 10);
});

// Audit points 2/3 : propose_duel n'est pas atomique face à deux demandes concurrentes.
test.todo("propose_duel : deux demandes simultanées entre les mêmes joueurs — audit points 2/3");
