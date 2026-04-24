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
  memberEntitlementId?: string | null;
  orderImageId?: string | null;
  deliveryImageId?: string | null;
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

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["EMPLOYEE", "ADMIN"]);
  const id = getRouterParam(event, "id");

  if (!id) {
    throw createError({ statusCode: 400, statusMessage: "เนเธกเนเธเธเธฃเธซเธฑเธชเธฃเธฒเธขเธเธฒเธฃเธฃเธฑเธเธเนเธฒ" });
  }

  const body = await readBody<UpdateServiceOrderBody>(event);
  const isWalkIn = Boolean(body.isWalkIn);
  const customerId = body.customerId?.trim() || null;
  const walkInName = body.walkInName?.trim() || null;
  const walkInPhone = body.walkInPhone?.trim() || null;
  const requestedEntitlementId = body.memberEntitlementId?.trim() || null;
  const orderImageId = body.orderImageId?.trim() || null;
  const deliveryImageId = body.deliveryImageId === null ? null : body.deliveryImageId?.trim() || undefined;

  if (!isWalkIn && !customerId) {
    throw createError({ statusCode: 400, statusMessage: "เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธฅเธนเธเธเนเธฒ" });
  }

  if (isWalkIn && requestedEntitlementId) {
    throw createError({ statusCode: 400, statusMessage: "ลูกค้าหน้าร้านไม่สามารถใช้เครดิตแพ็กเกจได้" });
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธเธฃเธดเธเธฒเธฃเธญเธขเนเธฒเธเธเนเธญเธข 1 เธฃเธฒเธขเธเธฒเธฃ" });
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
    throw createError({ statusCode: 400, statusMessage: "เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธเธฃเธดเธเธฒเธฃเธญเธขเนเธฒเธเธเนเธญเธข 1 เธฃเธฒเธขเธเธฒเธฃ" });
  }

  if (normalizedItems.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
    throw createError({ statusCode: 400, statusMessage: "เธเธณเธเธงเธเธฃเธฒเธขเธเธฒเธฃเธ•เนเธญเธเธกเธฒเธเธเธงเนเธฒ 0" });
  }

  const missingHangerCount = body.missingHangerCount ?? body.hangerCount ?? 0;
  if (!Number.isInteger(missingHangerCount) || missingHangerCount < 0) {
    throw createError({ statusCode: 400, statusMessage: "จำนวนไม้แขวนที่ขาดต้องเป็น 0 หรือมากกว่า" });
  }

  if (body.discountAmount !== undefined && (!Number.isFinite(Number(body.discountAmount)) || Number(body.discountAmount) < 0)) {
    throw createError({ statusCode: 400, statusMessage: "เธเธณเธเธงเธเธชเนเธงเธเธฅเธ”เธ•เนเธญเธเน€เธเนเธ 0 เธซเธฃเธทเธญเธกเธฒเธเธเธงเนเธฒ" });
  }

  const paymentMethod: PaymentMethod = body.paymentMethod ?? "CASH";
  if (paymentMethod !== "CASH" && paymentMethod !== "TRANSFER") {
    throw createError({ statusCode: 400, statusMessage: "เธเนเธญเธเธ—เธฒเธเธเธฒเธฃเธเธณเธฃเธฐเน€เธเธดเธเนเธกเนเธ–เธนเธเธ•เนเธญเธ" });
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
      throw createError({ statusCode: 404, statusMessage: "เนเธกเนเธเธเธฃเธฒเธขเธเธฒเธฃเธฃเธฑเธเธเนเธฒเธ—เธตเนเธ•เนเธญเธเธเธฒเธฃเนเธเนเนเธ" });
    }

    if (existing.payments.length > 1) {
      throw createError({
        statusCode: 400,
        statusMessage: "เธฃเธฒเธขเธเธฒเธฃเธเธตเนเธกเธตเธเนเธญเธกเธนเธฅเธเธฒเธฃเธเธณเธฃเธฐเน€เธเธดเธเธซเธฅเธฒเธขเธฃเธฒเธขเธเธฒเธฃ เธฃเธฐเธเธเธขเธฑเธเนเธกเนเธฃเธญเธเธฃเธฑเธเธเธฒเธฃเนเธเนเนเธเธญเธฑเธ•เนเธเธกเธฑเธ•เธด",
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
        throw createError({ statusCode: 404, statusMessage: "เนเธกเนเธเธเธฅเธนเธเธเนเธฒเธ—เธตเนเน€เธฅเธทเธญเธ" });
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
      throw createError({ statusCode: 404, statusMessage: "เธกเธตเธฃเธฒเธขเธเธฒเธฃเธเธฃเธดเธเธฒเธฃเธเธฒเธเธฃเธฒเธขเธเธฒเธฃเนเธกเนเธ–เธนเธเธ•เนเธญเธเธซเธฃเธทเธญเธ–เธนเธเธเธดเธ”เนเธเนเธเธฒเธ" });
    }

    const priceMap = new Map(storefrontPrices.map((item) => [item.id, item]));
    const orderItems = normalizedItems.map((item) => {
      const price = priceMap.get(item.storefrontPriceId);
      if (!price) {
        throw createError({ statusCode: 404, statusMessage: "เนเธกเนเธเธเธเธฃเธดเธเธฒเธฃเธ—เธตเนเน€เธฅเธทเธญเธ" });
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

    const hangerCharge = {
      count: missingHangerCount,
      pricePerUnit: DEFAULT_HANGER_PRICE_PER_UNIT,
      total: missingHangerCount * DEFAULT_HANGER_PRICE_PER_UNIT,
    };

    const dueAt = body.dueAt ? new Date(body.dueAt) : null;
    if (dueAt && Number.isNaN(dueAt.getTime())) {
      throw createError({ statusCode: 400, statusMessage: "เธงเธฑเธเธเธฑเธ”เธฃเธฑเธเนเธกเนเธ–เธนเธเธ•เนเธญเธ" });
    }

    const serviceOrderStatus = body.serviceOrderStatus ?? existing.status;
    const existingSlipImageId = existing.payments[0]?.slipImage?.id ?? null;
    const slipImageId = body.slipImageId !== undefined ? body.slipImageId : existingSlipImageId;

    type AllocatedItem = (typeof orderItems)[number] & { cashQuantity: number; creditQuantity: number };
    let allocatedItems: AllocatedItem[] = orderItems.map((item) => ({ ...item, creditQuantity: 0, cashQuantity: item.quantity }));
    let creditUsed = 0;
    let subtotalAmount = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    let discountAmount = Math.min(Number(body.discountAmount ?? 0), subtotalAmount);
    let payableAmount = subtotalAmount - discountAmount + hangerCharge.total;


    await prisma.$transaction(async (tx) => {
      if (existing.memberEntitlementId && existing.creditUsed) {
        await tx.memberEntitlement.update({
          where: { id: existing.memberEntitlementId },
          data: {
            creditRemaining: {
              increment: existing.creditUsed,
            },
          },
        });
      }

      let nextEntitlementId: string | null = null;

      if (requestedEntitlementId) {
        const entitlement = await tx.memberEntitlement.findFirst({
          where: {
            id: requestedEntitlementId,
            customerId: customerId!,
            deletedAt: null,
            status: "ACTIVE",
          },
          select: {
            id: true,
            creditRemaining: true,
          },
        });

        if (!entitlement) {
          throw createError({ statusCode: 404, statusMessage: "ไม่พบสิทธิ์แพ็กเกจรายเดือนที่เลือก" });
        }

        const creditAvailable = Math.max(0, Number(entitlement.creditRemaining ?? 0));
        let remainingCredit = creditAvailable;
        allocatedItems = orderItems.map((item) => {
          const creditQty = Math.min(item.quantity, remainingCredit);
          remainingCredit -= creditQty;
          return { ...item, creditQuantity: creditQty, cashQuantity: item.quantity - creditQty };
        });
        creditUsed = creditAvailable - remainingCredit;
        subtotalAmount = allocatedItems.reduce((sum, item) => sum + item.cashQuantity * item.unitPrice, 0);
        discountAmount = Math.min(Number(body.discountAmount ?? 0), subtotalAmount);
        payableAmount = subtotalAmount - discountAmount + hangerCharge.total;

        if (creditUsed > 0) {
          await tx.memberEntitlement.update({
            where: { id: entitlement.id },
            data: {
              creditRemaining: {
                decrement: creditUsed,
              },
            },
          });
        }

        nextEntitlementId = entitlement.id;
      }

      const paymentStatus: PaymentStatus = body.status ?? existing.payments[0]?.status ?? "PENDING";
      const isVerified = paymentStatus === "VERIFIED";

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
          memberEntitlementId: nextEntitlementId,
          creditUsed: nextEntitlementId ? creditUsed : null,
          dueAt,
          subtotalAmount,
          discountAmount,
          hangerCharge,
          totalAmount: payableAmount,
          note: body.note?.trim() || null,
          imageId: orderImageId,
          ...(deliveryImageId !== undefined ? { deliveryImageId } : {}),
        },
      });

      const existingItems = await tx.serviceOrderItem.findMany({
        where: {
          serviceOrderId: id,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (existingItems.length > 0) {
        await tx.serviceOrderItemImage.updateMany({
          where: {
            serviceOrderItemId: { in: existingItems.map((item) => item.id) },
            deletedAt: null,
          },
          data: {
            deletedAt,
            deletedById: actor.id,
          },
        });
      }

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

      for (const item of allocatedItems) {
        const rows: Array<{ qty: number; isPackage: boolean; totalPrice: number; attachPhotos: boolean }> = [];
        if (item.creditQuantity > 0) rows.push({ qty: item.creditQuantity, isPackage: true, totalPrice: 0, attachPhotos: true });
        if (item.cashQuantity > 0) rows.push({ qty: item.cashQuantity, isPackage: false, totalPrice: item.cashQuantity * item.unitPrice, attachPhotos: item.creditQuantity === 0 });
        if (rows.length === 0) rows.push({ qty: item.quantity, isPackage: false, totalPrice: item.totalPrice, attachPhotos: true });

        for (const row of rows) {
          const createdItem = await tx.serviceOrderItem.create({
            data: {
              serviceOrderId: id,
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

      if (existing.payments[0]) {
        await tx.paymentRecord.update({
          where: { id: existing.payments[0].id },
          data: {
            userId: paymentUserId!,
            memberEntitlementId: nextEntitlementId,
            amount: payableAmount,
            paymentMethod,
            slipImageId: slipImageId ?? null,
            status: paymentStatus,
            note: body.note?.trim() || null,
            paidAt: isVerified ? new Date() : null,
            verifiedById: isVerified ? actor.id : null,
            verifiedAt: isVerified ? new Date() : null,
            rejectionReason: paymentStatus === "FAILED" ? "เธญเธฑเธเน€เธ”เธ•เธฃเธฒเธขเธเธฒเธฃเนเธ”เธขเธเธนเนเธ”เธนเนเธฅเธฃเธฐเธเธ" : null,
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
              memberEntitlementId: nextEntitlementId,
              creditUsed: nextEntitlementId ? creditUsed : null,
              orderImageId,
            },
          },
        });
      } else {
        await tx.paymentRecord.create({
          data: {
            paymentNo: createPaymentNo(),
            userId: paymentUserId!,
            memberEntitlementId: nextEntitlementId,
            serviceOrderId: id,
            amount: payableAmount,
            paymentMethod,
            slipImageId: slipImageId ?? null,
            status: paymentStatus,
            note: body.note?.trim() || null,
            paidAt: isVerified ? new Date() : null,
            verifiedById: isVerified ? actor.id : null,
            verifiedAt: isVerified ? new Date() : null,
            rejectionReason: paymentStatus === "FAILED" ? "เธเธฑเธเธ—เธถเธเธฃเธฒเธขเธเธฒเธฃเนเธกเนเธชเธณเน€เธฃเนเธ" : null,
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
              memberEntitlementId: nextEntitlementId,
              creditUsed: nextEntitlementId ? creditUsed : null,
              orderImageId,
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
      statusMessage: "เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธญเธฑเธเน€เธ”เธ•เธฃเธฒเธขเธเธฒเธฃเธฃเธฑเธเธเนเธฒเนเธ”เน",
    });
  }
});
