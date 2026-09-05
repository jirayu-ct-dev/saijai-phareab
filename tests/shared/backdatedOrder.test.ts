import { describe, expect, it } from "vitest";
import { backdatedOrderSchema } from "../../shared/utils/backdatedOrder";

const schema = backdatedOrderSchema(new Date("2026-09-05T05:00:00Z"));
const received = { receivedAt: "2026-09-01T09:00", status: "RECEIVED" };

describe("backdated laundry intake", () => {
  it("interprets local input in Bangkok and keeps receipt, completion and payment independent", () => {
    const result = schema.parse({ ...received, status: "COMPLETED", completedAt: "2026-09-03T17:00", payment: { paidAt: "2026-09-02T10:00", method: "CASH" } });
    expect(result.receivedAt.toISOString()).toBe("2026-09-01T02:00:00.000Z");
    expect(result.completedAt?.toISOString()).toBe("2026-09-03T10:00:00.000Z");
    expect(result.payment?.paidAt.toISOString()).toBe("2026-09-02T03:00:00.000Z");
  });

  it.each([
    { receivedAt: "2026-02-30T12:00" },
    { receivedAt: "2026-02-30T12:00:00Z" },
    { receivedAt: "2026-09-06T12:00" },
    { status: "CANCELLED" },
    { status: "COMPLETED" },
    { completedAt: "2026-09-03T17:00" },
    { status: "COMPLETED", completedAt: "2026-08-31T12:00" },
    { status: "COMPLETED", completedAt: "2026-09-06T12:00" },
    { payment: { paidAt: "2026-08-31T12:00", method: "CASH" } },
    { payment: { paidAt: "2026-09-06T12:00", method: "CASH" } },
    { payment: { paidAt: "2026-09-02T12:00", method: "OTHER" } },
  ])("rejects invalid historical facts: %j", (change) => {
    expect(schema.safeParse({ ...received, ...change }).success).toBe(false);
  });

  it("allows outstanding payment even for completed laundry", () => {
    expect(schema.parse({ ...received, status: "COMPLETED", completedAt: "2026-09-02T12:00" }).payment).toBeUndefined();
  });
});
