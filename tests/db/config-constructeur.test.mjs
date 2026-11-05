import assert from "node:assert/strict";
import { test } from "node:test";
import { asUser, createPlayer, expectError, giveCard, makeDeck, withAdmin } from "./helpers.mjs";

const BRAND = "zz_test_marque";
const OTHER = "zz_autre_marque";

/** Constructeur de test, pièces de test et défi de la semaine courante forcé sur BRAND. */
async function setup(c) {
  await c.query(
    "insert into config_brands (slug, label, riddle) values ($1, 'Marque test', 'Énigme test') on conflict (slug) do nothing",
    [BRAND],
  );
  await c.query(
    `insert into card_templates (code, category, name, rarity, architecture, power_hp, weight_kg, base_break_risk, wear_sensitivity, manufacturers)
     values
       ('cfg_e1', 'moteur', 'Moteur config 1', 'commune', '4 cylindres', 100, 100, 0, 0, array[$1]::text[]),
       ('cfg_e2', 'moteur', 'Moteur config 2', 'commune', '4 cylindres', 120, 100, 0, 0, array[$1]::text[]),
       ('cfg_e_autre', 'moteur', 'Moteur autre marque', 'commune', '4 cylindres', 100, 100, 0, 0, array[$2]::text[])
     on conflict (code) do update set manufacturers = excluded.manufacturers, is_active = true`,
    [BRAND, OTHER],
  );
  await c.query(
    `insert into card_templates (code, category, name, rarity, gearbox_type, shift_time_ms, weight_kg, base_break_risk, wear_sensitivity, manufacturers)
     values
       ('cfg_g1', 'boite', 'Boite config 1', 'commune', 'manuelle', 100, 30, 0, 0, array[$1]::text[]),
       ('cfg_g_autre', 'boite', 'Boite autre marque', 'commune', 'manuelle', 100, 30, 0, 0, array[$2]::text[])
     on conflict (code) do update set manufacturers = excluded.manufacturers, is_active = true`,
    [BRAND, OTHER],
  );
  const { rows } = await c.query("select to_char(private.config_week_start(), 'YYYY-MM-DD') as w");
  await c.query(
    `insert into config_brand_weeks (week_start, brand) values ($1::date, $2)
     on conflict (week_start) do update set brand = excluded.brand`,
    [rows[0].w, BRAND],
  );
  return rows[0].w;
}

const status = (user) =>
  asUser(user, (c) => c.query("select public.config_challenge_status($1::uuid) as r", [user])).then((r) => r.rows[0].r);

const validate = (user) =>
  asUser(user, (c) => c.query("select public.validate_config_pair($1::uuid) as r", [user])).then((r) => r.rows[0].r);

async function profile(user) {
  return withAdmin(async (c) => {
    const { rows } = await c.query("select coins, xp_total from profiles where id = $1", [user]);
    return { coins: Number(rows[0].coins), xp: Number(rows[0].xp_total) };
  });
}

test("défi : le constructeur de la semaine est stable, la teaser et le total sont exposés", async () => {
  const user = await withAdmin(async (c) => {
    await setup(c);
    return createPlayer(c);
  });

  const first = await status(user);
  const second = await status(user);

  assert.equal(first.challenge.slug, BRAND);
  assert.equal(first.challenge.riddle, "Énigme test");
  assert.equal(second.challenge.slug, BRAND);
  assert.ok(first.next?.riddle, "le teaser de la semaine suivante doit être tiré");
  assert.equal(first.total, 2, "2 moteurs × 1 boîte du constructeur");
  assert.equal(first.found, 0);
  assert.deepEqual(first.reward, { coins: 20, xp: 20 });
  assert.equal(first.equipped, null);
});

