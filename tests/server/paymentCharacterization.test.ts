/**
 * DB-01 characterization tests — payment state and source mapping.
 *
 * These tests protect CURRENT behavior before the payment consolidation
 * (C5: a payment has exactly one source; PackageSale.status is derived from
 * the payment status mapping). They must pass against today's code, including
 * quirks such as self-transitions being allowed on terminal statuses.
 *
 * Pure utilities only — no database, no HTTP.
 */
import { describe, expect, it, vi } from "vitest";
import {
  applyPaymentStateTransition,
  buildPaymentStateTransition,
  canTransitionPaymentStatus,
  getAllowedPaymentStatusTransitions,
  packageSaleStatusByPaymentStatus,
} from "../../server/utils/paymentStateTransition";
import { classifyIncomeSource } from "../../server/utils/financeIncome";
import { extractPaymentVat } from "../../server/utils/paymentMeta";

const now = new Date("2026-09-01T10:00:00.000Z");

const existingPayment = (overrides: Record<string, unknown> = {}) => ({
  id: "payment-1",
  status: "UNPAID" as const,
  method: null,
  paidAt: null,
  confirmedAt: null,
  confirmedById: null,
  receiptNo: null,
  packageSaleId: "package-sale-1" as string | null,
  slipImageId: null,
  ...overrides,
});

const createTx = () => ({
  paymentRecord: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  paymentAuditLog: { create: vi.fn().mockResolvedValue({}) },
});

describe("payment status -> package sale presentation mapping", () => {
  // Invariant: PackageSale.status is a presentation value derived from the
  // payment status. Payment statuses UNPAID and PENDING_VERIFICATION both
  // present as PENDING — removing either mapping breaks member-facing state.
  it("maps every payment status to exactly one presentation status", () => {
    expect(packageSaleStatusByPaymentStatus).toEqual({
      UNPAID: "PENDING",
      PENDING_VERIFICATION: "PENDING",
      PAID: "PAID",
      CANCELLED: "CANCELLED",
    });
  });

  it("updates only the payment; package sale status is derived at read time", async () => {
    const tx = createTx();
    await applyPaymentStateTransition({
      tx,
      paymentId: "payment-1",
      existing: existingPayment({ status: "PENDING_VERIFICATION", method: "TRANSFER" }),
      nextStatus: "PAID",
      nextMethod: "TRANSFER",
      nextSlipImageId: "slip-1",
      actorId: "employee-1",
      now,
      createReceiptNo: vi.fn().mockResolvedValue("RC-2026-0001"),
    });

    expect(tx.paymentRecord.updateMany).toHaveBeenCalledOnce();
  });
});

describe("payment status transition rules", () => {
  it("allows moving between UNPAID and PENDING_VERIFICATION in both directions", () => {
    expect(canTransitionPaymentStatus("UNPAID", "PENDING_VERIFICATION")).toBe(true);
    expect(canTransitionPaymentStatus("PENDING_VERIFICATION", "UNPAID")).toBe(true);
  });

  it("allows cancellation from any non-terminal status", () => {
    expect(canTransitionPaymentStatus("UNPAID", "CANCELLED")).toBe(true);
    expect(canTransitionPaymentStatus("PENDING_VERIFICATION", "CANCELLED")).toBe(true);
    expect(getAllowedPaymentStatusTransitions("UNPAID")).toContain("CANCELLED");
  });

  it("treats PAID and CANCELLED as terminal (no forward transitions)", () => {
    expect(getAllowedPaymentStatusTransitions("PAID")).toEqual([]);
    expect(getAllowedPaymentStatusTransitions("CANCELLED")).toEqual([]);
    expect(canTransitionPaymentStatus("PAID", "CANCELLED")).toBe(false);
    expect(canTransitionPaymentStatus("CANCELLED", "PAID")).toBe(false);
    expect(canTransitionPaymentStatus("PAID", "PENDING_VERIFICATION")).toBe(false);
  });

  it("quirk: allows self-transitions, including on terminal statuses", () => {
    expect(canTransitionPaymentStatus("UNPAID", "UNPAID")).toBe(true);
    expect(canTransitionPaymentStatus("PAID", "PAID")).toBe(true);
    expect(canTransitionPaymentStatus("CANCELLED", "CANCELLED")).toBe(true);
  });
});

