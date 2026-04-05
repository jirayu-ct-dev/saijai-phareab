import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

const toNumber = (value: unknown) => Number(value ?? 0);

export default defineEventHandler(async (event) => {
  requireRole(event, ["EMPLOYEE", "ADMIN"]);

  const id = getRouterParam(event, "id");
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "Missing service order id" });
  }

  const serviceOrder = await prisma.serviceOrder.findFirst({
    where: {
      id,
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
        orderBy: { createdAt: "asc" },
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
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          paymentNo: true,
          paymentMethod: true,
          status: true,
          amount: true,
          paidAt: true,
        },
      },
    },
  });

  if (!serviceOrder) {
    throw createError({ statusCode: 404, statusMessage: "Service order not found" });
  }

  const hangerCharge = (serviceOrder.hangerCharge ?? null) as
    | { count?: number; pricePerUnit?: number; total?: number }
    | null;

  return {
    id: serviceOrder.id,
    orderNo: serviceOrder.orderNo,
    status: serviceOrder.status,
    note: serviceOrder.note,
    receivedAt: serviceOrder.receivedAt.toISOString(),
    dueAt: serviceOrder.dueAt?.toISOString() ?? null,
    subtotalAmount: toNumber(serviceOrder.subtotalAmount),
    discountAmount: toNumber(serviceOrder.discountAmount),
    totalAmount: toNumber(serviceOrder.totalAmount),
    hangerCharge: hangerCharge
      ? {
          count: Number(hangerCharge.count ?? 0),
          pricePerUnit: Number(hangerCharge.pricePerUnit ?? 0),
          total: Number(hangerCharge.total ?? 0),
        }
      : null,
    customer: {
      id: serviceOrder.customer.id,
      name: serviceOrder.isWalkIn ? serviceOrder.walkInName || "ลูกค้าหน้าร้าน" : serviceOrder.customer.name,
      email: serviceOrder.isWalkIn ? "ลูกค้าหน้าร้าน" : serviceOrder.customer.email,
      phoneNumber: serviceOrder.isWalkIn ? serviceOrder.walkInPhone : serviceOrder.customer.phoneNumber,
      image: serviceOrder.isWalkIn ? null : serviceOrder.customer.image,
    },
    isWalkIn: serviceOrder.isWalkIn,
    walkInName: serviceOrder.walkInName,
    walkInPhone: serviceOrder.walkInPhone,
    employee: serviceOrder.employee,
    items: serviceOrder.serviceOrderItems.map((item) => ({
      id: item.id,
      name: `${item.storefrontPrice.storefrontService.name} ${item.storefrontPrice.storefrontItem.name}`.trim(),
      quantity: item.quantity,
      unitPrice: toNumber(item.unitPrice),
      totalPrice: toNumber(item.totalPrice),
      notes: item.notes,
    })),
    payments: serviceOrder.payments.map((payment) => ({
      id: payment.id,
      paymentNo: payment.paymentNo,
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      amount: toNumber(payment.amount),
      paidAt: payment.paidAt?.toISOString() ?? null,
    })),
  };
});
