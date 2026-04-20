import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบรหัสรายการรับผ้า" });
  }

  try {
    const existing = await prisma.serviceOrder.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบรายการรับผ้าที่ต้องการลบ" });
    }

    await prisma.$transaction(async (tx) => {
      const deletedAt = new Date();

      await tx.serviceOrder.update({
        where: { id },
        data: {
          deletedAt,
          deletedById: actor.id,
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

    return { success: true };
  } catch (error) {
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
