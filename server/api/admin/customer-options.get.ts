import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";
import { getWalkInCustomerEmail } from "~~/server/utils/walkInCustomer";

export default defineEventHandler(async (event) => {
  await requireRole(event, ["EMPLOYEE", "ADMIN"]);

  try {
    const users = await prisma.user.findMany({
      where: {
        deletedAt: null,
        email: {
          not: getWalkInCustomerEmail(),
        },
        // role: "USER",
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        image: true,
        memberEntitlements: {
          where: {
            deletedAt: null,
            status: "ACTIVE",
          },
          orderBy: [
            { product: { packageType: "asc" } },
            { endAt: "asc" },
            { createdAt: "desc" },
          ],
          select: {
            id: true,
            creditInitial: true,
            creditRemaining: true,
            endAt: true,
            product: {
              select: {
                id: true,
                name: true,
                packageType: true,
                deductOn: true,
                isDelivery: true,
              },
            },
          },
        },
      },
      orderBy: [
        { name: "asc" },
        { createdAt: "desc" },
      ],
    });

    return users.map((user) => {
      const activeMemberEntitlement = user.memberEntitlements.find((entitlement) => entitlement.product.packageType === "MAIN") ?? null;
      const activeAddonEntitlements = user.memberEntitlements.filter((entitlement) => entitlement.product.packageType === "ADDON");

      return {
        id: user.id,
        label: `${user.name || user.email}${user.phoneNumber ? ` (${user.phoneNumber})` : ""}`,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        image: user.image,
        activeMemberEntitlement: activeMemberEntitlement
          ? {
              id: activeMemberEntitlement.id,
              productId: activeMemberEntitlement.product.id,
              productName: activeMemberEntitlement.product.name,
              creditInitial: activeMemberEntitlement.creditInitial,
              creditRemaining: activeMemberEntitlement.creditRemaining,
              endAt: activeMemberEntitlement.endAt?.toISOString() ?? null,
            }
          : null,
        addonEntitlements: activeAddonEntitlements.map((entitlement) => ({
          id: entitlement.id,
          productId: entitlement.product.id,
          productName: entitlement.product.name,
          creditInitial: entitlement.creditInitial,
          creditRemaining: entitlement.creditRemaining,
          endAt: entitlement.endAt?.toISOString() ?? null,
          deductOn: entitlement.product.deductOn,
          isDelivery: entitlement.product.isDelivery,
        })),
      };
    });
  } catch (error) {
    console.error("[GET /api/admin/customer-options]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถโหลดรายชื่อลูกค้าได้",
    });
  }
});
