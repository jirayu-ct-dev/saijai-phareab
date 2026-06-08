import { describe, expect, it, vi } from "vitest";
import {
  applyPaymentStateTransition,
  buildPaymentStateTransition,
  canTransitionPaymentStatus,
} from "../../server/utils/paymentStateTransition";

const createExistingPayment = (overrides = {}) => ({
  id: "payment-1",
  status: "UNPAID" as const,
  method: null,
  paidAt: null,
  confirmedAt: null,
  confirmedById: null,
  receiptNo: null,
  packageSaleId: "package-sale-1",
  slipImageId: null,
  ...overrides,
});

const createTx = () => ({
  paymentRecord: {
    update: vi.fn().mockResolvedValue({}),
  },
  packageSale: {
    update: vi.fn().mockResolvedValue({}),
  },
  paymentAuditLog: {
    create: vi.fn().mockResolvedValue({}),
  },
});

describe("payment state transitions", () => {
  it("allows UNPAID -> PENDING_VERIFICATION -> PAID and generates receiptNo when paid", async () => {
    const firstTx = createTx();
    const secondTx = createTx();
    const now = new Date("2026-05-21T10:00:00.000Z");
    const createReceiptNo = vi.fn().mockResolvedValue("RC-2026-0001");

    await applyPaymentStateTransition({
      tx: firstTx,
      paymentId: "payment-1",
      existing: createExistingPayment(),
      nextStatus: "PENDING_VERIFICATION",
      nextMethod: "TRANSFER",
      nextSlipImageId: "image-1",
      actorId: "employee-1",
      now,
      createReceiptNo,
    });

    await applyPaymentStateTransition({
      tx: secondTx,
      paymentId: "payment-1",
      existing: createExistingPayment({
        status: "PENDING_VERIFICATION",
        method: "TRANSFER",
        slipImageId: "image-1",
      }),
      nextStatus: "PAID",
      nextMethod: "TRANSFER",
      nextSlipImageId: "image-1",
      actorId: "employee-1",
      now,
      createReceiptNo,
    });

    expect(canTransitionPaymentStatus("UNPAID", "PENDING_VERIFICATION")).toBe(true);
    expect(canTransitionPaymentStatus("PENDING_VERIFICATION", "PAID")).toBe(true);
    expect(createReceiptNo).toHaveBeenCalledTimes(1);
    expect(secondTx.paymentRecord.update).toHaveBeenCalledWith({
      where: { id: "payment-1" },
      data: expect.objectContaining({
        status: "PAID",
        receiptNo: "RC-2026-0001",
      }),
    });
  });

  it("rejects PAID -> CANCELLED", () => {
    expect(canTransitionPaymentStatus("PAID", "CANCELLED")).toBe(false);
  });

  it("creates an AuditLog every time the state changes", async () => {
    const tx = createTx();

    await applyPaymentStateTransition({
      tx,
      paymentId: "payment-1",
      existing: createExistingPayment(),
      nextStatus: "PENDING_VERIFICATION",
      nextMethod: "TRANSFER",
      nextSlipImageId: "image-1",
      actorId: "employee-1",
      now: new Date("2026-05-21T10:00:00.000Z"),
      createReceiptNo: vi.fn(),
    });

    expect(tx.paymentAuditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.paymentAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        paymentId: "payment-1",
        action: "UPDATED",
        actorId: "employee-1",
        beforeJson: expect.objectContaining({ status: "UNPAID" }),
        afterJson: expect.objectContaining({ status: "PENDING_VERIFICATION" }),
      }),
    });
  });

  it("sets paidAt, confirmedAt, confirmedById only when status becomes PAID", () => {
    const now = new Date("2026-05-21T10:00:00.000Z");
    const pending = buildPaymentStateTransition({
      existing: createExistingPayment(),
      nextStatus: "PENDING_VERIFICATION",
      nextMethod: "TRANSFER",
      nextSlipImageId: "image-1",
      actorId: "employee-1",
      now,
      receiptNo: null,
    });
    const paid = buildPaymentStateTransition({
      existing: createExistingPayment({ status: "PENDING_VERIFICATION", method: "TRANSFER" }),
      nextStatus: "PAID",
      nextMethod: "TRANSFER",
      nextSlipImageId: "image-1",
      actorId: "employee-1",
      now,
      receiptNo: "RC-2026-0001",
    });

    expect(pending.updateData).toMatchObject({
      paidAt: null,
      confirmedAt: null,
      confirmedById: null,
    });
    expect(paid.updateData).toMatchObject({
      paidAt: now,
      confirmedAt: now,
      confirmedById: "employee-1",
    });
  });
});
