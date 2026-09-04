import { addDays } from "date-fns";
import type { PaymentStatus } from "~~/shared/types/enums";

type PaymentEntitlementEditInput = {
  paymentStatus: PaymentStatus;
  productChanged: boolean;
  validityDays: number | null | undefined;
  credits: number | null | undefined;
  now?: Date;
};

/**
 * Return only the entitlement fields an admin payment edit may replace.
 * Non-product edits preserve the current balance and lifecycle. A product
 * correction is allowed only after the caller has verified the entitlement
 * has never been used.
 */
export const buildPaymentEntitlementEdit = ({
  paymentStatus,
  productChanged,
  validityDays,
  credits,
  now = new Date(),
}: PaymentEntitlementEditInput) => {
  if (!productChanged) return {};

  const creditTotal = credits ?? 0;
  if (paymentStatus !== "PAID") {
    return {
      status: "PENDING" as const,
      startAt: null,
      endAt: null,
      activatedAt: null,
      suspendedAt: null,
      creditInitial: creditTotal,
      creditRemaining: creditTotal,
    };
  }

  return {
    status: "ACTIVE" as const,
    startAt: now,
    endAt: validityDays ? addDays(now, validityDays) : null,
    activatedAt: now,
    suspendedAt: null,
    creditInitial: creditTotal,
    creditRemaining: creditTotal,
  };
};
