import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../../server/utils/prisma";
import {
  claimNextPickupNotification,
  reconcilePickupConfirmation,
} from "../../server/utils/pickupConfirmation";

const dockerOnly = process.env.PICKUP_CONFIRMATION_DOCKER_TEST === "1";
const describeDocker = dockerOnly ? describe : describe.skip;

describeDocker("pickup confirmation Docker PostgreSQL integration", () => {
  const suffix = randomUUID();
  const userId = `pickup-test-user-${suffix}`;
  const accountId = `pickup-test-account-${suffix}`;
  const orderId = `pickup-test-order-${suffix}`;
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
});
