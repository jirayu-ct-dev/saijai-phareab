import { requireUser } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
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
          _count: {
            select: { serviceOrderItems: { where: { deletedAt: null } } }
          }
        }
      }),
      prisma.serviceOrder.count({ where })
    ]);

    const data = rows.map(row => ({
      id: row.id,
      orderNo: row.orderNo,
      status: row.status,
      receivedAt: row.receivedAt.toISOString(),
      dueAt: row.dueAt?.toISOString() ?? null,
      totalAmount: toNumber(row.totalAmount),
      itemCount: row._count.serviceOrderItems,
    }));

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
