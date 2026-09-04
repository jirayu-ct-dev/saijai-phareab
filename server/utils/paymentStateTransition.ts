import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";
import type { Prisma } from "~~/app/generated/prisma/client";

type PaymentStateExisting = {
  id: string;
  status: PaymentStatus;
  method: PaymentMethod | null;
  paidAt: Date | null;
  confirmedAt: Date | null;
  confirmedById: string | null;
  receiptNo: string | null;
  packageSaleId: string | null;
  slipImageId: string | null;
};

type PaymentStateTransitionInput = {
  existing: PaymentStateExisting;
  nextStatus: PaymentStatus;
  nextMethod: PaymentMethod | null;
  nextSlipImageId: string | null;
  actorId: string;
  now: Date;
  receiptNo: string | null;
};

type PaymentStateTransitionOperationInput = Omit<PaymentStateTransitionInput, "receiptNo"> & {
  paymentId: string;
  tx: {
    paymentRecord: {
      updateMany: Prisma.TransactionClient["paymentRecord"]["updateMany"];
    };
    paymentAuditLog: {
      create: Prisma.TransactionClient["paymentAuditLog"]["create"];
    };
  };
  createReceiptNo: (date: Date, tx: unknown) => Promise<string>;
};

export const paymentStatuses = new Set<PaymentStatus>(["UNPAID", "PENDING_VERIFICATION", "PAID", "CANCELLED"]);
export const paymentMethods = new Set<PaymentMethod>(["CASH", "TRANSFER"]);

export const packageSaleStatusByPaymentStatus: Record<PaymentStatus, "PENDING" | "PAID" | "CANCELLED"> = {
  UNPAID: "PENDING",
  PENDING_VERIFICATION: "PENDING",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
};

const allowedPaymentStatusTransitions: Record<PaymentStatus, PaymentStatus[]> = {
  UNPAID: ["PENDING_VERIFICATION", "PAID", "CANCELLED"],
  PENDING_VERIFICATION: ["UNPAID", "PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

export const canTransitionPaymentStatus = (fromStatus: PaymentStatus, toStatus: PaymentStatus) =>
  fromStatus === toStatus || allowedPaymentStatusTransitions[fromStatus].includes(toStatus);

export const getAllowedPaymentStatusTransitions = (status: PaymentStatus) => allowedPaymentStatusTransitions[status];

export const buildPaymentStateTransition = ({
  existing,
  nextStatus,
  nextMethod,
  nextSlipImageId,
  actorId,
  now,
  receiptNo,
}: PaymentStateTransitionInput) => {
  const paidAt = nextStatus === "PAID" ? existing.paidAt ?? now : existing.paidAt;
  const confirmedAt = nextStatus === "PAID" ? existing.confirmedAt ?? now : existing.confirmedAt;
  const confirmedById = nextStatus === "PAID" ? existing.confirmedById ?? actorId : existing.confirmedById;

  return {
    updateData: {
      status: nextStatus,
      method: nextMethod,
      receiptNo,
      slipImageId: nextSlipImageId,
      paidAt,
      confirmedAt,
      confirmedById,
    },
    beforeJson: {
      status: existing.status,
      method: existing.method,
      paidAt: existing.paidAt?.toISOString() ?? null,
      confirmedAt: existing.confirmedAt?.toISOString() ?? null,
      confirmedById: existing.confirmedById,
      receiptNo: existing.receiptNo,
      slipImageId: existing.slipImageId,
    },
    afterJson: {
      status: nextStatus,
      method: nextMethod,
      paidAt: paidAt?.toISOString() ?? null,
      confirmedAt: confirmedAt?.toISOString() ?? null,
      confirmedById,
      receiptNo,
      slipImageId: nextSlipImageId,
    },
  };
};

export const applyPaymentStateTransition = async ({
  tx,
  paymentId,
  existing,
  nextStatus,
  nextMethod,
  nextSlipImageId,
  actorId,
  now,
  createReceiptNo,
}: PaymentStateTransitionOperationInput) => {
  const receiptNo = nextStatus === "PAID" ? existing.receiptNo ?? (await createReceiptNo(now, tx)) : existing.receiptNo;
  const transition = buildPaymentStateTransition({
    existing,
    nextStatus,
    nextMethod,
    nextSlipImageId,
    actorId,
    now,
    receiptNo,
  });

  // Guard on the status the caller read so two concurrent transitions cannot
  // both apply (the second write would, e.g. for PAID, reset entitlement
  // credits to full). The read happened outside this transaction.
  const { count: updatedCount } = await tx.paymentRecord.updateMany({
    where: {
      id: paymentId,
      status: existing.status,
      method: existing.method,
      paidAt: existing.paidAt,
      confirmedAt: existing.confirmedAt,
      confirmedById: existing.confirmedById,
      receiptNo: existing.receiptNo,
      slipImageId: existing.slipImageId,
      deletedAt: null,
    },
    data: transition.updateData,
  });
  if (updatedCount !== 1) {
    throw createError({
      statusCode: 409,
      statusMessage: "สถานะการชำระเงินถูกเปลี่ยนโดยผู้ใช้อื่น กรุณาลองใหม่",
    });
  }

  // Same-status calls can still change method/slip; record an audit entry
  // whenever any audited field actually changed, not only on status changes.
  const fieldsChanged =
    existing.status !== nextStatus
    || JSON.stringify(transition.beforeJson) !== JSON.stringify(transition.afterJson);

  if (fieldsChanged) {
    await tx.paymentAuditLog.create({
      data: {
        paymentId,
        action: "UPDATED",
        actorId,
        beforeJson: transition.beforeJson,
        afterJson: transition.afterJson,
      },
    });
  }

  return transition;
};
