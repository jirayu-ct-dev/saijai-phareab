import { z } from "zod";
import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";

const schema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อบริการ").max(120),
  description: z.string().trim().max(1000).optional(),
  includedItemIds: z.array(z.string().trim().min(1)).max(500),
}).strict();

export default defineEventHandler(async (event) => {
  await requireRole(event, ["ADMIN"]);
  const body = await readValidatedBody(event, schema.parse);
  const includedItemIds = [...new Set(body.includedItemIds)];
  const activeItems = includedItemIds.length
    ? await prisma.storefrontItem.findMany({
      where: { id: { in: includedItemIds }, isActive: true, deletedAt: null },
      select: { id: true },
    })
    : [];
  if (activeItems.length !== includedItemIds.length) {
    throw createError({ statusCode: 400, statusMessage: "มีรายการผ้าที่ไม่พบหรือปิดใช้งานแล้ว" });
  }

  const service = await prisma.packageService.create({
    data: {
      name: body.name,
      description: body.description || null,
      ...(includedItemIds.length ? {
        includedItems: {
          createMany: { data: includedItemIds.map((storefrontItemId) => ({ storefrontItemId })) },
        },
      } : {}),
    },
    include: { includedItems: { select: { storefrontItemId: true } } },
  });
  const { includedItems, ...result } = service;
  return { ...result, includedItemIds: includedItems.map((item) => item.storefrontItemId) };
});
