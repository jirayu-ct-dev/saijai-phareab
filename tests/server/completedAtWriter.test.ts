import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const txMock = vi.hoisted(() => ({
  serviceOrder: { updateMany: vi.fn() },
}));

const prismaMock = vi.hoisted(() => ({
  serviceOrder: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

const notifyMock = vi.hoisted(() => vi.fn());

vi.mock("~~/server/utils/prisma", () => ({ prisma: prismaMock }));
vi.mock("~~/server/utils/auth", () => ({ requireRole: vi.fn() }));
vi.mock("~~/server/utils/notify", () => ({ notifyServiceOrderStatusChanged: notifyMock }));
vi.mock("~~/server/utils/serviceOrderCredits", () => ({
  deductAddonUsageRecords: vi.fn().mockResolvedValue([]),
  parseAddonUsages: vi.fn().mockReturnValue([]),
  refundAddonUsages: vi.fn(),
  refundPrimaryCredit: vi.fn(),
  voidPendingAddonUsageRecords: vi.fn(),
}));

(globalThis as Record<string, unknown>).defineEventHandler = (handler: unknown) => handler;
(globalThis as Record<string, unknown>).getRouterParam = () => "order-1";
(globalThis as Record<string, unknown>).readBody = async () => ({ status: "COMPLETED" });
(globalThis as Record<string, unknown>).createError = (input: Record<string, unknown>) => input;

const existing = {
  id: "order-1",
  status: "DELIVERING",
  completedAt: null,
  memberEntitlementId: null,
  creditUsed: null,
  addonUsages: null,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-02T05:45:00.000Z"));
  vi.clearAllMocks();
  prismaMock.serviceOrder.findFirst.mockResolvedValue(existing);
  prismaMock.$transaction.mockImplementation(async (operation: (tx: typeof txMock) => unknown) => operation(txMock));
  txMock.serviceOrder.updateMany.mockResolvedValue({ count: 1 });
  notifyMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("service-order completion writer", () => {
  it("persists status and completedAt atomically behind the previous-status guard", async () => {
    const { default: handler } = await import("../../server/api/admin/service-orders/[id]/status.patch");

    await handler({} as never);

    expect(txMock.serviceOrder.updateMany).toHaveBeenCalledWith({
      where: { id: "order-1", status: "DELIVERING", deletedAt: null },
      data: {
        status: "COMPLETED",
        completedAt: new Date("2026-09-02T05:45:00.000Z"),
      },
    });
    expect(notifyMock).toHaveBeenCalledWith({
      serviceOrderId: "order-1",
      fromStatus: "DELIVERING",
      toStatus: "COMPLETED",
    });
  });

  it("returns a conflict and skips notification when another writer won the transition", async () => {
    txMock.serviceOrder.updateMany.mockResolvedValueOnce({ count: 0 });
    const { default: handler } = await import("../../server/api/admin/service-orders/[id]/status.patch");

    await expect(handler({} as never)).rejects.toMatchObject({
      statusCode: 409,
      data: { code: "SERVICE_ORDER_STATUS_CONFLICT" },
    });
    expect(notifyMock).not.toHaveBeenCalled();
  });
});
