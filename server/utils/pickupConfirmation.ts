import { Prisma, type PickupNotificationKind } from "~~/app/generated/prisma/client";
import { prisma } from "~~/server/utils/prisma";
import { pushMessage, type LineMessage } from "~~/server/utils/line-messaging";
import {
  computePickupNotificationSchedule,
  isPickupConfirmationEligible,
  pickupRetryAt,
  shouldSkipPickupReminder,
} from "~~/server/utils/pickupConfirmationScheduling";
import { formatDateTime } from "~~/shared/utils/format";
import { retryPickupResponseStaffNotifications } from "~~/server/utils/pickupConfirmationResponse";

const ACTIVE_ORDER_STATUSES = ["RECEIVED", "PROCESSING", "DELIVERING"] as const;
const CANCELLABLE_JOB_STATUSES = ["PENDING", "PROCESSING", "FAILED", "UNREACHABLE"] as const;
const DEFAULT_LEASE_MS = 2 * 60_000;
const DEFAULT_MAX_ATTEMPTS = 5;

type ClaimedNotification = {
  id: string;
  confirmationId: string;
  revision: number;
  kind: PickupNotificationKind;
  recipientUserId: string;
  attempts: number;
};

export type PickupDispatchSummary = {
  scanned: number;
  claimed: number;
  sent: number;
  failed: number;
  unreachable: number;
  reminded: number;
  skipped: number;
  staffNotificationsRetried: number;
  staffNotificationsFailed: number;
};

const sameInstant = (left: Date | null, right: Date | null): boolean =>
  left?.getTime() === right?.getTime();

const pickupSettings = (setting: {
  pickupInitialDaysBefore: number;
  pickupInitialTime: string;
  pickupReminderEnabled: boolean;
  pickupReminderDaysBefore: number;
  pickupReminderTime: string;
  pickupMinimumLeadMinutes: number;
}) => ({
  initialDaysBefore: setting.pickupInitialDaysBefore,
  initialTime: setting.pickupInitialTime,
  reminderEnabled: setting.pickupReminderEnabled,
  reminderDaysBefore: setting.pickupReminderDaysBefore,
  reminderTime: setting.pickupReminderTime,
  minimumLeadMinutes: setting.pickupMinimumLeadMinutes,
});

const createJobsForRevision = (input: {
  confirmationId: string;
  revision: number;
  recipientUserId: string;
  dueAt: Date | null;
  orderStatus: string;
  now: Date;
  setting: Parameters<typeof pickupSettings>[0];
}) => {
  if (!input.dueAt) {
    return input.orderStatus === "DELIVERING"
      ? [{
          confirmationId: input.confirmationId,
          revision: input.revision,
          kind: "INITIAL" as const,
          recipientUserId: input.recipientUserId,
          scheduledFor: input.now,
        }]
      : [];
  }

  const schedule = computePickupNotificationSchedule(input.dueAt, pickupSettings(input.setting), input.now);
  const jobs: Array<{
    confirmationId: string;
    revision: number;
    kind: PickupNotificationKind;
    recipientUserId: string;
    scheduledFor: Date;
  }> = [{
    confirmationId: input.confirmationId,
    revision: input.revision,
    kind: "INITIAL" as const,
    recipientUserId: input.recipientUserId,
    scheduledFor: input.orderStatus === "DELIVERING" ? input.now : schedule.initialScheduledFor,
  }];

  if (schedule.reminderScheduledFor) {
    jobs.push({
      confirmationId: input.confirmationId,
      revision: input.revision,
      kind: "REMINDER",
      recipientUserId: input.recipientUserId,
      scheduledFor: schedule.reminderScheduledFor,
    });
  }
  return jobs;
};

