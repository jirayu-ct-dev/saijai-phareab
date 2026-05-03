import { requireUser } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

const toNumber = (value: unknown) => Number(value ?? 0);

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Bad Request" });
  }

  try {
    const row = await prisma.serviceOrder.findFirst({
      where: {
        id,
        customerId: user.id,
        deletedAt: null,
      },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
          },
        },
        image: {
          select: {
            id: true,
            secureUrl: true,
            url: true,
          },
        },
        deliveryImage: {
          select: {
            id: true,
            secureUrl: true,
            url: true,
          },
        },
        serviceOrderItems: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            createdAt: "asc",
          },
          include: {
            photos: {
              where: { deletedAt: null },
              orderBy: { sortOrder: "asc" },
              include: {
                image: {
                  select: {
                    id: true,
                    secureUrl: true,
                    url: true,
                  },
                },
              },
            },
            storefrontPrice: {
              include: {
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
                  },
                },
              },
            },
          },
        },
        payments: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    });

    if (!row) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบออเดอร์" });
    }

    const payment = row.payments[0] ?? null;
    const hangerCharge = (row.hangerCharge ?? null) as
      | { count?: number; pricePerUnit?: number; total?: number }
      | null;

    return {
      id: row.id,
      orderNo: row.orderNo,
      status: row.status,
      note: row.note,
      creditUsed: row.creditUsed,
      receivedAt: row.receivedAt.toISOString(),
      dueAt: row.dueAt?.toISOString() ?? null,
      subtotalAmount: toNumber(row.subtotalAmount),
      discountAmount: toNumber(row.discountAmount),
      totalAmount: toNumber(row.totalAmount),
      image: row.image
        ? {
            id: row.image.id,
            secureUrl: row.image.secureUrl,
            url: row.image.url,
          }
        : null,
      deliveryImage: row.deliveryImage
        ? {
            id: row.deliveryImage.id,
            secureUrl: row.deliveryImage.secureUrl,
            url: row.deliveryImage.url,
          }
        : null,
      hangerCharge: hangerCharge
        ? {
            count: Number(hangerCharge.count ?? 0),
            pricePerUnit: Number(hangerCharge.pricePerUnit ?? 0),
            total: Number(hangerCharge.total ?? 0),
          }
        : null,
      employee: row.employee,
      items: row.serviceOrderItems.map((item) => ({
        id: item.id,
        label: item.weightKg != null
          ? (item.weightLabel || "ซัก-พับ ชั่งกิโล")
          : `${item.storefrontPrice?.storefrontService.name ?? ""} ${item.storefrontPrice?.storefrontItem.name ?? ""}`.trim(),
        quantity: item.quantity,
        unitPrice: toNumber(item.unitPrice),
        totalPrice: toNumber(item.totalPrice),
        notes: item.notes,
        isPackageIncluded: item.isPackageIncluded,
        photos: item.photos.map((photo) => ({
          id: photo.id,
          imageId: photo.imageId,
          isDamaged: photo.isDamaged,
          sortOrder: photo.sortOrder,
          secureUrl: photo.image?.secureUrl ?? null,
          url: photo.image?.url ?? null,
        })),
      })),
      payment: payment
        ? {
            id: payment.id,
            paymentNo: payment.paymentNo,
          }
        : null,
    };
  } catch (error) {
    console.error("[GET /api/me/orders/[id]]", error);
    if ((error as any).statusCode === 404) throw error;
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถโหลดรายละเอียดออเดอร์ได้"
    });
  }
});