test("tirage : un constructeur sans boîte jouable n'est jamais tiré", async () => {
  await withAdmin(async (c) => {
    await setup(c);
    await c.query(
      "insert into config_brands (slug, label, riddle) values ('zz_moteur_seul', 'Moteur seul', 'Énigme sans boîte') on conflict (slug) do nothing",
    );
    await c.query(`
      insert into card_templates (code, category, name, rarity, architecture, power_hp, weight_kg, base_break_risk, wear_sensitivity, manufacturers)
      values ('cfg_e_seul', 'moteur', 'Moteur sans boîte', 'commune', '4 cylindres', 100, 100, 0, 0, array['zz_moteur_seul'])
      on conflict (code) do update set manufacturers = excluded.manufacturers, is_active = true`);
  });

  for (const week of ["2099-01-05", "2099-01-12", "2099-01-19", "2099-01-26"]) {
    const drawn = await withAdmin(async (c) =>
      (await c.query("select private.config_week_brand($1::date) as b", [week])).rows[0].b);
    assert.ok(drawn, `semaine ${week}`);
    assert.notEqual(drawn, "zz_moteur_seul", `semaine ${week}`);
  }
});

test("validation : paire du constructeur équipée = 20 pièces et 20 XP, une seule fois", async () => {
  const user = await withAdmin(async (c) => {
    await setup(c);
    const id = await createPlayer(c);
    await makeDeck(c, id, "cfg_e1", "cfg_g1");
    return id;
  });

  const result = await validate(user);
  assert.equal(result.status, "validated");
  assert.equal(result.engine_code, "cfg_e1");
  assert.equal(result.gearbox_code, "cfg_g1");
  assert.equal(result.coins, 20);
  assert.equal(result.xp, 20);
  assert.equal(result.found, 1);
  assert.equal(result.total, 2);
  assert.deepEqual(await profile(user), { coins: 20, xp: 20 });

  const again = await validate(user);
  assert.equal(again.status, "duplicate");
  assert.equal(again.coins, 0);
  assert.equal(again.found, 1);
  assert.deepEqual(await profile(user), { coins: 20, xp: 20 }, "pas de double récompense");

  const after = await status(user);
  assert.equal(after.found, 1);
  assert.equal(after.equipped.engine.code, "cfg_e1");
  assert.equal(after.equipped.gearbox.ok, true);
  assert.deepEqual(after.history, [{ engine: "cfg_e1", gearbox: "cfg_g1" }]);
});

test("validation : une pièce d'un autre constructeur échoue sans récompense", async () => {
  const user = await withAdmin(async (c) => {
    await setup(c);
    const id = await createPlayer(c);
    await makeDeck(c, id, "cfg_e_autre", "cfg_g1");
    return id;
  });

  const result = await validate(user);
  assert.equal(result.status, "mismatch");
  assert.equal(result.engine_ok, false);
  assert.equal(result.gearbox_ok, true);
  assert.equal(result.coins, 0);
  assert.deepEqual(await profile(user), { coins: 0, xp: 0 });
});

test("validation : une boîte d'un autre constructeur échoue, même avec un moteur du constructeur", async () => {
  const user = await withAdmin(async (c) => {
    await setup(c);
    const id = await createPlayer(c);
    await makeDeck(c, id, "cfg_e1", "cfg_g_autre");
    return id;
  });

  const result = await validate(user);
  assert.equal(result.status, "mismatch");
  assert.equal(result.engine_ok, true);
  assert.equal(result.gearbox_ok, false);
  assert.deepEqual(await profile(user), { coins: 0, xp: 0 });
});

test("progression : une nouvelle paire compte, la progression atteint le total", async () => {
  const { user, deckId } = await withAdmin(async (c) => {
    await setup(c);
    const id = await createPlayer(c);
    const { deckId } = await makeDeck(c, id, "cfg_e1", "cfg_g1");
    return { user: id, deckId };
  });

  assert.equal((await validate(user)).status, "validated");

  await withAdmin(async (c) => {
    const engine = await giveCard(c, user, "cfg_e2");
    await c.query("update user_decks set engine_card_id = $1 where id = $2", [engine, deckId]);
  });

  const result = await validate(user);
  assert.equal(result.status, "validated");
  assert.equal(result.found, 2);
  assert.equal(result.total, 2);
  assert.deepEqual(await profile(user), { coins: 40, xp: 40 });
});

