import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEV_OTP_PEPPER,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_MS,
  OTP_TTL_MS,
  checkOtp,
  generateOtpCode,
  hashOtpCode,
  maskEmail,
  otpEchoEnabled,
  otpMatches,
  resendCooldownRemaining,
  resolveOtpPepper,
} from "../../src/lib/otp.ts";

const PEPPER = "pepper-de-test-suffisamment-long-pour-hmac";

function record(code, overrides = {}) {
  return {
    code_hash: hashOtpCode(code, PEPPER),
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    attempts: 0,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

test("génération : toujours 6 chiffres, zéro-padding inclus", () => {
  for (let i = 0; i < 300; i += 1) {
    const code = generateOtpCode();
    assert.match(code, /^\d{6}$/);
    assert.ok(Number(code) >= 0 && Number(code) < 1_000_000);
  }
});

test("hash OTP : HMAC déterministe, sensible au pepper, comparaison correcte", () => {
  const code = "004217";
  const hash = hashOtpCode(code, PEPPER);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, hashOtpCode(code, PEPPER));
  assert.notEqual(hash, hashOtpCode(code, "un-autre-pepper"));
  assert.equal(otpMatches(code, hash, PEPPER), true);
  assert.equal(otpMatches("004218", hash, PEPPER), false);
  assert.equal(otpMatches(code, "pas-un-hash", PEPPER), false);
});

test("expiration : un code est refusé à partir de expires_at", () => {
  const now = Date.now();
  const code = "123456";
  const expires = new Date(now + 1000).toISOString();

  assert.equal(checkOtp(record(code, { expires_at: expires }), code, PEPPER, now).status, "ok");
  assert.equal(
    checkOtp(record(code, { expires_at: expires }), code, PEPPER, now + 1000).status,
    "expired",
  );
});

test("maximum 5 tentatives : la 5e mauvaise tentative supprime le code", () => {
  const code = "654321";
  let current = record(code);

  for (let attempt = 1; attempt <= OTP_MAX_ATTEMPTS; attempt += 1) {
    const result = checkOtp(current, "000000", PEPPER);
    assert.equal(result.status, "invalid");
    assert.equal(result.attempts, attempt);
    assert.equal(result.deleteCode, attempt === OTP_MAX_ATTEMPTS);
    current = { ...current, attempts: result.attempts };
  }

  assert.equal(checkOtp(current, code, PEPPER).status, "too_many_attempts");
});

test("un code absent est signalé comme manquant", () => {
  assert.deepEqual(checkOtp(null, "123456", PEPPER), {
    status: "missing",
    attempts: 0,
    deleteCode: false,
  });
});

test("cooldown de renvoi : 30 secondes pour le même (user, purpose)", () => {
  const createdAt = new Date("2026-10-30T12:00:00.000Z");
  const created = createdAt.getTime();
  assert.equal(resendCooldownRemaining(createdAt, created, OTP_RESEND_MS), OTP_RESEND_MS);
  assert.equal(resendCooldownRemaining(createdAt, created + 29_999, OTP_RESEND_MS), 1);
  assert.equal(resendCooldownRemaining(createdAt, created + 30_000, OTP_RESEND_MS), 0);
  assert.equal(resendCooldownRemaining(createdAt, created + 60_000, OTP_RESEND_MS), 0);
});

test("masquage de l'e-mail : a***@domaine.com", () => {
  assert.equal(maskEmail("alex@domaine.com"), "a***@domaine.com");
  assert.equal(maskEmail("A@B.FR"), "A***@B.FR");
  assert.equal(maskEmail("pas-un-email"), "***");
  assert.equal(maskEmail(""), "***");
});

test("devOtp : jamais en production, même avec AUTH_OTP_ECHO=1", () => {
  assert.equal(otpEchoEnabled({ NODE_ENV: "production", AUTH_OTP_ECHO: "1" }), false);
  assert.equal(otpEchoEnabled({ NODE_ENV: "production" }), false);
  assert.equal(otpEchoEnabled({ NODE_ENV: "test" }), true);
  assert.equal(otpEchoEnabled({ NODE_ENV: "development", AUTH_OTP_ECHO: "1" }), true);
  assert.equal(otpEchoEnabled({ NODE_ENV: "development" }), false);
});

test("pepper : obligatoire, long et non démo en production ; repli dev sinon", () => {
  assert.throws(() => resolveOtpPepper({ NODE_ENV: "production" }), /AUTH_OTP_PEPPER/);
  assert.throws(() => resolveOtpPepper({ NODE_ENV: "production", AUTH_OTP_PEPPER: "court" }), /AUTH_OTP_PEPPER/);
  assert.throws(
    () => resolveOtpPepper({ NODE_ENV: "production", AUTH_OTP_PEPPER: "change-me" }),
    /AUTH_OTP_PEPPER/,
  );
  assert.throws(
    () => resolveOtpPepper({ NODE_ENV: "production", AUTH_OTP_PEPPER: DEV_OTP_PEPPER }),
    /AUTH_OTP_PEPPER/,
  );
  const strong = "p".repeat(40);
  assert.equal(resolveOtpPepper({ NODE_ENV: "production", AUTH_OTP_PEPPER: strong }), strong);
  assert.equal(resolveOtpPepper({ NODE_ENV: "development" }), DEV_OTP_PEPPER);
});
