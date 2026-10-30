import assert from "node:assert/strict";
import { test } from "node:test";
import { asUser, createPlayer, ensureTemplates, expectError, giveCard, withAdmin } from "./helpers.mjs";

async function claim(user, challenge) {
  return (await asUser(user, (c) =>
    c.query("select public.claim_collector_challenge($1::uuid, $2::text) as r", [user, challenge]))).rows[0].r;
}

test("collection publique d'un pilote : cartes possédées, pseudo insensible à la casse", async () => {
  const { owner, visitor, ownerName } = await withAdmin(async (c) => {
    await ensureTemplates(c);
    const owner = await createPlayer(c);
    const visitor = await createPlayer(c);
    await giveCard(c, owner, "t_eng");
    await giveCard(c, owner, "t_gb");
    await giveCard(c, visitor, "t_eng_far");
    const { rows } = await c.query("select username from profiles where id = $1", [owner]);
    return { owner, visitor, ownerName: rows[0].username };
  });

  const result = (await asUser(visitor, (c) =>
    c.query("select public.collector_collection($1::uuid, $2::text) as r", [visitor, ownerName.toUpperCase()])))
    .rows[0].r;

  assert.equal(result.username, ownerName);
  assert.deepEqual(result.cards.map((card) => card.card_templates.code).sort(), ["t_eng", "t_gb"]);
});

test("collection publique d'un pilote : pseudo inconnu et appelant usurpé", async () => {
  const [visitor, other] = await withAdmin(async (c) => [await createPlayer(c), await createPlayer(c)]);

  await expectError(
    visitor,
    (c) => c.query("select public.collector_collection($1::uuid, 'pseudo-inexistant-42')", [visitor]),
    "user_not_found",
  );

  await expectError(
    visitor,
    (c) => c.query("select public.collector_collection($1::uuid, 'pseudo-inexistant-42')", [other]),
    "forbidden",
  );
});

test("défi du collectionneur inconnu", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  await expectError(
    user,
    (c) => c.query("select public.claim_collector_challenge($1::uuid, 'inconnu')", [user]),
    "collector_challenge_unknown",
  );
});

test("défi du collectionneur incomplet", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  await expectError(
    user,
    (c) => c.query("select public.claim_collector_challenge($1::uuid, 'toolbox')", [user]),
    "collector_challenge_not_done",
  );
});

test("toolbox : 50 pièces, une seule réclamation, pas de double récompense", async () => {
  const user = await withAdmin(async (c) => {
    const id = await createPlayer(c);
    // Toutes les cartes bonus actives ou non : toolbox exige la collection complète.
    await c.query(
      `insert into user_cards (owner_id, template_id, source)
       select $1, id, 'test' from card_templates where category = 'bonus'`,
      [id],
    );
    return id;
  });

  const result = await claim(user, "toolbox");
  assert.equal(Number(result.coins), 50);

  const after = await withAdmin(async (c) => {
    const claims = (await c.query(
      "select challenge_key, coins_awarded from collector_challenge_claims where owner_id = $1",
      [user],
    )).rows;
    const coins = Number((await c.query("select coins from profiles where id = $1", [user])).rows[0].coins);
    return { claims, coins };
  });
  assert.equal(after.claims.length, 1);
  assert.equal(after.claims[0].challenge_key, "toolbox");
  assert.equal(Number(after.claims[0].coins_awarded), 50);
  assert.equal(after.coins, 50);

  await expectError(
    user,
    (c) => c.query("select public.claim_collector_challenge($1::uuid, 'toolbox')", [user]),
    "collector_challenge_already_claimed",
  );

  const final = await withAdmin(async (c) => ({
    claims: Number((await c.query(
      "select count(*)::int as n from collector_challenge_claims where owner_id = $1",
      [user],
    )).rows[0].n),
    coins: Number((await c.query("select coins from profiles where id = $1", [user])).rows[0].coins),
  }));
  assert.equal(final.claims, 1);
  assert.equal(final.coins, 50);
});
