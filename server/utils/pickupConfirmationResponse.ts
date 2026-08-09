import type { PickupConfirmationResponse } from "~~/app/generated/prisma/client";
import { pushMessage, type LineMessage } from "~~/server/utils/line-messaging";
import { prisma } from "~~/server/utils/prisma";
import type { PickupConfirmationResponseValue } from "~~/shared/utils/pickupConfirmationPostback";
import { formatDateTime } from "~~/shared/utils/format";

const MAX_STAFF_NOTIFY_ATTEMPTS = 5;

export const pickupResponseLabels: Record<PickupConfirmationResponseValue, string> = {
  HOME_PICKUP: "มีผ้าส่งซัก — รับกลับจากบ้าน",
  SELF_DROPOFF: "นำผ้ามาส่งที่ร้านเอง",
  SKIP: "ไม่มีผ้ารอบนี้",
  CONTACT_REQUESTED: "ขอเลื่อน / กรุณาติดต่อลูกค้า",
};

export type RecordPickupResponseInput = {
  webhookEventId: string;
  confirmationId: string;
  revision: number;
  response: PickupConfirmationResponseValue;
  respondedByLineId: string;
  now?: Date;
};

export type RecordPickupResponseResult =
  | { ok: true; duplicate: boolean; changed: boolean; eventId: string; responseCount: number }
  | { ok: false; reason: "NOT_FOUND" | "UNAUTHORIZED" | "STALE" | "CLOSED" };

const isUniqueConstraintError = (error: unknown): boolean =>
  Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");

class PickupResponseConflictError extends Error {}

