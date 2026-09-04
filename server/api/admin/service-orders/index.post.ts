import type { ServiceOrderStatus } from "~~/shared/types/enums";
import { getBusinessSetting } from "~~/server/utils/appSetting";
import { computeVat } from "~~/server/utils/vat";
import { requireRole } from "~~/server/utils/auth";
import { createPaymentNo } from "~~/server/utils/paymentNo";
import { createReceiptNo } from "~~/server/utils/receiptNo";
import { createQuotationNo } from "~~/server/utils/quotationNo";
import { prisma } from "~~/server/utils/prisma";
import { createServiceOrderNo } from "~~/server/utils/serviceOrderNo";
import { createOfflineCustomer, isCustomerUniqueConflict, resolveOfflineCustomerConflict } from "~~/server/utils/customerAccount";
import { notifyQuotationCreated, notifyServiceOrderCreated, notifyServiceOrderStatusChanged } from "~~/server/utils/notify";
import { createAddonUsageRecords } from "~~/server/utils/serviceOrderCredits";
import { isServiceOrderStatus, resolveServiceOrderCompletedAt } from "~~/server/utils/serviceOrderStatusTransition";
import { parseBangkokDateTime } from "~~/shared/utils/pickup";

type CreateServiceOrderBody = {
  customerId?: string | null;
  newCustomer?: { name?: string | null; phoneNumber?: string | null; email?: string | null } | null;
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

  const customerId = body.customerId?.trim() || null;
  const newCustomer = body.newCustomer ?? null;
  const requestedEntitlementId = body.memberEntitlementId?.trim() || null;
  const orderImageId = body.orderImageId?.trim() || null;

  if ((!customerId && !newCustomer) || (customerId && newCustomer)) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกลูกค้าเดิมหรือเพิ่มลูกค้าใหม่อย่างใดอย่างหนึ่ง" });
  }
  if (newCustomer && requestedEntitlementId) {
    throw createError({ statusCode: 400, statusMessage: "ลูกค้าใหม่ยังไม่มีสิทธิ์แพ็กเกจให้เลือก" });
  }
  if (newCustomer && Array.isArray(body.addonEntitlements) && body.addonEntitlements.length > 0) {
    throw createError({ statusCode: 400, statusMessage: "ลูกค้าใหม่ยังไม่มีแพ็กเกจเสริมให้เลือก" });
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
        storefrontPriceId: item.storefrontPriceId,
        quantity: Number(item.quantity ?? 1),
        unitPriceOverride: item.unitPrice != null && Number.isFinite(Number(item.unitPrice)) ? Number(item.unitPrice) : null,
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
  // A new order must not be born cancelled: the create flow deducts package
  // credits with no refund branch, so a CANCELLED create would permanently
  // consume credits. Cancel via the status endpoint instead (it refunds).
  if (serviceOrderStatus === "CANCELLED") {
    throw createError({
      statusCode: 400,
      statusMessage: "ไม่สามารถสร้างรายการรับผ้าในสถานะยกเลิกได้ กรุณาสร้างรายการก่อนแล้วยกเลิกผ่านหน้าจอเปลี่ยนสถานะ",
    });
  }
  const receivedAt = new Date();
  const dueAt = parseBangkokDateTime(body.dueAt);

  if (dueAt && Number.isNaN(dueAt.getTime())) {
    throw createError({ statusCode: 400, statusMessage: "วันนัดรับไม่ถูกต้อง" });
  }

  try {
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

    let activationToken: string | null = null;
    const created = await prisma.$transaction(async (tx) => {
      let paymentUserId = customerId;
      if (newCustomer) {
        const offlineCustomer = await createOfflineCustomer(tx, {
          name: newCustomer.name,
          phoneNumber: newCustomer.phoneNumber,
          email: newCustomer.email,
          createdByStaffId: actor.id,
        });
        paymentUserId = offlineCustomer.customer.id;
        activationToken = offlineCustomer.activationToken;
      } else {
        const customer = await tx.user.findFirst({
          where: { id: customerId!, role: "USER", deletedAt: null },
          select: { id: true },
        });
        if (!customer) throw createError({ statusCode: 404, statusMessage: "ไม่พบลูกค้าที่เลือก" });
      }

      let memberEntitlement = null as null | {
        id: string;
        customerId: string;
        creditRemaining: number | null;
      };

      if (requestedEntitlementId) {
        memberEntitlement = await tx.memberEntitlement.findFirst({
          where: {
            id: requestedEntitlementId,
            customerId: paymentUserId!,
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
      const rawAddonEntitlements = Array.isArray(body.addonEntitlements) ? body.addonEntitlements : [];
      for (const entry of rawAddonEntitlements) {
        const credits = Math.floor(Number(entry.credits ?? 0));
        if (!entry.entitlementId || credits <= 0) continue;
        const addonEnt = await tx.memberEntitlement.findFirst({
          where: {
            id: entry.entitlementId,
            customerId: paymentUserId!,
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
          completedAt: resolveServiceOrderCompletedAt({
            fromStatus: null,
            toStatus: serviceOrderStatus,
            currentCompletedAt: null,
            transitionAt: receivedAt,
          }),
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

    return { ...created, activationToken };
  } catch (error) {
    if (error && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    const duplicateCustomer = await resolveOfflineCustomerConflict(error, newCustomer ?? undefined);
    if (duplicateCustomer) {
      throw createError({
        statusCode: 409,
        statusMessage: "เบอร์โทรหรืออีเมลนี้มีบัญชีลูกค้าอยู่แล้ว",
        data: { customer: duplicateCustomer },
      });
    }
    if (isCustomerUniqueConflict(error)) {
      throw createError({ statusCode: 409, statusMessage: "เบอร์โทรหรืออีเมลนี้มีบัญชีอยู่แล้ว" });
    }

    console.error("[POST /api/admin/service-orders]", error);
    throw createError({
      statusCode: 500,
      statusMessage: "ไม่สามารถสร้างรายการรับผ้าหน้าร้านได้",
    });
  }
});
