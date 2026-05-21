import { prisma } from "~~/server/utils/prisma";
import { requireRole } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireRole(event, ["EMPLOYEE", "ADMIN"]);

  try {
    const products = await prisma.packageProduct.findMany({
      where: {
        deletedAt: null,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        packageType: true,
        isDelivery: true,
        price: true,
        credits: true,
        validityDays: true,
      },
      orderBy: [
        { packageType: "asc" },
        { name: "asc" },
      ],
    });

    return products.map((product) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      packageType: product.packageType,
      isDelivery: product.isDelivery,
      price: Number(product.price),
      credits: product.credits,
      validityDays: product.validityDays,
    }));
  } catch (error) {
    console.error("[GET /api/admin/package-catalog]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Unable to load package catalog",
    });
  }
});
