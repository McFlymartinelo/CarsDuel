import assert from "node:assert/strict";
import { test } from "node:test";
import { authLimits } from "../../src/lib/auth-limits.ts";
import {
  SESSION_DAYS,
  generateSessionToken,
  hashSessionToken,
  sessionExpiresAt,
} from "../../src/lib/session-tokens.ts";

test("session : jeton opaque de 32 octets, hash SHA-256 stable", () => {
  const token = generateSessionToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(Buffer.from(token, "base64url").length, 32);
  assert.match(hashSessionToken(token), /^[0-9a-f]{64}$/);
  assert.equal(hashSessionToken(token), hashSessionToken(token));
  assert.notEqual(hashSessionToken(token), hashSessionToken(generateSessionToken()));
});

test("session : expiration à 30 jours", () => {
  const now = new Date("2026-10-30T12:00:00.000Z");
  assert.equal(sessionExpiresAt(now).getTime() - now.getTime(), SESSION_DAYS * 864e5);
});

test("rate limiting : plafonds par défaut et surcharge par l'environnement", () => {
  const defaults = authLimits({});
  assert.equal(defaults.loginIp, 20);
  assert.equal(defaults.loginFailEmail, 5);
  assert.equal(defaults.signupIp, 5);
  assert.equal(defaults.otpSendIp, 8);
  assert.equal(defaults.otpVerifyIp, 20);
  assert.equal(defaults.otpResendMs, 30_000);

  const custom = authLimits({
    AUTH_RATE_LIMIT_MAX: "3",
    AUTH_LOGIN_FAIL_MAX: "2",
    AUTH_SIGNUP_RATE_LIMIT_MAX: "4",
    AUTH_OTP_RATE_LIMIT_MAX: "1",
    AUTH_OTP_VERIFY_RATE_LIMIT_MAX: "6",
    AUTH_OTP_RESEND_MS: "1500",
  });
  assert.equal(custom.loginIp, 3);
  assert.equal(custom.loginFailEmail, 2);
  assert.equal(custom.signupIp, 4);
  assert.equal(custom.otpSendIp, 1);
  assert.equal(custom.otpVerifyIp, 6);
  assert.equal(custom.otpResendMs, 1500);

  const invalid = authLimits({ AUTH_RATE_LIMIT_MAX: "0", AUTH_OTP_RATE_LIMIT_MAX: "abc" });
  assert.equal(invalid.loginIp, 20);
  assert.equal(invalid.otpSendIp, 8);
});
