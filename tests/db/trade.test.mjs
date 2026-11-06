import assert from "node:assert/strict";
import { before, test } from "node:test";
import { asUser, createPlayer, ensureTemplates, expectError, giveCard, withAdmin } from "./helpers.mjs";

before(async () => {
  await withAdmin(ensureTemplates);
});

async function createOffer(proposer, recipient, proposerCards, recipientCards, coins = 0) {
  const { rows } = await asUser(proposer, (c) =>
    c.query(
      "select public.create_trade_offer($1::uuid, $2::uuid, $3::uuid[], $4::uuid[], $5::int) as id",
      [proposer, recipient, proposerCards, recipientCards, coins],
    ));
  return rows[0].id;
}

async function counterOffer(user, trade, proposerCards, recipientCards, coins = 0) {
  const { rows } = await asUser(user, (c) =>
    c.query(
      "select public.counter_trade_offer($1::uuid, $2::uuid, $3::uuid[], $4::uuid[], $5::int) as r",
      [user, trade, proposerCards, recipientCards, coins],
    ));
  return rows[0].r;
}

async function respond(user, trade, accept) {
  const { rows } = await asUser(user, (c) =>
    c.query("select public.respond_trade_offer($1::uuid, $2::uuid, $3::boolean) as r", [user, trade, accept]));
  return rows[0].r;
}

async function coinsOf(id) {
  return withAdmin(async (c) => Number((await c.query("select coins from profiles where id = $1", [id])).rows[0].coins));
}

async function ownerOf(card) {
  return withAdmin(async (c) => (await c.query("select owner_id from user_cards where id = $1", [card])).rows[0]?.owner_id);
}

async function tradeStatus(id) {
  return withAdmin(async (c) => (await c.query("select status from trade_offers where id = $1", [id])).rows[0]?.status);
}

test("création sans séquestre, acceptation avec pièces promises et taxe de 10 chacun", async () => {
  const fx = await withAdmin(async (c) => {
    const a = await createPlayer(c, 100);
    const b = await createPlayer(c, 100);
    const cardA = await giveCard(c, a, "t_eng");
    const cardB = await giveCard(c, b, "t_gb");
    return { a, b, cardA, cardB };
  });

  const trade = await createOffer(fx.a, fx.b, [fx.cardA], [fx.cardB], 25);
  assert.equal(await coinsOf(fx.a), 100, "aucune pièce bloquée à la création");
  assert.equal(await ownerOf(fx.cardA), fx.a, "aucune carte bloquée à la création");
  assert.equal(await tradeStatus(trade), "pending");

  const result = await respond(fx.b, trade, true);
  assert.equal(result.ok, true);
  assert.equal(result.accepted, true);
  assert.equal(result.tax, 10);
  assert.equal(await coinsOf(fx.a), 65, "25 pièces promises + 10 de taxe");
  assert.equal(await coinsOf(fx.b), 115, "25 pièces reçues − 10 de taxe");
  assert.equal(await ownerOf(fx.cardA), fx.b);
  assert.equal(await ownerOf(fx.cardB), fx.a);
  assert.equal(await tradeStatus(trade), "accepted");
});

test("contre-offre : rôles inversés, pièces remises à zéro et nouveau délai", async () => {
  const fx = await withAdmin(async (c) => {
    const a = await createPlayer(c, 100);
    const b = await createPlayer(c, 100);
    const cardA = await giveCard(c, a, "t_eng");
    const cardB = await giveCard(c, b, "t_gb");
    return { a, b, cardA, cardB };
  });

  const trade = await createOffer(fx.a, fx.b, [fx.cardA], [fx.cardB], 30);
  const before = (await withAdmin((c) => c.query("select expires_at from trade_offers where id = $1", [trade]))).rows[0].expires_at;
  const result = await counterOffer(fx.b, trade, [fx.cardB], [fx.cardA], 5);
  assert.equal(result.ok, true);

  const row = await withAdmin((c) =>
    c.query("select proposer_id, recipient_id, proposer_coins, expires_at from trade_offers where id = $1", [trade]));
  const t = row.rows[0];
  assert.equal(t.proposer_id, fx.b);
  assert.equal(t.recipient_id, fx.a);
  assert.equal(Number(t.proposer_coins), 5);
  assert.ok(new Date(t.expires_at) > new Date(before), "le délai repart de 24 h");

  const accepted = await respond(fx.a, trade, true);
  assert.equal(accepted.ok, true);
  assert.equal(await coinsOf(fx.b), 85, "5 pièces promises + 10 de taxe");
  assert.equal(await coinsOf(fx.a), 95, "5 pièces reçues − 10 de taxe");
  assert.equal(await ownerOf(fx.cardA), fx.b);
  assert.equal(await ownerOf(fx.cardB), fx.a);
});

