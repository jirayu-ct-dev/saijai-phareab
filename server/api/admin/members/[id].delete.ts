import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["ADMIN"]);
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "Missing id" });

  const target = await prisma.user.findFirst({
    where: { id, deletedAt: null, role: "USER" },
    select: {
      id: true,
      email: true,
      memberEntitlements: {
        where: { deletedAt: null },
        select: {
          id: true,
          serviceOrders: { where: { deletedAt: null }, select: { id: true }, take: 1 },
        },
      },
    },
  });
  if (!target) throw createError({ statusCode: 404, statusMessage: "ไม่พบลูกค้า" });
  if (target.email === "walkin@saijai.local") {
    throw createError({ statusCode: 400, statusMessage: "ห้ามลบลูกค้าหน้าร้าน" });
  }

  const hasUsedEntitlement = target.memberEntitlements.some((e) => e.serviceOrders.length > 0);
  if (hasUsedEntitlement) {
    throw createError({
      statusCode: 409,
      statusMessage: "ไม่สามารถลบลูกค้าที่มีการใช้สิทธิ์แพ็กเกจไปแล้ว",
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.memberEntitlement.updateMany({
      where: { customerId: id, deletedAt: null },
      data: { deletedAt: new Date(), deletedById: actor.id, status: "CANCELLED" },
    });
    await tx.session.deleteMany({ where: { userId: id } });
    await tx.user.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: actor.id },
    });
  });

  return { success: true };
});