export async function reconcilePickupConfirmation(serviceOrderId: string, now: Date = new Date()) {
  const [order, setting] = await Promise.all([
    prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      include: {
        customer: {
          select: {
            isActive: true,
            deletedAt: true,
            lineNotifyEnabled: true,
            accounts: {
              where: { providerId: "line" },
              select: { id: true },
              take: 1,
            },
          },
        },
        addonUsageRecords: {
          where: { isDelivery: true, credits: { gt: 0 }, refundedAt: null },
          select: { id: true },
          take: 1,
        },
        pickupConfirmation: { include: { notifications: true } },
      },
    }),
    prisma.notificationSetting.upsert({
      where: { id: "singleton" },
      create: { id: "singleton" },
      update: {},
    }),
  ]);

  if (!order) return { action: "NOT_FOUND" as const };

  const eligible = isPickupConfirmationEligible({
    deletedAt: order.deletedAt,
    status: order.status,
    hasDeliveryUsage: order.addonUsageRecords.length > 0,
    customerIsActive: order.customer.isActive,
    customerDeletedAt: order.customer.deletedAt,
    customerLineNotifyEnabled: order.customer.lineNotifyEnabled,
    customerHasLineAccount: order.customer.accounts.length > 0,
    pickupConfirmationEnabled: setting.pickupConfirmationEnabled,
  });

  if (!eligible) {
    if (!order.pickupConfirmation) return { action: "INELIGIBLE" as const };
    await prisma.$transaction([
      prisma.pickupConfirmation.update({
        where: { id: order.pickupConfirmation.id },
        data: {
          status: order.status === "COMPLETED" ? "CLOSED" : "CANCELLED",
          closedAt: now,
        },
      }),
      prisma.pickupConfirmationNotification.updateMany({
        where: {
          confirmationId: order.pickupConfirmation.id,
          status: { in: [...CANCELLABLE_JOB_STATUSES] },
        },
        data: { status: "CANCELLED", claimExpiresAt: null },
      }),
    ]);
    return { action: "CLOSED" as const };
  }

  if (!order.pickupConfirmation) {
    return prisma.$transaction(async (tx) => {
      const confirmation = await tx.pickupConfirmation.create({
        data: {
          serviceOrderId: order.id,
          dueAtSnapshot: order.dueAt,
        },
      });
      const jobs = createJobsForRevision({
        confirmationId: confirmation.id,
        revision: confirmation.revision,
        recipientUserId: order.customerId,
        dueAt: order.dueAt,
        orderStatus: order.status,
        now,
        setting,
      });
      if (jobs.length > 0) await tx.pickupConfirmationNotification.createMany({ data: jobs });
      return { action: "CREATED" as const, confirmationId: confirmation.id, jobs: jobs.length };
    });
  }

  const confirmation = order.pickupConfirmation;
  const currentJobs = confirmation.notifications.filter((job) => job.revision === confirmation.revision);
  const initial = currentJobs.find((job) => job.kind === "INITIAL");
  const initialWasSent = initial?.status === "SENT";
  const recipientChanged = Boolean(initial && initial.recipientUserId !== order.customerId);
  const dueAtChanged = !sameInstant(confirmation.dueAtSnapshot, order.dueAt);
  const requiresNewRevision = confirmation.status !== "ACTIVE"
    || ((initialWasSent || initial?.status === "PROCESSING") && (recipientChanged || dueAtChanged));

  if (requiresNewRevision) {
    return prisma.$transaction(async (tx) => {
      const nextRevision = confirmation.revision + 1;
      await tx.pickupConfirmationNotification.updateMany({
        where: { confirmationId: confirmation.id, status: { in: [...CANCELLABLE_JOB_STATUSES] } },
        data: { status: "CANCELLED", claimExpiresAt: null },
      });
      await tx.pickupConfirmation.update({
        where: { id: confirmation.id },
        data: {
          revision: nextRevision,
          status: "ACTIVE",
          response: null,
          respondedAt: null,
          closedAt: null,
          dueAtSnapshot: order.dueAt,
        },
      });
      const jobs = createJobsForRevision({
        confirmationId: confirmation.id,
        revision: nextRevision,
        recipientUserId: order.customerId,
        dueAt: order.dueAt,
        orderStatus: order.status,
        now,
        setting,
      });
      if (jobs.length > 0) await tx.pickupConfirmationNotification.createMany({ data: jobs });
      return { action: "REVISED" as const, revision: nextRevision, jobs: jobs.length };
    });
  }

  const nextJobs = createJobsForRevision({
    confirmationId: confirmation.id,
    revision: confirmation.revision,
    recipientUserId: order.customerId,
    dueAt: order.dueAt,
    orderStatus: order.status,
    now,
    setting,
  });

  return prisma.$transaction(async (tx) => {
    await tx.pickupConfirmation.update({
      where: { id: confirmation.id },
      data: { status: "ACTIVE", closedAt: null, dueAtSnapshot: order.dueAt },
    });

    for (const job of nextJobs) {
      const existingJob = currentJobs.find((item) => item.kind === job.kind);
      if (!existingJob) {
        await tx.pickupConfirmationNotification.create({ data: job });
      } else if (existingJob.status === "PENDING" || existingJob.status === "FAILED") {
        await tx.pickupConfirmationNotification.update({
          where: { id: existingJob.id },
          data: {
            recipientUserId: job.recipientUserId,
            scheduledFor: job.scheduledFor,
          },
        });
      }
    }

    const desiredKinds = nextJobs.map((job) => job.kind);
    await tx.pickupConfirmationNotification.updateMany({
      where: {
        confirmationId: confirmation.id,
        revision: confirmation.revision,
        kind: { notIn: desiredKinds },
        status: { in: [...CANCELLABLE_JOB_STATUSES] },
      },
      data: { status: "CANCELLED", claimExpiresAt: null },
    });
    return { action: "UPDATED" as const, jobs: nextJobs.length };
  });
}

