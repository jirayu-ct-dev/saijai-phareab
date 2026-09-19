type ServiceItemLookup = {
  storefrontItem: {
    findMany: (args: object) => Promise<Array<{ id: string }>>;
  };
};

export const validateServiceIncludedItemIds = async (
  client: ServiceItemLookup,
  itemIds: string[],
): Promise<string[]> => {
  const uniqueItemIds = [...new Set(itemIds)];
  const items = await client.storefrontItem.findMany({
    where: { id: { in: uniqueItemIds }, deletedAt: null, isActive: true },
    select: { id: true },
  });
  const validIds = new Set(items.map((item) => item.id));
  if (uniqueItemIds.some((itemId) => !validIds.has(itemId))) {
    throw createError({ statusCode: 400, statusMessage: "มีรายการผ้าบางรายการไม่ถูกต้องหรือถูกปิดใช้งาน" });
  }
  return uniqueItemIds;
};
