import assert from "node:assert/strict";
import { before, test } from "node:test";
import { asUser, connect, createPlayer, ensureTemplates, expectError, giveCard, withAdmin } from "./helpers.mjs";

before(async () => {
  await withAdmin(ensureTemplates);
});

async function listing(seller, card, price, offers) {
  const { rows } = await asUser(seller, (c) =>
    c.query("select public.create_listing($1::uuid, $2::uuid, $3::int, $4::boolean) as id", [seller, card, price, offers]));
  return rows[0].id;
}

test("taxe floor(prix * 0.90)", async () => {
  const fx = await withAdmin(async (c) => {
    const seller = await createPlayer(c, 0);
    const buyer = await createPlayer(c, 100);
    const card = await giveCard(c, seller, "t_eng");
    return { seller, buyer, card };
  });
  const id = await listing(fx.seller, fx.card, 10, false);
  const { rows } = await asUser(fx.buyer, (c) =>
    c.query("select public.buy_marketplace_item($1::uuid, $2::uuid) as r", [fx.buyer, id]));
  assert.equal(Number(rows[0].r.seller_net), 9);
  assert.equal(Number(rows[0].r.tax), 1);
  await withAdmin(async (c) => {
    const seller = Number((await c.query("select coins from profiles where id = $1", [fx.seller])).rows[0].coins);
    const buyer = Number((await c.query("select coins from profiles where id = $1", [fx.buyer])).rows[0].coins);
    assert.equal(seller, 9);
    assert.equal(buyer, 90);
  });
});

test("séquestre d'offre puis remboursement au retrait et à l'annulation", async () => {
  const fx = await withAdmin(async (c) => {
    const seller = await createPlayer(c, 0);
    const buyer = await createPlayer(c, 100);
    const card = await giveCard(c, seller, "t_eng");
    const card2 = await giveCard(c, seller, "t_eng");
    return { seller, buyer, card, card2 };
  });
  const id = await listing(fx.seller, fx.card, null, true);
  const offer = (await asUser(fx.buyer, (c) =>
    c.query("select public.make_offer($1::uuid, $2::uuid, $3::int) as id", [fx.buyer, id, 40]))).rows[0].id;
  await withAdmin(async (c) => {
    assert.equal(Number((await c.query("select coins from profiles where id = $1", [fx.buyer])).rows[0].coins), 60);
  });
  await asUser(fx.buyer, (c) => c.query("select public.withdraw_offer($1::uuid, $2::uuid)", [fx.buyer, offer]));
  await withAdmin(async (c) => {
    assert.equal(Number((await c.query("select coins from profiles where id = $1", [fx.buyer])).rows[0].coins), 100);
    const status = (await c.query("select status from marketplace_offers where id = $1", [offer])).rows[0].status;
    assert.equal(status, "withdrawn");
  });

  const id2 = await listing(fx.seller, fx.card2, null, true);
  await asUser(fx.buyer, (c) => c.query("select public.make_offer($1::uuid, $2::uuid, $3::int)", [fx.buyer, id2, 25]));
  await asUser(fx.seller, (c) => c.query("select public.cancel_listing($1::uuid, $2::uuid)", [fx.seller, id2]));
  await withAdmin(async (c) => {
    assert.equal(Number((await c.query("select coins from profiles where id = $1", [fx.buyer])).rows[0].coins), 100);
    const status = (await c.query(
      "select status from marketplace_offers where listing_id = $1", [id2])).rows[0].status;
    assert.equal(status, "refunded");
  });
});

