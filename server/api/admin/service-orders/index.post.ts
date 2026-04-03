import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";
import { DEFAULT_HANGER_PRICE_PER_UNIT } from "~~/shared/config/posConfig";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";

type CreateServiceOrderBody = {
  customerId: string;
  items: Array<{
    storefrontPriceId: string;
    quantity: number;
  }>;
  hangerCount?: number;
  paymentMethod: PaymentMethod;
  status?: PaymentStatus;
  note?: string | null;
  slipImageId?: string | null;
};

const getServiceOrderStatus = (status: PaymentStatus) => {
  if (status === "VERIFIED") return "RECEIVED" as const;
  if (status === "FAILED") return "CANCELLED" as const;
  return "PENDING" as const;
};

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const body = await readBody<CreateServiceOrderBody>(event);

  if (!body.customerId) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกลูกค้า" });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกบริการอย่างน้อย 1 รายการ" });
  }

  const normalizedItems = body.items
    .map((item) => ({
      storefrontPriceId: item.storefrontPriceId,
      quantity: Number(item.quantity ?? 1),
    }))
    .filter((item) => item.storefrontPriceId);

  if (normalizedItems.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกบริการอย่างน้อย 1 รายการ" });
  }

  if (normalizedItems.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
    throw createError({ statusCode: 400, statusMessage: "จำนวนรายการต้องมากกว่า 0" });
  }

  if (body.hangerCount !== undefined && (!Number.isInteger(body.hangerCount) || body.hangerCount < 0)) {
    throw createError({ statusCode: 400, statusMessage: "จำนวนไม้แขวนต้องเป็น 0 หรือมากกว่า" });
  }

  if (body.paymentMethod !== "CASH" && body.paymentMethod !== "TRANSFER") {
    throw createError({ statusCode: 400, statusMessage: "ช่องทางการชำระเงินไม่ถูกต้อง" });
  }

  if (body.paymentMethod === "TRANSFER" && !body.slipImageId) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาอัปโหลดสลิปสำหรับรายการโอน" });
  }

  const status: PaymentStatus = body.status ?? (body.paymentMethod === "CASH" ? "VERIFIED" : "PENDING");
  const isVerified = status === "VERIFIED";

  try {
    const customer = await prisma.user.findFirst({
      where: {
        id: body.customerId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!customer) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบลูกค้าที่เลือก" });
    }

    const priceIds = [...new Set(normalizedItems.map((item) => item.storefrontPriceId))];
    const storefrontPrices = await prisma.storefrontPrice.findMany({
      where: {
        id: { in: priceIds },
        deletedAt: null,
        isActive: true,
        storefrontService: {
          deletedAt: null,
          isActive: true,
        },
        storefrontItem: {
          deletedAt: null,
          isActive: true,
        },
      },
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
    });

    if (storefrontPrices.length !== priceIds.length) {
      throw createError({ statusCode: 404, statusMessage: "มีรายการบริการบางรายการไม่ถูกต้องหรือถูกปิดใช้งาน" });
    }

    const priceMap = new Map(storefrontPrices.map((item) => [item.id, item]));
    const orderItems = normalizedItems.map((item) => {
      const price = priceMap.get(item.storefrontPriceId);
      if (!price) {
        throw createError({ statusCode: 404, statusMessage: "ไม่พบบริการที่เลือก" });
      }

      const unitPrice = Number(price.price);
      return {
        price,
        quantity: item.quantity,
        unitPrice,
        totalPrice: unitPrice * item.quantity,
      };
    });

    const subtotalAmount = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const hangerCount = body.hangerCount ?? orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const hangerCharge = {
      count: hangerCount,
      pricePerUnit: DEFAULT_HANGER_PRICE_PER_UNIT,
      total: hangerCount * DEFAULT_HANGER_PRICE_PER_UNIT,
    };
    const totalAmount = subtotalAmount + hangerCharge.total;

    const created = await prisma.$transaction(async (tx) => {
      const serviceOrder = await tx.serviceOrder.create({
        data: {
          customerId: body.customerId,
          employeeId: actor.id,
          status: getServiceOrderStatus(status),
          isWalkIn: false,
          hangerCharge,
          totalAmount,
          note: body.note?.trim() || null,
        },
      });

      await tx.serviceOrderItem.createMany({
        data: orderItems.map((item) => ({
          serviceOrderId: serviceOrder.id,
          storefrontPriceId: item.price.id,
          isPackageIncluded: false,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          notes: `${item.price.storefrontService.name} ${item.price.storefrontItem.name}`.trim(),
        })),
      });

      const payment = await tx.paymentRecord.create({
        data: {
          userId: body.customerId,
          serviceOrderId: serviceOrder.id,
          amount: totalAmount,
          paymentMethod: body.paymentMethod,
          slipImageId: body.slipImageId ?? null,
          status,
          note: body.note?.trim() || null,
          paidAt: isVerified ? new Date() : null,
          verifiedById: isVerified ? actor.id : null,
          verifiedAt: isVerified ? new Date() : null,
          rejectionReason: status === "FAILED" ? "บันทึกรายการไม่สำเร็จ" : null,
          metadata: {
            createdByAdminId: actor.id,
            source: "admin-service-orders",
            subtotalAmount,
            hangerCharge,
          },
        },
      });

      return {
        id: serviceOrder.id,
        paymentId: payment.id,
      };
    });

    return created;
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    console.error("[POST /api/admin/service-orders]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "Unable to create service order",
    });
  }
});
