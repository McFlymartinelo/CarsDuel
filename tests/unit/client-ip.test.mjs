import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTrustedProxyCount, resolveClientIp } from "../../src/lib/client-ip.ts";

test("x-forwarded-for : avec un proxy de confiance, on prend le dernier maillon", () => {
  assert.equal(resolveClientIp("1.2.3.4, 5.6.7.8", 1), "5.6.7.8");
});

test("x-forwarded-for : un maillon forgé en première position est ignoré", () => {
  assert.equal(resolveClientIp("6.6.6.6, 192.0.2.10", 1), "192.0.2.10");
  assert.equal(resolveClientIp("6.6.6.6, 192.0.2.10", "1"), "192.0.2.10");
});

test("x-forwarded-for : plusieurs proxies de confiance, lecture depuis la droite", () => {
  assert.equal(resolveClientIp("1.2.3.4, 5.6.7.8, 9.9.9.9", 2), "5.6.7.8");
  assert.equal(resolveClientIp("203.0.113.7", 2), "unknown");
});

test("x-forwarded-for : en-tête absent ou config absente → unknown", () => {
  assert.equal(resolveClientIp(undefined, 1), "unknown");
  assert.equal(resolveClientIp("", 1), "unknown");
  assert.equal(resolveClientIp("1.2.3.4", 0), "unknown");
  assert.equal(resolveClientIp("1.2.3.4", undefined), "unknown");
});

test("x-forwarded-for : valeur invalide → unknown", () => {
  assert.equal(resolveClientIp("1.2.3.4, pas une ip!", 1), "unknown");
  assert.equal(resolveClientIp("999.999.999.999", 1), "unknown");
  assert.equal(resolveClientIp("<script>alert(1)</script>", 1), "unknown");
});

test("TRUSTED_PROXY_COUNT : entiers positifs uniquement", () => {
  assert.equal(parseTrustedProxyCount("2"), 2);
  assert.equal(parseTrustedProxyCount(""), 0);
  assert.equal(parseTrustedProxyCount("-1"), 0);
  assert.equal(parseTrustedProxyCount("1.5"), 0);
  assert.equal(parseTrustedProxyCount("abc"), 0);
});
