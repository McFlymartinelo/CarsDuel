import assert from "node:assert/strict";
import { test } from "node:test";
import { asUser, createPlayer, withAdmin } from "./helpers.mjs";

const ENDPOINT = "https://push.test/carsduel";

test("push : abonnement, demande de duel et filtre des non-abonnés", async () => {
  const [challenger, subscribed, other] = await withAdmin(async (c) => [
    await createPlayer(c),
    await createPlayer(c),
    await createPlayer(c),
  ]);

  await asUser(subscribed, (c) =>
    c.query("select public.upsert_push_subscription($1::uuid, $2, $3, $4, $5)", [
      subscribed,
      ENDPOINT,
      "p256dh",
      "auth",
      "test-agent",
    ]),
  );

  await withAdmin(async (c) => {
    const { rows: saved } = await c.query(
      "select user_id from push_subscriptions where endpoint = $1",
      [ENDPOINT],
    );
    assert.equal(saved[0]?.user_id, subscribed);

    const { rows: challenge } = await c.query(
      "insert into duel_challenges (challenger_id, target_id) values ($1, $2) returning id",
      [challenger, subscribed],
    );
    const { rows: event } = await c.query(
      "select kind, user_id, title from push_outbox where event_key = $1",
      [`duel_request:${challenge[0].id}`],
    );
    assert.equal(event.length, 1);
    assert.equal(event[0].kind, "duel_request");
    assert.equal(event[0].user_id, subscribed);

    const { rows: noChallenge } = await c.query(
      "insert into duel_challenges (challenger_id, target_id) values ($1, $2) returning id",
      [challenger, other],
    );
    const { rows: noEvent } = await c.query(
      "select 1 from push_outbox where event_key = $1",
      [`duel_request:${noChallenge[0].id}`],
    );
    assert.equal(noEvent.length, 0);
  });

  await asUser(subscribed, (c) =>
    c.query("select public.delete_push_subscription($1::uuid, $2)", [subscribed, ENDPOINT]),
  );

  await withAdmin(async (c) => {
    const { rows } = await c.query("select 1 from push_subscriptions where user_id = $1", [subscribed]);
    assert.equal(rows.length, 0);
  });
});

test("push : prime de classement en outbox", async () => {
  const user = await withAdmin(async (c) => {
    const id = await createPlayer(c);
    await c.query(
      `insert into push_subscriptions (user_id, endpoint, p256dh, auth)
       values ($1, 'https://push.test/payout', 'p256dh', 'auth')`,
      [id],
    );
    return id;
  });

  await withAdmin(async (c) => {
    const { rows } = await c.query(
      `insert into leaderboard_payouts (period, period_start, user_id, rank, xp, coins)
       values ('weekly', now() + interval '50 years', $1, 3, 120, 30) returning id`,
      [user],
    );
    const { rows: event } = await c.query(
      "select kind, body, amount from push_outbox where event_key = $1",
      [`payout:${rows[0].id}`],
    );
    assert.equal(event.length, 1);
    assert.equal(event[0].kind, "payout");
    assert.equal(event[0].amount, 30);
    assert.match(event[0].body, /Classement de la semaine/);
  });
});
