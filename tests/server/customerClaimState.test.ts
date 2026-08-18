import { describe, expect, it } from "vitest";
import { isCustomerClaimUsable, type CustomerClaimState } from "../../server/utils/customerClaimState";

const now = new Date("2026-08-18T08:00:00.000Z");
const usableClaim = (): CustomerClaimState => ({
  usedAt: null,
  revokedAt: null,
  expiresAt: new Date("2026-08-19T08:00:00.000Z"),
  user: { deletedAt: null, customerAccountStatus: "OFFLINE" },
});

describe("isCustomerClaimUsable", () => {
  it("accepts an unconsumed token for an offline customer", () => {
    expect(isCustomerClaimUsable(usableClaim(), now)).toBe(true);
  });

  it.each([
    ["unknown", null],
    ["used", { ...usableClaim(), usedAt: now }],
    ["revoked", { ...usableClaim(), revokedAt: now }],
    ["expired", { ...usableClaim(), expiresAt: now }],
    ["deleted customer", { ...usableClaim(), user: { deletedAt: now, customerAccountStatus: "OFFLINE" as const } }],
    ["active customer", { ...usableClaim(), user: { deletedAt: null, customerAccountStatus: "ACTIVE" as const } }],
  ])("rejects a %s claim", (_label, claim) => {
    expect(isCustomerClaimUsable(claim, now)).toBe(false);
  });
});
