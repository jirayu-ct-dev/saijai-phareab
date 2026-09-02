import { describe, expect, it, vi } from "vitest";
import { Prisma } from "~~/app/generated/prisma/client";
import { createPrintJob, projectPrintJob } from "../../server/utils/printJobQueue";
import type { PrintDocument } from "../../shared/types/printing";

// PRN-03 API-level contracts exercised through the create/projection core:
// idempotency (P2002 -> existing job) and the JSON-safe projection.

const NOW = new Date("2026-06-01T03:00:00.000Z");
const UPDATED_AT = new Date("2026-06-01T02:00:00.000Z");

const document: PrintDocument = {
  kind: "RECEIPT",
  documentId: "payment-1",
  documentNo: "RC-0001",
  revision: 1,
  issuedAt: NOW.toISOString(),
  shop: { name: "ร้าน", addressLine: null, phoneNumber: null, taxId: null },
  customer: { name: "ลูกค้า", phoneNumber: null },
  items: [
    { name: "ซัก เสื้อ", quantity: 1, unitPriceMinor: 123456, totalPriceMinor: 123456, note: null },
  ],
  totals: { subtotalAmountMinor: 123456, discountAmountMinor: 0, totalAmountMinor: 123456 },
  note: null,
  qrBlocks: [],
};

const existingJobRow = {
  id: "job-existing",
  printerId: "printer-1",
  kind: "RECEIPT",
  documentId: "payment-1",
  documentNo: "RC-0001",
  documentRevision: 1,
  status: "QUEUED",
  sourcePaymentId: "payment-1",
  sourceStatus: "UNPAID",
  sourceRevision: UPDATED_AT.getTime(),
  amountMinor: 123456,
  qrConfigVersion: null,
  snapshotHasPaymentQr: false,
  snapshot: document,
  snapshotHash: "hash-1",
  renderVersion: "prn05-1",
  snapshotExpiresAt: null,
  requestedById: "employee-1",
  selectedTransport: "WIFI",
  idempotencyKey: JSON.stringify(["employee-1", "RECEIPT", "payment-1", "WIFI", "key-12345678"]),
  reprintOfId: null,
  availableAt: NOW,
  attemptCount: 0,
  sendStartedAt: null,
  leaseToken: null,
  leaseExpiresAt: null,
  fencingToken: null,
  failureCode: null,
  failureMessageSafe: null,
  timeline: [],
  createdAt: NOW,
  updatedAt: NOW,
};

const paymentRow = {
  id: "payment-1",
  paymentNo: "PAY-0001",
  receiptNo: "RC-0001",
  amount: { toFixed: () => "1234.56" },
  status: "UNPAID",
  note: null,
  updatedAt: UPDATED_AT,
  user: { name: "ลูกค้า", phoneNumber: "0812345678" },
  serviceOrder: null,
  packageSale: null,
};

const makeTx = () => ({
  printer: {
    findFirst: vi.fn().mockResolvedValue({ id: "printer-1", defaultTransport: "WIFI" }),
  },
  paymentRecord: {
    findFirst: vi.fn().mockResolvedValue(paymentRow),
  },
  appSetting: { findUnique: vi.fn().mockResolvedValue(null) },
  shopSetting: { findUnique: vi.fn().mockResolvedValue(null) },
  printJob: {
    create: vi.fn(),
    findFirst: vi.fn(),
  },
});

describe("createPrintJob idempotency", () => {
  it("returns the existing job when the scope is found before insert (pre-check)", async () => {
    const tx = makeTx();
    tx.printJob.findFirst.mockResolvedValue(existingJobRow);

    const result = await createPrintJob(
      { $transaction: (fn: (t: unknown) => Promise<unknown>) => fn(tx) } as never,
      {
        actorId: "employee-1",
        kind: "RECEIPT",
        documentId: "payment-1",
        idempotencyKey: "key-12345678",
        now: NOW,
      },
    );

    expect(result.existing).toBe(true);
    expect(result.job).toMatchObject({ id: "job-existing" });
    expect(tx.printJob.create).not.toHaveBeenCalled();
  });

  it("returns the existing job on a concurrent P2002 via an out-of-transaction lookup", async () => {
    const tx = makeTx();
    tx.printJob.findFirst.mockResolvedValue(null);
    tx.printJob.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );
    // Postgres aborts the tx on P2002 — the winning row must be looked up
    // with the non-transactional client.
    const dbFindFirst = vi.fn().mockResolvedValue(existingJobRow);

    const result = await createPrintJob(
      {
        $transaction: (fn: (t: unknown) => Promise<unknown>) => fn(tx),
        printJob: { findFirst: dbFindFirst },
      } as never,
      {
        actorId: "employee-1",
        kind: "RECEIPT",
        documentId: "payment-1",
        idempotencyKey: "key-12345678",
        now: NOW,
      },
    );

    expect(result.existing).toBe(true);
    expect(result.job).toMatchObject({ id: "job-existing" });
    expect(dbFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          requestedById: "employee-1",
          kind: "RECEIPT",
          documentId: "payment-1",
          selectedTransport: "WIFI",
        }),
      }),
    );
  });

  it("creates a new job on the happy path", async () => {
    const tx = makeTx();
    tx.printJob.create.mockResolvedValue(existingJobRow);

    const result = await createPrintJob(
      { $transaction: (fn: (t: unknown) => Promise<unknown>) => fn(tx) } as never,
      {
        actorId: "employee-1",
        kind: "RECEIPT",
        documentId: "payment-1",
        idempotencyKey: "key-12345678",
        now: NOW,
      },
    );

    expect(result.existing).toBe(false);
    const data = tx.printJob.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      printerId: "printer-1",
      kind: "RECEIPT",
      documentId: "payment-1",
      documentNo: "RC-0001",
      status: "QUEUED",
      sourcePaymentId: "payment-1",
      sourceStatus: "UNPAID",
      sourceRevision: BigInt(UPDATED_AT.getTime()),
      amountMinor: 123456,
      snapshotHasPaymentQr: false,
      selectedTransport: "WIFI",
      renderVersion: "prn05-1",
    });
    // Exact money boundary: amount stored as minor units, never a float.
    expect(Number.isSafeInteger(data.amountMinor)).toBe(true);
  });

  it("fails with 404 when the source payment does not exist", async () => {
    const tx = makeTx();
    tx.paymentRecord.findFirst.mockResolvedValue(null);

    await expect(
      createPrintJob(
        { $transaction: (fn: (t: unknown) => Promise<unknown>) => fn(tx) } as never,
        {
          actorId: "employee-1",
          kind: "RECEIPT",
          documentId: "missing",
          idempotencyKey: "key-12345678",
          now: NOW,
        },
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("projectPrintJob (list view safety)", () => {
  it("never includes the document snapshot and masks the lease token", () => {
    const projection = projectPrintJob({
      ...existingJobRow,
      leaseToken: "secret-lease-token",
      leaseExpiresAt: NOW,
      fencingToken: 3,
      snapshotExpiresAt: NOW,
    } as never);

    const json = JSON.stringify(projection);
    expect(json).not.toContain("secret-lease-token");
    expect(json).not.toContain("qrBlocks");
    expect(projection).toMatchObject({
      id: "job-existing",
      status: "QUEUED",
      snapshotHash: "hash-1",
      lease: { leaseToken: "held", fencingToken: 3 },
      source: { paymentId: "payment-1", amountMinor: 123456 },
      timeline: [],
    });
    expect(projection.snapshotExpiresAt).toBe(NOW.toISOString());
  });
});
