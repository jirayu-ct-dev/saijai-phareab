import { Prisma } from "~~/app/generated/prisma/client";
import { prisma } from "~~/server/utils/prisma";
import type { PrintDocument } from "~~/shared/types/printing";
import {
  buildPrintDocument,
  decryptPaymentQrReceiverValue,
  loadPaymentQrReceiverKeyring,
} from "~~/server/utils/printDocument";

const directPaymentInclude = {
  user: { select: { name: true, phoneNumber: true } },
  serviceOrder: {
    select: {
      id: true,
      orderNo: true,
      quotationNo: true,
      status: true,
      receivedAt: true,
      completedAt: true,
      dueAt: true,
      subtotalAmount: true,
      discountAmount: true,
      note: true,
      weightKg: true,
      washFoldPricePerKgSnapshot: true,
      hangerCharge: true,
      memberEntitlementId: true,
      employee: { select: { name: true } },
      memberEntitlement: {
        select: {
          creditInitial: true,
          creditRemaining: true,
          endAt: true,
          product: { select: { name: true } },
        },
      },
      addonUsageRecords: {
        where: { refundedAt: null },
        orderBy: { createdAt: "asc" as const },
        select: { productName: true, credits: true },
      },
      serviceOrderItems: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" as const },
        select: {
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          notes: true,
          isPackageIncluded: true,
          storefrontPrice: {
            select: {
              storefrontService: { select: { name: true } },
              storefrontItem: { select: { name: true } },
            },
          },
        },
      },
    },
  },
  packageSale: {
    select: {
      id: true,
      note: true,
      soldBy: { select: { name: true } },
      subtotalAmount: true,
      discountAmount: true,
      items: {
        orderBy: { createdAt: "asc" as const },
        select: {
          qty: true,
          unitPrice: true,
          totalPrice: true,
          product: { select: { name: true, packageType: true } },
        },
      },
    },
  },
} satisfies Prisma.PaymentRecordInclude;

type DirectPrintDb = Pick<typeof prisma, "$transaction">;

/** Reads one current, consistent document snapshot without creating a PrintJob. */
export const loadDirectPrintDocument = async (
  db: DirectPrintDb,
  input: { paymentId: string; kind: PrintDocument["kind"]; userId?: string; now?: Date },
): Promise<PrintDocument> => db.$transaction(async (tx) => {
  const payment = await tx.paymentRecord.findFirst({
    where: {
      id: input.paymentId,
      deletedAt: null,
      ...(input.userId ? { userId: input.userId } : {}),
    },
    include: directPaymentInclude,
  });
  if (!payment) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบเอกสารที่ระบุ" });
  }

  const usageHistory = payment.serviceOrder?.memberEntitlementId
    ? await tx.serviceOrder.findMany({
        where: {
          memberEntitlementId: payment.serviceOrder.memberEntitlementId,
          deletedAt: null,
        },
        orderBy: { receivedAt: "asc" },
        select: {
          id: true,
          orderNo: true,
          receivedAt: true,
          serviceOrderItems: {
            where: { deletedAt: null, isPackageIncluded: true },
            select: { quantity: true },
          },
        },
      })
    : [];
  if (input.kind === "RECEIPT" && payment.status !== "PAID") {
    throw createError({ statusCode: 409, statusMessage: "รายการนี้ยังไม่พร้อมออกใบเสร็จ" });
  }
  if (input.kind === "QUOTATION" && !payment.serviceOrder) {
    throw createError({ statusCode: 409, statusMessage: "รายการนี้ไม่มีใบเสนอราคา" });
  }

  const [setting, legacyShop] = await Promise.all([
    tx.appSetting.findUnique({ where: { id: "singleton" } }),
    tx.shopSetting.findUnique({ where: { id: "singleton" } }),
  ]);
  const settingSnapshot = {
    name: setting?.name ?? null,
    phone: setting?.phone ?? null,
    address: setting?.address ?? null,
    lineQrImageUrl: setting?.lineQrImageUrl ?? null,
    paymentQrEnabled: setting?.paymentQrEnabled ?? null,
    paymentQrProvider: setting?.paymentQrProvider ?? null,
    paymentQrReceiverType: setting?.paymentQrReceiverType ?? null,
    paymentQrReceiverCiphertext: setting?.paymentQrReceiverCiphertext ?? null,
    paymentQrReceiverLast4: setting?.paymentQrReceiverLast4 ?? null,
    paymentQrReceiverLabel: setting?.paymentQrReceiverLabel ?? null,
    paymentQrKeyVersion: setting?.paymentQrKeyVersion ?? null,
    paymentQrConfigVersion: setting?.paymentQrConfigVersion ?? null,
    paymentQrActivatedAt: setting?.paymentQrActivatedAt ?? null,
    lineQrEnabled: setting?.lineQrEnabled ?? null,
  };

  let receiverValue: string | null = null;
  if (
    settingSnapshot.paymentQrReceiverCiphertext
    && settingSnapshot.paymentQrKeyVersion
    && settingSnapshot.paymentQrActivatedAt
  ) {
    const resolved = decryptPaymentQrReceiverValue({
      ciphertext: settingSnapshot.paymentQrReceiverCiphertext,
      keyVersion: settingSnapshot.paymentQrKeyVersion,
      keyring: loadPaymentQrReceiverKeyring(),
    });
    receiverValue = resolved.ok ? resolved.value : null;
  }

  return buildPrintDocument({
    kind: input.kind,
    payment: {
      ...payment,
      serviceOrder: payment.serviceOrder
        ? {
            ...payment.serviceOrder,
            usageHistory: usageHistory.map((row) => ({
              orderNo: row.orderNo,
              receivedAt: row.receivedAt,
              quantity: row.serviceOrderItems.reduce((sum, item) => sum + item.quantity, 0),
              isCurrent: row.id === payment.serviceOrder?.id,
            })),
          }
        : null,
      packageSale: payment.packageSale
        ? {
            ...payment.packageSale,
            items: payment.packageSale.items.map((item) => ({
              productName: item.product.name,
              packageType: item.product.packageType,
              qty: item.qty,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          }
        : null,
    },
    setting: settingSnapshot,
    legacyShop: legacyShop
      ? {
          name: legacyShop.name,
          phone: legacyShop.phone,
          address: legacyShop.address,
          lineQrImageUrl: legacyShop.lineQrImageUrl,
        }
      : null,
    receiverValue,
    now: input.now ?? new Date(),
  }).document;
});

export const loadCurrentDirectPrintDocument = (
  input: { paymentId: string; kind: PrintDocument["kind"]; userId?: string; now?: Date },
) => loadDirectPrintDocument(prisma, input);
