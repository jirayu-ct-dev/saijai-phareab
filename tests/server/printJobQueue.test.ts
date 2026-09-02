import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyPrintJobEvent,
  claimPrintJobs,
  printerProfileFromPrinterRow,
  validateJobFreshness,
  PRINT_JOB_MAX_CLAIM,
} from "../../server/utils/printJobQueue";
import { MAX_PRINT_JOB_TIMELINE_ENTRIES } from "../../shared/utils/printJobState";
import type { PrintDocument, PrintJobTimelineEntry } from "../../shared/types/printing";

const NOW = new Date("2026-06-01T03:00:00.000Z");
const UPDATED_AT = new Date("2026-06-01T02:00:00.000Z");

const printerProfile = printerProfileFromPrinterRow({
  id: "printer-1",
  name: "XP-C260M หน้าร้าน",
  model: "XP_C260M",
  defaultTransport: "WIFI",
  paperWidthMm: 80,
  printableDots: 576,
  renderMode: "HYBRID",
  capabilities: { nativeQr: true, partialCut: true },
});

const document: PrintDocument = {
  kind: "QUOTATION",
  documentId: "order-1",
  documentNo: "QT-0001",
  revision: 1,
  issuedAt: UPDATED_AT.toISOString(),
  shop: { name: "ร้าน", addressLine: null, phoneNumber: null, taxId: null },
  customer: { name: "ลูกค้า", phoneNumber: null },
  items: [
    { name: "ซัก เสื้อ", quantity: 1, unitPriceMinor: 123456, totalPriceMinor: 123456, note: null },
  ],
  totals: { subtotalAmountMinor: 123456, discountAmountMinor: 0, totalAmountMinor: 123456 },
  note: null,
  qrBlocks: [],
};

const jobRow = (overrides: Record<string, unknown> = {}) => ({
  id: "job-1",
  kind: "QUOTATION",
  documentNo: "QT-0001",
  documentRevision: 1,
  sourceRevision: UPDATED_AT.getTime(),
  sourceStatus: "UNPAID",
  amountMinor: 123456,
  qrConfigVersion: 3,
  snapshotHasPaymentQr: true,
  snapshot: document,
  snapshotHash: "hash-1",
  renderVersion: "prn05-1",
  timeline: [],
  sourcePayment: { status: "UNPAID", updatedAt: UPDATED_AT, amount: { toFixed: () => "1234.56" } },
  ...overrides,
});

const activatedSetting = {
  paymentQrEnabled: true,
  paymentQrActivatedAt: "2026-01-01T00:00:00.000Z",
  paymentQrReceiverCiphertext: "cipher",
  paymentQrKeyVersion: 1,
  paymentQrConfigVersion: 3,
};

const makeTx = (overrides: {
  job?: Record<string, unknown> | null;
  claimed?: Array<{ id: string; fencingToken: number }>;
  setting?: Record<string, unknown> | null;
} = {}) => {
  const tx = {
    printJob: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findUnique: vi.fn().mockResolvedValue(overrides.job === undefined ? jobRow() : overrides.job),
      update: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(overrides.job === undefined ? jobRow() : overrides.job),
    },
    appSetting: {
      findUnique: vi
        .fn()
        .mockResolvedValue(overrides.setting === undefined ? activatedSetting : overrides.setting),
    },
    $queryRaw: vi.fn().mockResolvedValue(overrides.claimed ?? [{ id: "job-1", fencingToken: 1 }]),
  };
  return tx;
};