describe("payment state transition data", () => {
  it("stamps paidAt/confirmedAt/confirmedById when a payment first becomes PAID", () => {
    const transition = buildPaymentStateTransition({
      existing: existingPayment({ status: "PENDING_VERIFICATION" }),
      nextStatus: "PAID",
      nextMethod: "TRANSFER",
      nextSlipImageId: "slip-1",
      actorId: "employee-1",
      now,
      receiptNo: "RC-2026-0001",
    });

    expect(transition.updateData).toMatchObject({
      status: "PAID",
      paidAt: now,
      confirmedAt: now,
      confirmedById: "employee-1",
      receiptNo: "RC-2026-0001",
    });
  });

  it("keeps the original paidAt/confirmedAt when a PAID payment is re-saved (no timestamp drift)", () => {
    const originalPaidAt = new Date("2026-08-01T08:00:00.000Z");
    const transition = buildPaymentStateTransition({
      existing: existingPayment({ status: "PAID", paidAt: originalPaidAt, confirmedAt: originalPaidAt, confirmedById: "admin-1" }),
      nextStatus: "PAID",
      nextMethod: "CASH",
      nextSlipImageId: null,
      actorId: "employee-2",
      now,
      receiptNo: "RC-2026-0001",
    });

    expect(transition.updateData.paidAt).toBe(originalPaidAt);
    expect(transition.updateData.confirmedAt).toBe(originalPaidAt);
    expect(transition.updateData.confirmedById).toBe("admin-1");
  });

  it("leaves paid/confirmed fields untouched for non-PAID statuses", () => {
    const transition = buildPaymentStateTransition({
      existing: existingPayment({ status: "UNPAID", paidAt: null }),
      nextStatus: "PENDING_VERIFICATION",
      nextMethod: "TRANSFER",
      nextSlipImageId: "slip-1",
      actorId: "employee-1",
      now,
      receiptNo: null,
    });

    expect(transition.updateData.paidAt).toBeNull();
    expect(transition.updateData.confirmedAt).toBeNull();
    expect(transition.updateData.confirmedById).toBeNull();
  });

  it("serializes audit timestamps as ISO strings for the JSON columns", () => {
    const paidAt = new Date("2026-08-01T08:00:00.000Z");
    const transition = buildPaymentStateTransition({
      existing: existingPayment({ status: "UNPAID", paidAt }),
      nextStatus: "PENDING_VERIFICATION",
      nextMethod: "TRANSFER",
      nextSlipImageId: null,
      actorId: "employee-1",
      now,
      receiptNo: null,
    });

    expect(transition.beforeJson.paidAt).toBe("2026-08-01T08:00:00.000Z");
    expect(transition.afterJson.paidAt).toBe("2026-08-01T08:00:00.000Z");
  });
});

describe("applyPaymentStateTransition bookkeeping", () => {
  it("generates a receipt number only when a payment becomes PAID without one", async () => {
    const createReceiptNo = vi.fn().mockResolvedValue("RC-2026-0001");

    const pendingTx = createTx();
    await applyPaymentStateTransition({
      tx: pendingTx,
      paymentId: "payment-1",
      existing: existingPayment(),
      nextStatus: "PENDING_VERIFICATION",
      nextMethod: "TRANSFER",
      nextSlipImageId: "slip-1",
      actorId: "employee-1",
      now,
      createReceiptNo,
    });
    expect(createReceiptNo).not.toHaveBeenCalled();
    expect(pendingTx.paymentRecord.updateMany.mock.calls[0][0].data.receiptNo).toBeNull();

    const paidTx = createTx();
    await applyPaymentStateTransition({
      tx: paidTx,
      paymentId: "payment-1",
      existing: existingPayment({ status: "PENDING_VERIFICATION", method: "TRANSFER", slipImageId: "slip-1" }),
      nextStatus: "PAID",
      nextMethod: "TRANSFER",
      nextSlipImageId: "slip-1",
      actorId: "employee-1",
      now,
      createReceiptNo,
    });
    expect(createReceiptNo).toHaveBeenCalledTimes(1);
    expect(paidTx.paymentRecord.updateMany.mock.calls[0][0].data.receiptNo).toBe("RC-2026-0001");
  });

  it("keeps an existing receipt number on a later PAID write", async () => {
    const createReceiptNo = vi.fn();
    const tx = createTx();

    await applyPaymentStateTransition({
      tx,
      paymentId: "payment-1",
      existing: existingPayment({ status: "PENDING_VERIFICATION", receiptNo: "RC-2026-0001" }),
      nextStatus: "PAID",
      nextMethod: "TRANSFER",
      nextSlipImageId: null,
      actorId: "employee-1",
      now,
      createReceiptNo,
    });

    expect(createReceiptNo).not.toHaveBeenCalled();
    expect(tx.paymentRecord.updateMany.mock.calls[0][0].data.receiptNo).toBe("RC-2026-0001");
  });

  it("writes an audit log entry when the status changes", async () => {
    const tx = createTx();
    await applyPaymentStateTransition({
      tx,
      paymentId: "payment-1",
      existing: existingPayment({ status: "UNPAID" }),
      nextStatus: "CANCELLED",
      nextMethod: null,
      nextSlipImageId: null,
      actorId: "admin-1",
      now,
      createReceiptNo: vi.fn(),
    });

    expect(tx.paymentAuditLog.create).toHaveBeenCalledTimes(1);
    expect(tx.paymentAuditLog.create.mock.calls[0][0].data).toMatchObject({
      paymentId: "payment-1",
      action: "UPDATED",
      actorId: "admin-1",
      beforeJson: { status: "UNPAID" },
      afterJson: { status: "CANCELLED" },
    });
  });

  it("writes an audit log when a self-transition changes a field (method/slip)", async () => {
    // Payment state PUTs overwrite method/slipImageId even when the status is
    // unchanged; since the audit-gap fix, any changed field is recorded so the
    // method cannot be swapped silently.
    const tx = createTx();
    await applyPaymentStateTransition({
      tx,
      paymentId: "payment-1",
      existing: existingPayment({ status: "PAID", paidAt: now, confirmedAt: now, confirmedById: "admin-1", receiptNo: "RC-1" }),
      nextStatus: "PAID",
      nextMethod: "CASH",
      nextSlipImageId: null,
      actorId: "admin-1",
      now,
      createReceiptNo: vi.fn(),
    });

    expect(tx.paymentAuditLog.create).toHaveBeenCalledTimes(1);
  });

  it("skips the audit log when nothing changes (self-transition writes are silent)", async () => {
    const tx = createTx();
    await applyPaymentStateTransition({
      tx,
      paymentId: "payment-1",
      existing: existingPayment({
        status: "PAID",
        method: "CASH",
        paidAt: now,
        confirmedAt: now,
        confirmedById: "admin-1",
        receiptNo: "RC-1",
      }),
      nextStatus: "PAID",
      nextMethod: "CASH",
      nextSlipImageId: null,
      actorId: "admin-1",
      now,
      createReceiptNo: vi.fn(),
    });

    expect(tx.paymentAuditLog.create).not.toHaveBeenCalled();
  });
});

