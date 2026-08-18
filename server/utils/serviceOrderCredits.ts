import type { DeductOn } from "~~/shared/types/enums";
import type { Prisma } from "~~/app/generated/prisma/client";

type TxClient = Prisma.TransactionClient;

export type StoredAddonUsage = {
  entitlementId: string;
  productId?: string;
  productName?: string;
  credits: number;
  deductOn?: DeductOn;
  isDelivery?: boolean;
  appliedAt?: string;
  deductedAt?: string;
  refundedAt?: string;
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
    .map((item) => {
      const deductOn: DeductOn = item.deductOn === "COMPLETED" ? "COMPLETED" : "CREATED";
      return {
        entitlementId: typeof item.entitlementId === "string" ? item.entitlementId : "",
        productId: typeof item.productId === "string" ? item.productId : undefined,
        productName: typeof item.productName === "string" ? item.productName : undefined,
        credits: Number(item.credits ?? 0),
        deductOn,
        isDelivery: item.isDelivery === true,
        appliedAt: typeof item.appliedAt === "string" ? item.appliedAt : undefined,
        deductedAt: typeof item.deductedAt === "string" ? item.deductedAt : undefined,
        refundedAt: typeof item.refundedAt === "string" ? item.refundedAt : undefined,
      };
    })
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

export const createAddonUsageRecords = async (
  tx: TxClient,
  serviceOrderId: string,
  usages: Array<StoredAddonUsage & { deductOn: DeductOn; deductedAt?: string | null }>,
) => {
  if (usages.length === 0) return;
  await tx.serviceOrderAddonUsage.createMany({
    data: usages.map((usage) => ({
      serviceOrderId,
      memberEntitlementId: usage.entitlementId,
      productId: usage.productId ?? null,
      productName: usage.productName ?? null,
      credits: usage.credits,
      deductOn: usage.deductOn,
      isDelivery: usage.isDelivery ?? false,
      deductedAt: usage.deductedAt ? new Date(usage.deductedAt) : null,
    })),
  });
};

export const deductAddonUsageRecords = async (tx: TxClient, serviceOrderId: string, deductOn: DeductOn) => {
  const usages = await tx.serviceOrderAddonUsage.findMany({
    where: {
      serviceOrderId,
      deductOn,
      deductedAt: null,
      refundedAt: null,
      credits: { gt: 0 },
    },
    include: {
      memberEntitlement: {
        include: { product: { select: { name: true } } },
      },
    },
  });

  if (usages.length === 0) return [];
  const deductedAt = new Date();
  const deducted: StoredAddonUsage[] = [];

  for (const usage of usages) {
    if (!usage.memberEntitlementId || !usage.memberEntitlement) {
      throw createError({ statusCode: 409, statusMessage: "ไม่พบสิทธิ์แพ็กเกจเสริมที่ต้องหักเครดิต" });
    }

    const { count } = await tx.memberEntitlement.updateMany({
      where: {
        id: usage.memberEntitlementId,
        status: "ACTIVE",
        deletedAt: null,
        creditRemaining: { gte: usage.credits },
      },
      data: { creditRemaining: { decrement: usage.credits } },
    });

    if (count === 0) {
      throw createError({
        statusCode: 409,
        statusMessage: `เครดิตของ "${usage.productName || usage.memberEntitlement.product.name}" ไม่พอหรือสิทธิ์ไม่พร้อมใช้งาน`,
      });
    }

    await tx.serviceOrderAddonUsage.update({
      where: { id: usage.id },
      data: { deductedAt },
    });

    deducted.push({
      entitlementId: usage.memberEntitlementId,
      productId: usage.productId ?? undefined,
      productName: usage.productName ?? usage.memberEntitlement.product.name,
      credits: usage.credits,
      deductOn: usage.deductOn,
      isDelivery: usage.isDelivery,
      appliedAt: deductedAt.toISOString(),
      deductedAt: deductedAt.toISOString(),
    });
  }

  return deducted;
};

/**
 * Refund add-on usages back to their respective add-on entitlements.
 * New normalized records are authoritative. Legacy JSON is used only when
 * no usage records exist, so migrated rows are not refunded twice.
 */
export const refundAddonUsages = async (tx: TxClient, serviceOrderId: string, addonUsages: unknown) => {
  const records = await tx.serviceOrderAddonUsage.findMany({
    where: {
      serviceOrderId,
      refundedAt: null,
      deductedAt: { not: null },
      credits: { gt: 0 },
    },
    select: {
      id: true,
      memberEntitlementId: true,
      credits: true,
    },
  });

  if (records.length > 0) {
    const refundedAt = new Date();
    for (const usage of records) {
      if (usage.memberEntitlementId) {
        await tx.memberEntitlement.updateMany({
          where: { id: usage.memberEntitlementId },
          data: { creditRemaining: { increment: usage.credits } },
        });
      }
    }
    await tx.serviceOrderAddonUsage.updateMany({
      where: { id: { in: records.map((usage) => usage.id) } },
      data: { refundedAt },
    });
    return;
  }

  const legacyUsages = parseAddonUsages(addonUsages);
  for (const usage of legacyUsages) {
    await tx.memberEntitlement.updateMany({
      where: { id: usage.entitlementId },
      data: { creditRemaining: { increment: usage.credits } },
    });
  }
};

export const voidPendingAddonUsageRecords = async (tx: TxClient, serviceOrderId: string) => {
  await tx.serviceOrderAddonUsage.updateMany({
    where: {
      serviceOrderId,
      deductedAt: null,
      refundedAt: null,
    },
    data: { refundedAt: new Date() },
  });
};