export async function reschedulePendingPickupNotifications(now: Date = new Date()) {
  const setting = await prisma.notificationSetting.findUnique({ where: { id: "singleton" } });
  if (!setting) return { scanned: 0, updated: 0, cancelled: 0, created: 0 };

  if (!setting.pickupConfirmationEnabled) {
    const active = await prisma.pickupConfirmation.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });
    const ids = active.map((item) => item.id);
    if (ids.length > 0) {
      await prisma.$transaction([
        prisma.pickupConfirmation.updateMany({
          where: { id: { in: ids } },
          data: { status: "CANCELLED", closedAt: now },
        }),
        prisma.pickupConfirmationNotification.updateMany({
          where: { confirmationId: { in: ids }, status: { in: [...CANCELLABLE_JOB_STATUSES] } },
          data: { status: "CANCELLED", claimExpiresAt: null },
        }),
      ]);
    }
    return { scanned: active.length, updated: 0, cancelled: active.length, created: 0 };
  }

  const confirmations = await prisma.pickupConfirmation.findMany({
    where: { status: "ACTIVE" },
    include: {
      serviceOrder: { select: { dueAt: true, customerId: true } },
      notifications: true,
    },
  });
  let updated = 0;
  let cancelled = 0;
  let created = 0;

  for (const confirmation of confirmations) {
    if (!confirmation.serviceOrder.dueAt) continue;
    const schedule = computePickupNotificationSchedule(
      confirmation.serviceOrder.dueAt,
      pickupSettings(setting),
      now,
    );
    const currentJobs = confirmation.notifications.filter((item) => item.revision === confirmation.revision);
    for (const job of currentJobs) {
      if (job.kind === "REMINDER" && !setting.pickupReminderEnabled) {
        if (CANCELLABLE_JOB_STATUSES.includes(job.status as typeof CANCELLABLE_JOB_STATUSES[number])) {
          await prisma.pickupConfirmationNotification.update({
            where: { id: job.id },
            data: { status: "CANCELLED", claimExpiresAt: null },
          });
          cancelled += 1;
        }
        continue;
      }
      const nextScheduledFor = job.kind === "INITIAL"
        ? schedule.configuredInitialAt
        : schedule.reminderScheduledFor;
      // A settings edit must not release a backlog of already-past messages.
      if (!nextScheduledFor || nextScheduledFor <= now) continue;
      if (job.status === "PENDING" || job.status === "FAILED") {
        await prisma.pickupConfirmationNotification.update({
          where: { id: job.id },
          data: { scheduledFor: nextScheduledFor },
        });
        updated += 1;
      } else if (job.kind === "REMINDER" && job.status === "CANCELLED" && setting.pickupReminderEnabled) {
        await prisma.pickupConfirmationNotification.update({
          where: { id: job.id },
          data: { status: "PENDING", scheduledFor: nextScheduledFor, lastError: null },
        });
        updated += 1;
      }
    }
    if (setting.pickupReminderEnabled && schedule.reminderScheduledFor && schedule.reminderScheduledFor > now
      && !currentJobs.some((job) => job.kind === "REMINDER")) {
      await prisma.pickupConfirmationNotification.create({
        data: {
          confirmationId: confirmation.id,
          revision: confirmation.revision,
          kind: "REMINDER",
          recipientUserId: confirmation.serviceOrder.customerId,
          scheduledFor: schedule.reminderScheduledFor,
        },
      });
      created += 1;
    }
  }

  const futureOrders = await prisma.serviceOrder.findMany({
    where: {
      deletedAt: null,
      status: { in: ["RECEIVED", "PROCESSING", "DELIVERING"] },
      dueAt: { gt: now },
      addonUsageRecords: { some: { isDelivery: true, credits: { gt: 0 }, refundedAt: null } },
      customer: {
        isActive: true,
        deletedAt: null,
        lineNotifyEnabled: true,
        accounts: { some: { providerId: "line" } },
      },
      OR: [
        { pickupConfirmation: null },
        { pickupConfirmation: { status: { not: "ACTIVE" } } },
      ],
    },
    select: { id: true, dueAt: true },
  });
  for (const order of futureOrders) {
    if (!order.dueAt) continue;
    const schedule = computePickupNotificationSchedule(order.dueAt, pickupSettings(setting), now);
    if (schedule.configuredInitialAt <= now) continue;
    const result = await reconcilePickupConfirmation(order.id, now);
    if (result.action === "CREATED" || result.action === "REVISED") created += 1;
  }
  return { scanned: confirmations.length + futureOrders.length, updated, cancelled, created };
}

