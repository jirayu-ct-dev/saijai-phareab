/**
 * DB-01 characterization tests — document delivery timestamp, Decimal
 * boundary, and item photo contracts.
 *
 * C6 compatibility invariant: DB-03 added `completedAt` and DB-04 stamps new
 * completion transitions. Backdated intake requires documents to prefer it,
 * retaining the legacy `updatedAt` fallback for rows without it. `paidAt` must never be presented as
 * the delivery timestamp. These tests pin that temporary read-old behavior.
 *
 * Also protects:
 *   - Decimal values leave the document builder as JSON-safe numbers.
 *   - ServiceOrderItemImage rows are the photo source of truth with the first
 *     photo stored through ServiceOrderItemImage only.
 *
 * Prisma is mocked for the document builder; handler-embedded rules that have
 * no pure seam are pinned as source contracts (repo-idiomatic pattern, see
 * tests/server/reusableCustomerContracts.test.ts).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "~~/app/generated/prisma/client";

const prismaMock = vi.hoisted(() => ({
  paymentRecord: {
    findFirst: vi.fn(),
  },
  serviceOrder: {
    findMany: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("~~/server/utils/prisma", () => ({ prisma: prismaMock }));

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const receivedAt = new Date("2026-08-01T04:00:00.000Z");
const deliveredUpdatedAt = new Date("2026-08-03T09:30:00.000Z");
const paidAt = new Date("2026-08-03T08:00:00.000Z");

const paymentFixture = (overrides: Record<string, unknown> = {}) => ({
  id: "payment-1",
  paymentNo: "PAY-2026-0001",
  receiptNo: "RC-2026-0001",
  status: "PAID",
  method: "CASH",
  createdAt: new Date("2026-08-01T03:00:00.000Z"),
  paidAt,
  confirmedAt: paidAt,
  confirmedBy: null,
  note: null,
  metadata: null,
  amount: new Prisma.Decimal("642.00"),
  packageSaleId: null as string | null,
  packageSale: null,
  serviceOrderId: "order-1",
  user: {
    id: "user-1",
    name: "ลูกค้า ก",
    email: "customer@example.com",
    phoneNumber: "0812345678",
    image: null,
  },
  slipImage: null,
  serviceOrder: {
    id: "order-1",
    orderNo: "ORD-2026-0001",
    quotationNo: "QT-2026-0001",
    status: "COMPLETED",
    note: null,
    memberEntitlementId: null as string | null,
    receivedAt,
    updatedAt: deliveredUpdatedAt,
    dueAt: null,
    weightKg: null as Prisma.Decimal | null,
    washFoldPricePerKgSnapshot: null as Prisma.Decimal | null,
    subtotalAmount: new Prisma.Decimal("700.00"),
    discountAmount: new Prisma.Decimal("58.00"),
    totalAmount: new Prisma.Decimal("642.00"),
    creditUsed: 0,
    hangerCharge: null,
    employee: null,
    memberEntitlement: null,
    addonUsageRecords: [],
    serviceOrderItems: [
      {
        id: "item-1",
        quantity: 2,
        unitPrice: new Prisma.Decimal("55.50"),
        totalPrice: new Prisma.Decimal("111.00"),
        notes: null,
        isPackageIncluded: false,
        storefrontPrice: null,
      },
    ],
  },
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

const buildPayload = async (payment: ReturnType<typeof paymentFixture>) => {
  prismaMock.paymentRecord.findFirst.mockResolvedValue(payment);
  const { buildPaymentDocumentPayload } = await import("../../server/utils/paymentDocument");
  const payload = await buildPaymentDocumentPayload("payment-1");
  expect(payload).not.toBeNull();
  return payload!;
};

describe("legacy delivery timestamp fallback during DB-04 compatibility", () => {
  it("preserves the actual backdated completion and payment dates when entered later", async () => {
    const fixture = paymentFixture();
    const payload = await buildPayload(paymentFixture({
      serviceOrder: { ...fixture.serviceOrder, completedAt: new Date("2026-08-02T10:00:00Z") },
      confirmedAt: new Date("2026-09-05T05:00:00Z"),
    }));
    expect(payload.serviceOrder!.deliveredAt).toBe("2026-08-02T10:00:00.000Z");
    expect(payload.paidAt).toBe(paidAt.toISOString());
    expect(payload.confirmedAt).toBe("2026-09-05T05:00:00.000Z");
  });
  it("derives deliveredAt from updatedAt for a COMPLETED order", async () => {
    const payload = await buildPayload(paymentFixture());

    expect(payload.serviceOrder!.deliveredAt).toBe("2026-08-03T09:30:00.000Z");
    expect(payload.serviceOrder!.deliveredAt).not.toBe(paidAt.toISOString());
  });

  it("returns null deliveredAt for an order that is not COMPLETED", async () => {
    const payload = await buildPayload(
      paymentFixture({
        serviceOrder: { ...paymentFixture().serviceOrder, status: "RECEIVED" },
        status: "UNPAID",
      }),
    );

    expect(payload.serviceOrder!.deliveredAt).toBeNull();
  });

  it("quirk: an order edited after completion shifts deliveredAt, because updatedAt moves", async () => {
    // Documents why C6 exists: the fallback tracks row updates, not the
    // completion moment. Any unrelated edit (e.g. note fix) changes the
    // presented delivery timestamp.
    const payload = await buildPayload(paymentFixture());
    expect(payload.serviceOrder!.deliveredAt).toBe(deliveredUpdatedAt.toISOString());
    expect(payload.serviceOrder!.receivedAt).toBe(receivedAt.toISOString());
  });

  it("mirrors the same COMPLETED->updatedAt fallback in the /api/me payment handler (source contract)", () => {
    expect(source("server/api/me/payment/[id].get.ts")).toMatch(
      /deliveredAt:\s*payment\.serviceOrder\.status === "COMPLETED"\s*\?\s*\(payment\.serviceOrder\.completedAt \?\? payment\.serviceOrder\.updatedAt\)\.toISOString\(\)/,
    );
  });

  it("uses updatedAt (not paidAt) as the staff notification delivery date for COMPLETED orders (source contract)", () => {
    const notifySource = source("server/utils/notify.ts");
    expect(notifySource).toMatch(
      /status === "COMPLETED"\)\s*\{\s*rows\.push\(kvRow\("วันที่ส่งผ้า",\s*formatDateTime\(order\.updatedAt\.toISOString\(\)\)\)\)/,
    );
    // The receipt notification uses paidAt for its payment date row — that is
    // a payment date, never the delivery date.
    expect(notifySource).toContain("formatDateTime((payment.paidAt ?? payment.updatedAt).toISOString())");
  });
});

describe("Decimal -> JSON-safe boundary in the payment document payload", () => {
  it("renders money and weight fields as plain numbers", async () => {
    const payload = await buildPayload(paymentFixture());

    expect(payload.amount).toBe(642);
    const serviceOrder = payload.serviceOrder!;
    expect(serviceOrder.subtotalAmount).toBe(700);
    expect(serviceOrder.discountAmount).toBe(58);
    expect(serviceOrder.totalAmount).toBe(642);
    expect(serviceOrder.weightKg).toBeNull();

    const [item] = serviceOrder.items;
    expect(item.unitPrice).toBe(55.5);
    expect(item.totalPrice).toBe(111);
  });

  it("renders wash-fold weight and per-kg snapshot as numbers when present", async () => {
    const payload = await buildPayload(
      paymentFixture({
        serviceOrder: {
          ...paymentFixture().serviceOrder,
          weightKg: new Prisma.Decimal("4.25"),
          washFoldPricePerKgSnapshot: new Prisma.Decimal("60.00"),
        },
      }),
    );

    expect(payload.serviceOrder!.weightKg).toBe(4.25);
    expect(payload.serviceOrder!.washFoldPricePerKg).toBe(60);
  });

  it("parses VAT metadata into a plain object and returns null without usable metadata", async () => {
    const withVat = await buildPayload(
      paymentFixture({ metadata: { vat: { rate: 7, amount: 42, included: true, baseAmount: 600 } } }),
    );
    expect(withVat.vat).toEqual({ rate: 7, amount: 42, included: true, baseAmount: 600 });

    const withoutVat = await buildPayload(paymentFixture({ metadata: null }));
    expect(withoutVat.vat).toBeNull();
  });
});

describe("payment document presentation rules", () => {
  it("labels a service-order payment STOREFRONT and a package payment PACKAGE (keyed on packageSaleId)", async () => {
    const storefront = await buildPayload(paymentFixture());
    expect(storefront.receiptType).toBe("STOREFRONT");
    expect(storefront.quotationNo).toBe("QT-2026-0001");

    const pkg = await buildPayload(paymentFixture({ packageSaleId: "sale-1", packageSale: null }));
    // Quirk: the label keys off packageSaleId even if the sale row is absent.
    expect(pkg.receiptType).toBe("PACKAGE");
  });

  it("masks internal customer emails in the customer-facing document", async () => {
    const payload = await buildPayload(
      paymentFixture({ user: { id: "user-1", name: "ลูกค้า ก", email: "walkin-xyz@saijai.local", phoneNumber: null, image: null } }),
    );
    expect(payload.customer.email).toBeNull();
    expect(payload.customer.name).toBe("ลูกค้า ก");
  });

  it("loads only non-deleted payments", async () => {
    await buildPayload(paymentFixture());
    expect(prismaMock.paymentRecord.findFirst.mock.calls[0][0]).toMatchObject({
      where: { id: "payment-1", deletedAt: null },
    });
  });
});

describe("item photo contracts (ServiceOrderItemImage as source of truth)", () => {
  it("does not write the removed direct item.imageId mirror", () => {
    for (const path of ["server/api/admin/service-orders/index.post.ts", "server/api/admin/service-orders/[id].put.ts"]) {
      expect(source(path), `${path} must use only normalized photo rows`).not.toMatch(/imageId:\s*item\.imageId/);
    }
  });

  it("creates normalized photo rows with imageId, isDamaged and sortOrder (source contract)", () => {
    expect(source("server/api/admin/service-orders/index.post.ts")).toMatch(
      /serviceOrderItemImage\.createMany\(\{\s*data: item\.photos\.map\(\(photo, index\) => \(\{\s*serviceOrderItemId: createdItem\.id,\s*imageId: photo\.imageId,\s*isDamaged: photo\.isDamaged,\s*sortOrder: photo\.sortOrder \?\? index/,
    );
  });

  it("reads photos sorted by sortOrder with deletedAt filtered out (source contract: admin and member views)", () => {
    for (const path of ["server/api/admin/service-orders/[id].get.ts", "server/api/me/orders/[id].get.ts"]) {
      const read = source(path);
      expect(read, `${path} must filter deleted photos`).toMatch(/photos:\s*\{\s*where:\s*\{\s*deletedAt: null\s*\},\s*orderBy:\s*\{\s*sortOrder: "asc"/);
    }
  });

  it("exposes per-photo isDamaged and sortOrder plus the first-photo imageId in the member order view (source contract)", () => {
    const meOrder = source("server/api/me/orders/[id].get.ts");
    expect(meOrder).toMatch(/isDamaged: photo\.isDamaged/);
    expect(meOrder).toMatch(/sortOrder: photo\.sortOrder/);
    expect(meOrder).toMatch(/imageId: photo\.imageId/);
  });
});
