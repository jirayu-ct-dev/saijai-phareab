import type { PaymentMethod, PaymentStatus, ServiceOrderStatus } from "~~/shared/types/enums";
import { DEFAULT_HANGER_PRICE_PER_UNIT } from "~~/shared/config/posConfig";
import { requireRole } from "~~/server/utils/auth";
import { createPaymentNo } from "~~/server/utils/paymentNo";
import { prisma } from "~~/server/utils/prisma";
import { createServiceOrderNo } from "~~/server/utils/serviceOrderNo";
import { ensureWalkInCustomer } from "~~/server/utils/walkInCustomer";

type CreateServiceOrderBody = {
  customerId?: string | null;
  isWalkIn?: boolean;
  walkInName?: string | null;
  walkInPhone?: string | null;
  memberEntitlementId?: string | null;
  orderImageId?: string | null;
  items: Array<{
    storefrontPriceId: string;
    quantity: number;
    imageId?: string | null;
    notes?: string | null;
    photos?: Array<{ imageId: string; isDamaged?: boolean; sortOrder?: number }>;
  }>;
  hangerCount?: number;
  missingHangerCount?: number;
  dueAt?: string | null;
  discountAmount?: number;
  paymentMethod?: PaymentMethod;
  status?: PaymentStatus;
  serviceOrderStatus?: ServiceOrderStatus;
  note?: string | null;
  slipImageId?: string | null;
};