const makeDb = (tx: ReturnType<typeof makeTx>) => ({
  $transaction: (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("claimPrintJobs", () => {
  it("claims a QUEUED job with a new lease, fencing token and composed operations", async () => {
    const tx = makeTx();
    const jobs = await claimPrintJobs(makeDb(tx) as never, {
      printerId: "printer-1",
      printerProfile,
      now: NOW,
    });

    expect(jobs).toHaveLength(1);
    const payload = jobs[0]!;
    expect(payload.jobId).toBe("job-1");
    expect(payload.leaseToken).toEqual(expect.any(String));
    expect(payload.fencingToken).toBe(1);
    expect(payload.leaseExpiresAt).toBe(new Date(NOW.getTime() + 30_000).toISOString());
    expect(payload.kind).toBe("QUOTATION");
    expect(payload.documentNo).toBe("QT-0001");
    expect(payload.document).toBe(document);
    expect(payload.snapshotHash).toBe("hash-1");
    expect(payload.renderVersion).toBe("prn05-1");
    // Composed operations: initialize first, partialCut (capability) last.
    expect(payload.operations[0]).toEqual({ type: "initialize" });
    expect(payload.operations.at(-1)).toEqual({ type: "partialCut" });

    // Atomic claim via FOR UPDATE SKIP LOCKED raw statement.
    expect(tx.printJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ["CLAIMED", "RENDERING", "READY"] } }),
      }),
    );
    expect(tx.printJob.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "SENDING" }),
      }),
    );
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    // Timeline entry appended for the claim.
    expect(tx.printJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({
          timeline: [expect.objectContaining({ status: "CLAIMED", at: NOW.toISOString() })],
        }),
      }),
    );
  });

  it("reclaims expired pre-send leases and parks expired SENDING jobs in NEEDS_REVIEW", async () => {
    const tx = makeTx({ claimed: [] });
    const jobs = await claimPrintJobs(makeDb(tx) as never, {
      printerId: "printer-1",
      printerProfile,
      now: NOW,
    });

    expect(jobs).toHaveLength(0);

    const reclaim = tx.printJob.updateMany.mock.calls.find(
      (call) => call[0].where.status?.in?.includes("CLAIMED"),
    )?.[0];
    expect(reclaim).toMatchObject({
      where: {
        printerId: "printer-1",
        status: { in: ["CLAIMED", "RENDERING", "READY"] },
        leaseExpiresAt: { lt: NOW },
        sendStartedAt: null,
      },
      data: { status: "QUEUED" },
    });

    const ambiguous = tx.printJob.updateMany.mock.calls.find(
      (call) => call[0].where.status === "SENDING",
    )?.[0];
    expect(ambiguous).toMatchObject({
      where: { status: "SENDING", leaseExpiresAt: { lt: NOW } },
      data: { status: "NEEDS_REVIEW" },
    });
  });

  it("moves jobs failing the C9 freshness check to STALE_DOCUMENT instead of sending", async () => {
    // QR config version changed since the snapshot (3 -> 4): stale.
    const tx = makeTx({
      setting: { ...activatedSetting, paymentQrConfigVersion: 4 },
    });
    const jobs = await claimPrintJobs(makeDb(tx) as never, {
      printerId: "printer-1",
      printerProfile,
      now: NOW,
    });

    expect(jobs).toHaveLength(0);
    expect(tx.printJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "job-1" },
        data: expect.objectContaining({
          status: "STALE_DOCUMENT",
          leaseToken: null,
          timeline: [expect.objectContaining({ status: "STALE_DOCUMENT", note: "QR_CONFIG_VERSION_MISMATCH" })],
        }),
      }),
    );
  });

  it("marks stale when the payment was updated after the snapshot (revision mismatch)", async () => {
    const laterUpdate = new Date(UPDATED_AT.getTime() + 5_000);
    const tx = makeTx({
      job: jobRow({ sourcePayment: { status: "UNPAID", updatedAt: laterUpdate, amount: { toFixed: () => "1234.56" } } }),
    });
    const jobs = await claimPrintJobs(makeDb(tx) as never, {
      printerId: "printer-1",
      printerProfile,
      now: NOW,
    });

    expect(jobs).toHaveLength(0);
    expect(tx.printJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "STALE_DOCUMENT" }),
      }),
    );
  });

  it("caps the claim batch at 5 jobs", () => {
    expect(PRINT_JOB_MAX_CLAIM).toBe(5);
  });
});

function timelineOf(update: unknown): PrintJobTimelineEntry[] {
  return (update as { data: { timeline: PrintJobTimelineEntry[] } }).data.timeline;
}

