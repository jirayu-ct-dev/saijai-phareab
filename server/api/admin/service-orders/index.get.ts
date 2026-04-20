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
        serviceOrderItems: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            createdAt: "asc",
          },
          include: {
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
        receivedAt: row.receivedAt.toISOString(),
        dueAt: row.dueAt?.toISOString() ?? null,
        subtotalAmount: toNumber(row.subtotalAmount),
        discountAmount: toNumber(row.discountAmount),
        totalAmount: toNumber(row.totalAmount),
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
          label: `${item.storefrontPrice.storefrontService.name} ${item.storefrontPrice.storefrontItem.name}`.trim(),
          quantity: item.quantity,
          unitPrice: toNumber(item.unitPrice),
          totalPrice: toNumber(item.totalPrice),
          notes: item.notes,
        })),
        payment: payment
          ? {
              id: payment.id,
              paymentNo: payment.paymentNo,
              paymentMethod: payment.paymentMethod,
              status: payment.status,
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
