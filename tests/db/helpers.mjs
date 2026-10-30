// Helpers des tests SQL. La base doit s'appeler carsduel_test (créée par scripts/test.mjs).
import assert from "node:assert/strict";
import pg from "pg";

const url = new URL(process.env.DATABASE_URL ?? "postgres://localhost/missing");
if (!url.pathname.endsWith("/carsduel_test")) {
  throw new Error("Refus : les tests SQL ne s'exécutent que sur la base carsduel_test (npm test).");
}

let seq = 0;

export function connect() {
  return new pg.Client({ connectionString: process.env.DATABASE_URL });
}

export async function withAdmin(fn) {
  const c = connect();
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

export async function createPlayer(c, coins = 0) {
  seq += 1;
  const username = `t${seq.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`.slice(0, 20);
  const { rows } = await c.query(
    "insert into users (email, password_hash) values ($1, '00:00') returning id",
    [`${username}@test.local`],
  );
  await c.query("insert into profiles (id, username, coins) values ($1, $2, $3)", [rows[0].id, username, coins]);
  return rows[0].id;
}

export async function ensureTemplates(c) {
  await c.query(`
    insert into card_templates (code, category, name, rarity, architecture, power_hp, weight_kg, base_break_risk, wear_sensitivity)
    values
      ('t_eng', 'moteur', 'Moteur test', 'commune', '4 cylindres', 100, 100, 0, 0),
      ('t_eng_far', 'moteur', 'Moteur eloigne', 'commune', '4 cylindres', 400, 100, 0, 0),
      ('t_eng_break', 'moteur', 'Moteur casse', 'commune', '4 cylindres', 100, 100, 100, 0)
    on conflict (code) do update set
      power_hp = excluded.power_hp,
      weight_kg = excluded.weight_kg,
      base_break_risk = excluded.base_break_risk,
      wear_sensitivity = 0`);
  await c.query(`
    insert into card_templates (code, category, name, rarity, gearbox_type, shift_time_ms, weight_kg, base_break_risk, wear_sensitivity)
    values ('t_gb', 'boite', 'Boite test', 'commune', 'manuelle', 100, 30, 0, 0)
    on conflict (code) do update set
      shift_time_ms = 100, weight_kg = 30, base_break_risk = 0, wear_sensitivity = 0`);
}

/** Casse déterministe : R0 pilote seul (météo à 0), usure négligeable pour enchaîner 20 duels. */
export async function neutralizeWeather(c) {
  await c.query("update weather_conditions set engine_break_mod = 0, gearbox_break_mod = 0");
  await c.query("update tire_weather_modifiers set wear_pct = 0.1");
}

export async function clearArena(c) {
  await c.query("delete from duels_history");
  await c.query("delete from user_decks");
}

export async function giveCard(c, owner, code) {
  const { rows } = await c.query(
    `insert into user_cards (owner_id, template_id, tire_wear, source, warranty_duels)
     select $1, id, case when category = 'pneus' then 100 end, 'test', coalesce(garantie, 0)
       from card_templates where code = $2
     returning id`,
    [owner, code],
  );
  if (!rows[0]) throw new Error(`template introuvable : ${code}`);
  return rows[0].id;
}

export async function makeDeck(c, owner, engineCode, gearboxCode = "t_gb", tireCode = "tire_route") {
  const engine = await giveCard(c, owner, engineCode);
  const gearbox = await giveCard(c, owner, gearboxCode);
  const tire = await giveCard(c, owner, tireCode);
  const { rows } = await c.query(
    `insert into user_decks (owner_id, name, engine_card_id, gearbox_card_id, tire_card_id)
     values ($1, 'Deck', $2, $3, $4) returning id`,
    [owner, engine, gearbox, tire],
  );
  return { deckId: rows[0].id, engine, gearbox, tire };
}

async function session(uid, fn) {
  const c = connect();
  await c.connect();
  try {
    await c.query("begin");
    await c.query("set local role app_user");
    await c.query("select set_config('app.user_id', $1, true)", [uid]);
    try {
      const result = await fn(c);
      await c.query("commit");
      return result;
    } catch (e) {
      await c.query("rollback");
      throw e;
    }
  } finally {
    await c.end();
  }
}

export const asUser = (uid, fn) => session(uid, fn);

export async function expectError(uid, fn, code) {
  await assert.rejects(() => session(uid, fn), (err) => {
    assert.match(err.message, new RegExp(code));
    return true;
  });
}

export async function duel(uid, deckId, bonusId = null) {
  const { rows } = await asUser(uid, (c) =>
    c.query("select public.execute_duel($1::uuid, $2::uuid, $3::uuid) as r", [uid, deckId, bonusId]));
  return rows[0].r;
}
