import assert from "node:assert/strict";
import { test } from "node:test";
import { asUser, createPlayer, expectError, withAdmin } from "./helpers.mjs";

const QUEST_POOL = [
  "inventaire", "boutique", "recycle_bonus", "duel", "duels_2", "duels_3",
  "attaque", "defense", "bonus", "bonus_2", "pneus_90", "leaderboard",
  "marketplace", "matin", "nuit", "rebond", "win_attaque", "win_defense",
];

async function dailyQuests(user) {
  return (await asUser(user, (c) =>
    c.query("select public.my_daily_quests($1::uuid) as r", [user]))).rows[0].r;
}

async function claim(user, quest) {
  return (await asUser(user, (c) =>
    c.query("select public.claim_daily_quest($1::uuid, $2::text) as r", [user, quest]))).rows[0].r;
}

test("my_daily_quests crée la ligne du jour et retourne le tirage", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  const state = await dailyQuests(user);

  assert.ok(state.second);
  assert.ok(state.third);
  assert.notEqual(state.second, state.third);
  assert.equal(typeof state.progress, "object");
  assert.deepEqual(state.claimed, []);

  const row = await withAdmin((c) => c.query(
    `select second, third from daily_quests
      where user_id = $1 and day = (now() at time zone 'Europe/Paris')::date`,
    [user],
  ));
  assert.equal(row.rows.length, 1);
  assert.equal(row.rows[0].second, state.second);
  assert.equal(row.rows[0].third, state.third);
});

test("touch_quest autorise une clé et met la progression à 1", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  await asUser(user, (c) => c.query("select public.touch_quest($1::uuid, 'inventaire')", [user]));

  const state = await dailyQuests(user);
  assert.equal(Number(state.progress.inventaire), 1);
});

test("claim_daily_quest verse 5 pièces une seule fois pour pointage", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  await dailyQuests(user); // pose connect = 1

  const result = await claim(user, "pointage");
  assert.equal(Number(result.coins), 5);
  assert.equal(Number((await withAdmin((c) => c.query("select coins from profiles where id = $1", [user]))).rows[0].coins), 5);

  await expectError(
    user,
    (c) => c.query("select public.claim_daily_quest($1::uuid, $2::text)", [user, "pointage"]),
    "quest_already_claimed",
  );
});

test("claim_daily_quest refuse une quête non terminée", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  const state = await dailyQuests(user);
  await expectError(
    user,
    (c) => c.query("select public.claim_daily_quest($1::uuid, $2::text)", [user, state.second]),
    "quest_not_done",
  );
});

test("claim_daily_quest refuse une quête hors du tirage du jour", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  const state = await dailyQuests(user);
  const outside = QUEST_POOL.find((quest) => quest !== state.second && quest !== state.third);
  assert.ok(outside);

  await expectError(
    user,
    (c) => c.query("select public.claim_daily_quest($1::uuid, $2::text)", [user, outside]),
    "quest_unknown",
  );
});
