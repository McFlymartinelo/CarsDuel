import assert from "node:assert/strict";
import { before, test } from "node:test";
import { asUser, createPlayer, ensureTemplates, expectError, giveCard, makeDeck, withAdmin } from "./helpers.mjs";

before(async () => {
  await withAdmin(ensureTemplates);
});

test("claim_daily_pull : un seul tirage par jour Paris", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  const { rows } = await asUser(user, (c) => c.query("select public.claim_daily_pull($1::uuid, 2) as r", [user]));
  assert.equal(rows[0].r.card_ids.length, 5);
  await expectError(user, (c) => c.query("select public.claim_daily_pull($1::uuid, 2)", [user]), "already_claimed");
  await withAdmin(async (c) => {
    const n = Number((await c.query(
      "select count(*)::int as n from user_cards where owner_id = $1 and source = 'daily_pull'", [user])).rows[0].n);
    assert.equal(n, 5);
  });
});

test("RLS : A ne lit ni les cartes non listées, ni les duels, ni les offres de B", async () => {
  const fx = await withAdmin(async (c) => {
    const a = await createPlayer(c, 0);
    const b = await createPlayer(c, 100);
    const seller = await createPlayer(c, 0);
    const hidden = await giveCard(c, b, "t_eng");
    const visible = await giveCard(c, b, "t_eng");
    const forSale = await giveCard(c, seller, "t_eng");
    const deckB = await makeDeck(c, b, "t_eng");
    await makeDeck(c, seller, "t_eng");
    return { a, b, seller, hidden, visible, forSale, deckB: deckB.deckId };
  });

  const listed = (await asUser(fx.b, (c) =>
    c.query("select public.create_listing($1::uuid, $2::uuid, 5, false) as id", [fx.b, fx.visible]))).rows[0].id;
  const sale = (await asUser(fx.seller, (c) =>
    c.query("select public.create_listing($1::uuid, $2::uuid, $3::int, true) as id", [fx.seller, fx.forSale, 8]))).rows[0].id;
  const offer = (await asUser(fx.b, (c) =>
    c.query("select public.make_offer($1::uuid, $2::uuid, 4) as id", [fx.b, sale]))).rows[0].id;
  const duel = (await asUser(fx.b, (c) =>
    c.query("select public.execute_duel($1::uuid, $2::uuid, null) as r", [fx.b, fx.deckB]))).rows[0].r;

  await asUser(fx.a, async (c) => {
    const cards = await c.query("select id from user_cards where id = any($1::uuid[])", [[fx.hidden, fx.visible]]);
    const ids = new Set(cards.rows.map((r) => r.id));
    assert.equal(ids.has(fx.hidden), false);
    assert.equal(ids.has(fx.visible), true);
    const duels = await c.query("select id from duels_history where id = $1", [duel.duel_id]);
    assert.equal(duels.rows.length, 0);
    const offers = await c.query("select id from marketplace_offers where id = $1", [offer]);
    assert.equal(offers.rows.length, 0);
    const ownListing = await c.query("select id from marketplace_listings where id = $1", [listed]);
    assert.equal(ownListing.rows.length, 1);
  });
});
