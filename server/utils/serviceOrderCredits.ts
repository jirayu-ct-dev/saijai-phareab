import type { DeductOn } from "~~/shared/types/enums";
import type { Prisma } from "~~/app/generated/prisma/client";
import { prisma } from "~~/server/utils/prisma";
import { backdatedEntitlementWhere } from "~~/server/utils/backdatedEntitlement";

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
};

const refundEntitlementCredits = async (tx: TxClient, entitlementId: string, credits: number) => {
  const { count } = await tx.memberEntitlement.updateMany({
    where: { id: entitlementId, deletedAt: null, creditRemaining: { not: null } },
    data: { creditRemaining: { increment: credits } },
  });

  if (count !== 1) {
    throw createError({
      statusCode: 409,
      statusMessage: "ไม่สามารถคืนเครดิตได้ เนื่องจากไม่พบสิทธิ์แพ็กเกจที่ใช้งานรายการนี้",
    });
  }
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
    .filter((item) => item.entitlementId && (item.credits > 0 || item.isDelivery));
};

/**
 * Refund primary member credits recorded on a service order back to the
 * linked entitlement. No-op when there is nothing to refund. Entitlement
 * status is intentionally not changed: suspended/expired/cancelled rows keep
 * blocking use, while their balance remains correct if they are reactivated.
 */