describe("validateJobFreshness (C9)", () => {
  const baseJob = {
    sourceRevision: UPDATED_AT.getTime(),
    snapshotHasPaymentQr: true,
    sourceStatus: "UNPAID" as const,
    amountMinor: 123456,
    qrConfigVersion: 3,
  };
  const basePayment = {
    status: "UNPAID" as const,
    amountMinor: 123456,
    updatedAt: UPDATED_AT,
  };
  const baseSetting = {
    paymentQrEnabled: true,
    paymentQrActivated: true,
    paymentQrConfigVersion: 3,
  };

  it("fresh when nothing changed", () => {
    expect(validateJobFreshness(baseJob, basePayment, baseSetting).stale).toBe(false);
  });

  it("stale on payment status change, amount mismatch or config version change", () => {
    expect(
      validateJobFreshness(baseJob, { ...basePayment, status: "PAID" }, baseSetting).reasons,
    ).toContain("PAYMENT_STATUS_CHANGED");
    expect(
      validateJobFreshness(baseJob, { ...basePayment, amountMinor: 999 }, baseSetting).reasons,
    ).toContain("AMOUNT_MISMATCH");
    expect(
      validateJobFreshness(baseJob, basePayment, { ...baseSetting, paymentQrConfigVersion: 4 }).reasons,
    ).toContain("QR_CONFIG_VERSION_MISMATCH");
    expect(
      validateJobFreshness(baseJob, basePayment, { ...baseSetting, paymentQrEnabled: false }).reasons,
    ).toContain("QR_DISABLED");
    // Revision marker = payment updatedAt.
    expect(
      validateJobFreshness(
        baseJob,
        { ...basePayment, updatedAt: new Date(UPDATED_AT.getTime() + 1) },
        baseSetting,
      ).reasons,
    ).toContain("REVISION_MISMATCH");
  });

  it("snapshots without payment QR only require the revision to be unchanged", () => {
    const job = { ...baseJob, snapshotHasPaymentQr: false };
    expect(
      validateJobFreshness(
        job,
        { ...basePayment, status: "PAID" },
        { ...baseSetting, paymentQrEnabled: false },
      ).stale,
    ).toBe(false);
  });
});

