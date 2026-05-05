import { requireUser } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);

  try {
    const [
      totalOrders,
      activeOrders,
      totalSpentResult
    ] = await Promise.all([
      prisma.serviceOrder.count({
        where: { customerId: user.id, deletedAt: null }
      }),
      prisma.serviceOrder.count({
        where: { 
          customerId: user.id, 
          status: { in: ["RECEIVED", "PROCESSING", "DELIVERING"] },
          deletedAt: null 
        }
      }),
      prisma.serviceOrder.aggregate({
        where: { customerId: user.id, status: "COMPLETED", deletedAt: null },
        _sum: { totalAmount: true }
      })
    ]);

    const recentOrders = await prisma.serviceOrder.findMany({
      where: { customerId: user.id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        orderNo: true,
        status: true,
        receivedAt: true,
        totalAmount: true,
      }
    });

    const activeEntitlements = await prisma.memberEntitlement.findMany({
      where: { 
        customerId: user.id, 
        status: "ACTIVE", 
        deletedAt: null 
      },
      include: {
        product: {
          select: { name: true }
        }
      }
    });

    return {
      stats: {
        totalOrders,
        activeOrders,
        totalSpent: Number(totalSpentResult._sum.totalAmount || 0),
      },
      recentOrders: recentOrders.map(order => ({
        ...order,
        receivedAt: order.receivedAt.toISOString(),
        totalAmount: Number(order.totalAmount || 0),
      })),
      activeEntitlements: activeEntitlements.map(ent => ({
        id: ent.id,
        productName: ent.product.name,
        creditInitial: ent.creditInitial,
        creditRemaining: ent.creditRemaining,
        endAt: ent.endAt?.toISOString() || null,
      }))
    };
  } catch (error) {
    console.error("[GET /api/me]", error);
    throw createError({ statusCode: 500, statusMessage: "ไม่สามารถโหลดข้อมูลแดชบอร์ดได้" });
  }
});
