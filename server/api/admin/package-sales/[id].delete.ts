import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบรหัสรายการขาย" });
  }

  try {
    const existingSale = await prisma.packageSale.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        customerId: true,
        items: {
          select: {
            id: true,
            memberEntitlements: {
              where: { deletedAt: null },
              select: {
                id: true,
                serviceOrders: {
                  where: { deletedAt: null },
                  select: { id: true },
                  take: 1,
                },
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
        payments: {
          where: { deletedAt: null },
          select: { id: true },
        },
      },
    });

    if (!existingSale) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบรายการขายที่ต้องการลบ" });
    }

    const hasUsedEntitlement = existingSale.items.some((item) =>
      item.memberEntitlements.some((entitlement) =>
        entitlement.serviceOrders.length > 0 || entitlement.serviceOrderAddonUsages.length > 0,
      ),
    );

    if (hasUsedEntitlement) {
      throw createError({
        statusCode: 409,
        statusMessage: "ไม่สามารถลบรายการขายที่มีการใช้งานสิทธิ์ไปแล้ว",
      });
    }

    const itemIds = existingSale.items.map((item) => item.id);

    await prisma.$transaction(async (tx) => {
      await tx.packageSale.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedById: actor.id,
          status: "CANCELLED",
        },
      });

      if (existingSale.payments.length > 0) {
        await tx.paymentRecord.updateMany({
          where: { id: { in: existingSale.payments.map((payment) => payment.id) } },
          data: {
            deletedAt: new Date(),
            deletedById: actor.id,
          },
        });
      }

      if (itemIds.length > 0) {
        await tx.memberEntitlement.updateMany({
          where: {
            sourceSaleItemId: { in: itemIds },
            deletedAt: null,
          },
          data: {
            deletedAt: new Date(),
            deletedById: actor.id,
            status: "CANCELLED",
          },
        });
      }
    });

    return { success: true };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    console.error("[DELETE /api/admin/package-sales/:id]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Unable to delete package sale",
    });
  }
});
