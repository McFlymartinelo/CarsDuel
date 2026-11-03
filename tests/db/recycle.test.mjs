import assert from "node:assert/strict";
import { before, test } from "node:test";
import { asUser, createPlayer, ensureTemplates, expectError, giveCard, makeDeck, withAdmin } from "./helpers.mjs";

const add = (uid, cardId) =>
  asUser(uid, (c) => c.query("select public.recycle_bin_add($1::uuid, $2::uuid) as r", [uid, cardId])).then((r) => r.rows[0].r);
const remove = (uid, cardId) =>
  asUser(uid, (c) => c.query("select public.recycle_bin_remove($1::uuid, $2::uuid) as r", [uid, cardId])).then((r) => r.rows[0].r);
const processBin = (uid) =>
  asUser(uid, (c) => c.query("select public.recycle_bin_process($1::uuid) as r", [uid])).then((r) => r.rows[0].r);
const exchange = (uid, category) =>
  asUser(uid, (c) => c.query("select public.recycle_exchange($1::uuid, $2::text) as r", [uid, category])).then((r) => r.rows[0].r);
const exchangeTiered = (uid, tier, category) =>
  asUser(uid, (c) =>
    c.query("select public.recycle_exchange_tiered($1::uuid, $2::text, $3::text) as r", [uid, tier, category]),
  ).then((r) => r.rows[0].r);

before(async () => {
  await withAdmin(async (c) => {
    await ensureTemplates(c);
    await c.query(`
      insert into card_templates
        (code, category, name, rarity, architecture, power_hp, weight_kg, base_break_risk, wear_sensitivity)
      values ('t_eng_21', 'moteur', 'Moteur 21 kg', 'commune', '4 cylindres', 100, 21, 0, 0)
      on conflict (code) do update set weight_kg = 21, base_break_risk = 0, wear_sensitivity = 0`);
    await c.query(`
      insert into card_templates
        (code, category, name, rarity, gearbox_type, shift_time_ms, weight_kg, base_break_risk, wear_sensitivity)
      values ('t_gb_2', 'boite', 'Boite 2 kg', 'commune', 'manuelle', 100, 2, 0, 0)
      on conflict (code) do update set weight_kg = 2, base_break_risk = 0, wear_sensitivity = 0`);
  });
});

test("benne : dépôt, retrait, poids et retrait de la config", async () => {
  const fx = await withAdmin(async (c) => {
    const user = await createPlayer(c);
    const other = await createPlayer(c);
    const deck = await makeDeck(c, user, "t_eng");
    const bonus = await giveCard(c, user, "bonus_revision_express");
    const listed = await giveCard(c, user, "t_eng");
    const foreign = await giveCard(c, other, "t_eng");
    return { user, other, ...deck, bonus, listed, foreign };
  });

  const added = await add(fx.user, fx.engine);
  assert.equal(Number(added.weight_kg), 100);
  await withAdmin(async (c) => {
    const card = (await c.query("select in_recycle_bin from user_cards where id = $1", [fx.engine])).rows[0];
    assert.equal(card.in_recycle_bin, true);
    const deck = (await c.query("select engine_card_id, gearbox_card_id, tire_card_id from user_decks where owner_id = $1", [fx.user])).rows[0];
    assert.equal(deck.engine_card_id, null);
    assert.equal(deck.gearbox_card_id, fx.gearbox);
    assert.equal(deck.tire_card_id, fx.tire);
  });

  await expectError(
    fx.user,
    (c) => c.query("select public.recycle_bin_add($1::uuid, $2::uuid)", [fx.user, fx.bonus]),
    "card_not_recyclable",
  );
  await expectError(
    fx.user,
    (c) => c.query("select public.recycle_bin_add($1::uuid, $2::uuid)", [fx.user, fx.foreign]),
    "card_not_owned",
  );
  await asUser(fx.user, (c) =>
    c.query("select public.create_listing($1::uuid, $2::uuid, 10, false)", [fx.user, fx.listed]));
  await expectError(
    fx.user,
    (c) => c.query("select public.recycle_bin_add($1::uuid, $2::uuid)", [fx.user, fx.listed]),
    "already_listed",
  );

  const removed = await remove(fx.user, fx.engine);
  assert.equal(removed.card_id, fx.engine);
  await expectError(
    fx.user,
    (c) => c.query("select public.recycle_bin_remove($1::uuid, $2::uuid)", [fx.user, fx.engine]),
    "card_not_in_recycle_bin",
  );

  // Une carte de la benne ne peut pas être équipée, même via une écriture directe.
  await add(fx.user, fx.engine);
  await expectError(
    fx.user,
    (c) => c.query(
      "insert into user_decks (owner_id, name, engine_card_id) values ($1, 'Benne', $2::uuid)",
      [fx.user, fx.engine],
    ),
    "invalid_deck_card",
  );
});

