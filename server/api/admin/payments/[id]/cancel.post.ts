import { COMPAT_METRICS, emitCompatFailure, emitCompatTelemetry } from "~~/server/utils/compatTelemetry";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

type CancelPaymentBody = { note?: string | null };

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["ADMIN"]);
  const paymentId = getRouterParam(event, "id");

  if (!paymentId) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบรหัสการชำระเงิน" });
  }

  const body = await readBody<CancelPaymentBody>(event).catch(() => ({} as CancelPaymentBody));

  const existing = await prisma.paymentRecord.findFirst({
    where: { id: paymentId, deletedAt: null },
    select: {
      id: true,
      status: true,
      method: true,
      slipImageId: true,
      packageSaleId: true,
      packageSale: {
        select: {
          customerId: true,
          items: {
            select: {
              memberEntitlements: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  serviceOrders: { where: { deletedAt: null }, select: { id: true }, take: 1 },
                  serviceOrderAddonUsages: {
                    where: {
                      refundedAt: null,
                      serviceOrder: { deletedAt: null },
                    },
                    select: { id: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบการชำระเงิน" });
  }

  if (existing.status === "PAID") {
    throw createError({ statusCode: 409, statusMessage: "ไม่สามารถยกเลิกการชำระเงินที่ยืนยันแล้ว" });
  }

  if (existing.status === "CANCELLED") {
    return { id: paymentId, status: "CANCELLED" as const };
  }

  const packageEntitlements = existing.packageSale?.items.flatMap((item) => item.memberEntitlements) ?? [];
  const hasUsedPackageEntitlement = packageEntitlements.some(
    (entitlement) => entitlement.serviceOrders.length > 0 || entitlement.serviceOrderAddonUsages.length > 0,
  );
  if (hasUsedPackageEntitlement) {
    throw createError({
      statusCode: 409,
      statusMessage: "ไม่สามารถยกเลิกการชำระเงินของแพ็กเกจที่ถูกใช้งานแล้ว",
    });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.paymentRecord.update({
        where: { id: paymentId },
        data: { status: "CANCELLED" },
      });
      await tx.paymentAuditLog.create({
        data: {
          paymentId,
          action: "CANCELLED",
          actorId: actor.id,
          beforeJson: { status: existing.status },
          afterJson: { status: "CANCELLED" },
          note: body.note?.trim() || null,
        },
      });
      if (existing.packageSaleId) {
        await tx.packageSale.update({
          where: { id: existing.packageSaleId },
          data: { status: "CANCELLED" },
        });
      }
      if (packageEntitlements.length > 0) {
        await tx.memberEntitlement.updateMany({
          where: {
            id: { in: packageEntitlements.map((entitlement) => entitlement.id) },
            deletedAt: null,
          },
          data: { status: "CANCELLED" },
        });
      }
    });

    // The payment → package-sale status mirror is a compatibility path during
    // consolidation; report it only after the transaction has committed.
    if (existing.packageSaleId) {
      emitCompatTelemetry({ metric: COMPAT_METRICS.paymentStatusSync, path: "cancel", result: "success" });
    }
  } catch (error) {
    if (existing.packageSaleId) {
      emitCompatFailure(COMPAT_METRICS.paymentStatusSync, "cancel", error);
    }
    throw error;
  }

  return { id: paymentId, status: "CANCELLED" as const };
});
