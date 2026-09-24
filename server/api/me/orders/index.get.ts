import { requireUser } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { computeOrderCreditSnapshots } from "~~/server/utils/serviceOrderCredits";
import { z } from "zod";

const toNumber = (value: unknown) => Number(value ?? 0);

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(10),
  status: z.enum(["RECEIVED", "PROCESSING", "DELIVERING", "COMPLETED", "CANCELLED"]).optional(),
});

export default defineEventHandler(async (event) => {
  const user = requireUser(event);
  const query = await getValidatedQuery(event, (data) => querySchema.parse(data));

  const where: any = {
    customerId: user.id,
    deletedAt: null,
  };

  if (query.status) {
    where.status = query.status;
  }

  try {
    const [rows, total] = await Promise.all([
      prisma.serviceOrder.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          serviceOrderItems: {
            where: { deletedAt: null },
            include: {
              storefrontPrice: {
                include: {
                  storefrontService: { select: { name: true } },
                  storefrontItem: { select: { name: true } }
                }
              },
              storefrontItem: { select: { id: true, name: true } },
            }
          },
          payments: {
            where: { deletedAt: null },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { id: true, status: true, paidAt: true, method: true }
          },
          memberEntitlement: {
            select: { id: true, creditInitial: true, creditRemaining: true }
          },
          customer: {
            select: { id: true, name: true, email: true, phoneNumber: true, image: true }
          }
        }
      }),
      prisma.serviceOrder.count({ where })
    ]);

    const snapshots = await computeOrderCreditSnapshots(rows);

    const data = rows.map(row => {
      const payment = row.payments[0] ?? null;
      const snapshot = snapshots.get(row.id);

      return {
        id: row.id,
        orderNo: row.orderNo,
        status: row.status,
        receivedAt: row.receivedAt.toISOString(),
        dueAt: row.dueAt?.toISOString() ?? null,
        totalAmount: toNumber(row.totalAmount),
        creditUsed: row.creditUsed,
        note: row.note,
        items: row.serviceOrderItems.map((item) => ({
          label: item.weightKg != null
            ? (item.weightLabel || "ซัก-พับ ชั่งกิโล")
            : `${item.storefrontPrice?.storefrontService?.name ?? ""} ${item.storefrontPrice?.storefrontItem?.name ?? item.storefrontItem?.name ?? ""}`.trim(),
          quantity: item.quantity,
          totalPrice: toNumber(item.totalPrice),
          isPackageIncluded: item.isPackageIncluded,
          isChargeable: item.isChargeable,
        })),
        payment: payment ? {
          id: payment.id,
          status: payment.status,
          paidAt: payment.paidAt?.toISOString() ?? null,
          method: payment.method
        } : null,
        memberEntitlement: row.memberEntitlement
          ? {
              id: row.memberEntitlement.id,
              creditInitial: row.memberEntitlement.creditInitial,
              creditRemaining: row.memberEntitlement.creditRemaining,
              orderCreditRemaining: snapshot?.orderCreditRemaining ?? row.memberEntitlement.creditRemaining,
              isOrderNegative: snapshot?.isOrderNegative ?? false,
              isSettled: snapshot?.isSettled ?? false,
              orderCreditShortfall: snapshot?.orderCreditShortfall ?? 0,
            }
          : null,
        customer: row.customer,
        itemCount: row.serviceOrderItems.length,
      };
    });

    return {
      data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize)
      }
    };
  } catch (error) {
    console.error("[GET /api/me/orders]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถโหลดรายการออเดอร์ได้"
    });
  }
});
