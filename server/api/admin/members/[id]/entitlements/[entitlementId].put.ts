import { z } from "zod/v4";
import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { parseBangkokDateTime } from "~~/shared/utils/pickup";

const schema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "EXPIRED", "CANCELLED"]).optional(),
  creditRemaining: z.number().int().min(0).nullish(),
  creditInitial: z.number().int().min(0).nullish(),
  startAt: z.string().nullish(),
  endAt: z.string().nullish(),
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
  const startAt = body.startAt === undefined ? undefined : body.startAt ? parseBangkokDateTime(body.startAt) : null;
  const endAt = body.endAt === undefined ? undefined : body.endAt ? parseBangkokDateTime(body.endAt) : null;

  if ((startAt && Number.isNaN(startAt.getTime())) || (endAt && Number.isNaN(endAt.getTime()))) {
    throw createError({ statusCode: 400, statusMessage: "วันที่แพ็กเกจไม่ถูกต้อง" });
  }

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
      startAt,
      endAt,
      productId: body.productId ?? undefined,
    },
    select: { id: true },
  });

  return { success: true, id: updated.id };
});