test("benne : moins de 10 kg refusé, 10 kg créditent 1 cube", async () => {
  const fx = await withAdmin(async (c) => {
    const user = await createPlayer(c, 0);
    const t1 = await giveCard(c, user, "tire_route");
    const t2 = await giveCard(c, user, "tire_sport");
    const gb = await giveCard(c, user, "t_gb_2");
    return { user, t1, t2, gb };
  });

  await add(fx.user, fx.t1);
  await add(fx.user, fx.t2);
  await expectError(fx.user, (c) => c.query("select public.recycle_bin_process($1::uuid)", [fx.user]), "recycle_bin_too_light");

  await add(fx.user, fx.gb);
  const r = await processBin(fx.user);
  assert.equal(Number(r.cards), 3);
  assert.equal(Number(r.weight_kg), 10);
  assert.equal(Number(r.cubes), 1);

  await withAdmin(async (c) => {
    const gone = await c.query("select id from user_cards where id = any($1::uuid[])", [[fx.t1, fx.t2, fx.gb]]);
    assert.equal(gone.rows.length, 0);
    assert.equal((await c.query("select scrap_cubes from profiles where id = $1", [fx.user])).rows[0].scrap_cubes, 1);
    const tx = await c.query("select amount, reason from scrap_cube_transactions where user_id = $1", [fx.user]);
    assert.deepEqual(tx.rows.map((x) => [x.amount, x.reason]), [[1, "recycle_bin"]]);
  });
});

test("benne : 21 kg produisent 2 cubes et les annonces historiques survivent", async () => {
  const fx = await withAdmin(async (c) => {
    const user = await createPlayer(c, 0);
    const engine = await giveCard(c, user, "t_eng_21");
    const listed = await giveCard(c, user, "t_eng");
    return { user, engine, listed };
  });

  const listing = (await asUser(fx.user, (c) =>
    c.query("select public.create_listing($1::uuid, $2::uuid, 10, false) as id", [fx.user, fx.listed]))).rows[0].id;
  await asUser(fx.user, (c) => c.query("select public.cancel_listing($1::uuid, $2::uuid)", [fx.user, listing]));

  await add(fx.user, fx.engine);
  const r = await processBin(fx.user);
  assert.equal(Number(r.weight_kg), 21);
  assert.equal(Number(r.cubes), 2);
  await withAdmin(async (c) => {
    assert.equal((await c.query("select scrap_cubes from profiles where id = $1", [fx.user])).rows[0].scrap_cubes, 2);
  });

  // Une carte déjà passée par la marketplace peut aussi être recyclée : l'annonce
  // conserve son instantané (nom, catégorie, modèle) et perd seulement son card_id.
  await add(fx.user, fx.listed);
  await processBin(fx.user);
  await withAdmin(async (c) => {
    const row = (await c.query(
      "select card_id, card_name, card_category, card_template_id from marketplace_listings where id = $1",
      [listing],
    )).rows[0];
    assert.equal(row.card_id, null);
    assert.equal(row.card_name, "Moteur test");
    assert.equal(row.card_category, "moteur");
    assert.ok(row.card_template_id);
    assert.equal((await c.query("select id from user_cards where id = $1", [fx.listed])).rows.length, 0);
  });
});

