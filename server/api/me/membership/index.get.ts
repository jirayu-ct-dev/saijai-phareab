import { requireUser } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

export default defineEventHandler(async (event) => {
  const user = requireUser(event);

  try {
    const entitlements = await prisma.memberEntitlement.findMany({
      where: {
        customerId: user.id,
        deletedAt: null,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            packageType: true,
            price: true,
          }
        }
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' }
      ]
    });

    return entitlements.map(ent => ({
      id: ent.id,
      productId: ent.product.id,
      productName: ent.product.name,
      packageType: ent.product.packageType,
      status: ent.status,
      creditInitial: ent.creditInitial,
      creditRemaining: ent.creditRemaining,
      startAt: ent.startAt?.toISOString() || null,
      endAt: ent.endAt?.toISOString() || null,
      activatedAt: ent.activatedAt?.toISOString() || null,
    }));
  } catch (error) {
    console.error("[GET /api/me/membership]", error);
    throw createError({ statusCode: 500, statusMessage: "ไม่สามารถโหลดข้อมูลแพ็กเกจได้" });
  }
});
