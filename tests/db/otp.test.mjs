import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { OTP_MAX_ATTEMPTS, checkOtp, hashOtpCode } from "../../src/lib/otp.ts";
import { deleteOtp, getOtp, issueOtp, setOtpAttempts } from "../../src/lib/otp-store.ts";
import {
  clearAuthAttempts,
  countAuthAttempts,
  isAuthRateLimited,
  recordAuthAttempt,
} from "../../src/lib/auth-attempts.ts";
import { asUser, createPlayer, withAdmin } from "./helpers.mjs";

const MIGRATION = path.resolve(import.meta.dirname, "../../db/migrations/20261030000019_otp_auth.sql");
const MIGRATION_SQL = fs.readFileSync(MIGRATION, "utf8");
const PEPPER = "pepper-de-test-suffisamment-long-pour-hmac";

function newEmail() {
  return `otp_${Date.now()}_${Math.random().toString(36).slice(2)}@test.local`;
}

async function issue(userId, purpose, code, overrides = {}) {
  const now = new Date();
  await withAdmin((c) =>
    issueOtp(c, {
      userId,
      email: overrides.email ?? `${userId}@test.local`,
      purpose,
      codeHash: hashOtpCode(code, PEPPER),
      expiresAt: new Date(now.getTime() + 10 * 60_000),
      createdAt: overrides.createdAt ?? now,
    }),
  );
}

test("migration email_verified : nouveaux comptes non vérifiés, anciens marqués vérifiés", async () => {
  // Nouveau compte : la valeur par défaut est false.
  const user = await withAdmin((c) => createPlayer(c));
  const created = await withAdmin((c) =>
    c.query("select email_verified from users where id = $1", [user]),
  );
  assert.equal(created.rows[0].email_verified, false);

  // Rejouer la migration complète est idempotent.
  await withAdmin((c) => c.query(MIGRATION_SQL));

  // Simulation de l'état d'avant migration (colonne nullable + comptes null),
  // dans une transaction annulée ensuite : les comptes existants deviennent vérifiés.
  await withAdmin(async (c) => {
    await c.query("begin");
    try {
      await c.query("alter table public.users alter column email_verified drop not null");
      const { rows } = await c.query(
        "insert into users (email, password_hash) values ($1, '00:00') returning id",
        [newEmail()],
      );
      await c.query("update users set email_verified = null where id = $1", [rows[0].id]);
      await c.query(MIGRATION_SQL);
      const after = await c.query("select email_verified from users where id = $1", [rows[0].id]);
      assert.equal(after.rows[0].email_verified, true);
    } finally {
      await c.query("rollback");
    }
  });
});

test("email_verified : l'attribution du kit de départ n'a lieu qu'une fois", async () => {
  const user = await withAdmin((c) => createPlayer(c));

  async function verifyAndGrant() {
    return withAdmin(async (c) => {
      const { rowCount } = await c.query(
        "update users set email_verified = true where id = $1 and email_verified = false returning id",
        [user],
      );
      if ((rowCount ?? 0) > 0) {
        await c.query("select private.grant_starter_kit($1)", [user]);
      }
      return rowCount;
    });
  }

  assert.equal(await verifyAndGrant(), 1);
  const firstCount = (
    await withAdmin((c) => c.query("select count(*)::int as n from user_cards where owner_id = $1", [user]))
  ).rows[0].n;
  assert.ok(firstCount > 0, "le kit de départ a bien attribué des cartes");

  assert.equal(await verifyAndGrant(), 0);
  const secondCount = (
    await withAdmin((c) => c.query("select count(*)::int as n from user_cards where owner_id = $1", [user]))
  ).rows[0].n;
  assert.equal(secondCount, firstCount);
});

test("OTP : upsert d'un seul code actif par (user_id, purpose)", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  const email = newEmail();

  await issue(user, "register", "111111", { email });
  await issue(user, "register", "222222", { email, createdAt: new Date(Date.now() + 1000) });
  await issue(user, "login", "333333", { email });

  const rows = await withAdmin((c) =>
    c.query("select purpose, code_hash, attempts from email_otps where user_id = $1 order by purpose", [user]),
  );
  assert.equal(rows.rows.length, 2, "un code register + un code login, jamais deux du même purpose");

  const register = rows.rows.find((row) => row.purpose === "register");
  assert.equal(register.code_hash, hashOtpCode("222222", PEPPER), "le nouveau code remplace l'ancien");
  assert.equal(register.attempts, 0);
});

test("OTP : suppression après succès", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  const code = "424242";
  await issue(user, "register", code);

  const record = await withAdmin((c) => getOtp(c, user, "register"));
  const result = checkOtp(record, code, PEPPER);
  assert.equal(result.status, "ok");
  assert.equal(result.deleteCode, true);

  await withAdmin((c) => deleteOtp(c, user, "register"));
  assert.equal(await withAdmin((c) => getOtp(c, user, "register")), null);
});

test("OTP : 5 mauvaises tentatives suppriment le code", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  const code = "135790";
  const wrong = "024681";
  await issue(user, "login", code);

  for (let attempt = 1; attempt <= OTP_MAX_ATTEMPTS; attempt += 1) {
    const record = await withAdmin((c) => getOtp(c, user, "login"));
    assert.ok(record, `le code existe avant la tentative ${attempt}`);
    const result = checkOtp(record, wrong, PEPPER);
    assert.equal(result.status, "invalid");
    if (result.deleteCode) {
      await withAdmin((c) => deleteOtp(c, user, "login"));
    } else {
      await withAdmin((c) => setOtpAttempts(c, user, "login", result.attempts));
    }
  }

  assert.equal(await withAdmin((c) => getOtp(c, user, "login")), null);
});

test("OTP : rate limiting d'envoi et de vérification, kinds séparés", async () => {
  const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
  await withAdmin(async (c) => {
    for (let i = 0; i < 8; i += 1) await recordAuthAttempt(c, "otp_send_ip", ip);
    await recordAuthAttempt(c, "otp_verify_ip", ip);
  });

  const counts = await withAdmin(async (c) => ({
    send: await countAuthAttempts(c, "otp_send_ip", ip, "15 minutes"),
    verify: await countAuthAttempts(c, "otp_verify_ip", ip, "15 minutes"),
    sendLimited: await isAuthRateLimited(c, "otp_send_ip", ip, "15 minutes", 8),
    sendBelow: await isAuthRateLimited(c, "otp_send_ip", ip, "15 minutes", 9),
    verifyLimited: await isAuthRateLimited(c, "otp_verify_ip", ip, "15 minutes", 20),
  }));
  assert.equal(counts.send, 8);
  assert.equal(counts.verify, 1);
  assert.equal(counts.sendLimited, true);
  assert.equal(counts.sendBelow, false);
  assert.equal(counts.verifyLimited, false);

  await withAdmin((c) => clearAuthAttempts(c, "otp_send_ip", ip));
  assert.equal(
    await withAdmin((c) => countAuthAttempts(c, "otp_send_ip", ip, "15 minutes")),
    0,
  );
});

test("email_otps n'est pas accessible à app_user (RLS + privilèges)", async () => {
  const user = await withAdmin((c) => createPlayer(c));
  await assert.rejects(
    () => asUser(user, (c) => c.query("select * from public.email_otps")),
    /permission denied/i,
  );
});
