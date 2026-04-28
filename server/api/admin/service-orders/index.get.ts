import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

const toNumber = (value: unknown) => Number(value ?? 0);

export default defineEventHandler(async (event) => {
  requireRole(event, ["EMPLOYEE", "ADMIN"]);

  try {
    const rows = await prisma.serviceOrder.findMany({
      where: {
        deletedAt: null,
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            image: true,
          },
        },
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        memberEntitlement: {
          select: {
            id: true,
            status: true,
            creditInitial: true,
            creditRemaining: true,
            endAt: true,
            product: {
              select: {
                id: true,
                name: true,
                packageType: true,
                credits: true,
                validityDays: true,
              },
            },
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
            image: {
              select: {
                id: true,
                secureUrl: true,
                url: true,
              },
            },
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
          include: {
            slipImage: {
              select: {
                id: true,
                secureUrl: true,
                url: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return rows.map((row) => {
      const payment = row.payments[0] ?? null;
      const hangerCharge = (row.hangerCharge ?? null) as
        | { count?: number; pricePerUnit?: number; total?: number }
        | null;

      return {
        id: row.id,
        orderNo: row.orderNo,
        status: row.status,
        isWalkIn: row.isWalkIn,
        walkInName: row.walkInName,
        walkInPhone: row.walkInPhone,
        note: row.note,
        creditUsed: row.creditUsed,
        receivedAt: row.receivedAt.toISOString(),
        dueAt: row.dueAt?.toISOString() ?? null,
        subtotalAmount: toNumber(row.subtotalAmount),
        discountAmount: toNumber(row.discountAmount),
        totalAmount: toNumber(row.totalAmount),
        weightKg: row.weightKg != null ? toNumber(row.weightKg) : null,
        washFoldPricePerKgSnapshot: row.washFoldPricePerKgSnapshot != null ? toNumber(row.washFoldPricePerKgSnapshot) : null,
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
        memberEntitlement: row.memberEntitlement
          ? {
              id: row.memberEntitlement.id,
              status: row.memberEntitlement.status,
              creditInitial: row.memberEntitlement.creditInitial,
              creditRemaining: row.memberEntitlement.creditRemaining,
              endAt: row.memberEntitlement.endAt?.toISOString() ?? null,
              product: row.memberEntitlement.product,
            }
          : null,
        hangerCharge: hangerCharge
          ? {
              count: Number(hangerCharge.count ?? 0),
              pricePerUnit: Number(hangerCharge.pricePerUnit ?? 0),
              total: Number(hangerCharge.total ?? 0),
            }
          : null,
        customer: {
          id: row.customer.id,
          name: row.isWalkIn ? row.walkInName || "ลูกค้าหน้าร้าน" : row.customer.name,
          email: row.isWalkIn ? "ลูกค้าหน้าร้าน" : row.customer.email,
          phoneNumber: row.isWalkIn ? row.walkInPhone || null : row.customer.phoneNumber,
          image: row.isWalkIn ? null : row.customer.image,
        },
        employee: row.employee,
        items: row.serviceOrderItems.map((item) => ({
          id: item.id,
          storefrontPriceId: item.storefrontPriceId,
          label: item.weightKg != null
            ? (item.weightLabel || "ซัก-พับ ชั่งกิโล")
            : `${item.storefrontPrice?.storefrontService.name ?? ""} ${item.storefrontPrice?.storefrontItem.name ?? ""}`.trim(),
          quantity: item.quantity,
          unitPrice: toNumber(item.unitPrice),
          totalPrice: toNumber(item.totalPrice),
          notes: item.notes,
          isPackageIncluded: item.isPackageIncluded,
          weightKg: item.weightKg != null ? toNumber(item.weightKg) : null,
          weightLabel: item.weightLabel ?? null,
          image: item.image
            ? {
                id: item.image.id,
                secureUrl: item.image.secureUrl,
                url: item.image.url,
              }
            : null,
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
              amount: toNumber(payment.amount),
              paidAt: payment.paidAt?.toISOString() ?? null,
              slipImage: payment.slipImage
                ? {
                    id: payment.slipImage.id,
                    secureUrl: payment.slipImage.secureUrl,
                    url: payment.slipImage.url,
                  }
                : null,
            }
          : null,
      };
    });
  } catch (error) {
    console.error("[GET /api/admin/service-orders]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถโหลดรายการรับผ้าได้",
    });
  }
});
