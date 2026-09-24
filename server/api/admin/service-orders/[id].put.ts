import type { ServiceOrderStatus } from "~~/shared/types/enums";
import { notifyReceipt, notifyServiceOrderStatusChanged } from "~~/server/utils/notify";
import { getBusinessSetting } from "~~/server/utils/appSetting";
import { computeVat } from "~~/server/utils/vat";
import { requireRole } from "~~/server/utils/auth";
import { createPaymentNo } from "~~/server/utils/paymentNo";
import { createReceiptNo } from "~~/server/utils/receiptNo";
import { prisma } from "~~/server/utils/prisma";
import { createAddonUsageRecords, refundAddonUsages, voidPendingAddonUsageRecords } from "~~/server/utils/serviceOrderCredits";
import { canTransitionServiceOrderStatus, isServiceOrderStatus, resolveServiceOrderCompletedAt } from "~~/server/utils/serviceOrderStatusTransition";
import { parseBangkokDateTime } from "~~/shared/utils/pickup";
import { backdatedEntitlementWhere } from "~~/server/utils/backdatedEntitlement";
import { allocatePackageCredits } from "~~/shared/utils/packageService";
import { isPackageCatalogItemAllowed } from "~~/shared/utils/packageCatalog";
import { z } from "zod";

const orderItemInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PACKAGE"), storefrontItemId: z.string().trim().min(1), quantity: z.number().int().min(1).max(1000),
    imageId: z.string().trim().min(1).optional().nullable(), notes: z.string().trim().max(2000).optional().nullable(),
    photos: z.array(z.object({ imageId: z.string().trim().min(1), isDamaged: z.boolean().optional(), sortOrder: z.number().int().optional() }).strict()).max(30).optional(),
  }).strict(),
  z.object({
    type: z.literal("STOREFRONT"), storefrontPriceId: z.string().trim().min(1), quantity: z.number().int().min(1).max(1000),
    unitPrice: z.number().finite().min(0).nullable().optional(), isChargeable: z.boolean().optional(),
    imageId: z.string().trim().min(1).optional().nullable(), notes: z.string().trim().max(2000).optional().nullable(),
    photos: z.array(z.object({ imageId: z.string().trim().min(1), isDamaged: z.boolean().optional(), sortOrder: z.number().int().optional() }).strict()).max(30).optional(),
  }).strict(),
]);

