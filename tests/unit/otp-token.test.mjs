import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import {
  DEV_OTP_JWT_SECRET,
  OTP_JWT_AUDIENCE,
  OTP_JWT_ISSUER,
  OTP_TOKEN_ERROR,
  readOtpToken,
  resolveOtpJwtSecret,
  signOtpToken,
} from "../../src/lib/otp-token.ts";

const SECRET = "secret-jwt-otp-de-test-32-caracteres-minimum";
process.env.NODE_ENV = "test";
process.env.AUTH_OTP_JWT_SECRET = SECRET;

function forge(payload, options = {}) {
  return jwt.sign(payload, SECRET, {
    algorithm: "HS256",
    issuer: OTP_JWT_ISSUER,
    audience: OTP_JWT_AUDIENCE,
    expiresIn: "15m",
    ...options,
  });
}

test("JWT OTP : signature et relecture du payload minimal", () => {
  const token = signOtpToken("11111111-1111-4111-8111-111111111111", "register");
  const result = readOtpToken(token);
  assert.equal(result.ok, true);
  assert.equal(result.userId, "11111111-1111-4111-8111-111111111111");
  assert.equal(result.otpPurpose, "register");

  const payload = jwt.decode(token);
  assert.deepEqual(
    Object.keys(payload).sort(),
    ["aud", "exp", "iat", "iss", "otpPurpose", "purpose", "sub"],
  );
  assert.equal(payload.purpose, "otp");
  assert.equal(payload.iss, "carsduel");
  assert.equal(payload.aud, "carsduel-otp");
});

test("JWT OTP : refus d'un token expiré", () => {
  const token = forge({ sub: "user", purpose: "otp", otpPurpose: "login" }, { expiresIn: "-1s" });
  assert.deepEqual(readOtpToken(token), { ok: false, message: OTP_TOKEN_ERROR });
});

test("JWT OTP : refus d'un mauvais issuer ou audience", () => {
  const badIssuer = forge(
    { sub: "user", purpose: "otp", otpPurpose: "login" },
    { issuer: "matchday" },
  );
  const badAudience = forge(
    { sub: "user", purpose: "otp", otpPurpose: "login" },
    { audience: "matchday-otp" },
  );
  assert.deepEqual(readOtpToken(badIssuer), { ok: false, message: OTP_TOKEN_ERROR });
  assert.deepEqual(readOtpToken(badAudience), { ok: false, message: OTP_TOKEN_ERROR });
});

test("JWT OTP : refus d'un mauvais purpose ou otpPurpose", () => {
  const wrongPurpose = forge({ sub: "user", purpose: "session", otpPurpose: "login" });
  const wrongOtpPurpose = forge({ sub: "user", purpose: "otp", otpPurpose: "reset" });
  assert.deepEqual(readOtpToken(wrongPurpose), { ok: false, message: OTP_TOKEN_ERROR });
  assert.deepEqual(readOtpToken(wrongOtpPurpose), { ok: false, message: OTP_TOKEN_ERROR });
});

test("JWT OTP : refus d'un token altéré, sans sub ou signé avec un autre secret", () => {
  const valid = signOtpToken("user", "login");
  assert.deepEqual(readOtpToken(`${valid}x`), { ok: false, message: OTP_TOKEN_ERROR });
  assert.deepEqual(readOtpToken(null), { ok: false, message: OTP_TOKEN_ERROR });
  assert.deepEqual(readOtpToken(""), { ok: false, message: OTP_TOKEN_ERROR });

  const noSub = forge({ purpose: "otp", otpPurpose: "login" });
  assert.deepEqual(readOtpToken(noSub), { ok: false, message: OTP_TOKEN_ERROR });

  const foreign = jwt.sign({ sub: "user", purpose: "otp", otpPurpose: "login" }, "autre-secret", {
    algorithm: "HS256",
    issuer: OTP_JWT_ISSUER,
    audience: OTP_JWT_AUDIENCE,
  });
  assert.deepEqual(readOtpToken(foreign), { ok: false, message: OTP_TOKEN_ERROR });
});

test("JWT OTP : secret obligatoire, long et non démo en production", () => {
  assert.throws(() => resolveOtpJwtSecret({ NODE_ENV: "production" }), /AUTH_OTP_JWT_SECRET/);
  assert.throws(
    () => resolveOtpJwtSecret({ NODE_ENV: "production", AUTH_OTP_JWT_SECRET: "trop-court" }),
    /AUTH_OTP_JWT_SECRET/,
  );
  assert.throws(
    () => resolveOtpJwtSecret({ NODE_ENV: "production", AUTH_OTP_JWT_SECRET: "change-me" }),
    /AUTH_OTP_JWT_SECRET/,
  );
  assert.throws(
    () => resolveOtpJwtSecret({ NODE_ENV: "production", AUTH_OTP_JWT_SECRET: DEV_OTP_JWT_SECRET }),
    /AUTH_OTP_JWT_SECRET/,
  );
  const strong = "s".repeat(40);
  assert.equal(resolveOtpJwtSecret({ NODE_ENV: "production", AUTH_OTP_JWT_SECRET: strong }), strong);
  assert.match(resolveOtpJwtSecret({ NODE_ENV: "development" }), /dev/);
});
