import { addDays } from "date-fns";
import { requireRole } from "~~/server/utils/auth";
import { prisma } from "~~/server/utils/prisma";
import { createReceiptNo } from "~~/server/utils/receiptNo";
import { notifyReceipt } from "~~/server/utils/notify";
import {
  applyPaymentStateTransition,
  canTransitionPaymentStatus,
  paymentMethods,
  paymentStatuses,
} from "~~/server/utils/paymentStateTransition";
import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";

type UpdatePaymentStateBody = {
  status?: PaymentStatus;
  method?: PaymentMethod | null;
  slipImageId?: string | null;
};

export default defineEventHandler(async (event) => {
  const actor = requireRole(event, ["ADMIN", "EMPLOYEE"]);
  const paymentId = getRouterParam(event, "id");

  if (!paymentId) {
    throw createError({ statusCode: 400, statusMessage: "ไม่พบรหัสการชำระเงิน" });
  }

  const body = await readBody<UpdatePaymentStateBody>(event).catch(() => ({} as UpdatePaymentStateBody));
  const nextStatus = body.status;

  if (!nextStatus || !paymentStatuses.has(nextStatus)) {
    throw createError({ statusCode: 400, statusMessage: "สถานะการชำระเงินไม่ถูกต้อง" });
  }

  if (body.method != null && !paymentMethods.has(body.method)) {
    throw createError({ statusCode: 400, statusMessage: "วิธีชำระเงินไม่ถูกต้อง" });
  }

  const existing = await prisma.paymentRecord.findFirst({
    where: { id: paymentId, deletedAt: null },
    select: {
      id: true,
      status: true,
      method: true,
      paidAt: true,
      confirmedAt: true,
      confirmedById: true,
      receiptNo: true,
      packageSaleId: true,
      slipImageId: true,
      serviceOrder: {
        select: { status: true },
      },
      packageSale: {
        select: {
          customerId: true,
          items: {
            select: {
              id: true,
              memberEntitlements: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  status: true,
                  creditInitial: true,
                  product: { select: { credits: true, validityDays: true } },
                  serviceOrders: { where: { deletedAt: null }, select: { id: true }, take: 1 },
                  serviceOrderAddonUsages: {
                    where: {
                      refundedAt: null,
                      serviceOrder: { deletedAt: null },
                    },
                    select: { id: true },
                    take: 1,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: "ไม่พบการชำระเงิน" });
  }

  const nextMethod = body.method === undefined ? existing.method : body.method;

  if (nextStatus === "PAID" && !nextMethod) {
    throw createError({ statusCode: 400, statusMessage: "กรุณาเลือกวิธีชำระเงินเมื่อสถานะเป็นชำระแล้ว" });
  }

  if (!canTransitionPaymentStatus(existing.status, nextStatus)) {
    throw createError({ statusCode: 409, statusMessage: "ไม่สามารถเปลี่ยนสถานะการชำระเงินนี้ได้" });
  }

  // A cancelled service order must never become payable — marking its payment
  // PAID would generate a receipt and count as revenue for a cancelled order.
  if (nextStatus === "PAID" && existing.serviceOrder?.status === "CANCELLED") {
    throw createError({
      statusCode: 409,
      statusMessage: "ไม่สามารถยืนยันการชำระเงินได้ เนื่องจากรายการรับผ้าถูกยกเลิกแล้ว",
    });
  }

  const packageEntitlements = existing.packageSale?.items.flatMap((item) => item.memberEntitlements) ?? [];
  const hasUsedPackageEntitlement = packageEntitlements.some(
    (entitlement) => entitlement.serviceOrders.length > 0 || entitlement.serviceOrderAddonUsages.length > 0,
  );
  if (nextStatus === "CANCELLED" && hasUsedPackageEntitlement) {
    throw createError({
      statusCode: 409,
      statusMessage: "ไม่สามารถยกเลิกการชำระเงินของแพ็กเกจที่ถูกใช้งานแล้ว",
    });
  }

  const slipProvided = Object.prototype.hasOwnProperty.call(body, "slipImageId");
  const nextSlipImageId = slipProvided ? body.slipImageId ?? null : existing.slipImageId;

  if (slipProvided && body.slipImageId) {
    const slipExists = await prisma.image.findFirst({
      where: { id: body.slipImageId },
      select: { id: true },
    });
    if (!slipExists) {
      throw createError({ statusCode: 400, statusMessage: "ไม่พบหลักฐานการชำระเงิน" });
    }
  }

  const now = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      await applyPaymentStateTransition({
        tx,
        paymentId,
        existing,
        nextStatus,
        nextMethod: nextMethod ?? null,
        nextSlipImageId,
        actorId: actor.id,
        now,
        createReceiptNo: (date, receiptTx) => createReceiptNo(date, receiptTx as never),
      });

      if (nextStatus === "CANCELLED" && packageEntitlements.length > 0) {
        await tx.memberEntitlement.updateMany({
          where: {
            id: { in: packageEntitlements.map((entitlement) => entitlement.id) },
            deletedAt: null,
          },
          data: { status: "CANCELLED" },
        });
      }

      if (nextStatus === "PAID" && packageEntitlements.length > 0) {
        for (const entitlement of packageEntitlements) {
          if (entitlement.status === "ACTIVE") continue;
          const startAt = now;
          await tx.memberEntitlement.update({
            where: { id: entitlement.id },
            data: {
              status: "ACTIVE",
              startAt,
              endAt: entitlement.product.validityDays ? addDays(startAt, entitlement.product.validityDays) : null,
              activatedAt: startAt,
              suspendedAt: null,
              creditInitial: entitlement.product.credits ?? entitlement.creditInitial ?? 0,
              creditRemaining: entitlement.product.credits ?? entitlement.creditInitial ?? 0,
            },
          });
        }
      }
    });

  } catch (error) {
    throw error;
  }

  // Skip the customer notification for a repeated PAID call on an already-paid
  // payment — only the first transition to PAID should send a receipt.
  if (nextStatus === "PAID" && existing.status !== "PAID") {
    void notifyReceipt({ paymentId }).catch((err) => {
      console.error("[state.put] notifyReceipt failed", err);
    });
  }

  return { id: paymentId, status: nextStatus, method: nextMethod ?? null };
});