test("achat concurrent : une seule vente réussit", async () => {
  const fx = await withAdmin(async (c) => {
    const seller = await createPlayer(c, 0);
    const b1 = await createPlayer(c, 50);
    const b2 = await createPlayer(c, 50);
    const card = await giveCard(c, seller, "t_eng");
    return { seller, b1, b2, card };
  });
  const id = await listing(fx.seller, fx.card, 10, false);
  async function buy(buyer) {
    const client = connect();
    await client.connect();
    try {
      await client.query("begin");
      await client.query("set local role app_user");
      await client.query("select set_config('app.user_id', $1, true)", [buyer]);
      await client.query("select public.buy_marketplace_item($1::uuid, $2::uuid)", [buyer, id]);
      await client.query("commit");
    } catch (e) {
      await client.query("rollback");
      throw e;
    } finally {
      await client.end();
    }
  }
  const results = await Promise.allSettled([buy(fx.b1), buy(fx.b2)]);
  const ok = results.filter((r) => r.status === "fulfilled");
  const ko = results.find((r) => r.status === "rejected");
  assert.equal(ok.length, 1);
  assert.match(ko.reason.message, /listing_closed/);
  await withAdmin(async (c) => {
    const row = (await c.query("select status, buyer_id from marketplace_listings where id = $1", [id])).rows[0];
    assert.equal(row.status, "sold");
    const owner = (await c.query("select owner_id, is_listed from user_cards where id = $1", [fx.card])).rows[0];
    assert.equal(owner.owner_id, row.buyer_id);
    assert.equal(owner.is_listed, false);
    const spent = [fx.b1, fx.b2].map(async (idBuyer) =>
      Number((await c.query("select coins from profiles where id = $1", [idBuyer])).rows[0].coins));
    const coins = await Promise.all(spent);
    assert.deepEqual(coins.sort((a, b) => a - b), [40, 50]);
  });
});

test("insufficient_funds annule la vente", async () => {
  const fx = await withAdmin(async (c) => {
    const seller = await createPlayer(c, 3);
    const buyer = await createPlayer(c, 0);
    const card = await giveCard(c, seller, "t_eng");
    return { seller, buyer, card };
  });
  const id = await listing(fx.seller, fx.card, 10, false);
  await expectError(
    fx.buyer,
    (c) => c.query("select public.buy_marketplace_item($1::uuid, $2::uuid)", [fx.buyer, id]),
    "insufficient_funds",
  );
  await withAdmin(async (c) => {
    const row = (await c.query("select status from marketplace_listings where id = $1", [id])).rows[0];
    const card = (await c.query("select owner_id, is_listed from user_cards where id = $1", [fx.card])).rows[0];
    const seller = Number((await c.query("select coins from profiles where id = $1", [fx.seller])).rows[0].coins);
    const buyer = Number((await c.query("select coins from profiles where id = $1", [fx.buyer])).rows[0].coins);
    assert.equal(row.status, "active");
    assert.equal(card.owner_id, fx.seller);
    assert.equal(card.is_listed, true);
    assert.equal(seller, 3);
    assert.equal(buyer, 0);
  });
});

test("prix 0 refusé et 4e vente entre les mêmes comptes refusée", async () => {
  const fx = await withAdmin(async (c) => {
    const seller = await createPlayer(c, 0);
    const buyer = await createPlayer(c, 100);
    const card = await giveCard(c, seller, "t_eng");
    const cards = [];
    for (let i = 0; i < 4; i++) cards.push(await giveCard(c, seller, "t_eng"));
    return { seller, buyer, card, cards };
  });
  await expectError(
    fx.seller,
    (c) => c.query("select public.create_listing($1::uuid, $2::uuid, 0, false)", [fx.seller, fx.card]),
    "invalid_price",
  );
  for (let i = 0; i < 3; i++) {
    const id = await listing(fx.seller, fx.cards[i], 10, false);
    await asUser(fx.buyer, (c) => c.query("select public.buy_marketplace_item($1::uuid, $2::uuid)", [fx.buyer, id]));
  }
  const fourth = await listing(fx.seller, fx.cards[3], 10, false);
  await expectError(
    fx.buyer,
    (c) => c.query("select public.buy_marketplace_item($1::uuid, $2::uuid)", [fx.buyer, fourth]),
    "trade_limit",
  );
  await withAdmin(async (c) => {
    const row = (await c.query("select status from marketplace_listings where id = $1", [fourth])).rows[0];
    const buyer = Number((await c.query("select coins from profiles where id = $1", [fx.buyer])).rows[0].coins);
    assert.equal(row.status, "active");
    assert.equal(buyer, 70);
  });
});