export const refundPrimaryCredit = async (tx: TxClient, order: Pick<RefundableOrder, "memberEntitlementId" | "creditUsed">) => {
  if (!order.memberEntitlementId) return;
  const credits = Number(order.creditUsed ?? 0);
  if (credits <= 0) return;

  await refundEntitlementCredits(tx, order.memberEntitlementId, credits);
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
  // A missed intake may use a package that has since expired. Its pending
  // completion usage retains eligibility at intake, without reactivating it.
  const historicalOrder = usages.some((usage) => usage.memberEntitlement?.status === "EXPIRED")
    ? await tx.serviceOrder.findFirst({
        where: {
          id: serviceOrderId,
          payments: { some: { auditLogs: { some: { afterJson: { path: ["backdated"], equals: true } } } } },
        },
        select: { receivedAt: true },
      })
    : null;
  const deductedAt = new Date();
  const deducted: StoredAddonUsage[] = [];

  for (const usage of usages) {
    if (!usage.memberEntitlementId || !usage.memberEntitlement) {
      throw createError({ statusCode: 409, statusMessage: "ไม่พบสิทธิ์แพ็กเกจเสริมที่ต้องหักเครดิต" });
    }

    const { count } = await tx.memberEntitlement.updateMany({
      where: {
        id: usage.memberEntitlementId,
        deletedAt: null,
        // For a backdated order the window filter also admits an expired
        // entitlement that covered the historical receive date; otherwise
        // only an ACTIVE entitlement may be deducted.
        ...(historicalOrder
          ? backdatedEntitlementWhere(historicalOrder.receivedAt)
          : { status: "ACTIVE" as const }),
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
 * What refundAddonUsages did for one order, used as a bounded telemetry
 * dimension by callers after their transaction commits:
 *   - "normalized":        refunded via normalized ledger records
 *   - "already-refunded":  normalized records exist but nothing is refundable
 *                          (all refunded, or nothing deducted yet)
 *   - "no-usage":          no normalized usage exists
 */
export type AddonRefundOutcome = "normalized" | "already-refunded" | "no-usage";

/**
 * Refund add-on usages back to their respective add-on entitlements.
 * The normalized ledger is the sole source of truth. A fully refunded or
 * not-yet-deducted order must never refund credits again.
 */
export const refundAddonUsages = async (
  tx: TxClient,
  serviceOrderId: string,
): Promise<AddonRefundOutcome> => {
  const records = await tx.serviceOrderAddonUsage.findMany({
    where: { serviceOrderId },
    select: { id: true, memberEntitlementId: true, credits: true, deductedAt: true, refundedAt: true },
  });

  if (records.length === 0) return "no-usage";
  const refundable = records.filter(
    (usage) => usage.refundedAt === null && usage.deductedAt !== null && usage.credits > 0,
  );
  if (refundable.length === 0) return "already-refunded";

  const refundedAt = new Date();
  for (const usage of refundable) {
    if (!usage.memberEntitlementId) {
      throw createError({
        statusCode: 409,
        statusMessage: "ไม่สามารถคืนเครดิตได้ เนื่องจากรายการใช้สิทธิ์ไม่มีแพ็กเกจอ้างอิง",
      });
    }
    await refundEntitlementCredits(tx, usage.memberEntitlementId, usage.credits);
  }
  await tx.serviceOrderAddonUsage.updateMany({
    where: { id: { in: refundable.map((usage) => usage.id) } },
    data: { refundedAt },
  });
  return "normalized";
};

export const reverseCompletedAddonDeductions = async (tx: TxClient, serviceOrderId: string) => {
  const records = await tx.serviceOrderAddonUsage.findMany({
    where: {
      serviceOrderId,
      deductOn: "COMPLETED",
      deductedAt: { not: null },
      refundedAt: null,
      credits: { gt: 0 },
    },
    select: { id: true, memberEntitlementId: true, credits: true },
  });

  for (const usage of records) {
    if (!usage.memberEntitlementId) {
      throw createError({ statusCode: 409, statusMessage: "ไม่สามารถคืนเครดิตได้ เนื่องจากรายการใช้สิทธิ์ไม่มีแพ็กเกจอ้างอิง" });
    }
    await refundEntitlementCredits(tx, usage.memberEntitlementId, usage.credits);
  }

  if (records.length > 0) {
    await tx.serviceOrderAddonUsage.updateMany({
      where: { id: { in: records.map((usage) => usage.id) } },
      data: { deductedAt: null },
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

export const settleNegativeEntitlements = async (
  tx: TxClient,
  customerId: string,
  newEntitlementId: string,
) => {
  if (typeof tx.memberEntitlement?.findFirst !== "function" || typeof tx.memberEntitlement?.findMany !== "function") {
    return;
  }

  const newEntitlement = await tx.memberEntitlement.findFirst({
    where: {
      id: newEntitlementId,
      customerId,
      deletedAt: null,
      status: "ACTIVE",
      creditRemaining: { gt: 0 },
    },
    select: { id: true, creditRemaining: true },
  });

  if (!newEntitlement || !newEntitlement.creditRemaining || newEntitlement.creditRemaining <= 0) {
    return;
  }

  // Find other MAIN entitlements belonging to this customer with negative creditRemaining
  const negativeEntitlements = await tx.memberEntitlement.findMany({
    where: {
      id: { not: newEntitlementId },
      customerId,
      deletedAt: null,
      creditRemaining: { lt: 0 },
      product: { packageType: "MAIN" },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, creditRemaining: true },
  });

  if (negativeEntitlements.length === 0) {
    return;
  }

  let availableCredits = newEntitlement.creditRemaining;

  for (const debtEnt of negativeEntitlements) {
    if (availableCredits <= 0) break;
    const debt = Math.abs(debtEnt.creditRemaining ?? 0);
    const settleAmount = Math.min(debt, availableCredits);

    await tx.memberEntitlement.update({
      where: { id: debtEnt.id },
      data: { creditRemaining: { increment: settleAmount } },
    });

    availableCredits -= settleAmount;
  }

  const totalSettled = newEntitlement.creditRemaining - availableCredits;
  if (totalSettled > 0) {
    await tx.memberEntitlement.update({
      where: { id: newEntitlementId },
      data: { creditRemaining: availableCredits },
    });
  }
};

export type OrderCreditSnapshot = {
  orderCreditRemaining: number;
  isOrderNegative: boolean;
  isSettled: boolean;
  orderCreditShortfall: number;
};

export const computeOrderCreditSnapshots = async (
  orders: Array<{
    id: string;
    memberEntitlementId: string | null;
  }>,
  dbClient?: {
    serviceOrder: {
      findMany: (args: any) => Promise<any[]>;
    };
    memberEntitlement: {
      findMany: (args: any) => Promise<any[]>;
    };
  }
): Promise<Map<string, OrderCreditSnapshot>> => {
  const result = new Map<string, OrderCreditSnapshot>();
  const client = dbClient || prisma;
  const entitlementIds = [...new Set(orders.map((o) => o.memberEntitlementId).filter(Boolean))] as string[];
  if (entitlementIds.length === 0) return result;

  const [entitlements, allOrders] = await Promise.all([
    client.memberEntitlement.findMany({
      where: { id: { in: entitlementIds } },
      select: { id: true, creditInitial: true, creditRemaining: true },
    }),
    client.serviceOrder.findMany({
      where: {
        memberEntitlementId: { in: entitlementIds },
        deletedAt: null,
      },
      select: {
        id: true,
        memberEntitlementId: true,
        creditUsed: true,
        receivedAt: true,
        createdAt: true,
      },
      orderBy: [
        { receivedAt: "asc" },
        { createdAt: "asc" },
      ],
    }),
  ]);

  const entMap = new Map(entitlements.map((e: any) => [e.id, e]));
  const ordersGrouped = new Map<string, typeof allOrders>();

  for (const ord of allOrders) {
    if (!ord.memberEntitlementId) continue;
    const list = ordersGrouped.get(ord.memberEntitlementId) ?? [];
    list.push(ord);
    ordersGrouped.set(ord.memberEntitlementId, list);
  }

  for (const entId of entitlementIds) {
    const ent = entMap.get(entId);
    const entOrders = ordersGrouped.get(entId) ?? [];
    const totalCreditsUsed = entOrders.reduce((sum: number, o: any) => sum + (o.creditUsed ?? 0), 0);
    const creditInitial = Number(ent?.creditInitial ?? 0);
    const currentRemaining = Number(ent?.creditRemaining ?? 0);

    // If this entitlement had its negative balance settled by purchasing a new package,
    // currentRemaining was increased (towards or to 0).
    const totalSettledIntoThis = Math.max(0, currentRemaining - (creditInitial - totalCreditsUsed));

    // If this entitlement itself started with fewer credits (used to settle older debt):
    const settledPaidAtStart = Math.max(0, creditInitial - currentRemaining - totalCreditsUsed);

    let runningRaw = creditInitial - settledPaidAtStart;

    for (const ord of entOrders) {
      const used = Number(ord.creditUsed ?? 0);
      const balanceBefore = runningRaw;
      runningRaw -= used;

      const wasOverdrafted = used > 0 && runningRaw < 0;
      let isSettled = false;
      let isOrderNegative = false;
      let orderCreditShortfall = 0;

      if (wasOverdrafted) {
        const availableBefore = Math.max(0, balanceBefore);
        orderCreditShortfall = Math.max(0, used - availableBefore);

        const overdraftAmount = Math.abs(runningRaw);
        if (totalSettledIntoThis >= overdraftAmount) {
          isSettled = true;
          isOrderNegative = false;
        } else {
          isSettled = false;
          isOrderNegative = true;
        }
      }

      result.set(ord.id, {
        orderCreditRemaining: runningRaw,
        isOrderNegative,
        isSettled,
        orderCreditShortfall,
      });
    }
  }

  return result;
};

