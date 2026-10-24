import assert from "node:assert/strict";
import { before, test } from "node:test";
import { asUser, createPlayer, ensureTemplates, expectError, giveCard, makeDeck, withAdmin } from "./helpers.mjs";

before(async () => {
  await withAdmin(ensureTemplates);
});

test("grant_starter_kit : commun, 5 bonus, un pneu de chaque type, sans config", async () => {
  const user = await withAdmin(async (c) => {
    const id = await createPlayer(c);
    await c.query("select private.grant_starter_kit($1)", [id]);
    return id;
  });
  await withAdmin(async (c) => {
    const { rows } = await c.query(
      `select t.category, t.rarity, t.tire_type
         from user_cards uc join card_templates t on t.id = uc.template_id
        where uc.owner_id = $1 and uc.source = 'starter'`,
      [user],
    );
    const of = (cat) => rows.filter((r) => r.category === cat);
    assert.equal(of("moteur").length, 1);
    assert.equal(of("moteur")[0].rarity, "commune");
    assert.equal(of("boite").length, 1);
    assert.equal(of("boite")[0].rarity, "commune");
    assert.equal(of("bonus").length, 5);
    assert.equal(new Set(of("pneus").map((r) => r.tire_type)).size, 5);
    const decks = await c.query("select id from user_decks where owner_id = $1", [user]);
    assert.equal(decks.rows.length, 0);
  });
});

test("recycle_card : base × état restant, et la config est retirée", async () => {
  const fx = await withAdmin(async (c) => {
    const user = await createPlayer(c, 0);
    const deck = await makeDeck(c, user, "t_eng");
    await c.query(
      `insert into card_templates (code, category, name, rarity, architecture, power_hp, weight_kg, base_break_risk, wear_sensitivity)
       values ('t_eng_worn', 'moteur', 'Moteur use', 'commune', '4 cylindres', 80, 90, 40, 10)
       on conflict (code) do update set base_break_risk = 40, wear_sensitivity = 10`,
    );
    const worn = await giveCard(c, user, "t_eng_worn");
    await c.query("update user_cards set runs_count = 2 where id = $1", [worn]);
    await c.query("update user_cards set tire_wear = 40 where id = $1", [deck.tire]);
    return { user, ...deck, worn };
  });

  const fresh = (await asUser(fx.user, (c) =>
    c.query("select public.recycle_card($1::uuid, $2::uuid) as r", [fx.user, fx.engine]))).rows[0].r;
  assert.equal(Number(fresh.coins), 50);

  const worn = (await asUser(fx.user, (c) =>
    c.query("select public.recycle_card($1::uuid, $2::uuid) as r", [fx.user, fx.worn]))).rows[0].r;
  assert.equal(Number(worn.coins), 20);

  const tire = (await asUser(fx.user, (c) =>
    c.query("select public.recycle_card($1::uuid, $2::uuid) as r", [fx.user, fx.tire]))).rows[0].r;
  assert.equal(Number(tire.coins), 4);

  await withAdmin(async (c) => {
    const left = await c.query("select id from user_cards where id = any($1::uuid[])", [[fx.engine, fx.worn, fx.tire]]);
    assert.equal(left.rows.length, 0);
    const decks = await c.query("select id from user_decks where owner_id = $1", [fx.user]);
    assert.equal(decks.rows.length, 0);
    const coins = await c.query("select coins from profiles where id = $1", [fx.user]);
    assert.equal(coins.rows[0].coins, 74);
  });
});

test("create_listing retire la carte de la config", async () => {
  const fx = await withAdmin(async (c) => {
    const user = await createPlayer(c, 0);
    return { user, ...(await makeDeck(c, user, "t_eng")) };
  });
  await asUser(fx.user, (c) =>
    c.query("select public.create_listing($1::uuid, $2::uuid, 5, false)", [fx.user, fx.engine]));
  await withAdmin(async (c) => {
    const decks = await c.query("select id from user_decks where owner_id = $1", [fx.user]);
    assert.equal(decks.rows.length, 0);
    const listed = await c.query("select is_listed from user_cards where id = $1", [fx.engine]);
    assert.equal(listed.rows[0].is_listed, true);
  });
});

