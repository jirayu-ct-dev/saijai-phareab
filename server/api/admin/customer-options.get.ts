import { prisma } from "~~/server/utils/prisma";
import { getWalkInCustomerEmail } from "~~/server/utils/walkInCustomer";

export default defineEventHandler(async () => {
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
            { endAt: "asc" },
            { createdAt: "desc" },
          ],
          take: 1,
          select: {
            id: true,
            creditInitial: true,
            creditRemaining: true,
            endAt: true,
            product: {
              select: {
                name: true,
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
      const activeMemberEntitlement = user.memberEntitlements[0] ?? null;

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
              productName: activeMemberEntitlement.product.name,
              creditInitial: activeMemberEntitlement.creditInitial,
              creditRemaining: activeMemberEntitlement.creditRemaining,
              endAt: activeMemberEntitlement.endAt?.toISOString() ?? null,
            }
          : null,
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
