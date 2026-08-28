import assert from "node:assert/strict";
import test from "node:test";
import { calculateClassCodeExpiry, isClassCodeActive } from "../src/features/classes/class-code.ts";

test("Class Code expiry is exactly 24 hours after issuance", () => {
  const issuedAt = new Date("2026-08-28T03:00:00.000Z");
  assert.equal(
    calculateClassCodeExpiry(issuedAt, 24).toISOString(),
    "2026-08-29T03:00:00.000Z",
  );
});

test("Class Code expires exactly at its stored expiry timestamp", () => {
  const expiresAt = "2026-08-29T03:00:00.000Z";
  assert.equal(isClassCodeActive("ABC123", expiresAt, new Date("2026-08-29T02:59:59.999Z")), true);
  assert.equal(isClassCodeActive("ABC123", expiresAt, new Date(expiresAt)), false);
  assert.equal(isClassCodeActive(null, expiresAt), false);
});