test("échanges : 25 cubes = 1 carte neuve de la catégorie choisie, 0 run", async () => {
  const user = await withAdmin((c) => createPlayer(c, 0));
  await withAdmin((c) => c.query("update profiles set scrap_cubes = 24 where id = $1", [user]));
  await expectError(
    user,
    (c) => c.query("select public.recycle_exchange($1::uuid, 'moteur')", [user]),
    "insufficient_scrap_cubes",
  );

  await withAdmin((c) => c.query("update profiles set scrap_cubes = 50 where id = $1", [user]));
  const engine = await exchange(user, "moteur");
  assert.equal(engine.category, "moteur");
  assert.equal(Number(engine.cost), 25);

  const gearbox = await exchange(user, "boite");
  assert.equal(gearbox.category, "boite");
  await expectError(
    user,
    (c) => c.query("select public.recycle_exchange($1::uuid, 'pneus')", [user]),
    "invalid_category",
  );
  await expectError(
    user,
    (c) => c.query("select public.recycle_exchange($1::uuid, 'moteur')", [user]),
    "insufficient_scrap_cubes",
  );

  await withAdmin(async (c) => {
    assert.equal((await c.query("select scrap_cubes from profiles where id = $1", [user])).rows[0].scrap_cubes, 0);
    for (const id of [engine.card_id, gearbox.card_id]) {
      const card = (await c.query(
        `select uc.runs_count, uc.source, t.category
           from user_cards uc join card_templates t on t.id = uc.template_id
          where uc.id = $1`,
        [id],
      )).rows[0];
      assert.equal(card.runs_count, 0);
      assert.equal(card.source, "recycle_exchange");
    }
    const tx = await c.query("select amount, reason from scrap_cube_transactions where user_id = $1 order by created_at", [user]);
    assert.deepEqual(tx.rows.map((x) => [x.amount, x.reason]), [[-25, "recycle_exchange"], [-25, "recycle_exchange"]]);
  });
});

test("échanges à paliers : coût, catégorie et solde débité", async () => {
  const user = await withAdmin((c) => createPlayer(c, 0));
  await withAdmin((c) => c.query("update profiles set scrap_cubes = 175 where id = $1", [user]));

  const standard = await exchangeTiered(user, "standard", "moteur");
  assert.equal(standard.tier, "standard");
  assert.equal(standard.category, "moteur");
  assert.equal(Number(standard.cost), 25);
  assert.equal(Number(standard.cubes_left), 150);

  const ameliore = await exchangeTiered(user, "ameliore", "boite");
  assert.equal(ameliore.tier, "ameliore");
  assert.equal(ameliore.category, "boite");
  assert.equal(Number(ameliore.cost), 50);
  assert.equal(Number(ameliore.cubes_left), 100);

  const prestige = await exchangeTiered(user, "prestige", "moteur");
  assert.equal(prestige.tier, "prestige");
  assert.equal(prestige.category, "moteur");
  assert.equal(Number(prestige.cost), 100);
  assert.equal(Number(prestige.cubes_left), 0);

  await expectError(
    user,
    (c) => c.query("select public.recycle_exchange_tiered($1::uuid, 'standard', 'moteur')", [user]),
    "insufficient_scrap_cubes",
  );
  await expectError(
    user,
    (c) => c.query("select public.recycle_exchange_tiered($1::uuid, 'inconnu', 'moteur')", [user]),
    "invalid_tier",
  );
  await expectError(
    user,
    (c) => c.query("select public.recycle_exchange_tiered($1::uuid, 'standard', 'pneus')", [user]),
    "invalid_category",
  );

  await withAdmin(async (c) => {
    for (const draw of [standard, ameliore, prestige]) {
      const card = (await c.query(
        `select uc.runs_count, uc.source, t.category
           from user_cards uc join card_templates t on t.id = uc.template_id
          where uc.id = $1`,
        [draw.card_id],
      )).rows[0];
      assert.equal(card.runs_count, 0);
      assert.equal(card.source, "recycle_exchange");
      assert.equal(card.category, draw.category);
    }
    const tx = await c.query(
      "select amount, reason from scrap_cube_transactions where user_id = $1 order by created_at",
      [user],
    );
    assert.deepEqual(tx.rows.map((x) => [x.amount, x.reason]), [
      [-25, "recycle_exchange"],
      [-50, "recycle_exchange"],
      [-100, "recycle_exchange"],
    ]);
  });
});

test("l'ancien recyclage direct a disparu", async () => {
  const { rows } = await withAdmin((c) => c.query(
    "select count(*)::int as n from pg_proc where pronamespace = 'public'::regnamespace and proname = 'recycle_card'",
  ));
  assert.equal(rows[0].n, 0);
});
