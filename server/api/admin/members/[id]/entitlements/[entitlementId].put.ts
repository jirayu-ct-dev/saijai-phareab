import { z } from "zod/v4";
import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";

const schema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "EXPIRED", "CANCELLED"]).optional(),
  creditRemaining: z.number().int().min(0).nullish(),
  creditInitial: z.number().int().min(0).nullish(),
  startAt: z.string().datetime().nullish(),
  endAt: z.string().datetime().nullish(),
  productId: z.string().min(1).optional(),
});

export default defineEventHandler(async (event) => {
  requireRole(event, ["ADMIN"]);
  const id = getRouterParam(event, "id");
  const entitlementId = getRouterParam(event, "entitlementId");
  if (!id || !entitlementId) throw createError({ statusCode: 400, statusMessage: "Missing id" });

  const ent = await prisma.memberEntitlement.findFirst({
    where: { id: entitlementId, customerId: id, deletedAt: null },
    select: { id: true },
  });
  if (!ent) throw createError({ statusCode: 404, statusMessage: "ไม่พบแพ็กเกจ" });

  const body = await readValidatedBody(event, schema.parse);

  if (body.productId) {
    const product = await prisma.packageProduct.findFirst({
      where: { id: body.productId, deletedAt: null },
      select: { id: true },
    });
    if (!product) throw createError({ statusCode: 400, statusMessage: "ไม่พบแพ็กเกจที่เลือก" });
  }

  const updated = await prisma.memberEntitlement.update({
    where: { id: entitlementId },
    data: {
      status: body.status ?? undefined,
      creditRemaining: body.creditRemaining ?? undefined,
      creditInitial: body.creditInitial ?? undefined,
      startAt: body.startAt === undefined ? undefined : body.startAt ? new Date(body.startAt) : null,
      endAt: body.endAt === undefined ? undefined : body.endAt ? new Date(body.endAt) : null,
      productId: body.productId ?? undefined,
    },
    select: { id: true },
  });

  return { success: true, id: updated.id };
});
