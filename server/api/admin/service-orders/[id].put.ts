import type { PaymentMethod, PaymentStatus, ServiceOrderStatus } from "~~/shared/types/enums";
import { DEFAULT_HANGER_PRICE_PER_UNIT } from "~~/shared/config/posConfig";
import { requireRole } from "~~/server/utils/auth";
import { createPaymentNo } from "~~/server/utils/paymentNo";
import { prisma } from "~~/server/utils/prisma";
import { ensureWalkInCustomer } from "~~/server/utils/walkInCustomer";

type UpdateServiceOrderBody = {
  customerId?: string | null;
  isWalkIn?: boolean;
  walkInName?: string | null;
  walkInPhone?: string | null;
  items: Array<{
    storefrontPriceId: string;
    quantity: number;
  }>;
  hangerCount?: number;
  dueAt?: string | null;
  discountAmount?: number;
  paymentMethod: PaymentMethod;
  status?: PaymentStatus;
  serviceOrderStatus?: ServiceOrderStatus;
  note?: string | null;
  slipImageId?: string | null;
};

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบรหัสรายการรับผ้า" });
  }

  const body = await readBody<UpdateServiceOrderBody>(event);

  const isWalkIn = Boolean(body.isWalkIn);
  const customerId = body.customerId?.trim() || null;
  const walkInName = body.walkInName?.trim() || null;
  const walkInPhone = body.walkInPhone?.trim() || null;

  if (!isWalkIn && !customerId) {
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

  if (body.discountAmount !== undefined && (!Number.isFinite(Number(body.discountAmount)) || Number(body.discountAmount) < 0)) {
    throw createError({ statusCode: 400, statusMessage: "จำนวนส่วนลดต้องเป็น 0 หรือมากกว่า" });
  }

  if (body.paymentMethod !== "CASH" && body.paymentMethod !== "TRANSFER") {
    throw createError({ statusCode: 400, statusMessage: "ช่องทางการชำระเงินไม่ถูกต้อง" });
  }

  try {
    const existing = await prisma.serviceOrder.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        payments: {
          where: {
            deletedAt: null,
          },
          orderBy: {
            createdAt: "desc",
          },
          include: {
            slipImage: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบรายการรับผ้าที่ต้องการแก้ไข" });
    }

    if (existing.payments.length > 1) {
      throw createError({
        statusCode: 400,
        statusMessage: "รายการนี้มีข้อมูลการชำระเงินหลายรายการ ระบบยังไม่รองรับการแก้ไขอัตโนมัติ",
      });
    }

    let paymentUserId = customerId;
    if (isWalkIn) {
      const walkInCustomer = await ensureWalkInCustomer(prisma);
      paymentUserId = walkInCustomer.id;
    } else {
      const customer = await prisma.user.findFirst({
        where: {
          id: customerId!,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (!customer) {
        throw createError({ statusCode: 404, statusMessage: "ไม่พบลูกค้าที่เลือก" });
      }
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
    const discountAmount = Math.min(Number(body.discountAmount ?? 0), subtotalAmount);
    const hangerCount = body.hangerCount ?? orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const hangerCharge = {
      count: hangerCount,
      pricePerUnit: DEFAULT_HANGER_PRICE_PER_UNIT,
      total: hangerCount * DEFAULT_HANGER_PRICE_PER_UNIT,
    };
    const totalAmount = subtotalAmount - discountAmount + hangerCharge.total;

    const dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) {
      throw createError({ statusCode: 400, statusMessage: "วันนัดรับไม่ถูกต้อง" });
    }

    const paymentStatus = body.status ?? existing.payments[0]?.status ?? (body.paymentMethod === "CASH" ? "VERIFIED" : "PENDING");
    const serviceOrderStatus = body.serviceOrderStatus ?? existing.status;
    const existingSlipImageId = existing.payments[0]?.slipImage?.id ?? null;
    const slipImageId = body.slipImageId !== undefined ? body.slipImageId : existingSlipImageId;

    if (body.paymentMethod === "TRANSFER" && !slipImageId) {
      throw createError({ statusCode: 400, statusMessage: "กรุณาอัปโหลดสลิปสำหรับรายการโอน" });
    }

    const isVerified = paymentStatus === "VERIFIED";

    await prisma.$transaction(async (tx) => {
      const deletedAt = new Date();

      await tx.serviceOrder.update({
        where: { id },
        data: {
          customerId: paymentUserId!,
          employeeId: existing.employeeId ?? actor.id,
          status: serviceOrderStatus,
          isWalkIn,
          walkInName,
          walkInPhone,
          dueAt,
          subtotalAmount,
          discountAmount,
          hangerCharge,
          totalAmount,
          note: body.note?.trim() || null,
        },
      });

      await tx.serviceOrderItem.updateMany({
        where: {
          serviceOrderId: id,
          deletedAt: null,
        },
        data: {
          deletedAt,
          deletedById: actor.id,
        },
      });

      await tx.serviceOrderItem.createMany({
        data: orderItems.map((item) => ({
          serviceOrderId: id,
          storefrontPriceId: item.price.id,
          isPackageIncluded: false,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          notes: `${item.price.storefrontService.name} ${item.price.storefrontItem.name}`.trim(),
        })),
      });

      if (existing.payments[0]) {
        await tx.paymentRecord.update({
          where: { id: existing.payments[0].id },
          data: {
            userId: paymentUserId!,
            amount: totalAmount,
            paymentMethod: body.paymentMethod,
            slipImageId: slipImageId ?? null,
            status: paymentStatus,
            note: body.note?.trim() || null,
            paidAt: isVerified ? new Date() : null,
            verifiedById: isVerified ? actor.id : null,
            verifiedAt: isVerified ? new Date() : null,
            rejectionReason: paymentStatus === "FAILED" ? "อัปเดตรายการโดยผู้ดูแลระบบ" : null,
            metadata: {
              updatedByAdminId: actor.id,
              source: "admin-service-orders",
              orderNo: existing.orderNo,
              subtotalAmount,
              discountAmount,
              hangerCharge,
              dueAt,
              isWalkIn,
              walkInName,
              walkInPhone,
            },
          },
        });
      } else {
        await tx.paymentRecord.create({
          data: {
            paymentNo: createPaymentNo(),
            userId: paymentUserId!,
            serviceOrderId: id,
            amount: totalAmount,
            paymentMethod: body.paymentMethod,
            slipImageId: slipImageId ?? null,
            status: paymentStatus,
            note: body.note?.trim() || null,
            paidAt: isVerified ? new Date() : null,
            verifiedById: isVerified ? actor.id : null,
            verifiedAt: isVerified ? new Date() : null,
            rejectionReason: paymentStatus === "FAILED" ? "บันทึกรายการไม่สำเร็จ" : null,
            metadata: {
              createdByAdminId: actor.id,
              source: "admin-service-orders",
              orderNo: existing.orderNo,
              subtotalAmount,
              discountAmount,
              hangerCharge,
              receivedAt: existing.receivedAt,
              dueAt,
              isWalkIn,
              walkInName,
              walkInPhone,
            },
          },
        });
      }
    });

    return { success: true };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    console.error("[PUT /api/admin/service-orders/:id]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถอัปเดตรายการรับผ้าได้",
    });
  }
});