const getDefaultServiceOrderStatus = (status: PaymentStatus) => {
  if (status === "VERIFIED") return "RECEIVED" as const;
  if (status === "FAILED") return "CANCELLED" as const;
  return "PENDING" as const;
};

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const body = await readBody<CreateServiceOrderBody>(event);

  const isWalkIn = Boolean(body.isWalkIn);
  const customerId = body.customerId?.trim() || null;
  const walkInName = body.walkInName?.trim() || null;
  const walkInPhone = body.walkInPhone?.trim() || null;
  const requestedEntitlementId = body.memberEntitlementId?.trim() || null;
  const orderImageId = body.orderImageId?.trim() || null;

  if (!isWalkIn && !customerId) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกลูกค้า" });
  }

  if (isWalkIn && requestedEntitlementId) {
    throw createError({ statusCode: 400, statusMessage: "ลูกค้าหน้าร้านไม่สามารถใช้เครดิตแพ็กเกจได้" });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกบริการอย่างน้อย 1 รายการ" });
  }

  const normalizedItems = body.items
    .map((item) => {
      const rawPhotos = Array.isArray(item.photos) ? item.photos : [];
      const photos = rawPhotos
        .map((photo, index) => ({
          imageId: photo.imageId?.trim() || "",
          isDamaged: Boolean(photo.isDamaged),
          sortOrder: Number.isFinite(photo.sortOrder) ? Number(photo.sortOrder) : index,
        }))
        .filter((photo) => photo.imageId);

      return {
        storefrontPriceId: item.storefrontPriceId,
        quantity: Number(item.quantity ?? 1),
        imageId: item.imageId?.trim() || photos[0]?.imageId || null,
        notes: item.notes?.trim() || null,
        photos,
      };
    })
    .filter((item) => item.storefrontPriceId);

  if (normalizedItems.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกบริการอย่างน้อย 1 รายการ" });
  }

  if (normalizedItems.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
    throw createError({ statusCode: 400, statusMessage: "จำนวนรายการต้องมากกว่า 0" });
  }

  const missingHangerCount = body.missingHangerCount ?? body.hangerCount ?? 0;
  if (!Number.isInteger(missingHangerCount) || missingHangerCount < 0) {
    throw createError({ statusCode: 400, statusMessage: "จำนวนไม้แขวนที่ขาดต้องเป็น 0 หรือมากกว่า" });
  }

  if (body.discountAmount !== undefined && (!Number.isFinite(Number(body.discountAmount)) || Number(body.discountAmount) < 0)) {
    throw createError({ statusCode: 400, statusMessage: "จำนวนส่วนลดต้องเป็น 0 หรือมากกว่า" });
  }

  const paymentMethod: PaymentMethod = body.paymentMethod ?? "CASH";
  if (paymentMethod !== "CASH" && paymentMethod !== "TRANSFER") {
    throw createError({ statusCode: 400, statusMessage: "ช่องทางการชำระเงินไม่ถูกต้อง" });
  }

  const status: PaymentStatus = body.status ?? "PENDING";
  const serviceOrderStatus: ServiceOrderStatus = body.serviceOrderStatus ?? getDefaultServiceOrderStatus(status);
  const isVerified = status === "VERIFIED";
  const receivedAt = new Date();
  const dueAt = body.dueAt ? new Date(body.dueAt) : null;

  if (dueAt && Number.isNaN(dueAt.getTime())) {
    throw createError({ statusCode: 400, statusMessage: "วันนัดรับไม่ถูกต้อง" });
  }

  try {
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
        imageId: item.imageId,
        notes: item.notes,
        photos: item.photos,
      };
    });

    const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const hangerCharge = {
      count: missingHangerCount,
      pricePerUnit: DEFAULT_HANGER_PRICE_PER_UNIT,
      total: missingHangerCount * DEFAULT_HANGER_PRICE_PER_UNIT,
    };

    type AllocatedItem = typeof orderItems[number] & { cashQuantity: number; creditQuantity: number };

    const created = await prisma.$transaction(async (tx) => {
      let memberEntitlement = null as null | {
        id: string;
        customerId: string;
        creditRemaining: number | null;
      };

      if (requestedEntitlementId) {
        memberEntitlement = await tx.memberEntitlement.findFirst({
          where: {
            id: requestedEntitlementId,
            customerId: customerId!,
            deletedAt: null,
            status: "ACTIVE",
          },
          select: {
            id: true,
            customerId: true,
            creditRemaining: true,
          },
        });

        if (!memberEntitlement) {
          throw createError({ statusCode: 404, statusMessage: "ไม่พบสิทธิ์แพ็กเกจรายเดือนที่เลือก" });
        }
      }

      // FIFO allocate credit to items; split rows for partial coverage.
      const creditAvailable = memberEntitlement ? Math.max(0, Number(memberEntitlement.creditRemaining ?? 0)) : 0;
      let remainingCredit = creditAvailable;
      const allocatedItems: AllocatedItem[] = orderItems.map((item) => {
        const creditQty = Math.min(item.quantity, remainingCredit);
        remainingCredit -= creditQty;
        return { ...item, creditQuantity: creditQty, cashQuantity: item.quantity - creditQty };
      });
      const creditUsed = creditAvailable - remainingCredit;
      const subtotalAmount = allocatedItems.reduce((sum, item) => sum + item.cashQuantity * item.unitPrice, 0);
      const discountAmount = Math.min(Number(body.discountAmount ?? 0), subtotalAmount);
      const payableAmount = subtotalAmount - discountAmount + hangerCharge.total;

      if (memberEntitlement && creditUsed > 0) {
        const { count } = await tx.memberEntitlement.updateMany({
          where: {
            id: memberEntitlement.id,
            creditRemaining: { gte: creditUsed },
          },
          data: {
            creditRemaining: {
              decrement: creditUsed,
            },
          },
        });

        if (count === 0) {
          throw createError({ statusCode: 409, statusMessage: "เครดิตไม่พอ กรุณาลองใหม่" });
        }
      }

      const serviceOrder = await tx.serviceOrder.create({
        data: {
          orderNo: createServiceOrderNo(receivedAt),
          customerId: paymentUserId!,
          employeeId: actor.id,
          status: serviceOrderStatus,
          isWalkIn,
          walkInName,
          walkInPhone,
          memberEntitlementId: memberEntitlement?.id ?? null,
          creditUsed: memberEntitlement ? creditUsed : null,
          receivedAt,
          dueAt,
          subtotalAmount,
          discountAmount,
          hangerCharge,
          totalAmount: payableAmount,
          note: body.note?.trim() || null,
          imageId: orderImageId,
        },
      });

      for (const item of allocatedItems) {
        const rows: Array<{ qty: number; isPackage: boolean; totalPrice: number; attachPhotos: boolean }> = [];
        if (item.creditQuantity > 0) {
          rows.push({ qty: item.creditQuantity, isPackage: true, totalPrice: 0, attachPhotos: true });
        }
        if (item.cashQuantity > 0) {
          rows.push({
            qty: item.cashQuantity,
            isPackage: false,
            totalPrice: item.cashQuantity * item.unitPrice,
            attachPhotos: item.creditQuantity === 0,
          });
        }

        for (const row of rows) {
          const createdItem = await tx.serviceOrderItem.create({
            data: {
              serviceOrderId: serviceOrder.id,
              storefrontPriceId: item.price.id,
              isPackageIncluded: row.isPackage,
              quantity: row.qty,
              unitPrice: item.unitPrice,
              totalPrice: row.totalPrice,
              imageId: row.attachPhotos ? item.imageId : null,
              notes: item.notes,
            },
            select: { id: true },
          });

          if (row.attachPhotos && item.photos.length > 0) {
            await tx.serviceOrderItemImage.createMany({
              data: item.photos.map((photo, index) => ({
                serviceOrderItemId: createdItem.id,
                imageId: photo.imageId,
                isDamaged: photo.isDamaged,
                sortOrder: photo.sortOrder ?? index,
              })),
            });
          }
        }
      }

      const payment = await tx.paymentRecord.create({
        data: {
          paymentNo: createPaymentNo(),
          userId: paymentUserId!,
          memberEntitlementId: memberEntitlement?.id ?? null,
          serviceOrderId: serviceOrder.id,
          amount: payableAmount,
          paymentMethod,
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
            orderNo: serviceOrder.orderNo,
            subtotalAmount,
            discountAmount,
            hangerCharge,
            receivedAt,
            dueAt,
            isWalkIn,
            walkInName,
            walkInPhone,
            memberEntitlementId: memberEntitlement?.id ?? null,
            creditUsed: memberEntitlement ? creditUsed : null,
            orderImageId,
          },
        },
      });

      return {
        id: serviceOrder.id,
        orderNo: serviceOrder.orderNo,
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
      statusMessage: "ไม่สามารถสร้างรายการรับผ้าหน้าร้านได้",
    });
  }
});
