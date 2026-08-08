import type { ServiceOrderStatus } from "~~/shared/types/enums";
import { getBusinessSetting } from "~~/server/utils/businessSetting";
import { computeVat } from "~~/server/utils/vat";
import { requireRole } from "~~/server/utils/auth";
import { createPaymentNo } from "~~/server/utils/paymentNo";
import { createReceiptNo } from "~~/server/utils/receiptNo";
import { createQuotationNo } from "~~/server/utils/quotationNo";
import { prisma } from "~~/server/utils/prisma";
import { createServiceOrderNo } from "~~/server/utils/serviceOrderNo";
import { ensureWalkInCustomer } from "~~/server/utils/walkInCustomer";
import { notifyQuotationCreated, notifyServiceOrderCreated, notifyServiceOrderStatusChanged } from "~~/server/utils/notify";
import { createAddonUsageRecords } from "~~/server/utils/serviceOrderCredits";
import { isServiceOrderStatus } from "~~/server/utils/serviceOrderStatusTransition";
import { parseBangkokDateTime } from "~~/shared/utils/pickup";
import { reconcilePickupConfirmation } from "~~/server/utils/pickupConfirmation";

type CreateServiceOrderBody = {
  customerId?: string | null;
  isWalkIn?: boolean;
  walkInName?: string | null;
  walkInPhone?: string | null;
  memberEntitlementId?: string | null;
  addonEntitlements?: Array<{ entitlementId: string; credits: number }>;
  orderImageId?: string | null;
  items: Array<{
    storefrontPriceId: string;
    quantity: number;
    unitPrice?: number | null;
    imageId?: string | null;
    notes?: string | null;
    photos?: Array<{ imageId: string; isDamaged?: boolean; sortOrder?: number }>;
  }>;
  washFold?: {
    weightKg: number;
    notes?: string | null;
  } | null;
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

  const serviceOrderStatus: ServiceOrderStatus = body.serviceOrderStatus ?? "RECEIVED";
  if (!isServiceOrderStatus(serviceOrderStatus)) {
    throw createError({ statusCode: 400, statusMessage: "สถานะรายการรับผ้าไม่ถูกต้อง" });
  }
  const receivedAt = new Date();
  const dueAt = parseBangkokDateTime(body.dueAt);

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

    const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const business = await getBusinessSetting();

    if (washFoldInput) {
      if (washFoldInput.weightKg <= 0) {
        throw createError({ statusCode: 400, statusMessage: "น้ำหนักต้องมากกว่า 0" });
      }
      if (business.washFoldMinKg > 0 && washFoldInput.weightKg < business.washFoldMinKg) {
        throw createError({
          statusCode: 400,
          statusMessage: `น้ำหนักขั้นต่ำ ${business.washFoldMinKg} กก.`,
        });
      }
    }

    const hangerCharge = washFoldInput
      ? { count: 0, pricePerUnit: 0, total: 0 }
      : {
          count: missingHangerCount,
          pricePerUnit: business.hangerPricePerUnit,
          total: missingHangerCount * business.hangerPricePerUnit,
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

      const washFoldSubtotal = washFoldInput
        ? Math.round(washFoldInput.weightKg * business.washFoldPricePerKg * 100) / 100
        : 0;
      const subtotalAmount = washFoldInput
        ? washFoldSubtotal
        : allocatedItems.reduce((sum, item) => sum + item.cashQuantity * item.unitPrice, 0);
      const washFoldPriceSnapshot = washFoldInput ? business.washFoldPricePerKg : null;
      const discountAmount = Math.min(Number(body.discountAmount ?? 0), subtotalAmount);
      const beforeVat = subtotalAmount - discountAmount + hangerCharge.total;
      const vat = computeVat({ amount: beforeVat, rate: business.vatRate, included: business.vatIncluded });
      const payableAmount = vat.totalAmount;
      const isPackageFullyCovered = Boolean(memberEntitlement && creditUsed > 0 && payableAmount === 0);

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
      const rawAddonEntitlements = Array.isArray(body.addonEntitlements) ? body.addonEntitlements : [];
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
        const usage: PendingAddonUsage = {
          entitlementId: addonEnt.id,
          productId: addonEnt.product.id,
          productName: addonEnt.product.name,
          credits,
          deductOn: addonEnt.product.deductOn,
          isDelivery: addonEnt.product.isDelivery,
          deductedAt: undefined,
        };
        const shouldDeductNow = addonEnt.product.deductOn === "CREATED" || serviceOrderStatus === "COMPLETED";
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

      const serviceOrder = await tx.serviceOrder.create({
        data: {
          orderNo: await createServiceOrderNo(receivedAt),
          quotationNo: await createQuotationNo(receivedAt, tx),
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
          weightKg: washFoldInput?.weightKg ?? null,
          washFoldPricePerKgSnapshot: washFoldPriceSnapshot,
          note: body.note?.trim() || null,
          imageId: orderImageId,
          addonUsages: storedAddonUsages.length ? storedAddonUsages : undefined,
        },
      });

      await createAddonUsageRecords(tx, serviceOrder.id, pendingAddonUsages);

      for (const item of allocatedItems) {
        const rows: Array<{ qty: number; isPackage: boolean; totalPrice: number; attachPhotos: boolean }> = [];
        if (item.creditQuantity > 0) {
          rows.push({ qty: item.creditQuantity, isPackage: true, totalPrice: 0, attachPhotos: true });
        }
        if (item.cashQuantity > 0) {
          rows.push({
            qty: item.cashQuantity,
            isPackage: false,
            totalPrice: washFoldInput ? 0 : item.cashQuantity * item.unitPrice,
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
          paymentNo: await createPaymentNo(),
          receiptNo: isPackageFullyCovered ? await createReceiptNo(receivedAt, tx) : null,
          userId: paymentUserId!,
          serviceOrderId: serviceOrder.id,
          amount: payableAmount,
          status: isPackageFullyCovered ? "PAID" : "UNPAID",
          method: null,
          slipImageId: null,
          note: body.note?.trim() || null,
          paidAt: isPackageFullyCovered ? receivedAt : null,
          confirmedAt: isPackageFullyCovered ? receivedAt : null,
          confirmedById: isPackageFullyCovered ? actor.id : null,
          metadata: {
            createdByAdminId: actor.id,
            source: "admin-service-orders",
            orderNo: serviceOrder.orderNo,
            quotationNo: serviceOrder.quotationNo,
            subtotalAmount,
            discountAmount,
            hangerCharge,
            vat: {
              rate: vat.vatRate,
              amount: vat.vatAmount,
              included: vat.vatIncluded,
              baseAmount: vat.baseAmount,
            },
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

      await tx.paymentAuditLog.create({
        data: {
          paymentId: payment.id,
          action: isPackageFullyCovered ? "CONFIRMED" : "CREATED",
          actorId: actor.id,
          afterJson: {
            status: isPackageFullyCovered ? "PAID" : "UNPAID",
            amount: payableAmount,
            quotationNo: serviceOrder.quotationNo,
            receiptNo: payment.receiptNo,
          },
        },
      });

      return {
        id: serviceOrder.id,
        orderNo: serviceOrder.orderNo,
        paymentId: payment.id,
      };
    });

    await reconcilePickupConfirmation(created.id);

    if (serviceOrderStatus === "RECEIVED") {
      // Send RECEIVED notification first, then transition to PROCESSING
      await notifyServiceOrderCreated({ serviceOrderId: created.id });
      await notifyQuotationCreated({ serviceOrderId: created.id });
      await prisma.serviceOrder.update({
        where: { id: created.id },
        data: { status: "PROCESSING" },
      });
      void notifyServiceOrderStatusChanged({
        serviceOrderId: created.id,
        fromStatus: "RECEIVED",
        toStatus: "PROCESSING",
      });
    } else {
      await notifyServiceOrderCreated({ serviceOrderId: created.id, status: serviceOrderStatus });
      await notifyQuotationCreated({ serviceOrderId: created.id });
    }

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
