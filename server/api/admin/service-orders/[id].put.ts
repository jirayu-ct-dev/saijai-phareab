import type { ServiceOrderStatus } from "~~/shared/types/enums";
import { notifyServiceOrderStatusChanged } from "~~/server/utils/notify";
import { getBusinessSetting } from "~~/server/utils/businessSetting";
import { computeVat } from "~~/server/utils/vat";
import { requireRole } from "~~/server/utils/auth";
import { createPaymentNo } from "~~/server/utils/paymentNo";
import { prisma } from "~~/server/utils/prisma";
import { ensureWalkInCustomer } from "~~/server/utils/walkInCustomer";
import { createAddonUsageRecords, refundAddonUsages, voidPendingAddonUsageRecords } from "~~/server/utils/serviceOrderCredits";
import { isServiceOrderStatus } from "~~/server/utils/serviceOrderStatusTransition";
import { parseBangkokDateTime } from "~~/shared/utils/pickup";
import { dispatchPickupInitialFallback, reconcilePickupConfirmation } from "~~/server/utils/pickupConfirmation";

type UpdateServiceOrderBody = {
  customerId?: string | null;
  isWalkIn?: boolean;
  walkInName?: string | null;
  walkInPhone?: string | null;
  memberEntitlementId?: string | null;
  addonEntitlements?: Array<{ entitlementId: string; credits: number }>;
  orderImageId?: string | null;
  deliveryImageId?: string | null;
  items: Array<{
    storefrontPriceId: string;
    quantity: number;
    unitPrice?: number | null;
    imageId?: string | null;
    notes?: string | null;
    photos?: Array<{ imageId: string; isDamaged?: boolean; sortOrder?: number }>;
  }>;
  washFold?: { weightKg: number; notes?: string | null } | null;
  hangerCount?: number;
  missingHangerCount?: number;
  dueAt?: string | null;
  discountAmount?: number;
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
  const requestedEntitlementId = body.memberEntitlementId?.trim() || null;
  const orderImageId = body.orderImageId?.trim() || null;
  const deliveryImageId = body.deliveryImageId === null ? null : body.deliveryImageId?.trim() || undefined;
  const shouldReplaceAddonUsages = Array.isArray(body.addonEntitlements);
  if (body.serviceOrderStatus !== undefined && !isServiceOrderStatus(body.serviceOrderStatus)) {
    throw createError({ statusCode: 400, statusMessage: "สถานะรายการรับผ้าไม่ถูกต้อง" });
  }

  if (!isWalkIn && !customerId) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกลูกค้า" });
  }

  if (isWalkIn && requestedEntitlementId) {
    throw createError({ statusCode: 400, statusMessage: "ลูกค้าหน้าร้านไม่สามารถใช้เครดิตแพ็กเกจได้" });
  }

  if (isWalkIn && Array.isArray(body.addonEntitlements) && body.addonEntitlements.length > 0) {
    throw createError({ statusCode: 400, statusMessage: "ลูกค้าหน้าร้านไม่สามารถใช้แพ็กเกจเสริมได้" });
  }

  const washFoldInput = body.washFold && Number.isFinite(Number(body.washFold.weightKg))
    ? { weightKg: Number(body.washFold.weightKg), notes: body.washFold.notes?.trim() || null }
    : null;

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกบริการอย่างน้อย 1 รายการ" });
  }

  if (washFoldInput && requestedEntitlementId) {
    throw createError({ statusCode: 400, statusMessage: "โหมดซัก-พับชั่งกิโลใช้แพ็กเกจรายเดือนไม่ได้" });
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
        unitPriceOverride: item.unitPrice != null && Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : null,
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

      const unitPrice = item.unitPriceOverride ?? Number(price.price);
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

    const business = await getBusinessSetting();

    if (washFoldInput) {
      if (washFoldInput.weightKg <= 0) {
        throw createError({ statusCode: 400, statusMessage: "น้ำหนักต้องมากกว่า 0" });
      }
      if (business.washFoldMinKg > 0 && washFoldInput.weightKg < business.washFoldMinKg) {
        throw createError({ statusCode: 400, statusMessage: `น้ำหนักขั้นต่ำ ${business.washFoldMinKg} กก.` });
      }
    }

    const hangerCharge = washFoldInput
      ? { count: 0, pricePerUnit: 0, total: 0 }
      : {
          count: missingHangerCount,
          pricePerUnit: business.hangerPricePerUnit,
          total: missingHangerCount * business.hangerPricePerUnit,
        };

    const washFoldSubtotal = washFoldInput
      ? Math.round(washFoldInput.weightKg * business.washFoldPricePerKg * 100) / 100
      : 0;

    const dueAt = parseBangkokDateTime(body.dueAt);
    if (dueAt && Number.isNaN(dueAt.getTime())) {
      throw createError({ statusCode: 400, statusMessage: "วันนัดรับไม่ถูกต้อง" });
    }

    const serviceOrderStatus = body.serviceOrderStatus ?? existing.status;
    const existingSlipImageId = existing.payments[0]?.slipImage?.id ?? null;
    const slipImageId = body.slipImageId !== undefined ? body.slipImageId : existingSlipImageId;

    type AllocatedItem = (typeof orderItems)[number] & { cashQuantity: number; creditQuantity: number };
    let allocatedItems: AllocatedItem[] = orderItems.map((item) => ({ ...item, creditQuantity: 0, cashQuantity: item.quantity }));
    let creditUsed = 0;
    let subtotalAmount = washFoldInput
      ? washFoldSubtotal
      : orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    let discountAmount = Math.min(Number(body.discountAmount ?? 0), subtotalAmount);
    let beforeVat = subtotalAmount - discountAmount + hangerCharge.total;
    let vat = computeVat({ amount: beforeVat, rate: business.vatRate, included: business.vatIncluded });
    let payableAmount = vat.totalAmount;


    await prisma.$transaction(async (tx) => {
      if (existing.memberEntitlementId && existing.creditUsed) {
        // Only refund credits if the entitlement is still ACTIVE.
        // If it was suspended/expired/cancelled after this order was created,
        // restoring credits would bypass the suspension.
        const { count } = await tx.memberEntitlement.updateMany({
          where: {
            id: existing.memberEntitlementId,
            status: "ACTIVE",
            creditRemaining: { gte: 0 },
          },
          data: {
            creditRemaining: { increment: existing.creditUsed },
          },
        });
        if (count === 0) {
          throw createError({
            statusCode: 409,
            statusMessage:
              "ไม่สามารถแก้ไขรายการนี้ได้ เนื่องจากสิทธิ์แพ็กเกจที่ใช้ไปถูกระงับหรือหมดอายุแล้ว กรุณาติดต่อผู้ดูแลระบบ",
          });
        }
      }

      if (shouldReplaceAddonUsages) {
        await refundAddonUsages(tx, existing.id, existing.addonUsages);
        await voidPendingAddonUsageRecords(tx, existing.id);
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
        beforeVat = subtotalAmount - discountAmount + hangerCharge.total;
        vat = computeVat({ amount: beforeVat, rate: business.vatRate, included: business.vatIncluded });
        payableAmount = vat.totalAmount;

        if (creditUsed > 0) {
          const { count } = await tx.memberEntitlement.updateMany({
            where: {
              id: entitlement.id,
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

        nextEntitlementId = entitlement.id;
      }

      type PendingAddonUsage = {
        entitlementId: string;
        productId: string;
        productName: string;
        credits: number;
        deductOn: "CREATED" | "COMPLETED";
        isDelivery: boolean;
        appliedAt?: string;
        deductedAt?: string;
      };
      const pendingAddonUsages: PendingAddonUsage[] = [];
      const storedAddonUsages: PendingAddonUsage[] = [];
      const rawAddonEntitlements = shouldReplaceAddonUsages ? body.addonEntitlements ?? [] : [];
      for (const entry of rawAddonEntitlements) {
        const credits = Math.floor(Number(entry.credits ?? 0));
        if (!entry.entitlementId || credits <= 0) continue;
        const addonEnt = await tx.memberEntitlement.findFirst({
          where: {
            id: entry.entitlementId,
            customerId: customerId!,
            status: "ACTIVE",
            deletedAt: null,
            product: { packageType: "ADDON" },
          },
          include: { product: { select: { id: true, name: true, deductOn: true, isDelivery: true } } },
        });
        if (!addonEnt) {
          throw createError({ statusCode: 400, statusMessage: `ไม่พบสิทธิ์แพ็กเกจเสริม (${entry.entitlementId})` });
        }
        const shouldDeductNow = addonEnt.product.deductOn === "CREATED" || serviceOrderStatus === "COMPLETED";
        const usage: PendingAddonUsage = {
          entitlementId: addonEnt.id,
          productId: addonEnt.product.id,
          productName: addonEnt.product.name,
          credits,
          deductOn: addonEnt.product.deductOn,
          isDelivery: addonEnt.product.isDelivery,
          deductedAt: undefined,
        };
        if (shouldDeductNow) {
          const { count } = await tx.memberEntitlement.updateMany({
            where: {
              id: addonEnt.id,
              creditRemaining: { gte: credits },
              status: "ACTIVE",
              deletedAt: null,
            },
            data: { creditRemaining: { decrement: credits } },
          });
          if (count === 0) {
            throw createError({ statusCode: 400, statusMessage: `เครดิตของ "${addonEnt.product.name}" ไม่พอ` });
          }
          const deductedAt = new Date().toISOString();
          usage.appliedAt = deductedAt;
          usage.deductedAt = deductedAt;
          storedAddonUsages.push(usage);
        }
        pendingAddonUsages.push(usage);
      }

      const existingPayment = existing.payments[0];

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
          weightKg: washFoldInput?.weightKg ?? null,
          washFoldPricePerKgSnapshot: washFoldInput ? business.washFoldPricePerKg : null,
          note: body.note?.trim() || null,
          imageId: orderImageId,
          ...(shouldReplaceAddonUsages ? { addonUsages: storedAddonUsages } : {}),
          ...(deliveryImageId !== undefined ? { deliveryImageId } : {}),
        },
      });

      if (shouldReplaceAddonUsages) {
        await createAddonUsageRecords(tx, id, pendingAddonUsages);
      }

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
        if (item.cashQuantity > 0) rows.push({ qty: item.cashQuantity, isPackage: false, totalPrice: washFoldInput ? 0 : item.cashQuantity * item.unitPrice, attachPhotos: item.creditQuantity === 0 });
        if (rows.length === 0) rows.push({ qty: item.quantity, isPackage: false, totalPrice: washFoldInput ? 0 : item.totalPrice, attachPhotos: true });

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
            memberEntitlementId: null,
            amount: payableAmount,
            slipImageId: slipImageId ?? null,
            note: body.note?.trim() || null,
            paidAt: existingPayment?.paidAt ?? new Date(),
            metadata: {
              updatedByAdminId: actor.id,
              source: "admin-service-orders",
              orderNo: existing.orderNo,
              subtotalAmount,
              discountAmount,
              hangerCharge,
              vat: {
                rate: vat.vatRate,
                amount: vat.vatAmount,
                included: vat.vatIncluded,
                baseAmount: vat.baseAmount,
              },
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
            paymentNo: await createPaymentNo(),
            userId: paymentUserId!,
            serviceOrderId: id,
            amount: payableAmount,
            slipImageId: slipImageId ?? null,
            note: body.note?.trim() || null,
            paidAt: new Date(),
            metadata: {
              createdByAdminId: actor.id,
              source: "admin-service-orders",
              orderNo: existing.orderNo,
              subtotalAmount,
              discountAmount,
              hangerCharge,
              vat: {
                rate: vat.vatRate,
                amount: vat.vatAmount,
                included: vat.vatIncluded,
                baseAmount: vat.baseAmount,
              },
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

    await reconcilePickupConfirmation(existing.id);
    if (existing.status !== serviceOrderStatus) {
      const notification = notifyServiceOrderStatusChanged({
        serviceOrderId: existing.id,
        fromStatus: existing.status,
        toStatus: serviceOrderStatus,
      });
      if (serviceOrderStatus === "DELIVERING") await notification;
      else void notification;
    }
    if (serviceOrderStatus === "DELIVERING") {
      await dispatchPickupInitialFallback(existing.id);
    }

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
