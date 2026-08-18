import type { ServiceOrderStatus } from "~~/shared/types/enums";
import { requireRole } from "~~/server/utils/auth";
import { notifyServiceOrderStatusChanged } from "~~/server/utils/notify";
import { prisma } from "~~/server/utils/prisma";
import { deductAddonUsageRecords, parseAddonUsages, refundAddonUsages, refundPrimaryCredit, voidPendingAddonUsageRecords } from "~~/server/utils/serviceOrderCredits";
import { canTransitionServiceOrderStatus, isServiceOrderStatus } from "~~/server/utils/serviceOrderStatusTransition";

type UpdateServiceOrderStatusBody = {
  status?: ServiceOrderStatus;
};

export default defineEventHandler(async (event) => {
  requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบรหัสรายการรับผ้า" });
  }

  const body = await readBody<UpdateServiceOrderStatusBody>(event);
  const nextStatus = body.status;

  if (!isServiceOrderStatus(nextStatus)) {
    throw createError({ statusCode: 400, statusMessage: "สถานะรายการรับผ้าไม่ถูกต้อง" });
  }

  try {
    const existing = await prisma.serviceOrder.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        memberEntitlementId: true,
        creditUsed: true,
        addonUsages: true,
      },
    });

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบรายการรับผ้าที่ต้องการอัปเดต" });
    }

    if (existing.status === nextStatus) {
      return { success: true };
    }

    if (!canTransitionServiceOrderStatus(existing.status, nextStatus)) {
      throw createError({
        statusCode: 400,
        statusMessage: "ไม่สามารถข้ามสถานะรายการรับผ้าได้",
      });
    }

    await prisma.$transaction(async (tx) => {
      const shouldRefundCredits = existing.status !== "CANCELLED" && nextStatus === "CANCELLED";
      const shouldDeductCompletedAddons = existing.status !== "CANCELLED" && nextStatus === "COMPLETED";
      let nextAddonUsages: unknown | undefined;

      if (shouldRefundCredits) {
        await refundPrimaryCredit(tx, {
          memberEntitlementId: existing.memberEntitlementId,
          creditUsed: existing.creditUsed,
        });
        await refundAddonUsages(tx, existing.id, existing.addonUsages);
        await voidPendingAddonUsageRecords(tx, existing.id);
      }

      if (shouldDeductCompletedAddons) {
        const deducted = await deductAddonUsageRecords(tx, existing.id, "COMPLETED");
        if (deducted.length > 0) {
          nextAddonUsages = [...parseAddonUsages(existing.addonUsages), ...deducted];
        }
      }

      await tx.serviceOrder.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(nextAddonUsages !== undefined ? { addonUsages: nextAddonUsages } : {}),
          ...(shouldRefundCredits
            ? {
                creditUsed: null,
                memberEntitlementId: null,
                addonUsages: [],
              }
            : {}),
        },
      });
    });

    if (nextStatus === "DELIVERING") {
      await notifyServiceOrderStatusChanged({
        serviceOrderId: existing.id,
        fromStatus: existing.status,
        toStatus: nextStatus,
      });
    } else {
      void notifyServiceOrderStatusChanged({
        serviceOrderId: existing.id,
        fromStatus: existing.status,
        toStatus: nextStatus,
      });
    }

    return { success: true };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    console.error("[PATCH /api/admin/service-orders/:id/status]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถอัปเดตสถานะรายการรับผ้าได้",
    });
  }
});
