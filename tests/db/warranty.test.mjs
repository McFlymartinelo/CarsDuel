import assert from "node:assert/strict";
import { before, test } from "node:test";
import {
  asUser,
  clearArena,
  createPlayer,
  duel,
  ensureTemplates,
  expectError,
  giveCard,
  makeDeck,
  neutralizeWeather,
  withAdmin,
} from "./helpers.mjs";

before(async () => {
  await withAdmin(async (c) => {
    await neutralizeWeather(c);
    await ensureTemplates(c);
    // Les gabarits de test sont garantis 2 duels.
    await c.query("update card_templates set garantie = 2 where code in ('t_eng', 't_eng_break', 't_gb')");
  });
});

test("catalogue : la garantie de l'export JSON est chargée", async () => {
  const rows = (await withAdmin((c) => c.query(
    "select code, garantie from card_templates where code in ('M1A', 'M2A', 'B2') order by code"))).rows;
  assert.deepEqual(rows.map((r) => [r.code, r.garantie]), [["B2", 8], ["M1A", 2], ["M2A", 8]]);
});

test("un duel incrémente la garantie, la réparation remet le risque initial sans la consommer", async () => {
  const fx = await withAdmin(async (c) => {
    await clearArena(c);
    const attacker = await createPlayer(c);
    const defender = await createPlayer(c);
    const deck = await makeDeck(c, attacker, "t_eng_break");
    await makeDeck(c, defender, "t_eng");
    return { attacker, deck };
  });

  for (let run = 1; run <= 2; run++) {
    const r = await duel(fx.attacker, fx.deck.deckId);
    assert.equal(r.broken_part, "moteur");
    await withAdmin(async (c) => {
      const row = (await c.query(
        "select is_destroyed, runs_count, runs_total, warranty_used, warranty_duels from user_cards where id = $1",
        [fx.deck.engine])).rows[0];
      assert.equal(row.is_destroyed, true);
      assert.equal(row.runs_total, run, "le run qui casse compte dans le compteur à vie");
      assert.equal(row.warranty_used, run);
      assert.equal(row.warranty_duels, 2);
    });
    const repaired = (await asUser(fx.attacker, (c) =>
      c.query("select public.repair_card($1::uuid, $2::uuid) as r", [fx.attacker, fx.deck.engine]))).rows[0].r;
    assert.equal(repaired.warranty_used, run);
    assert.equal(repaired.warranty_duels, 2);
    await withAdmin(async (c) => {
      const row = (await c.query(
        "select is_destroyed, runs_count, runs_total, warranty_used from user_cards where id = $1",
        [fx.deck.engine])).rows[0];
      assert.equal(row.is_destroyed, false);
      assert.equal(row.runs_count, 0, "le risque de casse repart de R0");
      assert.equal(row.runs_total, run, "le compteur à vie ne repart pas de zéro");
      assert.equal(row.warranty_used, run, "la garantie continue son cours");
    });
  }

  // 3e duel : la garantie est épuisée, la réparation est refusée.
  await duel(fx.attacker, fx.deck.deckId);
  await withAdmin(async (c) => {
    const row = (await c.query("select runs_total from user_cards where id = $1", [fx.deck.engine])).rows[0];
    assert.equal(row.runs_total, 3);
  });
  await expectError(
    fx.attacker,
    (c) => c.query("select public.repair_card($1::uuid, $2::uuid)", [fx.attacker, fx.deck.engine]),
    "warranty_expired",
  );
});

test("réparation refusée sur une pièce intacte ou un pneu", async () => {
  const fx = await withAdmin(async (c) => {
    const user = await createPlayer(c);
    const engine = await giveCard(c, user, "t_eng");
    const tire = await giveCard(c, user, "tire_slick");
    await c.query("update user_cards set is_destroyed = true where id = $1", [tire]);
    return { user, engine, tire };
  });
  await expectError(
    fx.user,
    (c) => c.query("select public.repair_card($1::uuid, $2::uuid)", [fx.user, fx.engine]),
    "card_not_broken",
  );
  await expectError(
    fx.user,
    (c) => c.query("select public.repair_card($1::uuid, $2::uuid)", [fx.user, fx.tire]),
    "warranty_not_applicable",
  );
});