test("bonus : recyclage à 1 pièce, vente refusée", async () => {
  const fx = await withAdmin(async (c) => {
    const user = await createPlayer(c, 0);
    const recycle = await giveCard(c, user, "bonus_revision_express");
    const sell = await giveCard(c, user, "bonus_vidange_boite");
    return { user, recycle, sell };
  });
  const r = (await asUser(fx.user, (c) =>
    c.query("select public.recycle_card($1::uuid, $2::uuid) as r", [fx.user, fx.recycle]))).rows[0].r;
  assert.equal(Number(r.coins), 1);
  await expectError(
    fx.user,
    (c) => c.query("select public.create_listing($1::uuid, $2::uuid, 5, false)", [fx.user, fx.sell]),
    "bonus_not_sellable",
  );
  await withAdmin(async (c) => {
    const gone = await c.query("select id from user_cards where id = $1", [fx.recycle]);
    assert.equal(gone.rows.length, 0);
    const coins = await c.query("select coins from profiles where id = $1", [fx.user]);
    assert.equal(coins.rows[0].coins, 1);
    const still = await c.query("select is_listed from user_cards where id = $1", [fx.sell]);
    assert.equal(still.rows[0].is_listed, false);
  });
});

test("pièce détruite : recyclage à 1 pièce", async () => {
  const fx = await withAdmin(async (c) => {
    const user = await createPlayer(c, 0);
    const engine = await giveCard(c, user, "t_eng");
    const tire = await giveCard(c, user, "tire_slick");
    await c.query("update user_cards set is_destroyed = true where id = any($1::uuid[])", [[engine, tire]]);
    return { user, engine, tire };
  });
  const engine = (await asUser(fx.user, (c) =>
    c.query("select public.recycle_card($1::uuid, $2::uuid) as r", [fx.user, fx.engine]))).rows[0].r;
  const tire = (await asUser(fx.user, (c) =>
    c.query("select public.recycle_card($1::uuid, $2::uuid) as r", [fx.user, fx.tire]))).rows[0].r;
  assert.equal(Number(engine.coins), 1);
  assert.equal(Number(tire.coins), 1);
  await withAdmin(async (c) => {
    const left = await c.query("select id from user_cards where id = any($1::uuid[])", [[fx.engine, fx.tire]]);
    assert.equal(left.rows.length, 0);
    const coins = await c.query("select coins from profiles where id = $1", [fx.user]);
    assert.equal(coins.rows[0].coins, 2);
  });
});

test("claim_daily_pull : 3 bonus, un seul tirage par jour Paris", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  const { rows } = await asUser(user, (c) => c.query("select public.claim_daily_pull($1::uuid) as r", [user]));
  assert.equal(rows[0].r.card_ids.length, 3);
  await expectError(user, (c) => c.query("select public.claim_daily_pull($1::uuid)", [user]), "already_claimed");
  await withAdmin(async (c) => {
    const { rows: cards } = await c.query(
      `select t.category from user_cards uc join card_templates t on t.id = uc.template_id
        where uc.owner_id = $1 and uc.source = 'daily_pull'`,
      [user],
    );
    assert.equal(cards.length, 3);
    assert.ok(cards.every((r) => r.category === "bonus"));
  });
});

test("claim_weekly_pull : un moteur ou une boîte, une fois par semaine", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  const { rows } = await asUser(user, (c) => c.query("select public.claim_weekly_pull($1::uuid) as r", [user]));
  assert.equal(rows[0].r.card_ids.length, 1);
  await expectError(user, (c) => c.query("select public.claim_weekly_pull($1::uuid)", [user]), "weekly_already_claimed");
  const daily = await asUser(user, (c) => c.query("select public.claim_daily_pull($1::uuid) as r", [user]));
  assert.equal(daily.rows[0].r.card_ids.length, 3);
  await withAdmin(async (c) => {
    const { rows: cards } = await c.query(
      `select t.category from user_cards uc join card_templates t on t.id = uc.template_id
        where uc.owner_id = $1 and uc.source = 'weekly_pull'`,
      [user],
    );
    assert.equal(cards.length, 1);
    assert.ok(cards[0].category === "moteur" || cards[0].category === "boite");
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
