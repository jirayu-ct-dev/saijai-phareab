import { describe, expect, it } from "vitest";
import {
  createPackageProductSchema,
  updatePackageProductSchema,
} from "../../shared/utils/packageProductInput";

describe("package product request validation", () => {
  it("accepts a valid package and defaults its type", () => {
    const value = createPackageProductSchema.parse({
      name: " แพ็กเกจรีดผ้า ",
      price: 500,
      credits: 30,
      validityDays: 30,
      serviceId: "s3",
    });

    expect(value).toMatchObject({
      name: "แพ็กเกจรีดผ้า",
      packageType: "MAIN",
      price: 500,
      validityDays: 30,
    });
  });

  it.each([
    { field: "price", body: { name: "แพ็กเกจ", price: Number.NaN } },
    { field: "validityDays", body: { name: "แพ็กเกจ", price: 100, validityDays: -1 } },
    { field: "validityDays", body: { name: "แพ็กเกจ", price: 100, validityDays: 1.5 } },
    { field: "packageType", body: { name: "แพ็กเกจ", price: 100, packageType: "OTHER" } },
  ])("rejects invalid $field", ({ body }) => {
    expect(createPackageProductSchema.safeParse(body).success).toBe(false);
  });

  it("allows an explicit unlimited validity period", () => {
    expect(updatePackageProductSchema.parse({ validityDays: null })).toEqual({ validityDays: null });
  });

  it("rejects unknown fields instead of silently accepting them", () => {
    expect(updatePackageProductSchema.safeParse({ unexpected: true }).success).toBe(false);
  });
});
