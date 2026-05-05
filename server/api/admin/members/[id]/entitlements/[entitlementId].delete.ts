import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["ADMIN"]);
  const id = getRouterParam(event, "id");
  const entitlementId = getRouterParam(event, "entitlementId");
  if (!id || !entitlementId) throw createError({ statusCode: 400, statusMessage: "Missing id" });

  const ent = await prisma.memberEntitlement.findFirst({
    where: { id: entitlementId, customerId: id, deletedAt: null },
    select: { id: true },
  });
  if (!ent) throw createError({ statusCode: 404, statusMessage: "ไม่พบแพ็กเกจ" });

  await prisma.memberEntitlement.update({
    where: { id: entitlementId },
    data: {
      deletedAt: new Date(),
      deletedById: actor.id,
      status: "CANCELLED",
    },
  });

  return { success: true };
});
