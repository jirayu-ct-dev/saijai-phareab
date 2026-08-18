import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["ADMIN"]);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบรหัสรายการชำระเงิน" });
  }

  try {
    const existing = await prisma.paymentRecord.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        memberEntitlement: {
          select: { id: true },
        },
        packageSale: {
          select: {
            id: true,
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
      throw createError({ statusCode: 404, statusMessage: "ไม่พบรายการชำระเงินที่ต้องการลบ" });
    }

    const packageEntitlements = existing.packageSale?.items.flatMap((item) => item.memberEntitlements) ?? [];
    const hasUsedPackageEntitlement = packageEntitlements.some(
      (entitlement) => entitlement.serviceOrders.length > 0 || entitlement.serviceOrderAddonUsages.length > 0,
    );
    if (hasUsedPackageEntitlement) {
      throw createError({
        statusCode: 409,
        statusMessage: "ไม่สามารถลบการชำระเงินของแพ็กเกจที่ถูกใช้งานแล้ว",
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.paymentRecord.update({
        where: { id },
        data: {
          deletedAt: new Date(),
          deletedById: actor.id,
        },
      });

      if (existing.packageSale?.id) {
        await tx.packageSale.update({
          where: { id: existing.packageSale.id },
          data: {
            deletedAt: new Date(),
            deletedById: actor.id,
          },
        });
      }

      const entitlementIds = new Set<string>();

      if (existing.memberEntitlement?.id) {
        entitlementIds.add(existing.memberEntitlement.id);
      }

      for (const item of existing.packageSale?.items ?? []) {
        for (const entitlement of item.memberEntitlements) {
          entitlementIds.add(entitlement.id);
        }
      }

      if (entitlementIds.size > 0) {
        await tx.memberEntitlement.updateMany({
          where: {
            id: { in: [...entitlementIds] },
            deletedAt: null,
          },
          data: {
            deletedAt: new Date(),
            deletedById: actor.id,
          },
        });
      }
    });

    return { success: true };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    console.error("[DELETE /api/admin/payments/:id]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถลบรายการชำระเงินได้",
    });
  }
});
