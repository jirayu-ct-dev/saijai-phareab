import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({
  storefrontItem: { findMany: vi.fn() },
  packageService: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  packageServiceIncludedItem: { findMany: vi.fn(), deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));

const transactionMock = vi.hoisted(() => ({
  packageService: { findFirst: vi.fn(), update: vi.fn() },
  packageServiceIncludedItem: { findMany: vi.fn(), deleteMany: vi.fn() },
  storefrontItem: { findMany: vi.fn() },
}));

vi.mock("~~/server/utils/prisma", () => ({ prisma: prismaMock }));
vi.mock("~~/server/utils/auth", () => ({ requireRole: vi.fn() }));

(globalThis as Record<string, unknown>).defineEventHandler = (handler: unknown) => handler;
(globalThis as Record<string, unknown>).readValidatedBody = async (
  event: { body?: unknown },
  validate: (body: unknown) => unknown,
) => validate(event?.body);
(globalThis as Record<string, unknown>).getRouterParam = (event: { params?: Record<string, string> }, name: string) =>
  event?.params?.[name];
(globalThis as Record<string, unknown>).createError = (input: { statusCode?: number; statusMessage?: string } = {}) =>
  Object.assign(new Error(input.statusMessage ?? "H3Error"), input);

const serviceRow = (overrides: Record<string, unknown> = {}) => ({
  id: "package-service-1",
  name: "ซักอบ",
  description: null,
  includedItems: [],
  ...overrides,
});

const importHandler = async (path: string): Promise<(event?: unknown) => unknown> => {
  const mod = (await import(path)) as { default: (event?: unknown) => unknown };
  return mod.default;
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

describe("package services without included garments", () => {
  it("creates a service immediately with no included garments", async () => {
    prismaMock.packageService.create.mockResolvedValue(serviceRow());

    const handler = await importHandler("../../server/api/admin/package-services/index.post");
    const result = await handler({ body: { name: "ซักอบ", includedItemIds: [] } });

    expect(prismaMock.packageService.create).toHaveBeenCalledWith({
      data: { name: "ซักอบ", description: null },
      include: { includedItems: { select: { storefrontItemId: true } } },
    });
    expect(prismaMock.storefrontItem.findMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      id: "package-service-1",
      name: "ซักอบ",
      description: null,
      includedItemIds: [],
    });
  });

  it("allows removing every included garment from an existing service", async () => {
    transactionMock.packageService.findFirst.mockResolvedValue({ id: "package-service-1" });
    transactionMock.packageServiceIncludedItem.findMany.mockResolvedValue([
      { storefrontItemId: "shirt-1" },
    ]);
    transactionMock.storefrontItem.findMany.mockResolvedValue([]);
    transactionMock.packageService.update.mockResolvedValue(serviceRow());
    prismaMock.$transaction.mockImplementation((operation) => operation(transactionMock));

    const handler = await importHandler("../../server/api/admin/package-services/[id].put");
    const result = await handler({
      params: { id: "package-service-1" },
      body: { name: "ซักอบ", includedItemIds: [] },
    });

    expect(transactionMock.packageServiceIncludedItem.deleteMany).toHaveBeenCalledWith({
      where: { packageServiceId: "package-service-1" },
    });
    expect(transactionMock.packageService.update).toHaveBeenCalledWith({
      where: { id: "package-service-1" },
      data: { name: "ซักอบ", description: null },
      include: { includedItems: { select: { storefrontItemId: true } } },
    });
    expect(result).toEqual({
      id: "package-service-1",
      name: "ซักอบ",
      description: null,
      includedItemIds: [],
    });
  });
});
