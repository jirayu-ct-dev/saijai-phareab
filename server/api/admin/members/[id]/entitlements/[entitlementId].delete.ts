import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { syncLineRichMenuForUser } from "~~/server/utils/line-richmenu";

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["ADMIN"]);
  const id = getRouterParam(event, "id");
  const entitlementId = getRouterParam(event, "entitlementId");
  if (!id || !entitlementId) throw createError({ statusCode: 400, statusMessage: "Missing id" });

  const ent = await prisma.memberEntitlement.findFirst({
    where: { id: entitlementId, customerId: id, deletedAt: null },
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
  });
  if (!ent) throw createError({ statusCode: 404, statusMessage: "ไม่พบแพ็กเกจ" });

  if (ent.serviceOrders.length > 0 || ent.serviceOrderAddonUsages.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: "ไม่สามารถลบแพ็กเกจที่มีการใช้งานไปแล้ว",
    });
  }

  await prisma.memberEntitlement.update({
    where: { id: entitlementId },
    data: {
      deletedAt: new Date(),
      deletedById: actor.id,
      status: "CANCELLED",
    },
  });

  try {
    await syncLineRichMenuForUser(id);
  } catch (error) {
    console.warn("[DELETE /api/admin/members/:id/entitlements/:entitlementId] LINE rich menu sync failed", error);
  }

  return { success: true };
});