test("taxe impossible chez le destinataire : l'offre est marquée failed sans transfert", async () => {
  const fx = await withAdmin(async (c) => {
    const a = await createPlayer(c, 100);
    const b = await createPlayer(c, 5);
    const cardA = await giveCard(c, a, "t_eng");
    const cardB = await giveCard(c, b, "t_gb");
    return { a, b, cardA, cardB };
  });

  const trade = await createOffer(fx.a, fx.b, [fx.cardA], [fx.cardB], 0);
  const result = await respond(fx.b, trade, true);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "insufficient_funds");
  assert.equal(await tradeStatus(trade), "failed");
  assert.equal(await coinsOf(fx.a), 100);
  assert.equal(await coinsOf(fx.b), 5);
  assert.equal(await ownerOf(fx.cardA), fx.a);
  assert.equal(await ownerOf(fx.cardB), fx.b);
});

test("carte supprimée entre-temps : l'échange échoue et ne transfère rien", async () => {
  const fx = await withAdmin(async (c) => {
    const a = await createPlayer(c, 100);
    const b = await createPlayer(c, 100);
    const cardA = await giveCard(c, a, "t_eng");
    const cardB = await giveCard(c, b, "t_gb");
    return { a, b, cardA, cardB };
  });

  const trade = await createOffer(fx.a, fx.b, [fx.cardA], [fx.cardB], 0);
  await withAdmin((c) => c.query("delete from user_cards where id = $1", [fx.cardA]));

  const result = await respond(fx.b, trade, true);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "cards_unavailable");
  assert.equal(await tradeStatus(trade), "failed");
  assert.equal(await ownerOf(fx.cardB), fx.b);
});

test("validité 24 h : expiration opportuniste", async () => {
  const fx = await withAdmin(async (c) => {
    const a = await createPlayer(c, 100);
    const b = await createPlayer(c, 100);
    const cardA = await giveCard(c, a, "t_eng");
    return { a, b, cardA };
  });

  const trade = await createOffer(fx.a, fx.b, [fx.cardA], [], 0);
  await withAdmin((c) => c.query("update trade_offers set expires_at = now() - interval '1 minute' where id = $1", [trade]));
  await asUser(fx.b, (c) => c.query("select public.expire_trade_offers($1::uuid)", [fx.b]));
  assert.equal(await tradeStatus(trade), "expired");
});

test("garde-fous : self, doublons, propriété et limite de 5 cartes", async () => {
  const fx = await withAdmin(async (c) => {
    const a = await createPlayer(c, 100);
    const b = await createPlayer(c, 100);
    const cardA = await giveCard(c, a, "t_eng");
    const cardB = await giveCard(c, b, "t_gb");
    const six = [];
    for (let i = 0; i < 6; i++) six.push(await giveCard(c, a, "t_eng"));
    return { a, b, cardA, cardB, six };
  });

  await expectError(
    fx.a,
    (c) => c.query("select public.create_trade_offer($1::uuid, $1::uuid, $2::uuid[], '{}'::uuid[], 0)", [fx.a, [fx.cardA]]),
    "cannot_trade_self",
  );
  await expectError(
    fx.a,
    (c) => c.query("select public.create_trade_offer($1::uuid, $2::uuid, $3::uuid[], $3::uuid[], 0)", [fx.a, fx.b, [fx.cardA]]),
    "invalid_trade_cards",
  );
  await expectError(
    fx.a,
    (c) => c.query("select public.create_trade_offer($1::uuid, $2::uuid, $3::uuid[], '{}'::uuid[], 0)", [fx.a, fx.b, [fx.cardB]]),
    "trade_card_not_owned",
  );
  await expectError(
    fx.a,
    (c) => c.query("select public.create_trade_offer($1::uuid, $2::uuid, $3::uuid[], '{}'::uuid[], 0)", [fx.a, fx.b, fx.six]),
    "too_many_trade_cards",
  );
});

test("trade_partner renvoie l'inventaire public, sans cartes détruites", async () => {
  const fx = await withAdmin(async (c) => {
    const a = await createPlayer(c, 0);
    const b = await createPlayer(c, 0);
    const visible = await giveCard(c, b, "t_gb");
    const destroyed = await giveCard(c, b, "t_eng");
    await c.query("update user_cards set is_destroyed = true where id = $1", [destroyed]);
    const username = (await c.query("select username from profiles where id = $1", [b])).rows[0].username;
    return { a, b, visible, destroyed, username };
  });

  const partner = (await asUser(fx.a, (c) =>
    c.query("select public.trade_partner($1::uuid, $2::text) as r", [fx.a, fx.username]))).rows[0].r;
  assert.equal(partner.user.id, fx.b);
  assert.ok(partner.cards.some((card) => card.id === fx.visible));
  assert.ok(!partner.cards.some((card) => card.id === fx.destroyed));
});