export async function claimNextPickupNotification(
  now: Date = new Date(),
  leaseMs = DEFAULT_LEASE_MS,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  filter?: { serviceOrderId?: string; kind?: PickupNotificationKind },
): Promise<ClaimedNotification | null> {
  const claimExpiresAt = new Date(now.getTime() + leaseMs);
  const rows = await prisma.$queryRaw<ClaimedNotification[]>(Prisma.sql`
    WITH candidate AS (
      SELECT job."id"
      FROM "pickup_confirmation_notification" job
      JOIN "pickup_confirmation" confirmation ON confirmation."id" = job."confirmationId"
      JOIN "service_order" service_order ON service_order."id" = confirmation."serviceOrderId"
      WHERE confirmation."status" = 'ACTIVE'::"PickupConfirmationStatus"
        AND confirmation."revision" = job."revision"
        AND confirmation."response" IS NULL
        AND service_order."deletedAt" IS NULL
        AND service_order."status" IN ('RECEIVED', 'PROCESSING', 'DELIVERING')
        AND (${filter?.serviceOrderId ?? null}::text IS NULL OR service_order."id" = ${filter?.serviceOrderId ?? null})
        AND (${filter?.kind ?? null}::text IS NULL OR job."kind"::text = ${filter?.kind ?? null})
        AND (job."attempts" < ${maxAttempts} OR job."manualRetryRequestedAt" IS NOT NULL)
        AND (
          (job."status" IN ('PENDING', 'FAILED') AND job."scheduledFor" <= ${now})
          OR (job."status" = 'PROCESSING' AND job."claimExpiresAt" <= ${now})
        )
        AND (
          job."kind" = 'INITIAL'::"PickupNotificationKind"
          OR EXISTS (
            SELECT 1 FROM "pickup_confirmation_notification" initial
            WHERE initial."confirmationId" = job."confirmationId"
              AND initial."revision" = job."revision"
              AND initial."kind" = 'INITIAL'::"PickupNotificationKind"
              AND initial."status" = 'SENT'::"PickupNotificationStatus"
          )
        )
      ORDER BY job."scheduledFor" ASC, job."createdAt" ASC
      FOR UPDATE OF job SKIP LOCKED
      LIMIT 1
    )
    UPDATE "pickup_confirmation_notification" job
    SET "status" = 'PROCESSING'::"PickupNotificationStatus",
        "claimedAt" = ${now},
        "claimExpiresAt" = ${claimExpiresAt},
        "attempts" = job."attempts" + 1,
        "manualRetryRequestedAt" = NULL,
        "updatedAt" = ${now}
    FROM candidate
    WHERE job."id" = candidate."id"
    RETURNING job."id", job."confirmationId", job."revision", job."kind",
              job."recipientUserId", job."attempts"
  `);
  return rows[0] ?? null;
}