type UpdateServiceOrderBody = {
  customerId?: string | null;
  memberEntitlementId?: string | null;
  addonEntitlements?: Array<{ entitlementId: string; credits: number }>;
  orderImageId?: string | null;
  deliveryImageId?: string | null;
  items: unknown[];
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
  const customerId = body.customerId?.trim() || null;
  const requestedEntitlementId = body.memberEntitlementId?.trim() || null;
  const orderImageId = body.orderImageId?.trim() || null;
  const deliveryImageId = body.deliveryImageId === null ? null : body.deliveryImageId?.trim() || undefined;
  const shouldReplaceAddonUsages = Array.isArray(body.addonEntitlements);
  if (body.serviceOrderStatus !== undefined && !isServiceOrderStatus(body.serviceOrderStatus)) {
    throw createError({ statusCode: 400, statusMessage: "สถานะรายการรับผ้าไม่ถูกต้อง" });
  }

  if (!customerId) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกลูกค้า" });
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

  const parsedItems = z.array(orderItemInputSchema).max(100).safeParse(body.items);
  if (!parsedItems.success) {
    throw createError({ statusCode: 400, statusMessage: "รายการผ้าไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่" });
  }
  const normalizedItems = parsedItems.data
    .map((item) => {
      const rawPhotos = Array.isArray(item.photos) ? item.photos : [];
      const parsedPhotos = rawPhotos
        .map((photo, index) => ({
          imageId: photo.imageId?.trim() || "",
          isDamaged: Boolean(photo.isDamaged),
          sortOrder: Number.isFinite(photo.sortOrder) ? Number(photo.sortOrder) : index,
        }))
        .filter((photo) => photo.imageId);
      const legacyImageId = item.imageId?.trim() || "";
      const photos = parsedPhotos.length > 0
        ? parsedPhotos
        : legacyImageId
          ? [{ imageId: legacyImageId, isDamaged: false, sortOrder: 0 }]
          : [];

      return {
        ...item,
        notes: item.notes?.trim() || null,
        photos,
      };
    });

  const hangerCount = body.hangerCount ?? 0;
  const missingHangerCount = body.missingHangerCount ?? 0;
  if (!Number.isInteger(hangerCount) || hangerCount < 0) {
    throw createError({ statusCode: 400, statusMessage: "จำนวนไม้แขวนที่ลูกค้าให้มาต้องเป็น 0 หรือมากกว่า" });
  }
  if (!Number.isInteger(missingHangerCount) || missingHangerCount < 0) {
    throw createError({ statusCode: 400, statusMessage: "จำนวนไม้แขวนที่ซื้อเพิ่มต้องเป็น 0 หรือมากกว่า" });
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
    if (existing.payments.some((payment) => payment.status === "PAID")) {
      throw createError({
        statusCode: 409,
        statusMessage: "ออเดอร์ที่ชำระเงินแล้วแก้ไขยอด รายการ หรือแพ็กเกจผ่านหน้านี้ไม่ได้ กรุณาใช้ขั้นตอนปรับยอดที่มีประวัติการตรวจสอบ",
      });
    }

    const paymentUserId = customerId;
    const customer = await prisma.user.findFirst({
      where: { id: customerId, role: "USER", deletedAt: null },
      select: { id: true },
    });
    if (!customer) {
      throw createError({ statusCode: 404, statusMessage: "ไม่พบลูกค้าที่เลือก" });
    }

    const priceIds = [...new Set(normalizedItems.flatMap((item) => item.type === "STOREFRONT" ? [item.storefrontPriceId] : []))];
    const packageItemIds = [...new Set(normalizedItems.flatMap((item) => item.type === "PACKAGE" ? [item.storefrontItemId] : []))];
    const [storefrontPrices, packageItems] = await Promise.all([prisma.storefrontPrice.findMany({
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
    }), prisma.storefrontItem.findMany({
      // Package entitlements own their inclusion list; storefront price/item
      // deactivation must not invalidate an already-included garment.
      where: { id: { in: packageItemIds } },
      select: { id: true, name: true },
    })]);

    if (storefrontPrices.length !== priceIds.length) {
      throw createError({ statusCode: 404, statusMessage: "มีรายการบริการบางรายการไม่ถูกต้องหรือถูกปิดใช้งาน" });
    }
    if (packageItems.length !== packageItemIds.length) {
      throw createError({ statusCode: 404, statusMessage: "มีรายการผ้าในแพ็กเกจบางรายการไม่ถูกต้องหรือถูกปิดใช้งาน" });
    }

    const priceMap = new Map(storefrontPrices.map((item) => [item.id, item]));
    const packageItemMap = new Map(packageItems.map((item) => [item.id, item]));
    const orderItems = normalizedItems.map((item) => {
      if (item.type === "PACKAGE") {
        const storefrontItem = packageItemMap.get(item.storefrontItemId);
        if (!storefrontItem) throw createError({ statusCode: 404, statusMessage: "ไม่พบรายการผ้าในแพ็กเกจที่เลือก" });
        return {
          type: item.type, price: null, itemId: storefrontItem.id, itemName: storefrontItem.name,
          quantity: item.quantity, unitPrice: 0, totalPrice: 0, isPackageIncluded: true, isChargeable: false,
          notes: item.notes, photos: item.photos,
        };
      }

      const price = priceMap.get(item.storefrontPriceId);
      if (!price) throw createError({ statusCode: 404, statusMessage: "ไม่พบบริการที่เลือก" });
      const priceMin = price.priceMin == null ? null : Number(price.priceMin);
      const priceMax = price.priceMax == null ? null : Number(price.priceMax);
      const isRangePrice = priceMin != null && priceMax != null && priceMin !== priceMax;
      if (isRangePrice && (item.unitPrice == null || item.unitPrice < priceMin || item.unitPrice > priceMax)) {
        throw createError({ statusCode: 400, statusMessage: `ราคาของ "${price.storefrontItem.name}" ต้องอยู่ระหว่าง ${priceMin}–${priceMax} บาท` });
      }
      const unitPrice = isRangePrice ? item.unitPrice! : Number(price.price);
      const isChargeable = item.isChargeable !== false;
      return {
        type: item.type, price, itemId: price.storefrontItem.id, itemName: price.storefrontItem.name,
        quantity: item.quantity,
        unitPrice,
        totalPrice: isChargeable ? unitPrice * item.quantity : 0,
        isPackageIncluded: false,
        isChargeable,
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
      ? { count: 0, providedCount: 0, pricePerUnit: 0, total: 0 }
      : {
          count: missingHangerCount,
          providedCount: hangerCount,
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
    if (!canTransitionServiceOrderStatus(existing.status, serviceOrderStatus)) {
      throw createError({
        statusCode: 400,
        statusMessage: "ไม่สามารถข้ามสถานะรายการรับผ้าได้",
      });
    }
    const statusTransitionAt = new Date();
    const existingSlipImageId = existing.payments[0]?.slipImage?.id ?? null;
    const slipImageId = body.slipImageId !== undefined ? body.slipImageId : existingSlipImageId;

    let allocation = allocatePackageCredits(orderItems, 0, false);
    let allocatedItems = allocation.items;
    let creditUsed = 0;
    let subtotalAmount = washFoldInput
      ? washFoldSubtotal
      : allocation.cashSubtotal;
    let discountAmount = Math.min(Number(body.discountAmount ?? 0), subtotalAmount);
    let beforeVat = subtotalAmount - discountAmount + hangerCharge.total;
    let vat = computeVat({ amount: beforeVat, rate: business.vatRate, included: business.vatIncluded });
    let payableAmount = vat.totalAmount;


    await prisma.$transaction(async (tx) => {
      if (existing.memberEntitlementId && existing.creditUsed) {
        // Preserve balance accounting even if the entitlement is currently
        // suspended/expired/cancelled; its status still prevents further use.
        const { count } = await tx.memberEntitlement.updateMany({
          where: {
            id: existing.memberEntitlementId,
            deletedAt: null,
            creditRemaining: { not: null },
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

      if (shouldReplaceAddonUsages || serviceOrderStatus === "CANCELLED") {
        await refundAddonUsages(tx, existing.id);
        await voidPendingAddonUsageRecords(tx, existing.id);
      }

      let nextEntitlementId: string | null = null;
      if (orderItems.some((item) => item.isPackageIncluded) && !requestedEntitlementId && serviceOrderStatus !== "CANCELLED") {
        throw createError({ statusCode: 400, statusMessage: "ต้องเลือกแพ็กเกจเพื่อเพิ่มรายการผ้าที่รวมในแพ็กเกจ" });
      }

      // A cancelled order holds no package credits — never re-deduct an
      // entitlement for it, or the stored creditUsed would trigger a second
      // refund on a later cancel/delete.
      if (requestedEntitlementId && serviceOrderStatus !== "CANCELLED") {
        // An edit keeps the order's original receive date, so the replacement
        // package must cover it — an edit cannot re-bill the order onto a
        // package from another month (expired-but-covering stays allowed for
        // backdated orders).
        const entitlement = await tx.memberEntitlement.findFirst({
          where: {
            id: requestedEntitlementId,
            customerId: customerId!,
            ...backdatedEntitlementWhere(existing.receivedAt),
          },
          select: {
            id: true,
            creditRemaining: true,
            product: {
              select: {
                packageServiceId: true,
                packageService: {
                  select: { includedItems: { select: { storefrontItemId: true } } },
                },
              },
            },
          },
        });

        if (!entitlement) {
          throw createError({ statusCode: 404, statusMessage: "ไม่พบสิทธิ์แพ็กเกจรายเดือนที่เลือก หรือช่วงสิทธิ์ไม่ครอบคลุมวันรับผ้าของรายการนี้" });
        }

        const rule = { includedItemIds: entitlement.product.packageService?.includedItems.map((item) => item.storefrontItemId) ?? [] };
        const invalidItem = orderItems.find((item) => item.isPackageIncluded && !isPackageCatalogItemAllowed(rule, { itemId: item.itemId }));
        if (invalidItem) {
          throw createError({
            statusCode: 400,
            statusMessage: `รายการ "${invalidItem.itemName}" ไม่อยู่ในแพ็กเกจที่เลือก`,
          });
        }

        const creditAvailable = Number(entitlement.creditRemaining ?? 0);
        allocation = allocatePackageCredits(orderItems, creditAvailable, true);
        allocatedItems = allocation.items;
        creditUsed = allocation.creditUsed;
        subtotalAmount = allocation.cashSubtotal;
        discountAmount = Math.min(Number(body.discountAmount ?? 0), subtotalAmount);
        beforeVat = subtotalAmount - discountAmount + hangerCharge.total;
        vat = computeVat({ amount: beforeVat, rate: business.vatRate, included: business.vatIncluded });
        payableAmount = vat.totalAmount;

        if (creditUsed > 0) {
          const { count } = await tx.memberEntitlement.updateMany({
            where: {
              id: entitlement.id,
              deletedAt: null,
              ...backdatedEntitlementWhere(existing.receivedAt),
            },
            data: {
              creditRemaining: {
                decrement: creditUsed,
              },
            },
          });

          if (count === 0) {
            throw createError({ statusCode: 409, statusMessage: "ไม่พบสิทธิ์แพ็กเกจที่เลือก กรุณาลองใหม่" });
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
      // A cancelled order holds no addon usage — skip re-deducting any
      // entitlements the client may still send alongside the cancel.
      const rawAddonEntitlements = shouldReplaceAddonUsages && serviceOrderStatus !== "CANCELLED"
        ? body.addonEntitlements ?? []
        : [];
      for (const entry of rawAddonEntitlements) {
        const credits = Math.floor(Number(entry.credits ?? 0));
        if (!entry.entitlementId) continue;
        const addonEnt = await tx.memberEntitlement.findFirst({
          where: {
            id: entry.entitlementId,
            customerId: customerId!,
            ...backdatedEntitlementWhere(existing.receivedAt),
            product: { packageType: "ADDON" },
          },
          include: { product: { select: { id: true, name: true, deductOn: true, isDelivery: true } } },
        });
        if (!addonEnt) {
          throw createError({ statusCode: 400, statusMessage: `ไม่พบสิทธิ์แพ็กเกจเสริม (${entry.entitlementId})` });
        }
        if (!addonEnt.product.isDelivery && credits <= 0) continue;
        const shouldDeductNow = !addonEnt.product.isDelivery
          && (addonEnt.product.deductOn === "CREATED" || serviceOrderStatus === "COMPLETED");
        const usage: PendingAddonUsage = {
          entitlementId: addonEnt.id,
          productId: addonEnt.product.id,
          productName: addonEnt.product.name,
          credits: addonEnt.product.isDelivery ? 0 : credits,
          deductOn: addonEnt.product.deductOn,
          isDelivery: addonEnt.product.isDelivery,
          deductedAt: undefined,
        };
        if (shouldDeductNow) {
          const { count } = await tx.memberEntitlement.updateMany({
            where: {
              id: addonEnt.id,
              creditRemaining: { gte: credits },
              ...backdatedEntitlementWhere(existing.receivedAt),
            },
            data: { creditRemaining: { decrement: credits } },
          });
          if (count === 0) {
            throw createError({ statusCode: 400, statusMessage: `เครดิตของ "${addonEnt.product.name}" ไม่พอ` });
          }
          const deductedAt = new Date().toISOString();
          usage.appliedAt = deductedAt;
          usage.deductedAt = deductedAt;
        }
        pendingAddonUsages.push(usage);
      }

      const existingPayment = existing.payments[0];

      const deletedAt = new Date();

      const { count: updatedOrderCount } = await tx.serviceOrder.updateMany({
        where: { id, status: existing.status, deletedAt: null },
        data: {
          customerId: paymentUserId!,
          employeeId: existing.employeeId ?? actor.id,
          status: serviceOrderStatus,
          completedAt: resolveServiceOrderCompletedAt({
            fromStatus: existing.status,
            toStatus: serviceOrderStatus,
            currentCompletedAt: existing.completedAt,
            transitionAt: statusTransitionAt,
          }),
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
          ...(deliveryImageId !== undefined ? { deliveryImageId } : {}),
        },
      });
      if (updatedOrderCount !== 1) {
        throw createError({
          statusCode: 409,
          statusMessage: "สถานะรายการรับผ้าถูกเปลี่ยนโดยผู้ใช้อื่น กรุณาลองใหม่",
          data: { code: "SERVICE_ORDER_STATUS_CONFLICT" },
        });
      }

      if (shouldReplaceAddonUsages && serviceOrderStatus !== "CANCELLED") {
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
        const createdItem = await tx.serviceOrderItem.create({
          data: {
            serviceOrderId: id,
            storefrontPriceId: item.price?.id ?? null,
            storefrontItemId: item.itemId,
            isPackageIncluded: item.isPackageIncluded,
            isChargeable: item.isChargeable,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: washFoldInput ? 0 : item.totalPrice,
            notes: item.notes,
          },
          select: { id: true },
        });

        if (item.photos.length > 0) {
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

      if (existingPayment) {
        const isZeroTotal = payableAmount === 0;
        const settledAt = isZeroTotal ? existingPayment.paidAt ?? new Date() : existingPayment.paidAt;
        const receiptNo = isZeroTotal
          ? existingPayment.receiptNo ?? await createReceiptNo(settledAt!, tx)
          : existingPayment.receiptNo;
        await tx.paymentRecord.update({
          where: { id: existingPayment.id },
          data: {
            userId: paymentUserId!,
            amount: payableAmount,
            ...(isZeroTotal ? {
              status: "PAID" as const,
              receiptNo,
              paidAt: settledAt,
              confirmedAt: existingPayment.confirmedAt ?? settledAt,
              confirmedById: existingPayment.confirmedById ?? actor.id,
            } : {}),
            slipImageId: slipImageId ?? null,
            note: body.note?.trim() || null,
            // Preserve earlier metadata such as the backdated marker.
            metadata: {
              ...(existingPayment && typeof existingPayment.metadata === "object" && existingPayment.metadata
                ? existingPayment.metadata
                : {}),
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
              memberEntitlementId: nextEntitlementId,
              creditUsed: nextEntitlementId ? creditUsed : null,
              orderImageId,
            },
          },
        });

        await tx.paymentAuditLog.create({
          data: {
            paymentId: existingPayment.id,
            action: isZeroTotal && existingPayment.status !== "PAID" ? "CONFIRMED" : "UPDATED",
            actorId: actor.id,
            beforeJson: {
              userId: existingPayment.userId,
              amount: Number(existingPayment.amount),
              status: existingPayment.status,
              receiptNo: existingPayment.receiptNo,
              slipImageId: existingPayment.slipImageId,
            },
            afterJson: {
              userId: paymentUserId,
              amount: payableAmount,
              status: isZeroTotal ? "PAID" : existingPayment.status,
              receiptNo,
              slipImageId: slipImageId ?? null,
            },
          },
        });
      } else {
        const isZeroTotal = payableAmount === 0;
        const settledAt = isZeroTotal ? new Date() : null;
        await tx.paymentRecord.create({
          data: {
            paymentNo: await createPaymentNo(),
            userId: paymentUserId!,
            serviceOrderId: id,
            amount: payableAmount,
            status: isZeroTotal ? "PAID" : "UNPAID",
            receiptNo: isZeroTotal ? await createReceiptNo(settledAt!, tx) : null,
            paidAt: settledAt,
            confirmedAt: settledAt,
            confirmedById: isZeroTotal ? actor.id : null,
            slipImageId: slipImageId ?? null,
            note: body.note?.trim() || null,
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
              memberEntitlementId: nextEntitlementId,
              creditUsed: nextEntitlementId ? creditUsed : null,
              orderImageId,
            },
          },
        });
      }
    });

    const paymentMetadata = existing.payments[0]?.metadata;
    const isBackdatedOrder = Boolean(
      paymentMetadata
      && typeof paymentMetadata === "object"
      && "backdated" in paymentMetadata,
    );
    if (payableAmount === 0 && !isBackdatedOrder) {
      const freePayment = await prisma.paymentRecord.findFirst({
        where: { serviceOrderId: id, deletedAt: null },
        select: { id: true },
      });
      if (freePayment) void notifyReceipt({ paymentId: freePayment.id });
    }

    if (existing.status !== serviceOrderStatus) {
      const notification = notifyServiceOrderStatusChanged({
        serviceOrderId: existing.id,
        fromStatus: existing.status,
        toStatus: serviceOrderStatus,
      });
      if (serviceOrderStatus === "DELIVERING") await notification;
      else void notification;
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