export async function recordPickupResponse(input: RecordPickupResponseInput): Promise<RecordPickupResponseResult> {
  const now = input.now ?? new Date();
  const duplicate = await prisma.pickupConfirmationResponseEvent.findUnique({
    where: { webhookEventId: input.webhookEventId },
    select: { id: true, confirmationId: true, respondedByLineId: true, revision: true },
  });
  if (duplicate) {
    if (duplicate.confirmationId !== input.confirmationId || duplicate.respondedByLineId !== input.respondedByLineId) {
      return { ok: false, reason: "UNAUTHORIZED" };
    }
    const responseCount = await prisma.pickupConfirmationResponseEvent.count({
      where: { confirmationId: input.confirmationId, revision: duplicate.revision },
    });
    return { ok: true, duplicate: true, changed: responseCount > 1, eventId: duplicate.id, responseCount };
  }

  const confirmation = await prisma.pickupConfirmation.findUnique({
    where: { id: input.confirmationId },
    include: { serviceOrder: { select: { customerId: true, status: true, deletedAt: true } } },
  });
  if (!confirmation) return { ok: false, reason: "NOT_FOUND" };
  const lineAccount = await prisma.account.findFirst({
    where: {
      providerId: "line",
      accountId: input.respondedByLineId,
      userId: confirmation.serviceOrder.customerId,
    },
    select: { userId: true },
  });
  if (!lineAccount) {
    return { ok: false, reason: "UNAUTHORIZED" };
  }
  if (confirmation.revision !== input.revision) return { ok: false, reason: "STALE" };
  if (confirmation.status !== "ACTIVE" || confirmation.serviceOrder.deletedAt
    || confirmation.serviceOrder.status === "COMPLETED" || confirmation.serviceOrder.status === "CANCELLED") {
    return { ok: false, reason: "CLOSED" };
  }

  const priorRevisionResponseCount = await prisma.pickupConfirmationResponseEvent.count({
    where: { confirmationId: confirmation.id, revision: confirmation.revision },
  });
  const changed = priorRevisionResponseCount > 0;
  try {
    const event = await prisma.$transaction(async (tx) => {
      const updated = await tx.pickupConfirmation.updateMany({
        where: {
          id: confirmation.id,
          revision: input.revision,
          status: "ACTIVE",
          serviceOrder: {
            customerId: lineAccount.userId,
            deletedAt: null,
            status: { in: ["RECEIVED", "PROCESSING", "DELIVERING"] },
          },
        },
        data: {
          response: input.response as PickupConfirmationResponse,
          respondedAt: now,
          responseCount: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new PickupResponseConflictError();
      const created = await tx.pickupConfirmationResponseEvent.create({
        data: {
          confirmationId: confirmation.id,
          revision: confirmation.revision,
          webhookEventId: input.webhookEventId,
          response: input.response as PickupConfirmationResponse,
          respondedByLineId: input.respondedByLineId,
        },
      });
      await tx.pickupConfirmationNotification.updateMany({
        where: {
          confirmationId: confirmation.id,
          revision: confirmation.revision,
          kind: "REMINDER",
          status: { in: ["PENDING", "PROCESSING", "FAILED", "UNREACHABLE"] },
        },
        data: { status: "CANCELLED", claimExpiresAt: null },
      });
      return created;
    });
    return {
      ok: true,
      duplicate: false,
      changed,
      eventId: event.id,
      responseCount: priorRevisionResponseCount + 1,
    };
  } catch (error) {
    if (error instanceof PickupResponseConflictError) {
      const current = await prisma.pickupConfirmation.findUnique({
        where: { id: input.confirmationId },
        select: { revision: true, status: true },
      });
      return { ok: false, reason: current && current.revision !== input.revision ? "STALE" : "CLOSED" };
    }
    if (!isUniqueConstraintError(error)) throw error;
    const existing = await prisma.pickupConfirmationResponseEvent.findUniqueOrThrow({
      where: { webhookEventId: input.webhookEventId },
      select: { id: true },
    });
    const responseCount = await prisma.pickupConfirmationResponseEvent.count({
      where: { confirmationId: confirmation.id, revision: confirmation.revision },
    });
    return { ok: true, duplicate: true, changed: responseCount > 1, eventId: existing.id, responseCount };
  }
}

const getBaseUrl = () => (
  process.env.BETTER_AUTH_URL?.trim()
  || process.env.NUXT_PUBLIC_BASE_URL?.trim()
  || "http://localhost:3000"
).replace(/\/+$/, "");

const buildStaffResponseMessage = (input: {
  customerName: string;
  phoneNumber: string | null;
  orderId: string;
  orderNo: string | null;
  dueAt: Date | null;
  response: PickupConfirmationResponseValue;
  changed: boolean;
}): LineMessage => {
  const contactRequested = input.response === "CONTACT_REQUESTED";
  const lines = [
    `${contactRequested ? "⚠️" : "🧺"} ${input.changed ? "ลูกค้าแก้ไขคำตอบ" : "คำตอบรับผ้ารอบถัดไป"}`,
    `ลูกค้า: ${input.customerName}`,
    `เบอร์โทร: ${input.phoneNumber || "-"}`,
    `ออเดอร์: ${input.orderNo || "-"}`,
    `วันนัดส่ง: ${input.dueAt ? formatDateTime(input.dueAt) : "-"}`,
    `คำตอบ: ${pickupResponseLabels[input.response]}`,
    `${getBaseUrl()}/admin/service-orders/${encodeURIComponent(input.orderId)}`,
  ];
  return { type: "text", text: lines.join("\n") };
};

export async function notifyPickupResponseEvent(
  eventId: string,
  send: typeof pushMessage = pushMessage,
) {
  const responseEvent = await prisma.pickupConfirmationResponseEvent.findUnique({
    where: { id: eventId },
    include: {
      confirmation: {
        include: {
          serviceOrder: {
            include: {
              customer: { select: { name: true, email: true, phoneNumber: true } },
            },
          },
          responseEvents: {
            select: { id: true, revision: true },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
        },
      },
    },
  });
  if (!responseEvent || responseEvent.staffNotifiedAt) return { status: "SKIPPED" as const };
  if (responseEvent.staffNotifyAttempts >= MAX_STAFF_NOTIFY_ATTEMPTS) return { status: "EXHAUSTED" as const };
  const claimedAt = new Date();
  const claimExpiresAt = new Date(claimedAt.getTime() + 2 * 60_000);
  const claimed = await prisma.pickupConfirmationResponseEvent.updateMany({
    where: {
      id: responseEvent.id,
      staffNotifiedAt: null,
      staffNotifyAttempts: responseEvent.staffNotifyAttempts,
      OR: [
        { staffNotifyClaimExpiresAt: null },
        { staffNotifyClaimExpiresAt: { lte: claimedAt } },
      ],
    },
    data: {
      staffNotifyAttempts: { increment: 1 },
      staffNotifyClaimedAt: claimedAt,
      staffNotifyClaimExpiresAt: claimExpiresAt,
    },
  });
  if (claimed.count !== 1) return { status: "SKIPPED" as const };

  const subscribers = await prisma.notificationSubscriber.findMany({
    where: {
      isActive: true,
      receivePickupResponse: true,
      user: { isActive: true, deletedAt: null, role: { in: ["ADMIN", "EMPLOYEE"] } },
    },
    include: {
      user: {
        select: {
          accounts: {
            where: { providerId: "line" },
            select: { accountId: true },
            take: 1,
          },
        },
      },
    },
  });
  const order = responseEvent.confirmation.serviceOrder;
  const customerName = order.customer.name?.trim() || order.customer.email;
  const revisionEvents = responseEvent.confirmation.responseEvents.filter(
    (item) => item.revision === responseEvent.revision,
  );
  const changed = revisionEvents.findIndex((item) => item.id === responseEvent.id) > 0;
  const message = buildStaffResponseMessage({
    customerName,
    phoneNumber: order.customer.phoneNumber,
    orderId: order.id,
    orderNo: order.orderNo,
    dueAt: order.dueAt,
    response: responseEvent.response as PickupConfirmationResponseValue,
    changed,
  });

  const failures: string[] = [];
  for (const subscriber of subscribers) {
    const lineUserId = subscriber.user.accounts[0]?.accountId;
    if (!lineUserId) continue;
    try {
      await send({ to: lineUserId, messages: [message] });
    } catch (error) {
      failures.push(error instanceof Error ? error.message.slice(0, 300) : "LINE push failed");
    }
  }

  if (failures.length === 0) {
    await prisma.pickupConfirmationResponseEvent.update({
      where: { id: responseEvent.id },
      data: {
        staffNotifiedAt: new Date(),
        staffNotifyClaimedAt: null,
        staffNotifyClaimExpiresAt: null,
        staffNotifyError: null,
      },
    });
    return { status: "SENT" as const, subscribers: subscribers.length };
  }
  await prisma.pickupConfirmationResponseEvent.update({
    where: { id: responseEvent.id },
    data: {
      staffNotifyClaimedAt: null,
      staffNotifyClaimExpiresAt: null,
      staffNotifyError: failures.join(" | ").slice(0, 1000),
    },
  });
  return { status: "FAILED" as const, failures: failures.length };
}

export async function retryPickupResponseStaffNotifications(limit = 25) {
  const events = await prisma.pickupConfirmationResponseEvent.findMany({
    where: {
      staffNotifiedAt: null,
      staffNotifyAttempts: { lt: MAX_STAFF_NOTIFY_ATTEMPTS },
      OR: [
        { staffNotifyClaimExpiresAt: null },
        { staffNotifyClaimExpiresAt: { lte: new Date() } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  let sent = 0;
  let failed = 0;
  for (const event of events) {
    const result = await notifyPickupResponseEvent(event.id);
    if (result.status === "SENT") sent += 1;
    else if (result.status === "FAILED") failed += 1;
  }
  return { scanned: events.length, sent, failed };
}
