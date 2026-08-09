import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../server/utils/prisma";
import {
  claimNextPickupNotification,
  dispatchDuePickupNotifications,
  reconcilePickupConfirmation,
  reschedulePendingPickupNotifications,
} from "../../server/utils/pickupConfirmation";
import { notifyPickupResponseEvent, recordPickupResponse } from "../../server/utils/pickupConfirmationResponse";

const dockerOnly = process.env.PICKUP_CONFIRMATION_DOCKER_TEST === "1";
const describeDocker = dockerOnly ? describe : describe.skip;

describeDocker("pickup confirmation Docker PostgreSQL integration", () => {
  const suffix = randomUUID();
  const userId = `pickup-test-user-${suffix}`;
  const accountId = `pickup-test-account-${suffix}`;
  const orderId = `pickup-test-order-${suffix}`;
  const staffUserId = `pickup-test-staff-${suffix}`;
  const staffAccountId = `pickup-test-staff-account-${suffix}`;
  let confirmationId: string | null = null;

  beforeAll(async () => {
    await prisma.user.create({
      data: {
        id: userId,
        email: `${userId}@example.test`,
        name: "Pickup Test",
        accounts: {
          create: {
            id: accountId,
            accountId: `line-${suffix}`,
            providerId: "line",
          },
        },
      },
    });
    await prisma.serviceOrder.create({
      data: {
        id: orderId,
        customerId: userId,
        status: "PROCESSING",
        dueAt: new Date("2026-09-10T02:00:00.000Z"),
        addonUsageRecords: {
          create: {
            credits: 1,
            isDelivery: true,
          },
        },
      },
    });
    await prisma.user.create({
      data: {
        id: staffUserId,
        email: `${staffUserId}@example.test`,
        name: "Pickup Staff Test",
        role: "EMPLOYEE",
        accounts: {
          create: {
            id: staffAccountId,
            accountId: `line-staff-${suffix}`,
            providerId: "line",
          },
        },
        notificationSubscriber: { create: { receivePickupResponse: true } },
      },
    });
    await prisma.notificationSetting.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", pickupConfirmationEnabled: true },
      update: { pickupConfirmationEnabled: true },
    });
  });

  afterAll(async () => {
    if (confirmationId) {
      await prisma.pickupConfirmation.deleteMany({ where: { id: confirmationId } });
    }
    await prisma.serviceOrder.deleteMany({ where: { id: orderId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.user.deleteMany({ where: { id: staffUserId } });
    await prisma.$disconnect();
  });

  it("creates durable jobs and lets concurrent workers claim only one", async () => {
    const now = new Date("2026-09-09T06:00:00.000Z");
    const result = await reconcilePickupConfirmation(orderId, now);
    expect(result.action).toBe("CREATED");
    if (result.action !== "CREATED") throw new Error("confirmation was not created");
    confirmationId = result.confirmationId;
    expect(result.jobs).toBe(2);

    const [first, second] = await Promise.all([
      claimNextPickupNotification(now),
      claimNextPickupNotification(now),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect((first ?? second)?.kind).toBe("INITIAL");
  });

  it("reclaims a processing job only after its lease expires", async () => {
    const beforeExpiry = await claimNextPickupNotification(new Date("2026-09-09T06:01:00.000Z"));
    expect(beforeExpiry).toBeNull();

    const afterExpiry = await claimNextPickupNotification(new Date("2026-09-09T06:03:00.000Z"));
    expect(afterExpiry?.kind).toBe("INITIAL");
    expect(afterExpiry?.attempts).toBe(2);
  });

  it("creates a new revision when dueAt changes after the initial message was sent", async () => {
    if (!confirmationId) throw new Error("missing confirmation");
    await prisma.pickupConfirmationNotification.updateMany({
      where: { confirmationId, revision: 1, kind: "INITIAL" },
      data: { status: "SENT", sentAt: new Date("2026-09-09T06:03:00.000Z"), claimExpiresAt: null },
    });
    await prisma.pickupConfirmation.update({
      where: { id: confirmationId },
      data: { response: "SKIP", respondedAt: new Date("2026-09-09T06:04:00.000Z"), responseCount: 1 },
    });
    await prisma.serviceOrder.update({
      where: { id: orderId },
      data: { dueAt: new Date("2026-09-11T02:00:00.000Z") },
    });

    const result = await reconcilePickupConfirmation(orderId, new Date("2026-09-09T07:00:00.000Z"));
    expect(result.action).toBe("REVISED");
    const confirmation = await prisma.pickupConfirmation.findUniqueOrThrow({
      where: { id: confirmationId },
      include: { notifications: { orderBy: { revision: "asc" } } },
    });
    expect(confirmation.revision).toBe(2);
    expect(confirmation.response).toBeNull();
    expect(confirmation.notifications.some((job) => job.revision === 1 && job.status === "SENT")).toBe(true);
    expect(confirmation.notifications.filter((job) => job.revision === 2)).toHaveLength(2);
  });

  it("allows a manually requested retry after automatic attempts are exhausted", async () => {
    if (!confirmationId) throw new Error("missing confirmation");
    const now = new Date("2026-09-09T07:05:00.000Z");
    await prisma.pickupConfirmationNotification.updateMany({
      where: { confirmationId, revision: 2, kind: "INITIAL" },
      data: {
        status: "PENDING",
        attempts: 5,
        scheduledFor: now,
        manualRetryRequestedAt: now,
      },
    });
    const claimed = await claimNextPickupNotification(now, 2 * 60_000, 5, {
      serviceOrderId: orderId,
      kind: "INITIAL",
    });
    expect(claimed).toMatchObject({ kind: "INITIAL", attempts: 6 });
    const persisted = await prisma.pickupConfirmationNotification.findUniqueOrThrow({ where: { id: claimed!.id } });
    expect(persisted.manualRetryRequestedAt).toBeNull();
  });

  it("enforces LINE ownership and makes webhook redelivery idempotent", async () => {
    if (!confirmationId) throw new Error("missing confirmation");
    const base = {
      confirmationId,
      revision: 2,
      response: "SKIP" as const,
      now: new Date("2026-09-09T07:10:00.000Z"),
    };
    expect(await recordPickupResponse({
      ...base,
      webhookEventId: `pickup-wrong-${suffix}`,
      respondedByLineId: "another-line-user",
    })).toEqual({ ok: false, reason: "UNAUTHORIZED" });

    const first = await recordPickupResponse({
      ...base,
      webhookEventId: `pickup-event-1-${suffix}`,
      respondedByLineId: `line-${suffix}`,
    });
    expect(first).toMatchObject({ ok: true, duplicate: false, responseCount: 1 });
    if (!first.ok) throw new Error("response was not recorded");
    const failedStaffNotify = await notifyPickupResponseEvent(first.eventId, async () => {
      throw new Error("simulated LINE failure");
    });
    expect(failedStaffNotify.status).toBe("FAILED");
    expect((await prisma.pickupConfirmation.findUniqueOrThrow({ where: { id: confirmationId } })).response).toBe("SKIP");
    const successfulStaffNotify = await notifyPickupResponseEvent(first.eventId, async () => undefined);
    expect(successfulStaffNotify.status).toBe("SENT");

    const redelivery = await recordPickupResponse({
      ...base,
      webhookEventId: `pickup-event-1-${suffix}`,
      respondedByLineId: `line-${suffix}`,
    });
    expect(redelivery).toMatchObject({ ok: true, duplicate: true, responseCount: 1 });

    const changed = await recordPickupResponse({
      ...base,
      webhookEventId: `pickup-event-2-${suffix}`,
      response: "HOME_PICKUP",
      respondedByLineId: `line-${suffix}`,
      now: new Date("2026-09-09T07:15:00.000Z"),
    });
    expect(changed).toMatchObject({ ok: true, duplicate: false, changed: true, responseCount: 2 });
    expect(await prisma.pickupConfirmationResponseEvent.count({ where: { confirmationId } })).toBe(2);
    expect((await prisma.pickupConfirmation.findUniqueOrThrow({ where: { id: confirmationId } })).response).toBe("HOME_PICKUP");
  });

  it("closes the confirmation when the delivery usage is refunded", async () => {
    if (!confirmationId) throw new Error("missing confirmation");
    await prisma.serviceOrderAddonUsage.updateMany({
      where: { serviceOrderId: orderId, isDelivery: true },
      data: { refundedAt: new Date("2026-09-09T08:00:00.000Z") },
    });
    const result = await reconcilePickupConfirmation(orderId, new Date("2026-09-09T08:00:00.000Z"));
    expect(result.action).toBe("CLOSED");
    const confirmation = await prisma.pickupConfirmation.findUniqueOrThrow({ where: { id: confirmationId } });
    expect(confirmation.status).toBe("CANCELLED");
    expect(await prisma.pickupConfirmationNotification.count({
      where: { confirmationId, status: { in: ["PENDING", "PROCESSING", "FAILED", "UNREACHABLE"] } },
    })).toBe(0);
  });

  it("disables active jobs and does not release a past backlog when re-enabled", async () => {
    if (!confirmationId) throw new Error("missing confirmation");
    await prisma.serviceOrderAddonUsage.updateMany({
      where: { serviceOrderId: orderId, isDelivery: true },
      data: { refundedAt: null },
    });
    await prisma.serviceOrder.update({
      where: { id: orderId },
      data: { dueAt: new Date("2026-09-10T02:00:00.000Z") },
    });
    await prisma.notificationSetting.update({
      where: { id: "singleton" },
      data: { pickupConfirmationEnabled: false },
    });
    await reschedulePendingPickupNotifications(new Date("2026-09-09T06:00:00.000Z"));

    await prisma.notificationSetting.update({
      where: { id: "singleton" },
      data: { pickupConfirmationEnabled: true },
    });
    await reschedulePendingPickupNotifications(new Date("2026-09-09T06:00:00.000Z"));
    expect((await prisma.pickupConfirmation.findUniqueOrThrow({ where: { id: confirmationId } })).status).toBe("CANCELLED");

    await prisma.serviceOrder.update({
      where: { id: orderId },
      data: { dueAt: new Date("2026-09-20T02:00:00.000Z") },
    });
    await reschedulePendingPickupNotifications(new Date("2026-09-09T06:00:00.000Z"));
    const reopened = await prisma.pickupConfirmation.findUniqueOrThrow({ where: { id: confirmationId } });
    expect(reopened.status).toBe("ACTIVE");
    expect(reopened.revision).toBe(3);
  });

  it("records LINE failure without changing the order or delivery credits", async () => {
    if (!confirmationId) throw new Error("missing confirmation");
    const now = new Date("2026-09-19T06:00:00.000Z");
    await prisma.pickupConfirmationResponseEvent.updateMany({
      where: { confirmationId },
      data: { staffNotifiedAt: now },
    });
    const initial = await prisma.pickupConfirmationNotification.findFirstOrThrow({
      where: { confirmationId, revision: 3, kind: "INITIAL" },
    });
    await prisma.pickupConfirmationNotification.update({
      where: { id: initial.id },
      data: { status: "PENDING", scheduledFor: now, attempts: 0 },
    });
    const before = await prisma.serviceOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { addonUsageRecords: true },
    });
    const summary = await dispatchDuePickupNotifications(now, 1, async () => {
      throw new Error("simulated customer LINE failure");
    });
    expect(summary.failed).toBe(1);
    const after = await prisma.serviceOrder.findUniqueOrThrow({
      where: { id: orderId },
      include: { addonUsageRecords: true },
    });
    expect(after.status).toBe(before.status);
    expect(after.addonUsageRecords.map((usage) => usage.credits)).toEqual(before.addonUsageRecords.map((usage) => usage.credits));
    expect((await prisma.pickupConfirmationNotification.findUniqueOrThrow({ where: { id: initial.id } })).status).toBe("FAILED");
  });

  it("cascades confirmation audit rows when a disposable order is hard-deleted", async () => {
    if (!confirmationId) throw new Error("missing confirmation");
    await prisma.serviceOrder.delete({ where: { id: orderId } });
    expect(await prisma.pickupConfirmation.findUnique({ where: { id: confirmationId } })).toBeNull();
    confirmationId = null;
  });
});
