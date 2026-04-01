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
          select: { id: true },
        },
      },
    });

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบรายการชำระเงินที่ต้องการลบ" });
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

      if (existing.memberEntitlement?.id) {
        await tx.memberEntitlement.updateMany({
          where: {
            id: existing.memberEntitlement.id,
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
      statusMessage: "Unable to delete payment",
    });
  }
});
