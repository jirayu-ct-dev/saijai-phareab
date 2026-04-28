import type { ServiceOrderStatus } from "~~/shared/types/enums";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { Prisma } from "~~/app/generated/prisma/client";
import { refundAddonUsages, refundPrimaryCredit } from "~~/server/utils/serviceOrderCredits";
import { notifyServiceOrderStatusChanged } from "~~/server/utils/notify";

type AddonUsageInput = {
  entitlementId: string;
  credits: number;
};

type UpdateStatusBody = {
  status?: ServiceOrderStatus;
  deliveryImageId?: string | null;
  addonUsages?: AddonUsageInput[];
};

type StoredAddonUsage = {
  entitlementId: string;
  productId: string;
  productName: string;
  credits: number;
  appliedAt: string;
};

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบรหัสรายการรับผ้า" });
  }

  const body = await readBody<UpdateStatusBody>(event);
  const status = body.status;
  const allowedStatuses: ServiceOrderStatus[] = [
    "RECEIVED",
    "PROCESSING",
    "DELIVERING",
    "COMPLETED",
    "CANCELLED",
  ];

  if (!status || !allowedStatuses.includes(status)) {
    throw createError({ statusCode: 400, statusMessage: "สถานะงานไม่ถูกต้อง" });
  }

  const existing = await prisma.serviceOrder.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true,
      status: true,
      employeeId: true,
      customerId: true,
      orderNo: true,
      addonUsages: true,
      creditUsed: true,
      memberEntitlementId: true,
      updatedAt: true,
    },
  });

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบรายการรับผ้า" });
  }

  const deliveryImageIdInput = body.deliveryImageId;
  const isTransitionToCompleted = status === "COMPLETED" && existing.status !== "COMPLETED";
  const isTransitionToCancelled = status === "CANCELLED" && existing.status !== "CANCELLED";
  const isTransitionFromCompleted = existing.status === "COMPLETED" && status !== "COMPLETED";
  const rawAddonUsages = Array.isArray(body.addonUsages) ? body.addonUsages : [];

  const normalizedAddonUsages = rawAddonUsages
    .filter((item) => item && typeof item.entitlementId === "string")
    .map((item) => ({
      entitlementId: item.entitlementId,
      credits: Math.max(0, Math.floor(Number(item.credits) || 0)),
    }))
    .filter((item) => item.credits > 0);

  if (normalizedAddonUsages.length && !isTransitionToCompleted) {
    throw createError({
      statusCode: 400,
      statusMessage: "ใช้สิทธิ์แพ็กเกจรองได้เฉพาะตอนเปลี่ยนสถานะเป็นเสร็จสิ้นเท่านั้น",
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const storedUsages: StoredAddonUsage[] = [];

    if (isTransitionToCompleted && normalizedAddonUsages.length) {
      for (const usage of normalizedAddonUsages) {
        const entitlement = await tx.memberEntitlement.findFirst({
          where: {
            id: usage.entitlementId,
            customerId: existing.customerId,
            status: "ACTIVE",
            deletedAt: null,
            product: { packageType: "ADDON" },
          },
          include: { product: { select: { id: true, name: true, packageType: true } } },
        });

        if (!entitlement) {
          throw createError({
            statusCode: 400,
            statusMessage: `ไม่พบสิทธิ์แพ็กเกจรองที่ต้องการใช้ (${usage.entitlementId})`,
          });
        }

        const remaining = entitlement.creditRemaining ?? 0;
        if (remaining < usage.credits) {
          throw createError({
            statusCode: 400,
            statusMessage: `เครดิตคงเหลือของ "${entitlement.product.name}" ไม่พอ (มี ${remaining})`,
          });
        }

        await tx.memberEntitlement.update({
          where: { id: entitlement.id },
          data: { creditRemaining: remaining - usage.credits },
        });

        storedUsages.push({
          entitlementId: entitlement.id,
          productId: entitlement.product.id,
          productName: entitlement.product.name,
          credits: usage.credits,
          appliedAt: new Date().toISOString(),
        });
      }
    }

    const updateData: {
      status: ServiceOrderStatus;
      employeeId: string;
      deliveryImageId?: string | null;
      addonUsages?: StoredAddonUsage[] | typeof Prisma.DbNull;
      creditUsed?: number | null;
      memberEntitlementId?: string | null;
    } = {
      status,
      employeeId: existing.employeeId ?? actor.id,
    };

    if (isTransitionToCancelled) {
      await refundPrimaryCredit(tx, {
        memberEntitlementId: existing.memberEntitlementId,
        creditUsed: existing.creditUsed,
      });
      await refundAddonUsages(tx, existing.addonUsages);
      updateData.creditUsed = null;
      updateData.memberEntitlementId = null;
      updateData.addonUsages = Prisma.DbNull;
    } else if (isTransitionFromCompleted) {
      await refundAddonUsages(tx, existing.addonUsages);
      updateData.addonUsages = Prisma.DbNull;
    }

    if (status === "COMPLETED") {
      if (deliveryImageIdInput !== undefined) {
        updateData.deliveryImageId = deliveryImageIdInput || null;
      }
      if (storedUsages.length) {
        updateData.addonUsages = storedUsages;
      }
    } else if (deliveryImageIdInput !== undefined) {
      updateData.deliveryImageId = null;
    }

    return tx.serviceOrder.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        orderNo: true,
        status: true,
        updatedAt: true,
      },
    });
  });

  if (existing.status !== updated.status) {
    void notifyServiceOrderStatusChanged({
      serviceOrderId: updated.id,
      fromStatus: existing.status,
      toStatus: updated.status,
    });
  }

  return {
    id: updated.id,
    orderNo: updated.orderNo,
    status: updated.status,
    updatedAt: updated.updatedAt.toISOString(),
  };
});