const buildPickupQuestionMessage = (input: {
  confirmationId: string;
  revision: number;
  orderNo: string | null;
  dueAt: Date | null;
  reminder: boolean;
}): LineMessage => {
  const action = (label: string, response: string) => ({
    type: "button",
    style: "secondary",
    height: "sm",
    action: {
      type: "postback",
      label,
      displayText: label,
      data: `action=pickup_confirmation&id=${encodeURIComponent(input.confirmationId)}&rev=${input.revision}&response=${response}`,
    },
  });
  return {
    type: "flex",
    altText: input.reminder ? "เตือนยืนยันการรับผ้ารอบถัดไป" : "ยืนยันการรับผ้ารอบถัดไป",
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        contents: [
          { type: "text", text: input.reminder ? "🔔 ขอคำตอบเรื่องผ้ารอบถัดไป" : "🧺 ผ้ารอบถัดไปมีให้รับไหมคะ/ครับ", weight: "bold", wrap: true },
          { type: "text", text: `ออเดอร์ ${input.orderNo || "-"}${input.dueAt ? ` · นัดส่ง ${formatDateTime(input.dueAt)}` : ""}`, size: "sm", color: "#6B7280", wrap: true },
          action("มีผ้าส่งซัก", "HOME_PICKUP"),
          action("นำมาส่งที่ร้านเอง", "SELF_DROPOFF"),
          action("ไม่มีผ้ารอบนี้", "SKIP"),
          action("ขอเลื่อน / ติดต่อร้าน", "CONTACT_REQUESTED"),
        ],
      },
    },
  };
};