test("prolongation : +2 duels, une seule fois, sur une carte intacte", async () => {
  const fx = await withAdmin(async (c) => {
    const user = await createPlayer(c, 5);
    const engine = await giveCard(c, user, "t_eng");
    const bonus = await giveCard(c, user, "bonus_revision_complete");
    await c.query("update user_cards set warranty_used = 1 where id = $1", [engine]);
    return { user, engine, bonus };
  });

  const r = (await asUser(fx.user, (c) =>
    c.query("select public.extend_warranty($1::uuid, $2::uuid) as r", [fx.user, fx.engine]))).rows[0].r;
  assert.equal(Number(r.warranty_duels), 4);

  await withAdmin(async (c) => {
    const card = (await c.query(
      "select warranty_duels, warranty_used, warranty_extended from user_cards where id = $1", [fx.engine])).rows[0];
    assert.equal(card.warranty_duels, 4);
    assert.equal(card.warranty_used, 1);
    assert.equal(card.warranty_extended, true);
    assert.equal(Number((await c.query("select coins from profiles where id = $1", [fx.user])).rows[0].coins), 0);
    assert.equal((await c.query("select is_destroyed from user_cards where id = $1", [fx.bonus])).rows[0].is_destroyed, true);
  });

  // Une seule prolongation par carte.
  await expectError(
    fx.user,
    (c) => c.query("select public.extend_warranty($1::uuid, $2::uuid)", [fx.user, fx.engine]),
    "warranty_already_extended",
  );
});

test("prolongation refusée sur une pièce cassée, expirée ou en vente", async () => {
  const broken = await withAdmin(async (c) => {
    const user = await createPlayer(c, 5);
    const engine = await giveCard(c, user, "t_eng");
    await c.query("update user_cards set is_destroyed = true, warranty_used = 1 where id = $1", [engine]);
    return { user, engine };
  });
  await expectError(
    broken.user,
    (c) => c.query("select public.extend_warranty($1::uuid, $2::uuid)", [broken.user, broken.engine]),
    "card_broken_no_extension",
  );

  const expired = await withAdmin(async (c) => {
    const user = await createPlayer(c, 5);
    const engine = await giveCard(c, user, "t_eng");
    await c.query("update user_cards set warranty_used = 2 where id = $1", [engine]);
    return { user, engine };
  });
  await expectError(
    expired.user,
    (c) => c.query("select public.extend_warranty($1::uuid, $2::uuid)", [expired.user, expired.engine]),
    "warranty_expired",
  );

  const listed = await withAdmin(async (c) => {
    const user = await createPlayer(c, 5);
    const engine = await giveCard(c, user, "t_eng");
    await c.query("update user_cards set is_listed = true, warranty_used = 1 where id = $1", [engine]);
    return { user, engine };
  });
  await expectError(
    listed.user,
    (c) => c.query("select public.extend_warranty($1::uuid, $2::uuid)", [listed.user, listed.engine]),
    "card_is_listed",
  );
});

test("prolongation refusée sans Révision complète ou sans pièces", async () => {
  const noBonus = await withAdmin(async (c) => {
    const user = await createPlayer(c, 5);
    const engine = await giveCard(c, user, "t_eng");
    await c.query("update user_cards set warranty_used = 1 where id = $1", [engine]);
    return { user, engine };
  });
  await expectError(
    noBonus.user,
    (c) => c.query("select public.extend_warranty($1::uuid, $2::uuid)", [noBonus.user, noBonus.engine]),
    "bonus_revision_required",
  );

  const noCoins = await withAdmin(async (c) => {
    const user = await createPlayer(c, 0);
    const engine = await giveCard(c, user, "t_eng");
    await giveCard(c, user, "bonus_revision_complete");
    await c.query("update user_cards set warranty_used = 1 where id = $1", [engine]);
    return { user, engine };
  });
  await expectError(
    noCoins.user,
    (c) => c.query("select public.extend_warranty($1::uuid, $2::uuid)", [noCoins.user, noCoins.engine]),
    "insufficient_funds",
  );
});

test("duel organisé : la garantie du demandeur avance aussi", async () => {
  const fx = await withAdmin(async (c) => {
    await clearArena(c);
    const challenger = await createPlayer(c);
    const target = await createPlayer(c);
    const deck = await makeDeck(c, challenger, "t_eng");
    await makeDeck(c, target, "t_eng");
    const username = (await c.query("select username from profiles where id = $1", [target])).rows[0].username;
    return { challenger, target, deck, username };
  });

  const challenge = (await asUser(fx.challenger, (c) =>
    c.query("select public.propose_duel($1::uuid, $2::text) as r", [fx.challenger, fx.username]))).rows[0].r;
  await asUser(fx.target, (c) =>
    c.query("select public.accept_duel($1::uuid, $2::uuid) as r", [fx.target, challenge.challenge_id]));

  await withAdmin(async (c) => {
    for (const id of [fx.deck.engine, fx.deck.gearbox]) {
      assert.equal((await c.query("select warranty_used from user_cards where id = $1", [id])).rows[0].warranty_used, 1);
    }
  });
});
