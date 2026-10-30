import assert from "node:assert/strict";
import { before, test } from "node:test";
import { asUser, createPlayer, expectError, withAdmin } from "./helpers.mjs";

const SECRET = "alexmartinelo";
const CODES = ["B51", "F116"];

async function createNamedPlayer(c, username) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const { rows } = await c.query(
    "insert into users (email, password_hash) values ($1, '00:00') returning id",
    [`${username}-${suffix}@test.local`],
  );
  await c.query("insert into profiles (id, username, coins) values ($1, $2, 0)", [rows[0].id, username]);
  return rows[0].id;
}

let owner;
let other;

before(async () => {
  await withAdmin(async (c) => {
    owner = await createNamedPlayer(c, SECRET);
    other = await createPlayer(c);
  });
});

test("pack F1 privé : actif, visible et offert à alexmartinelo uniquement", async () => {
  await withAdmin(async (c) => {
    const templates = await c.query(
      "select code, is_active, restricted_to_username from card_templates where code = any($1::text[]) order by code",
      [CODES],
    );
    assert.deepEqual(templates.rows, [
      { code: "B51", is_active: true, restricted_to_username: SECRET },
      { code: "F116", is_active: true, restricted_to_username: SECRET },
    ]);

    const owned = await c.query(
      `select t.code
         from user_cards uc join card_templates t on t.id = uc.template_id
        where uc.owner_id = $1 and t.code = any($2::text[])
        order by t.code`,
      [owner, CODES],
    );
    assert.deepEqual(owned.rows.map((r) => r.code), CODES);

    const otherOwned = await c.query(
      `select 1
         from user_cards uc join card_templates t on t.id = uc.template_id
        where uc.owner_id = $1 and t.code = any($2::text[])`,
      [other, CODES],
    );
    assert.equal(otherOwned.rowCount, 0);
  });

  await asUser(owner, async (c) => {
    const { rows } = await c.query(
      "select code from card_templates where code = any($1::text[]) order by code",
      [CODES],
    );
    assert.deepEqual(rows.map((r) => r.code), CODES);
  });

  await asUser(other, async (c) => {
    const { rows } = await c.query(
      "select code from card_templates where code = any($1::text[])",
      [CODES],
    );
    assert.equal(rows.length, 0);
  });
});

test("pack F1 privé : masqué dans la collection publique vue par les autres", async () => {
  const fromOther = (await asUser(other, (c) =>
    c.query("select public.collector_collection($1::uuid, $2::text) as r", [other, SECRET]))).rows[0].r;
  const otherCodes = fromOther.cards.map((card) => card.card_templates.code);
  for (const code of CODES) assert.equal(otherCodes.includes(code), false);

  const fromSelf = (await asUser(owner, (c) =>
    c.query("select public.collector_collection($1::uuid, $2::text) as r", [owner, SECRET]))).rows[0].r;
  const selfCodes = fromSelf.cards.map((card) => card.card_templates.code);
  for (const code of CODES) assert.equal(selfCodes.includes(code), true);
});

test("pack F1 privé : tirage exclu pour les autres joueurs", async () => {
  const result = await asUser(other, (c) =>
    c.query("select public.claim_weekly_pull($1::uuid, 'moteur') as r", [other]));
  const cardId = result.rows[0].r.card_ids[0];

  await withAdmin(async (c) => {
    const { rows } = await c.query(
      `select t.code
         from user_cards uc join card_templates t on t.id = uc.template_id
        where uc.id = $1`,
      [cardId],
    );
    assert.notEqual(rows[0].code, "F116");
    assert.notEqual(rows[0].code, "B51");
  });
});

test("pack F1 privé : impossible à revendre sur le marché", async () => {
  const card = await withAdmin(async (c) => {
    const { rows } = await c.query(
      `select uc.id
         from user_cards uc join card_templates t on t.id = uc.template_id
        where uc.owner_id = $1 and t.code = 'F116'`,
      [owner],
    );
    return rows[0].id;
  });

  await expectError(
    owner,
    (c) => c.query("select public.create_listing($1::uuid, $2::uuid, 10, false)", [owner, card]),
    "card_not_sellable",
  );
});