test("validation : sans configuration complète, refus clair", async () => {
  const user = await withAdmin(async (c) => {
    await setup(c);
    return createPlayer(c);
  });
  await expectError(user, (c) => c.query("select public.validate_config_pair($1::uuid)", [user]), "config_incomplete");
});

test("validation : moteur détruit refusé", async () => {
  const user = await withAdmin(async (c) => {
    await setup(c);
    const id = await createPlayer(c);
    const { engine } = await makeDeck(c, id, "cfg_e1", "cfg_g1");
    await c.query("update user_cards set is_destroyed = true where id = $1", [engine]);
    return id;
  });
  await expectError(user, (c) => c.query("select public.validate_config_pair($1::uuid)", [user]), "engine_destroyed");
});

test("sécurité : appelant usurpé refusé, statut comme validation", async () => {
  const [visitor, other] = await withAdmin(async (c) => [await createPlayer(c), await createPlayer(c)]);
  await expectError(visitor, (c) => c.query("select public.validate_config_pair($1::uuid)", [other]), "forbidden");
  await expectError(visitor, (c) => c.query("select public.config_challenge_status($1::uuid)", [other]), "forbidden");
});

test("rotation : les paires d'une semaine précédente ne comptent plus", async () => {
  const user = await withAdmin(async (c) => {
    const w = await setup(c);
    const id = await createPlayer(c);
    await makeDeck(c, id, "cfg_e1", "cfg_g1");
    await c.query(
      `insert into config_pair_claims (owner_id, week_start, brand, engine_template_id, gearbox_template_id, coins_awarded, xp_awarded)
       select $1, $2::date - 7, $3, e.id, g.id, 20, 20
         from card_templates e, card_templates g
        where e.code = 'cfg_e1' and g.code = 'cfg_g1'`,
      [id, w, BRAND],
    );
    return id;
  });

  assert.equal((await status(user)).found, 0);
  const result = await validate(user);
  assert.equal(result.status, "validated", "la paire de la semaine précédente ne bloque pas la nouvelle");
  assert.equal(result.found, 1);
});

test("visibilité : une pièce privée ne gonfle le total que pour son propriétaire", async () => {
  const owner = await withAdmin(async (c) => {
    await setup(c);
    const id = await createPlayer(c);
    await c.query("update profiles set username = 'zz_prive_pilote' where id = $1", [id]);
    await c.query(`
      insert into card_templates (code, category, name, rarity, architecture, power_hp, weight_kg, base_break_risk, wear_sensitivity, manufacturers, restricted_to_username)
      values ('cfg_e_prive', 'moteur', 'Moteur privé', 'commune', '4 cylindres', 100, 100, 0, 0, array['${BRAND}'], 'zz_prive_pilote')
      on conflict (code) do update set manufacturers = excluded.manufacturers, restricted_to_username = excluded.restricted_to_username`);
    return id;
  });
  const visitor = await withAdmin((c) => createPlayer(c));

  assert.equal((await status(visitor)).total, 2);
  assert.equal((await status(owner)).total, 3);

  await withAdmin((c) => c.query("delete from card_templates where code = 'cfg_e_prive'"));
});

test("multi-constructeurs : une boîte partagée valide la paire pour chacun de ses constructeurs", async () => {
  const user = await withAdmin(async (c) => {
    await setup(c);
    await c.query(`
      insert into card_templates (code, category, name, rarity, gearbox_type, shift_time_ms, weight_kg, base_break_risk, wear_sensitivity, manufacturers)
      values ('cfg_g_partage', 'boite', 'Boite partagée', 'commune', 'manuelle', 100, 30, 0, 0, array[$1, $2]::text[])
      on conflict (code) do update set manufacturers = excluded.manufacturers, is_active = true`,
      [BRAND, OTHER]);
    const id = await createPlayer(c);
    await makeDeck(c, id, "cfg_e1", "cfg_g_partage");
    return id;
  });

  const result = await validate(user);
  assert.equal(result.status, "validated");
  assert.equal(result.gearbox_ok, true);
  assert.equal(result.total, 4, "2 moteurs × 2 boîtes (dont une partagée) du constructeur");
});
