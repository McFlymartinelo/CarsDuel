import assert from "node:assert/strict";
import { test } from "node:test";
import {
  findActiveSession,
  generateSessionToken,
  hashSessionToken,
  invalidateOtherSessionsForHash,
  purgeExpiredSessions,
  rotateSessionForHash,
  sessionExpiresAt,
} from "../../src/lib/session-tokens.ts";
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

test("session : création, lecture d'une session valide et expiration", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  const validToken = generateSessionToken();
  const expiredToken = generateSessionToken();
  const now = new Date();

  await withAdmin(async (c) => {
    await rotateSessionForHash(c, user, hashSessionToken(validToken), sessionExpiresAt(now));
    await c.query("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [
      hashSessionToken(expiredToken),
      user,
      new Date(now.getTime() - 60_000),
    ]);
  });

  assert.equal(
    await withAdmin((c) => findActiveSession(c, hashSessionToken(validToken), now)),
    user,
  );
  assert.equal(
    await withAdmin((c) => findActiveSession(c, hashSessionToken(expiredToken), now)),
    null,
  );
  assert.equal(await withAdmin((c) => findActiveSession(c, hashSessionToken("inconnu"), now)), null);
});

test("session : rotation supprime l'ancienne ligne liée au cookie puis insère la nouvelle", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  const first = generateSessionToken();
  const second = generateSessionToken();

  await withAdmin((c) =>
    rotateSessionForHash(c, user, hashSessionToken(first), sessionExpiresAt()),
  );
  await withAdmin((c) =>
    rotateSessionForHash(
      c,
      user,
      hashSessionToken(second),
      sessionExpiresAt(),
      hashSessionToken(first),
    ),
  );

  const hashes = (
    await withAdmin((c) =>
      c.query("select token_hash from sessions where user_id = $1 order by token_hash", [user]),
    )
  ).rows.map((row) => row.token_hash);
  assert.deepEqual(hashes, [hashSessionToken(second)]);
});

test("session : purge des jetons expirés sans toucher aux sessions actives", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  const active = generateSessionToken();
  const expired = generateSessionToken();
  const now = new Date();

  await withAdmin(async (c) => {
    await rotateSessionForHash(c, user, hashSessionToken(active), sessionExpiresAt(now));
    await c.query("insert into sessions (token_hash, user_id, expires_at) values ($1, $2, $3)", [
      hashSessionToken(expired),
      user,
      new Date(now.getTime() - 1000),
    ]);
    await purgeExpiredSessions(c, now);
  });

  const remaining = (
    await withAdmin((c) => c.query("select token_hash from sessions where user_id = $1", [user]))
  ).rows.map((row) => row.token_hash);
  assert.deepEqual(remaining, [hashSessionToken(active)]);
});
