import { requireUser } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const entitlementId = getRouterParam(event, "id");

  if (!entitlementId) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request" });
  }

  try {
    const entitlement = await prisma.memberEntitlement.findFirst({
      where: {
        id: entitlementId,
        customerId: user.id,
        deletedAt: null,
      },
      include: {
        product: {
          select: { name: true }
        }
      }
    });

    if (!entitlement) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบแพ็กเกจ" });
    }

    const usages = await prisma.serviceOrder.findMany({
      where: {
        memberEntitlementId: entitlementId,
        deletedAt: null,
      },
      select: {
        id: true,
        orderNo: true,
        receivedAt: true,
        creditUsed: true,
        status: true,
        _count: {
          select: { serviceOrderItems: { where: { deletedAt: null } } }
        }
      },
      orderBy: { receivedAt: 'desc' }
    });

    return {
      entitlement: {
        id: entitlement.id,
        productName: entitlement.product.name,
        creditInitial: entitlement.creditInitial,
        creditRemaining: entitlement.creditRemaining,
        status: entitlement.status,
        startAt: entitlement.startAt?.toISOString() || null,
        endAt: entitlement.endAt?.toISOString() || null,
      },
      usages: usages.map(usage => ({
        orderId: usage.id,
        orderNo: usage.orderNo,
        receivedAt: usage.receivedAt.toISOString(),
        creditUsed: usage.creditUsed,
        itemCount: usage._count.serviceOrderItems,
        status: usage.status,
      }))
    };
  } catch (error) {
    console.error("[GET /api/me/membership/[id]/usage]", error);
    if ((error as any).statusCode === 404) throw error;
    throw createError({ statusCode: 500, statusMessage: "ไม่สามารถโหลดประวัติการใช้งานได้" });
  }
});
