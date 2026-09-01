/**
 * DB-01 characterization tests — staff notification subscriber lifecycle.
 *
 * C4 invariant being protected: "never subscribed", "temporarily disabled"
 * and "deleted" are distinct states backed by distinct API operations.
 *   - POST   create: upserts a row for a staff user; re-adding a disabled
 *            subscriber re-enables the SAME row (isActive: true), it does not
 *            fail and does not create a second row.
 *   - PUT    disable: partial update keeps the row with isActive: false.
 *   - DELETE delete: hard-deletes the row entirely.
 *
 * Prisma and auth are mocked; h3 auto-imports used by the handlers are shimmed
 * with the same contract Nitro provides at runtime. No database, no HTTP.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
  },
  notificationSubscriber: {
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findMany: vi.fn(),
  },
  notificationSetting: {
    upsert: vi.fn(),
  },
}));

vi.mock("~~/server/utils/prisma", () => ({ prisma: prismaMock }));
vi.mock("~~/server/utils/auth", () => ({ requireRole: vi.fn() }));

// Nitro auto-import shims (must be installed before the handler modules load).
(globalThis as Record<string, unknown>).defineEventHandler = (handler: unknown) => handler;
(globalThis as Record<string, unknown>).readValidatedBody = async (
  event: { body?: unknown },
  validate: (body: unknown) => unknown,
) => validate(event?.body);
(globalThis as Record<string, unknown>).getRouterParam = (event: { params?: Record<string, string> }, name: string) =>
  event?.params?.[name];
(globalThis as Record<string, unknown>).createError = (input: { statusCode?: number; statusMessage?: string } = {}) =>
  Object.assign(new Error(input.statusMessage ?? "H3Error"), input);

const subscriberRow = (overrides: Record<string, unknown> = {}) => ({
  id: "sub-1",
  userId: "staff-1",
  isActive: true,
  receiveNewOrder: true,
  receiveStatusChange: true,
  receiveReceipt: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

const importHandler = async (path: string): Promise<(event?: unknown) => unknown> => {
  const mod = (await import(path)) as { default: (event?: unknown) => unknown };
  return mod.default;
};

const staffUser = (role: string, deletedAt: Date | null = null) => ({ id: "staff-1", role, deletedAt });

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("POST /api/admin/settings/notification-subscribers (create / re-enable)", () => {
  it("creates a subscriber row for a staff user", async () => {
    prismaMock.user.findFirst.mockResolvedValue(staffUser("EMPLOYEE"));
    prismaMock.notificationSubscriber.upsert.mockResolvedValue(subscriberRow());

    const handler = await importHandler("../../server/api/admin/settings/notification-subscribers.post");
    const result = await handler({ body: { userId: "staff-1" } });

    expect(prismaMock.notificationSubscriber.upsert).toHaveBeenCalledWith({
      where: { userId: "staff-1" },
      create: { userId: "staff-1" },
      update: { isActive: true },
    });
    expect(result).toEqual(subscriberRow());
  });

  it("re-enables the existing row when the staff user is added again (no duplicate)", async () => {
    // C4: a disabled subscriber (isActive: false) that is re-added becomes
    // active again via the update branch of the same upsert.
    prismaMock.user.findFirst.mockResolvedValue(staffUser("ADMIN"));
    prismaMock.notificationSubscriber.upsert.mockResolvedValue(subscriberRow({ isActive: true }));

    const handler = await importHandler("../../server/api/admin/settings/notification-subscribers.post");
    await handler({ body: { userId: "staff-1" } });

    expect(prismaMock.notificationSubscriber.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.notificationSubscriber.upsert.mock.calls[0][0].update).toEqual({ isActive: true });
  });

  it("rejects non-staff users with 400", async () => {
    prismaMock.user.findFirst.mockResolvedValue(staffUser("USER"));

    const handler = await importHandler("../../server/api/admin/settings/notification-subscribers.post");
    await expect(handler({ body: { userId: "staff-1" } })).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.notificationSubscriber.upsert).not.toHaveBeenCalled();
  });

  it("rejects deleted users with 404 (lookup filters deletedAt)", async () => {
    prismaMock.user.findFirst.mockResolvedValue(null);

    const handler = await importHandler("../../server/api/admin/settings/notification-subscribers.post");
    await expect(handler({ body: { userId: "ghost-1" } })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("requires a userId in the body", async () => {
    const handler = await importHandler("../../server/api/admin/settings/notification-subscribers.post");
    await expect(handler({ body: {} })).rejects.toThrow();
  });
});

describe("PUT /api/admin/settings/notification-subscribers/:id (disable / partial update)", () => {
  it("disables a subscriber with a partial update while keeping the row", async () => {
    // C4: disabling is an update, not a delete — the row stays.
    prismaMock.notificationSubscriber.update.mockResolvedValue(subscriberRow({ isActive: false }));

    const handler = await importHandler("../../server/api/admin/settings/notification-subscribers/[id].put");
    const result = await handler({ params: { id: "sub-1" }, body: { isActive: false } });

    expect(prismaMock.notificationSubscriber.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { isActive: false },
    });
    expect(prismaMock.notificationSubscriber.delete).not.toHaveBeenCalled();
    expect(result).toEqual(subscriberRow({ isActive: false }));
  });

  it("accepts channel toggles and strips unknown body fields via the zod schema", async () => {
    prismaMock.notificationSubscriber.update.mockResolvedValue(subscriberRow());

    const handler = await importHandler("../../server/api/admin/settings/notification-subscribers/[id].put");
    await handler({
      params: { id: "sub-1" },
      body: { receiveReceipt: false, userId: "attacker-1" },
    });

    // zod strips the unknown `userId` key and the payload only carries schema fields.
    expect(prismaMock.notificationSubscriber.update).toHaveBeenCalledWith({
      where: { id: "sub-1" },
      data: { receiveReceipt: false },
    });
  });

  it("rejects a body where isActive is not a boolean", async () => {
    const handler = await importHandler("../../server/api/admin/settings/notification-subscribers/[id].put");
    await expect(handler({ params: { id: "sub-1" }, body: { isActive: "yes" } })).rejects.toThrow();
  });
});

describe("DELETE /api/admin/settings/notification-subscribers/:id (delete)", () => {
  it("hard-deletes the row and reports success", async () => {
    prismaMock.notificationSubscriber.delete.mockResolvedValue(subscriberRow());

    const handler = await importHandler("../../server/api/admin/settings/notification-subscribers/[id].delete");
    const result = await handler({ params: { id: "sub-1" } });

    expect(prismaMock.notificationSubscriber.delete).toHaveBeenCalledWith({ where: { id: "sub-1" } });
    expect(result).toEqual({ success: true });
  });

  it("requires an id param", async () => {
    const handler = await importHandler("../../server/api/admin/settings/notification-subscribers/[id].delete");
    await expect(handler({ params: {} })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("GET /api/admin/settings/notification (subscriber list projection)", () => {
  it("lists every subscriber row (including disabled ones) with the fixed projection and LINE link flag", async () => {
    prismaMock.notificationSetting.upsert.mockResolvedValue({ id: "singleton", notifyStaffOnNewOrder: true });
    prismaMock.notificationSubscriber.findMany.mockResolvedValue([
      subscriberRow({
        user: {
          id: "staff-1",
          name: "พนักงาน เอ",
          email: "staff@example.com",
          image: null,
          role: "EMPLOYEE",
          accounts: [{ accountId: "U-line-1" }],
        },
      }),
      subscriberRow({
        id: "sub-2",
        userId: "staff-2",
        isActive: false,
        user: {
          id: "staff-2",
          name: "ผู้ดูแล บี",
          email: "admin@example.com",
          image: "img.png",
          role: "ADMIN",
          accounts: [],
        },
      }),
    ]);

    const handler = await importHandler("../../server/api/admin/settings/notification.get");
    const result = (await handler({})) as { setting: unknown; subscribers: Array<Record<string, unknown>> };

    // Disabled rows remain visible in the admin list — the lifecycle states
    // stay distinguishable (C4).
    expect(result.subscribers).toHaveLength(2);
    expect(result.subscribers[0]).toEqual({
      id: "sub-1",
      userId: "staff-1",
      isActive: true,
      receiveNewOrder: true,
      receiveStatusChange: true,
      receiveReceipt: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      user: {
        id: "staff-1",
        name: "พนักงาน เอ",
        email: "staff@example.com",
        image: null,
        role: "EMPLOYEE",
        hasLineLinked: true,
      },
    });
    expect(result.subscribers[1].isActive).toBe(false);
    expect((result.subscribers[1].user as Record<string, unknown>).hasLineLinked).toBe(false);
  });
});
