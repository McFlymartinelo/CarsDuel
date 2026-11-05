import assert from "node:assert/strict";
import { before, test } from "node:test";
import { asUser, createPlayer, ensureTemplates, expectError, giveCard, makeDeck, withAdmin } from "./helpers.mjs";

before(async () => {
  await withAdmin(ensureTemplates);
});

test("grant_starter_kit : 2 moteurs et 2 boîtes communs, 5 bonus, 5 pneus au hasard, sans config", async () => {
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
    assert.equal(of("moteur").length, 2);
    assert.ok(of("moteur").every((r) => r.rarity === "commune"));
    assert.equal(of("boite").length, 2);
    assert.ok(of("boite").every((r) => r.rarity === "commune"));
    assert.equal(of("bonus").length, 5);
    assert.equal(of("pneus").length, 5);
    assert.ok(of("pneus").every((r) => r.tire_type !== null));
    const decks = await c.query("select id from user_decks where owner_id = $1", [user]);
    assert.equal(decks.rows.length, 0);
  });
});

test("create_listing retire uniquement la carte vendue de la config", async () => {
  const fx = await withAdmin(async (c) => {
    const user = await createPlayer(c, 0);
    return { user, ...(await makeDeck(c, user, "t_eng")) };
  });
  await asUser(fx.user, (c) =>
    c.query("select public.create_listing($1::uuid, $2::uuid, 10, false)", [fx.user, fx.engine]));
  await withAdmin(async (c) => {
    const decks = await c.query("select engine_card_id, gearbox_card_id, tire_card_id from user_decks where owner_id = $1", [fx.user]);
    assert.equal(decks.rows.length, 1);
    assert.equal(decks.rows[0].engine_card_id, null);
    assert.equal(decks.rows[0].gearbox_card_id, fx.gearbox);
    assert.equal(decks.rows[0].tire_card_id, fx.tire);
    const listed = await c.query("select is_listed from user_cards where id = $1", [fx.engine]);
    assert.equal(listed.rows[0].is_listed, true);
  });
});

test("user_decks autorise une config partielle (1 ou 2 emplacements) et refuse un deck entièrement vide", async () => {
  const fx = await withAdmin(async (c) => {
    const user = await createPlayer(c, 0);
    const engine = await giveCard(c, user, "t_eng");
    const gearbox = await giveCard(c, user, "t_gb");
    return { user, engine, gearbox };
  });

  await expectError(
    fx.user,
    (c) => c.query("insert into user_decks (owner_id, name) values ($1, 'Vide')", [fx.user]),
    "invalid_deck_card",
  );

  await asUser(fx.user, async (c) => {
    const { rows } = await c.query(
      "insert into user_decks (owner_id, name, engine_card_id) values ($1, 'Deck principal', $2::uuid) returning id, engine_card_id, gearbox_card_id, tire_card_id",
      [fx.user, fx.engine],
    );
    assert.equal(rows[0].engine_card_id, fx.engine);
    assert.equal(rows[0].gearbox_card_id, null);
    assert.equal(rows[0].tire_card_id, null);

    await c.query("update user_decks set gearbox_card_id = $2::uuid where id = $1::uuid", [rows[0].id, fx.gearbox]);
    const updated = await c.query("select engine_card_id, gearbox_card_id, tire_card_id from user_decks where id = $1::uuid", [rows[0].id]);
    assert.equal(updated.rows[0].engine_card_id, fx.engine);
    assert.equal(updated.rows[0].gearbox_card_id, fx.gearbox);
    assert.equal(updated.rows[0].tire_card_id, null);
  });
});

test("bonus : vendable sur la marketplace, dépôt dans la benne impossible", async () => {
  const fx = await withAdmin(async (c) => {
    const user = await createPlayer(c, 0);
    const bonus = await giveCard(c, user, "bonus_vidange_boite");
    return { user, bonus };
  });
  const { rows } = await asUser(fx.user, (c) =>
    c.query("select public.create_listing($1::uuid, $2::uuid, 10, false) as id", [fx.user, fx.bonus]),
  );
  assert.ok(rows[0].id);
  await expectError(
    fx.user,
    (c) => c.query("select public.recycle_bin_add($1::uuid, $2::uuid)", [fx.user, fx.bonus]),
    "card_not_recyclable",
  );
  await withAdmin(async (c) => {
    const listed = await c.query("select is_listed, in_recycle_bin from user_cards where id = $1", [fx.bonus]);
    assert.equal(listed.rows[0].is_listed, true);
    assert.equal(listed.rows[0].in_recycle_bin, false);
  });
});

