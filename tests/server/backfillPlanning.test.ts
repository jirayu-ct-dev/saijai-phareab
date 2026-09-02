/**
 * DB-05 backfill planning helper tests.
 *
 * The planning helpers decide what the backfill would change. They must never
 * overwrite a populated destination, never plan a write for a quarantined
 * source, and classify legacy JSON exactly like the application parser does
 * (the classifier delegates to parseAddonUsages).
 */
import { describe, expect, it } from "vitest";
import { classifyAddonOrder, planImageJoins, planSettingsCopy } from "../../scripts/db-rehearsal/backfill/plan.mts";

describe("classifyAddonOrder (application parser semantics)", () => {
  it("keeps valid entries with their JSON semantics", () => {
    const result = classifyAddonOrder([
      {
        entitlementId: "ent-1",
        productId: "prod-1",
        productName: "แพ็กเกจเสริม",
        credits: 2,
        deductOn: "CREATED",
        appliedAt: "2026-08-12T09:00:00.000Z",
        deductedAt: "2026-08-12T09:30:00.000Z",
      },
    ]);
    expect(result.invalidJson).toBe(false);
    expect(result.quarantine).toEqual([]);
    expect(result.valid).toEqual([
      expect.objectContaining({ index: 0, entitlementId: "ent-1", credits: 2 }),
    ]);
  });

  it("normalizes unknown deductOn like the application does", () => {
    const result = classifyAddonOrder([{ entitlementId: "ent-1", credits: 1, deductOn: "COMPLETE" }]);
    expect(result.valid[0]?.deductOn).toBe("CREATED");
  });

  it("quarantines entries the parser rejects (unknown-shape)", () => {
    const result = classifyAddonOrder([
      { entitlementId: "", credits: 2 },
      { entitlementId: "ent-1", credits: 0 },
      "not-an-object",
      null,
      { entitlementId: "ent-2", credits: 3 },
    ]);
    expect(result.valid).toEqual([expect.objectContaining({ index: 4, entitlementId: "ent-2" })]);
    expect(result.quarantine).toEqual([
      { index: 0, reason: "unknown-shape" },
      { index: 1, reason: "unknown-shape" },
      { index: 2, reason: "unknown-shape" },
      { index: 3, reason: "unknown-shape" },
    ]);
  });

  it("quarantines a refund without a deduction instead of guessing a timestamp", () => {
    const result = classifyAddonOrder([
      { entitlementId: "ent-1", credits: 2, refundedAt: "2026-08-12T10:00:00.000Z" },
    ]);
    expect(result.valid).toEqual([]);
    expect(result.quarantine).toEqual([{ index: 0, reason: "invalid-json" }]);
  });

  it("flags a non-array payload as invalid JSON", () => {
    const result = classifyAddonOrder({ entitlementId: "ent-1", credits: 1 });
    expect(result.invalidJson).toBe(true);
    expect(result.valid).toEqual([]);
  });
});

describe("planSettingsCopy (null-safe, field-by-field)", () => {
  const legacyShop = {
    name: "Fixture Laundry",
    phone: "029999999",
    address: "Fixture Address",
    logoUrl: null,
    lineQrImageUrl: "https://example.test/line-qr.png",
  };
  const legacyNotification = {
    notifyCustomerOnQuotation: true,
    notifyCustomerOnReceived: false,
    notifyCustomerOnProcessing: true,
    notifyCustomerOnDelivering: false,
    notifyCustomerOnCompleted: true,
    notifyCustomerOnCancelled: false,
    notifyCustomerReceipt: true,
    notifyStaffOnNewOrder: false,
    notifyCustomerOnPackageExpiring: true,
  };

  it("fills only null destination slots and derives lineQrEnabled from the legacy URL", () => {
    const plan = planSettingsCopy(legacyShop, legacyNotification, null);
    expect(plan.mismatches).toEqual([]);
    expect(plan.updateData).toMatchObject({
      name: "Fixture Laundry",
      phone: "029999999",
      address: "Fixture Address",
      lineQrImageUrl: "https://example.test/line-qr.png",
      lineQrEnabled: true,
      notifyCustomerOnReceived: false,
      notifyStaffOnNewOrder: false,
    });
    expect(plan.updateData).not.toHaveProperty("logoUrl");
  });

  it("derives lineQrEnabled = false when the legacy LINE QR URL is absent", () => {
    const plan = planSettingsCopy({ ...legacyShop, lineQrImageUrl: null }, null, null);
    expect(plan.updateData.lineQrEnabled).toBe(false);
  });

  it("reports a conflict without overwriting a populated, differing destination", () => {
    const plan = planSettingsCopy(legacyShop, legacyNotification, {
      name: "Already Migrated",
      phone: null,
      address: null,
      logoUrl: null,
      lineQrImageUrl: null,
      lineQrEnabled: null,
    });
    expect(plan.updateData).not.toHaveProperty("name");
    expect(plan.mismatches).toEqual([
      { checkId: "settings_target_conflict", subjectId: "singleton", detail: "field:name" },
    ]);
    expect(plan.updateData.phone).toBe("029999999");
  });

  it("treats an equal destination value as already migrated (no write)", () => {
    const plan = planSettingsCopy(legacyShop, legacyNotification, {
      name: "Fixture Laundry",
      phone: "029999999",
      address: "Fixture Address",
      logoUrl: null,
      lineQrImageUrl: "https://example.test/line-qr.png",
      lineQrEnabled: true,
      ...legacyNotification,
    });
    expect(plan.mismatches).toEqual([]);
    expect(plan.updateData).toEqual({});
  });

  it("flags a lineQrEnabled conflict with the legacy URL derivation", () => {
    const plan = planSettingsCopy(legacyShop, null, {
      name: null,
      phone: null,
      address: null,
      logoUrl: null,
      lineQrImageUrl: null,
      lineQrEnabled: false,
    });
    expect(plan.updateData).not.toHaveProperty("lineQrEnabled");
    expect(plan.mismatches).toEqual([
      { checkId: "settings_target_conflict", subjectId: "singleton", detail: "field:lineQrEnabled" },
    ]);
  });

  it("copies nothing when the legacy rows were created by this same run", () => {
    const plan = planSettingsCopy(null, null, null);
    expect(plan.updateData).toEqual({});
    expect(plan.mismatches).toEqual([]);
  });
});

describe("planImageJoins (pair-existence guarded creates)", () => {
  const items = [
    { id: "item-1", imageId: "img-1" },
    { id: "item-2", imageId: "img-2" },
    { id: "item-3", imageId: "img-ghost" },
  ];

  it("creates missing pairs with the fixed backfill shape", () => {
    const plan = planImageJoins([items[0], items[1]], new Set(["item-1::img-1"]), new Set(["img-1", "img-2"]));
    expect(plan.creates).toEqual([{ serviceOrderItemId: "item-2", imageId: "img-2" }]);
    expect(plan.quarantine).toEqual([]);
  });

  it("quarantines a direct imageId without an image row", () => {
    const plan = planImageJoins([items[2]], new Set(), new Set(["img-1"]));
    expect(plan.creates).toEqual([]);
    expect(plan.quarantine).toEqual([{ serviceOrderItemId: "item-3", imageId: "img-ghost", reason: "missing-image" }]);
  });

  it("skips a pair whose only join row is soft-deleted (no duplicate semantics)", () => {
    const plan = planImageJoins([items[0]], new Set(["item-1::img-1"]), new Set(["img-1"]));
    expect(plan.creates).toEqual([]);
  });
});
