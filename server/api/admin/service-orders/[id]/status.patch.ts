import type { ServiceOrderStatus } from "~~/shared/types/enums";
import type { Prisma } from "~~/app/generated/prisma/client";
import { requireRole } from "~~/server/utils/auth";
import { notifyServiceOrderStatusChanged } from "~~/server/utils/notify";
import { prisma } from "~~/server/utils/prisma";
import { deductAddonUsageRecords, refundAddonUsages, refundPrimaryCredit, voidPendingAddonUsageRecords } from "~~/server/utils/serviceOrderCredits";
import { canTransitionServiceOrderStatus, isServiceOrderStatus, resolveServiceOrderCompletedAt } from "~~/server/utils/serviceOrderStatusTransition";

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
        completedAt: true,
        memberEntitlementId: true,
        creditUsed: true,
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
      const transitionAt = new Date();
      const shouldRefundCredits = existing.status !== "CANCELLED" && nextStatus === "CANCELLED";
      const shouldDeductCompletedAddons = existing.status !== "CANCELLED" && nextStatus === "COMPLETED";
      if (shouldRefundCredits) {
        await refundPrimaryCredit(tx, {
          memberEntitlementId: existing.memberEntitlementId,
          creditUsed: existing.creditUsed,
        });
        await refundAddonUsages(tx, existing.id);
        await voidPendingAddonUsageRecords(tx, existing.id);
      }

      if (shouldDeductCompletedAddons) {
        await deductAddonUsageRecords(tx, existing.id, "COMPLETED");
      }

      const updateData: Prisma.ServiceOrderUncheckedUpdateManyInput = {
        status: nextStatus,
        completedAt: resolveServiceOrderCompletedAt({
          fromStatus: existing.status,
          toStatus: nextStatus,
          currentCompletedAt: existing.completedAt,
          transitionAt,
        }),
      };

      if (shouldRefundCredits) {
        updateData.creditUsed = null;
        updateData.memberEntitlementId = null;
      }

      const { count } = await tx.serviceOrder.updateMany({
        where: { id, status: existing.status, deletedAt: null },
        data: updateData,
      });
      if (count !== 1) {
        throw createError({
          statusCode: 409,
          statusMessage: "สถานะรายการรับผ้าถูกเปลี่ยนโดยผู้ใช้อื่น กรุณาลองใหม่",
          data: { code: "SERVICE_ORDER_STATUS_CONFLICT" },
        });
      }
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
