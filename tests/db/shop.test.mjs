import assert from "node:assert/strict";
import { before, test } from "node:test";
import { asUser, createPlayer, ensureTemplates, expectError, withAdmin } from "./helpers.mjs";

before(async () => {
  await withAdmin(ensureTemplates);
});

/** Un seul article de boutique pour t_eng : les tests s'exécutent dans l'ordre du fichier. */
async function shopItem(price, stock = null) {
  return withAdmin(async (c) => {
    const { rows } = await c.query(
      `insert into public.shop_catalog (vendor_id, template_id, price, stock, is_active)
       select v.id, t.id, $1, $2, true
         from public.shop_vendors v, public.card_templates t
        where v.name = 'Magasin de pièces neuves' and t.code = 't_eng'
       on conflict (vendor_id, template_id)
       do update set price = excluded.price, stock = excluded.stock, is_active = true
       returning id`,
      [price, stock],
    );
    return rows[0].id;
  });
}

const buy = (uid, catalogId, quantity) =>
  asUser(uid, (c) =>
    c.query("select public.buy_shop_item($1::uuid, $2::uuid, $3::int) as r", [uid, catalogId, quantity]),
  ).then((r) => r.rows[0].r);

const snapshot = (uid, catalogId) =>
  withAdmin(async (c) => ({
    coins: Number((await c.query("select coins from public.profiles where id = $1", [uid])).rows[0].coins),
    stock: (await c.query("select stock from public.shop_catalog where id = $1", [catalogId])).rows[0].stock,
    cards: (await c.query("select count(*)::int as n from public.user_cards where owner_id = $1", [uid])).rows[0].n,
    purchases: (
      await c.query(
        "select count(*)::int as n, coalesce(sum(amount), 0)::int as total from public.coin_transactions where user_id = $1 and reason = 'shop_purchase'",
        [uid],
      )
    ).rows[0],
  }));

test("achat groupé : un seul débit, stock décrémenté, une carte par exemplaire", async () => {
  const catalogId = await shopItem(100, 5);
  const uid = await withAdmin((c) => createPlayer(c, 500));

  const ids = await buy(uid, catalogId, 3);
  assert.equal(ids.length, 3);
  assert.equal(new Set(ids).size, 3);

  const after = await snapshot(uid, catalogId);
  assert.equal(after.coins, 200);
  assert.equal(after.stock, 2);
  assert.equal(after.cards, 3);
  assert.equal(after.purchases.n, 1);
  assert.equal(after.purchases.total, -300);
});

test("achat groupé : pièces insuffisantes, rien n'est débité ni créé", async () => {
  const catalogId = await shopItem(100, null);
  const uid = await withAdmin((c) => createPlayer(c, 250));

  await expectError(
    uid,
    (c) => c.query("select public.buy_shop_item($1::uuid, $2::uuid, $3::int)", [uid, catalogId, 3]),
    "insufficient_funds",
  );

  const after = await snapshot(uid, catalogId);
  assert.equal(after.coins, 250);
  assert.equal(after.cards, 0);
  assert.equal(after.purchases.n, 0);
});

test("achat groupé : stock insuffisant, tout est annulé", async () => {
  const catalogId = await shopItem(100, 2);
  const uid = await withAdmin((c) => createPlayer(c, 1000));

  await expectError(
    uid,
    (c) => c.query("select public.buy_shop_item($1::uuid, $2::uuid, $3::int)", [uid, catalogId, 3]),
    "insufficient_stock",
  );

  const after = await snapshot(uid, catalogId);
  assert.equal(after.coins, 1000);
  assert.equal(after.stock, 2);
  assert.equal(after.cards, 0);
  assert.equal(after.purchases.n, 0);
});

test("quantité invalide : zéro est refusé", async () => {
  const catalogId = await shopItem(100, null);
  const uid = await withAdmin((c) => createPlayer(c, 1000));

  await expectError(
    uid,
    (c) => c.query("select public.buy_shop_item($1::uuid, $2::uuid, $3::int)", [uid, catalogId, 0]),
    "invalid_quantity",
  );
  assert.equal((await snapshot(uid, catalogId)).cards, 0);
});

test("ancienne signature à deux arguments : un seul exemplaire", async () => {
  const catalogId = await shopItem(50, null);
  const uid = await withAdmin((c) => createPlayer(c, 100));

  const { rows } = await asUser(uid, (c) =>
    c.query("select public.buy_shop_item($1::uuid, $2::uuid) as r", [uid, catalogId]),
  );
  assert.ok(rows[0].r);

  const after = await snapshot(uid, catalogId);
  assert.equal(after.coins, 50);
  assert.equal(after.cards, 1);
});
