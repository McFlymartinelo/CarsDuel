import assert from "node:assert/strict";
import { test } from "node:test";
import { asUser, createPlayer, ensureTemplates, expectError, giveCard, withAdmin } from "./helpers.mjs";

async function claim(user, challenge) {
  return (await asUser(user, (c) =>
    c.query("select public.claim_collector_challenge($1::uuid, $2::text) as r", [user, challenge]))).rows[0].r;
}

test("collection publique d'un pilote : cartes obtenues, pseudo insensible à la casse", async () => {
  const { visitor, ownerName } = await withAdmin(async (c) => {
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

test("collection publique : un modèle obtenu puis recyclé reste dans la collection", async () => {
  const fx = await withAdmin(async (c) => {
    await ensureTemplates(c);
    const owner = await createPlayer(c);
    const visitor = await createPlayer(c);
    const card = await giveCard(c, owner, "t_eng_break");
    const { rows } = await c.query("select username from profiles where id = $1", [owner]);
    return { owner, visitor, card, ownerName: rows[0].username };
  });

  await asUser(fx.owner, (c) => c.query("select public.recycle_bin_add($1::uuid, $2::uuid)", [fx.owner, fx.card]));
  await asUser(fx.owner, (c) => c.query("select public.recycle_bin_process($1::uuid)", [fx.owner]));
  await withAdmin(async (c) => {
    assert.equal((await c.query("select id from user_cards where id = $1", [fx.card])).rows.length, 0);
  });

  const result = (await asUser(fx.visitor, (c) =>
    c.query("select public.collector_collection($1::uuid, $2::text) as r", [fx.visitor, fx.ownerName]))).rows[0].r;

  assert.deepEqual(result.cards.map((card) => card.card_templates.code).sort(), ["t_eng_break"]);
});

test("badge déjà obtenue : l'historique survit au recyclage définitif", async () => {
  const fx = await withAdmin(async (c) => {
    await ensureTemplates(c);
    const user = await createPlayer(c);
    const card = await giveCard(c, user, "t_eng");
    const template = (await c.query("select template_id from user_cards where id = $1", [card])).rows[0].template_id;
    return { user, card, template };
  });

  await asUser(fx.user, (c) => c.query("select public.recycle_bin_add($1::uuid, $2::uuid)", [fx.user, fx.card]));
  await asUser(fx.user, (c) => c.query("select public.recycle_bin_process($1::uuid)", [fx.user]));

  const kept = await asUser(fx.user, (c) => c.query(
    "select 1 from public.collector_obtained where owner_id = $1 and template_id = $2",
    [fx.user, fx.template],
  ));
  assert.equal(kept.rows.length, 1);

  await withAdmin(async (c) => {
    assert.equal((await c.query("select id from user_cards where id = $1", [fx.card])).rows.length, 0);
  });
});

test("badge déjà obtenue : vendeur et acheteur conservent le modèle", async () => {
  const fx = await withAdmin(async (c) => {
    await ensureTemplates(c);
    const seller = await createPlayer(c);
    const buyer = await createPlayer(c, 100);
    const card = await giveCard(c, seller, "t_eng");
    const template = (await c.query("select template_id from user_cards where id = $1", [card])).rows[0].template_id;
    return { seller, buyer, card, template };
  });

  const listing = (await asUser(fx.seller, (c) => c.query(
    "select public.create_listing($1::uuid, $2::uuid, 10, false) as id",
    [fx.seller, fx.card],
  ))).rows[0].id;
  await asUser(fx.buyer, (c) => c.query("select public.buy_marketplace_item($1::uuid, $2::uuid)", [fx.buyer, listing]));

  await withAdmin(async (c) => {
    for (const user of [fx.seller, fx.buyer]) {
      const rows = (await c.query(
        "select 1 from collector_obtained where owner_id = $1 and template_id = $2",
        [user, fx.template],
      )).rows;
      assert.equal(rows.length, 1);
    }
  });
});

test("défi du collectionneur : les modèles obtenus comptent après avoir quitté l'inventaire", async () => {
  const user = await withAdmin(async (c) => {
    const id = await createPlayer(c);
    await c.query(
      `insert into user_cards (owner_id, template_id, source)
       select $1, id, 'test' from card_templates where category = 'bonus'`,
      [id],
    );
    // Simule vente/recyclage/destruction : les cartes quittent l'inventaire mais
    // l'historique collector_obtained doit continuer à alimenter le défi.
    await c.query("delete from user_cards where owner_id = $1", [id]);
    return id;
  });

  await withAdmin(async (c) => {
    assert.equal(
      Number((await c.query("select count(*)::int as n from user_cards where owner_id = $1", [user])).rows[0].n),
      0,
    );
  });

  const result = await claim(user, "toolbox");
  assert.equal(Number(result.coins), 50);
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
