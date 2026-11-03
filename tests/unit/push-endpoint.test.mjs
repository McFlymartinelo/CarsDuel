import assert from "node:assert/strict";
import { test } from "node:test";
import { isAllowedPushEndpoint } from "../../src/lib/push-endpoint.ts";

test("endpoint push : accepte un service public HTTPS", () => {
  assert.equal(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc"), true);
  assert.equal(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc"), true);
});

test("endpoint push : refuse HTTP, localhost et adresses privées", () => {
  assert.equal(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/abc"), false);
  assert.equal(isAllowedPushEndpoint("https://localhost/push"), false);
  assert.equal(isAllowedPushEndpoint("https://app.local/push"), false);
  assert.equal(isAllowedPushEndpoint("https://127.0.0.1/push"), false);
  assert.equal(isAllowedPushEndpoint("https://192.168.1.10/push"), false);
  assert.equal(isAllowedPushEndpoint("https://[fd00::1]/push"), false);
  assert.equal(isAllowedPushEndpoint("pas une url"), false);
});
