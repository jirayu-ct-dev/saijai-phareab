import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async () => {
  try {
    const prices = await prisma.storefrontPrice.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        storefrontService: {
          deletedAt: null,
          isActive: true,
        },
        storefrontItem: {
          deletedAt: null,
          isActive: true,
        },
      },
      select: {
        id: true,
        price: true,
        storefrontService: {
          select: {
            id: true,
            name: true,
          },
        },
        storefrontItem: {
          select: {
            id: true,
            name: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { storefrontService: { name: "asc" } },
        { storefrontItem: { name: "asc" } },
      ],
    });

    return prices.map((price) => ({
      id: price.id,
      price: Number(price.price),
      categoryId: price.storefrontItem.category?.id ?? null,
      categoryName: price.storefrontItem.category?.name ?? null,
      serviceId: price.storefrontService.id,
      serviceName: price.storefrontService.name,
      itemId: price.storefrontItem.id,
      itemName: price.storefrontItem.name,
      label: `${price.storefrontService.name} ${price.storefrontItem.name}`.trim(),
    }));
  } catch (error) {
    console.error("[GET /api/admin/storefront-catalog]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Unable to load storefront catalog",
    });
  }
});