test("create_listings : plusieurs exemplaires mis en vente en une fois, tout ou rien", async () => {
  const fx = await withAdmin(async (c) => {
    const user = await createPlayer(c, 0);
    const a = await giveCard(c, user, "bonus_vidange_boite");
    const b = await giveCard(c, user, "bonus_vidange_boite");
    return { user, a, b };
  });
  const { rows } = await asUser(fx.user, (c) =>
    c.query("select public.create_listings($1::uuid, $2::uuid[], 10, false) as ids", [fx.user, [fx.a, fx.b]]),
  );
  assert.equal(rows[0].ids.length, 2);
  await expectError(
    fx.user,
    (c) => c.query("select public.create_listings($1::uuid, $2::uuid[], 10, false)", [fx.user, [fx.a]]),
    "already_listed",
  );
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

test("claim_weekly_pull : un moteur, une fois par semaine", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  const { rows } = await asUser(user, (c) =>
    c.query("select public.claim_weekly_pull($1::uuid, 'moteur') as r", [user]));
  assert.equal(rows[0].r.card_ids.length, 1);
  await expectError(
    user,
    (c) => c.query("select public.claim_weekly_pull($1::uuid, 'moteur')", [user]),
    "weekly_already_claimed",
  );
  const daily = await asUser(user, (c) => c.query("select public.claim_daily_pull($1::uuid) as r", [user]));
  assert.equal(daily.rows[0].r.card_ids.length, 3);
  await withAdmin(async (c) => {
    const { rows: cards } = await c.query(
      `select t.category from user_cards uc join card_templates t on t.id = uc.template_id
        where uc.owner_id = $1 and uc.source = 'weekly_pull'`,
      [user],
    );
    assert.equal(cards.length, 1);
    assert.equal(cards[0].category, "moteur");
  });
});

test("claim_weekly_pull : une boîte", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  const { rows } = await asUser(user, (c) =>
    c.query("select public.claim_weekly_pull($1::uuid, 'boite') as r", [user]));
  assert.equal(rows[0].r.card_ids.length, 1);
  await withAdmin(async (c) => {
    const { rows: cards } = await c.query(
      `select t.category from user_cards uc join card_templates t on t.id = uc.template_id
        where uc.owner_id = $1 and uc.source = 'weekly_pull'`,
      [user],
    );
    assert.equal(cards.length, 1);
    assert.equal(cards[0].category, "boite");
  });
});

test("claim_weekly_pull : catégorie invalide refusée", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  for (const category of ["pneus", "bonus", "xxx"]) {
    await expectError(
      user,
      (c) => c.query("select public.claim_weekly_pull($1::uuid, $2::text)", [user, category]),
      "invalid_category",
    );
  }
  await withAdmin(async (c) => {
    const n = Number((await c.query(
      "select count(*)::int as n from user_cards where owner_id = $1 and source = 'weekly_pull'",
      [user],
    )).rows[0].n);
    assert.equal(n, 0);
  });
});

test("claim_weekly_pull : seule la signature (uuid, text) subsiste", async () => {
  const { rows } = await withAdmin((c) => c.query(
    `select oidvectortypes(p.proargtypes) as args
       from pg_proc p
      where p.pronamespace = 'public'::regnamespace and p.proname = 'claim_weekly_pull'`,
  ));
  assert.deepEqual(rows.map((r) => r.args), ["uuid, text"]);
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
    c.query("select public.create_listing($1::uuid, $2::uuid, 10, false) as id", [fx.b, fx.visible]))).rows[0].id;
  const sale = (await asUser(fx.seller, (c) =>
    c.query("select public.create_listing($1::uuid, $2::uuid, $3::int, true) as id", [fx.seller, fx.forSale, 10]))).rows[0].id;
  const offer = (await asUser(fx.b, (c) =>
    c.query("select public.make_offer($1::uuid, $2::uuid, 10) as id", [fx.b, sale]))).rows[0].id;
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

test("validate_deck refuse une carte d'un autre joueur, une carte en vente ou une mauvaise catégorie", async () => {
  const fx = await withAdmin(async (c) => {
    const owner = await createPlayer(c);
    const other = await createPlayer(c);
    const engine = await giveCard(c, owner, "t_eng");
    const gearbox = await giveCard(c, owner, "t_gb");
    const tire = await giveCard(c, owner, "tire_route");
    const foreign = await giveCard(c, other, "t_eng");
    return { owner, other, engine, gearbox, tire, foreign };
  });

  const insert = `insert into user_decks (owner_id, name, engine_card_id, gearbox_card_id, tire_card_id)
                  values ($1, 'Test', $2::uuid, $3::uuid, $4::uuid)`;

  await expectError(
    fx.owner,
    (c) => c.query(insert, [fx.owner, fx.foreign, fx.gearbox, fx.tire]),
    "invalid_deck_card",
  );

  await asUser(fx.owner, (c) =>
    c.query("select public.create_listing($1::uuid, $2::uuid, 10, false)", [fx.owner, fx.engine]));
  await expectError(
    fx.owner,
    (c) => c.query(insert, [fx.owner, fx.engine, fx.gearbox, fx.tire]),
    "invalid_deck_card",
  );

  await expectError(
    fx.owner,
    (c) => c.query(insert, [fx.owner, fx.gearbox, fx.gearbox, fx.tire]),
    "invalid_deck_card",
  );
});

// Audit point 6 : validate_deck ne vérifie pas encore is_destroyed.
test.todo("une carte détruite ne devrait pas pouvoir être équipée — audit point 6");