describe("payment source cardinality (exactly one of serviceOrderId / packageSaleId)", () => {
  // Invariant C5: a payment has exactly one source. classifyIncomeSource is
  // today's only pure seam that encodes this: records with both or neither
  // source are classified OTHER and must not be counted in either bucket.
  it("classifies a package-sale-sourced payment as PACKAGE_SALE", () => {
    expect(
      classifyIncomeSource({ id: "p1", amount: 500, packageSaleId: "sale-1", serviceOrderId: null, serviceOrder: null }),
    ).toBe("PACKAGE_SALE");
  });

  it("classifies a service-order-sourced payment as LAUNDRY_ORDER or WASH_FOLD", () => {
    expect(
      classifyIncomeSource({ id: "p2", amount: 200, packageSaleId: null, serviceOrderId: "o1", serviceOrder: { weightKg: null } }),
    ).toBe("LAUNDRY_ORDER");
    expect(
      classifyIncomeSource({ id: "p3", amount: 150, packageSaleId: null, serviceOrderId: "o2", serviceOrder: { weightKg: 4.5 } }),
    ).toBe("WASH_FOLD");
  });

  it("quirk: classifies a payment with both sources as OTHER, not an error", () => {
    expect(
      classifyIncomeSource({
        id: "p4",
        amount: 100,
        packageSaleId: "sale-1",
        serviceOrderId: "order-1",
        serviceOrder: { weightKg: null },
      }),
    ).toBe("OTHER");
  });

  it("classifies a payment with no source as OTHER", () => {
    expect(classifyIncomeSource({ id: "p5", amount: 100, packageSaleId: null, serviceOrderId: null, serviceOrder: null })).toBe(
      "OTHER",
    );
  });
});

describe("payment VAT metadata extraction (JSON-safe boundary)", () => {
  it("returns a plain-number VAT summary when the metadata carries a positive rate", () => {
    expect(
      extractPaymentVat({ vat: { rate: 7, amount: 42, included: true, baseAmount: 600 } }),
    ).toEqual({ rate: 7, amount: 42, included: true, baseAmount: 600 });
  });

  it("returns null when metadata is missing, malformed, or the rate is not positive", () => {
    expect(extractPaymentVat(null)).toBeNull();
    expect(extractPaymentVat(undefined)).toBeNull();
    expect(extractPaymentVat({})).toBeNull();
    expect(extractPaymentVat({ vat: {} })).toBeNull();
    expect(extractPaymentVat({ vat: { rate: 0, amount: 0 } })).toBeNull();
    expect(extractPaymentVat({ vat: { rate: -7, amount: -42 } })).toBeNull();
    expect(extractPaymentVat({ vat: { rate: "not-a-number", amount: 1 } })).toBeNull();
  });

  it("defaults missing amount/baseAmount to 0 and coerces included to boolean", () => {
    expect(extractPaymentVat({ vat: { rate: 7 } })).toEqual({ rate: 7, amount: 0, included: false, baseAmount: 0 });
    expect(extractPaymentVat({ vat: { rate: 7, amount: "42.5", included: 1 } })).toEqual({
      rate: 7,
      amount: 42.5,
      included: true,
      baseAmount: 0,
    });
  });
});