async function sendClaimedPickupNotification(
  claimed: ClaimedNotification,
  now: Date,
  send: typeof pushMessage = pushMessage,
) {
  const job = await prisma.pickupConfirmationNotification.findUnique({
    where: { id: claimed.id },
    include: {
      confirmation: {
        include: {
          serviceOrder: {
            include: {
              customer: {
                select: {
                  accounts: {
                    where: { providerId: "line" },
                    select: { accountId: true },
                    take: 1,
                  },
                },
              },
            },
          },
          notifications: { where: { revision: claimed.revision } },
        },
      },
    },
  });
  if (!job || job.status !== "PROCESSING") return "SKIPPED" as const;

  const confirmation = job.confirmation;
  const order = confirmation.serviceOrder;
  if (confirmation.status !== "ACTIVE" || confirmation.revision !== job.revision
    || !ACTIVE_ORDER_STATUSES.includes(order.status as typeof ACTIVE_ORDER_STATUSES[number])) {
    await prisma.pickupConfirmationNotification.update({ where: { id: job.id }, data: { status: "CANCELLED", claimExpiresAt: null } });
    return "SKIPPED" as const;
  }
  if (order.dueAt && now >= order.dueAt) {
    await prisma.pickupConfirmationNotification.update({ where: { id: job.id }, data: { status: "SKIPPED_TOO_LATE", claimExpiresAt: null } });
    return "SKIPPED" as const;
  }
  if (job.kind === "REMINDER") {
    const initial = confirmation.notifications.find((item) => item.kind === "INITIAL");
    if (!initial?.sentAt || shouldSkipPickupReminder({
      reminderScheduledFor: job.scheduledFor,
      initialSentAt: initial.sentAt,
      now,
      dueAt: order.dueAt ?? now,
      hasResponse: confirmation.response !== null,
      orderStatus: order.status,
      confirmationStatus: confirmation.status,
    })) {
      await prisma.pickupConfirmationNotification.update({ where: { id: job.id }, data: { status: "SKIPPED_TOO_LATE", claimExpiresAt: null } });
      return "SKIPPED" as const;
    }
  }

  const lineUserId = order.customer.accounts[0]?.accountId;
  if (!lineUserId || job.recipientUserId !== order.customerId) {
    await prisma.pickupConfirmationNotification.update({
      where: { id: job.id },
      data: { status: "UNREACHABLE", claimExpiresAt: null, lastError: "LINE account unavailable for current recipient" },
    });
    return "UNREACHABLE" as const;
  }

  try {
    await send({
      to: lineUserId,
      messages: [buildPickupQuestionMessage({
        confirmationId: confirmation.id,
        revision: confirmation.revision,
        orderNo: order.orderNo,
        dueAt: order.dueAt,
        reminder: job.kind === "REMINDER",
      })],
    });
    await prisma.pickupConfirmationNotification.update({
      where: { id: job.id },
      data: { status: "SENT", sentAt: now, claimExpiresAt: null, lastError: null },
    });
    return "SENT" as const;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "LINE push failed";
    await prisma.pickupConfirmationNotification.update({
      where: { id: job.id },
      data: {
        status: job.attempts >= DEFAULT_MAX_ATTEMPTS ? "UNREACHABLE" : "FAILED",
        scheduledFor: pickupRetryAt(now, job.attempts),
        claimExpiresAt: null,
        lastError: message,
      },
    });
    return job.attempts >= DEFAULT_MAX_ATTEMPTS ? "UNREACHABLE" as const : "FAILED" as const;
  }
}

export async function dispatchPickupInitialFallback(serviceOrderId: string, now: Date = new Date()) {
  const claimed = await claimNextPickupNotification(now, DEFAULT_LEASE_MS, DEFAULT_MAX_ATTEMPTS, {
    serviceOrderId,
    kind: "INITIAL",
  });
  if (!claimed) return { claimed: false, result: "SKIPPED" as const };
  const result = await sendClaimedPickupNotification(claimed, now);
  return { claimed: true, result };
}

export async function dispatchDuePickupNotifications(
  now: Date = new Date(),
  limit = 50,
  send: typeof pushMessage = pushMessage,
): Promise<PickupDispatchSummary> {
  const summary: PickupDispatchSummary = {
    scanned: 0,
    claimed: 0,
    sent: 0,
    failed: 0,
    unreachable: 0,
    reminded: 0,
    skipped: 0,
    staffNotificationsRetried: 0,
    staffNotificationsFailed: 0,
  };
  for (let index = 0; index < limit; index += 1) {
    summary.scanned += 1;
    const claimed = await claimNextPickupNotification(now);
    if (!claimed) break;
    summary.claimed += 1;
    const result = await sendClaimedPickupNotification(claimed, now, send);
    if (result === "SENT") {
      summary.sent += 1;
      if (claimed.kind === "REMINDER") summary.reminded += 1;
    } else if (result === "FAILED") summary.failed += 1;
    else if (result === "UNREACHABLE") summary.unreachable += 1;
    else summary.skipped += 1;
  }
  const staff = await retryPickupResponseStaffNotifications();
  summary.staffNotificationsRetried = staff.sent;
  summary.staffNotificationsFailed = staff.failed;
  return summary;
}
