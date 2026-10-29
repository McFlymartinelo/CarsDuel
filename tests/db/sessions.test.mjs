import assert from "node:assert/strict";
import { test } from "node:test";
import { invalidateOtherSessionsForHash } from "../../src/lib/session-tokens.ts";
import { createPlayer, withAdmin } from "./helpers.mjs";

// invalidateOtherSessions (src/lib/session.ts) lit next/headers, indisponible dans
// le harnais node:test. On teste donc la fonction de suppression injectable qu'elle
// appelle avec le hash du cookie courant.
test("suppression des autres sessions : la session courante reste, les autres comptes sont intacts", async () => {
  const fx = await withAdmin(async (c) => {
    const user = await createPlayer(c);
    const otherUser = await createPlayer(c);
    await c.query(
      `insert into sessions (token_hash, user_id, expires_at)
       values ('current-token', $1, now() + interval '1 day'),
              ('other-token-1', $1, now() + interval '1 day'),
              ('other-token-2', $1, now() + interval '1 day'),
              ('foreign-token', $2, now() + interval '1 day')`,
      [user, otherUser],
    );
    return { user, otherUser };
  });

  await withAdmin((c) => invalidateOtherSessionsForHash(c, fx.user, "current-token"));

  const mine = (await withAdmin((c) => c.query(
    "select token_hash from sessions where user_id = $1 order by token_hash",
    [fx.user],
  ))).rows.map((r) => r.token_hash);
  assert.deepEqual(mine, ["current-token"]);

  const foreign = (await withAdmin((c) => c.query(
    "select token_hash from sessions where user_id = $1",
    [fx.otherUser],
  ))).rows.map((r) => r.token_hash);
  assert.deepEqual(foreign, ["foreign-token"]);
});