describe("applyPrintJobEvent", () => {
  const eventBase = { jobId: "job-1", leaseToken: "lease-1", fencingToken: 1 };

  const claimedJob = (overrides: Record<string, unknown> = {}) =>
    jobRow({
      printerId: "printer-1",
      status: "CLAIMED",
      leaseToken: "lease-1",
      fencingToken: 1,
      leaseExpiresAt: new Date(NOW.getTime() + 30_000),
      sendStartedAt: null,
      sourcePayment: undefined,
      ...overrides,
    });

  it("accepts a valid transition and appends a bounded timeline entry", async () => {
    const tx = makeTx({ job: claimedJob() });
    const result = await applyPrintJobEvent(makeDb(tx) as never, {
      printerId: "printer-1",
      event: { ...eventBase, type: "RENDERING" },
      now: NOW,
    });
    expect(result).toEqual({ jobId: "job-1", accepted: true });
    expect(tx.printJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RENDERING" }),
      }),
    );
  });

  it("rejects a stale fencing token", async () => {
    const tx = makeTx({ job: claimedJob() });
    const result = await applyPrintJobEvent(makeDb(tx) as never, {
      printerId: "printer-1",
      event: { ...eventBase, fencingToken: 2, type: "RENDERING" },
      now: NOW,
    });
    expect(result).toEqual({ jobId: "job-1", accepted: false, reason: "stale-fencing" });
    expect(tx.printJob.update).not.toHaveBeenCalled();
  });

  it("rejects a wrong lease token", async () => {
    const tx = makeTx({ job: claimedJob() });
    const result = await applyPrintJobEvent(makeDb(tx) as never, {
      printerId: "printer-1",
      event: { ...eventBase, leaseToken: "lease-old", type: "RENDERING" },
      now: NOW,
    });
    expect(result).toEqual({ jobId: "job-1", accepted: false, reason: "stale-fencing" });
  });

  it("sets sendStartedAt on SENDING", async () => {
    const tx = makeTx({ job: claimedJob({ status: "READY" }) });
    const result = await applyPrintJobEvent(makeDb(tx) as never, {
      printerId: "printer-1",
      event: { ...eventBase, type: "SENDING" },
      now: NOW,
    });
    expect(result).toEqual({ jobId: "job-1", accepted: true });
    expect(tx.printJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "SENDING", sendStartedAt: NOW }),
      }),
    );
  });

  it("rejects FAILED after bytes were written", async () => {
    const tx = makeTx({
      job: claimedJob({
        status: "SENDING",
        sendStartedAt: NOW,
      }),
    });
    const result = await applyPrintJobEvent(makeDb(tx) as never, {
      printerId: "printer-1",
      event: { ...eventBase, type: "FAILED", failureCode: "FAILED_DEVICE" },
      now: NOW,
    });
    // SENDING -> FAILED is not a valid transition at all.
    expect(result).toEqual({ jobId: "job-1", accepted: false, reason: "invalid-transition" });
  });

  it("rejects FAILED with sendStartedAt set even from a state that allows FAILED", async () => {
    const tx = makeTx({
      job: claimedJob({ status: "READY", sendStartedAt: NOW }),
    });
    const result = await applyPrintJobEvent(makeDb(tx) as never, {
      printerId: "printer-1",
      event: { ...eventBase, type: "FAILED", failureCode: "FAILED_DEVICE" },
      now: NOW,
    });
    expect(result).toEqual({ jobId: "job-1", accepted: false, reason: "failed-after-send" });
  });

  it("rejects FAILED without a safe failure code before send", async () => {
    const tx = makeTx({ job: claimedJob({ status: "READY" }) });
    const result = await applyPrintJobEvent(makeDb(tx) as never, {
      printerId: "printer-1",
      event: { ...eventBase, type: "FAILED" },
      now: NOW,
    });
    expect(result).toEqual({ jobId: "job-1", accepted: false, reason: "invalid-failure-code" });
  });

  it("accepts a pre-send FAILED with a safe failure code and clears the lease", async () => {
    const tx = makeTx({ job: claimedJob({ status: "READY" }) });
    const result = await applyPrintJobEvent(makeDb(tx) as never, {
      printerId: "printer-1",
      event: { ...eventBase, type: "FAILED", failureCode: "FAILED_DEVICE", failureMessageSafe: "กระดาษติด" },
      now: NOW,
    });
    expect(result).toEqual({ jobId: "job-1", accepted: true });
    expect(tx.printJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "FAILED",
          failureCode: "FAILED_DEVICE",
          failureMessageSafe: "กระดาษติด",
          leaseToken: null,
          leaseExpiresAt: null,
        }),
      }),
    );
  });

  it("bounds the timeline at MAX_PRINT_JOB_TIMELINE_ENTRIES, dropping the oldest", async () => {
    const fullTimeline: PrintJobTimelineEntry[] = Array.from(
      { length: MAX_PRINT_JOB_TIMELINE_ENTRIES },
      (_, i) => ({ at: NOW.toISOString(), status: "RENDERING", note: `t${i}` }),
    );
    const tx = makeTx({ job: claimedJob({ timeline: fullTimeline }) });
    await applyPrintJobEvent(makeDb(tx) as never, {
      printerId: "printer-1",
      event: { ...eventBase, type: "RENDERING" },
      now: NOW,
    });
    const update = tx.printJob.update.mock.calls[0]![0];
    const data = timelineOf(update);
    expect(data).toHaveLength(MAX_PRINT_JOB_TIMELINE_ENTRIES);
    // Oldest entry dropped, newest appended.
    expect(data[0].note).toBe("t1");
    expect(data.at(-1)).toMatchObject({ status: "RENDERING", note: null });
  });

  it("rejects events for another printer's job", async () => {
    const tx = makeTx({ job: null });
    const result = await applyPrintJobEvent(makeDb(tx) as never, {
      printerId: "printer-1",
      event: { ...eventBase, type: "RENDERING" },
      now: NOW,
    });
    expect(result).toEqual({ jobId: "job-1", accepted: false, reason: "not-found" });
  });
});
