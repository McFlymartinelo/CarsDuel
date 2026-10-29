import assert from "node:assert/strict";
import { test } from "node:test";
import { asUser, createPlayer, withAdmin } from "./helpers.mjs";

test("pseudos : unicité insensible à la casse à l'insertion et au renommage", async () => {
  const suffix = Date.now().toString(36).slice(-6);
  const base = `Case${suffix}`;
  const otherBase = `Autre${suffix}`;
  const fx = await withAdmin(async (c) => {
    const alex = await createPlayer(c);
    const other = await createPlayer(c);
    await c.query("update profiles set username = $1 where id = $2", [base, alex]);
    await c.query("update profiles set username = $1 where id = $2", [otherBase, other]);
    const newcomer = (await c.query(
      "insert into users (email, password_hash) values ($1, '00:00') returning id",
      [`dup_${Date.now()}_${Math.random().toString(36).slice(2)}@test.local`],
    )).rows[0].id;
    return { alex, other, newcomer, base, otherBase };
  });

  await assert.rejects(
    () => withAdmin((c) => c.query("insert into profiles (id, username) values ($1, $2)", [fx.newcomer, fx.base.toLowerCase()])),
    (err) => {
      assert.equal(err.code, "23505");
      assert.match(err.constraint, /username/);
      return true;
    },
  );

  await assert.rejects(
    () => withAdmin((c) => c.query("update profiles set username = $1 where id = $2", [fx.base.toUpperCase(), fx.other])),
    (err) => {
      assert.equal(err.code, "23505");
      assert.match(err.constraint, /username/);
      return true;
    },
  );

  const rows = (await withAdmin((c) => c.query(
    "select username from profiles where id = any($1::uuid[])",
    [[fx.alex, fx.other]],
  ))).rows;
  assert.deepEqual(rows.map((r) => r.username).sort(), [fx.base, fx.otherBase].sort());
});

test("propose_duel retrouve un pseudo sans tenir compte de la casse", async () => {
  const base = `Pilote${Date.now().toString(36).slice(-6)}`;
  const fx = await withAdmin(async (c) => {
    const alex = await createPlayer(c);
    const challenger = await createPlayer(c);
    await c.query("update profiles set username = $1 where id = $2", [base, alex]);
    return { alex, challenger, base };
  });

  const { rows } = await asUser(fx.challenger, (c) =>
    c.query("select public.propose_duel($1::uuid, $2::text) as r", [fx.challenger, fx.base.toLowerCase()]));
  assert.equal(rows[0].r.username, fx.base);
});
