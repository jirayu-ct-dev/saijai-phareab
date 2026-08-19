import { describe, expect, it } from "vitest";
import { isUnidentifiableLegacyCustomer } from "../../shared/utils/customer";

describe("isUnidentifiableLegacyCustomer", () => {
  it.each([
    [{ name: "ลูกค้าเดิมไม่ระบุ 019", phoneNumber: "0000000019" }],
    [{ name: "ชื่อชั่วคราว", phoneNumber: "000-000-0019" }],
  ])("detects migrated placeholder customers", (customer) => {
    expect(isUnidentifiableLegacyCustomer(customer)).toBe(true);
  });

  it("keeps an identifiable customer selectable", () => {
    expect(isUnidentifiableLegacyCustomer({ name: "สมชาย ใจดี", phoneNumber: "0812345678" })).toBe(false);
  });
});
