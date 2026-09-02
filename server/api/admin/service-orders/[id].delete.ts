import { COMPAT_METRICS, emitCompatFailure, emitCompatTelemetry } from "~~/server/utils/compatTelemetry";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { refundAddonUsages, refundPrimaryCredit, voidPendingAddonUsageRecords } from "~~/server/utils/serviceOrderCredits";
import type { AddonRefundOutcome } from "~~/server/utils/serviceOrderCredits";

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบรหัสรายการรับผ้า" });
  }

  const attemptedCompatPaths = new Set<"addon-refund">();

  try {
    const existing = await prisma.serviceOrder.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        memberEntitlementId: true,
        creditUsed: true,
        addonUsages: true,
      },
    });

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบรายการรับผ้าที่ต้องการลบ" });
    }

    let refundOutcome: AddonRefundOutcome | undefined;

    await prisma.$transaction(async (tx) => {
      const deletedAt = new Date();

      await refundPrimaryCredit(tx, {
        memberEntitlementId: existing.memberEntitlementId,
        creditUsed: existing.creditUsed,
      });
      attemptedCompatPaths.add("addon-refund");
      refundOutcome = await refundAddonUsages(tx, existing.id, existing.addonUsages);
      await voidPendingAddonUsageRecords(tx, existing.id);

      await tx.serviceOrder.update({
        where: { id },
        data: {
          deletedAt,
          deletedById: actor.id,
          creditUsed: null,
          memberEntitlementId: null,
          addonUsages: [],
        },
      });

      await tx.serviceOrderItem.updateMany({
        where: {
          serviceOrderId: id,
          deletedAt: null,
        },
        data: {
          deletedAt,
          deletedById: actor.id,
        },
      });

      await tx.paymentRecord.updateMany({
        where: {
          serviceOrderId: id,
          deletedAt: null,
        },
        data: {
          deletedAt,
          deletedById: actor.id,
        },
      });
    });

    if (refundOutcome) {
      emitCompatTelemetry({ metric: COMPAT_METRICS.addonRefund, path: "delete", result: refundOutcome });
    }

    return { success: true };
  } catch (error) {
    if (attemptedCompatPaths.has("addon-refund")) {
      emitCompatFailure(COMPAT_METRICS.addonRefund, "delete", error);
    }
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    console.error("[DELETE /api/admin/service-orders/:id]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถลบรายการรับผ้าได้",
    });
  }
});
