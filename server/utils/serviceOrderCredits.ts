import type { Prisma } from "~~/app/generated/prisma/client";

type TxClient = Prisma.TransactionClient;

type StoredAddonUsage = {
  entitlementId: string;
  productId?: string;
  productName?: string;
  credits: number;
  appliedAt?: string;
};

type RefundableOrder = {
  memberEntitlementId: string | null;
  creditUsed: number | null;
  addonUsages: unknown;
};

export const parseAddonUsages = (value: unknown): StoredAddonUsage[] => {
  if (!Array.isArray(value)) return [];
  return (value as unknown[])
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      entitlementId: typeof item.entitlementId === "string" ? item.entitlementId : "",
      productId: typeof item.productId === "string" ? item.productId : undefined,
      productName: typeof item.productName === "string" ? item.productName : undefined,
      credits: Number(item.credits ?? 0),
      appliedAt: typeof item.appliedAt === "string" ? item.appliedAt : undefined,
    }))
    .filter((item) => item.entitlementId && item.credits > 0);
};

/**
 * Refund primary member credits recorded on a service order back to the
 * linked entitlement. No-op when there is nothing to refund.
 */
export const refundPrimaryCredit = async (tx: TxClient, order: Pick<RefundableOrder, "memberEntitlementId" | "creditUsed">) => {
  if (!order.memberEntitlementId) return;
  const credits = Number(order.creditUsed ?? 0);
  if (credits <= 0) return;

  await tx.memberEntitlement.updateMany({
    where: { id: order.memberEntitlementId },
    data: { creditRemaining: { increment: credits } },
  });
};

/**
 * Refund addon usages back to their respective addon entitlements.
 * Uses updateMany so a missing/deleted entitlement doesn't abort the
 * surrounding cancel/delete transaction.
 */
export const refundAddonUsages = async (tx: TxClient, addonUsages: unknown) => {
  const usages = parseAddonUsages(addonUsages);
  for (const usage of usages) {
    await tx.memberEntitlement.updateMany({
      where: { id: usage.entitlementId },
      data: { creditRemaining: { increment: usage.credits } },
    });
  }
};
