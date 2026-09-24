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
  const id = getRouterParam(event, "id");
  if (!id) throw createError({ statusCode: 400, statusMessage: "ไม่พบรหัสบริการแพ็กเกจ" });
  const body = await readValidatedBody(event, schema.parse);
  const includedItemIds = [...new Set(body.includedItemIds)];

  const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.packageService.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw createError({ statusCode: 404, statusMessage: "ไม่พบบริการแพ็กเกจที่ต้องการแก้ไข" });

    const existingItems = await tx.packageServiceIncludedItem.findMany({
      where: { packageServiceId: id },
      select: { storefrontItemId: true },
    });
    const existingItemIds = new Set(existingItems.map((item) => item.storefrontItemId));
    const activeItems = await tx.storefrontItem.findMany({
      where: { id: { in: includedItemIds }, isActive: true, deletedAt: null },
      select: { id: true },
    });
    const selectableItemIds = new Set([...existingItemIds, ...activeItems.map((item) => item.id)]);
    if (includedItemIds.some((itemId) => !selectableItemIds.has(itemId))) {
      throw createError({ statusCode: 400, statusMessage: "มีรายการผ้าที่ไม่พบหรือปิดใช้งานแล้ว" });
    }

    await tx.packageServiceIncludedItem.deleteMany({ where: { packageServiceId: id } });
    const service = await tx.packageService.update({
      where: { id },
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
    return service;
  });

  const { includedItems, ...result } = updated;
  return { ...result, includedItemIds: includedItems.map((item) => item.storefrontItemId) };
});
