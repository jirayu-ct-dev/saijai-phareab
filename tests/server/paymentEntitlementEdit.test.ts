import { describe, expect, it } from "vitest";
import { buildPaymentEntitlementEdit } from "../../server/utils/paymentEntitlementEdit";

describe("admin payment entitlement edits", () => {
  it("preserves lifecycle and balances when the package product did not change", () => {
    expect(buildPaymentEntitlementEdit({
      paymentStatus: "PAID",
      productChanged: false,
      validityDays: 30,
      credits: 10,
    })).toEqual({});
  });

  it("keeps a corrected unpaid package pending and unusable", () => {
    expect(buildPaymentEntitlementEdit({
      paymentStatus: "PENDING_VERIFICATION",
      productChanged: true,
      validityDays: 30,
      credits: 10,
    })).toEqual({
      status: "PENDING",
      startAt: null,
      endAt: null,
      activatedAt: null,
      suspendedAt: null,
      creditInitial: 10,
      creditRemaining: 10,
    });
  });

  it("activates an unused paid entitlement when its product is corrected", () => {
    const now = new Date("2026-09-03T00:00:00.000Z");
    expect(buildPaymentEntitlementEdit({
      paymentStatus: "PAID",
      productChanged: true,
      validityDays: 30,
      credits: 10,
      now,
    })).toEqual(expect.objectContaining({
      status: "ACTIVE",
      startAt: now,
      endAt: new Date("2026-10-03T00:00:00.000Z"),
      creditInitial: 10,
      creditRemaining: 10,
    }));
  });
});
