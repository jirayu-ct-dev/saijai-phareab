import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireRole(event, ["ADMIN"]);

  const services = await prisma.packageService.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    include: { includedItems: { select: { storefrontItemId: true } } },
  });
  const includedItemIds = [...new Set(services.flatMap((service) => service.includedItems.map((item) => item.storefrontItemId)))];
  const [items, categories] = await Promise.all([
    prisma.storefrontItem.findMany({
      where: {
        OR: [
          { isActive: true, deletedAt: null },
          { id: { in: includedItemIds } },
        ],
      },
      orderBy: [{ categoryId: "asc" }, { name: "asc" }],
      select: { id: true, name: true, categoryId: true, isActive: true, deletedAt: true },
    }),
    prisma.storefrontCategory.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return {
    services: services.map(({ includedItems, ...service }) => ({
      ...service,
      includedItemIds: includedItems.map((item) => item.storefrontItemId),
    })),
    items,
    categories,
  };
});
