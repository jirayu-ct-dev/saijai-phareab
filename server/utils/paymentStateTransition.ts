import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";

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
      update: (args: unknown) => Promise<unknown>;
    };
    packageSale: {
      update: (args: unknown) => Promise<unknown>;
    };
    paymentAuditLog: {
      create: (args: unknown) => Promise<unknown>;
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

  await tx.paymentRecord.update({
    where: { id: paymentId },
    data: transition.updateData,
  });

  if (existing.packageSaleId) {
    await tx.packageSale.update({
      where: { id: existing.packageSaleId },
      data: { status: packageSaleStatusByPaymentStatus[nextStatus] },
    });
  }

  if (existing.status !== nextStatus) {
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
