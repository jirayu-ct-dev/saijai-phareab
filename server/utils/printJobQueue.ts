// ============================
// PRINT JOB QUEUE (PRN-03)
// ============================
//
// Server-side print queue core per docs/plan-database-printing-master-orchestration.md
// C8 (lease + fencing), C9 (stale guard) and PRN-03 "bridge claim/event/heartbeat":
//
// - Bridge credential auth: Authorization Bearer token compared timing-safe
//   against the printer's stored SHA-256 hash (no user session involved).
// - claimPrintJobs: single transaction, raw `UPDATE ... WHERE id IN
//   (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING` (proven pattern from
//   scripts/printing-rehearsal/prn02-claim-and-fencing.sql), stale-lease
//   reclaim, per-job C9 freshness validation (stale -> STALE_DOCUMENT).
// - applyPrintJobEvent: every bridge event must carry the current leaseToken
//   AND fencingToken; transitions validated via shared/utils/printJobState.
//
// The token itself is never logged.

import { createHash, randomUUID } from "node:crypto";
import type { H3Event } from "h3";
import { Prisma } from "~~/app/generated/prisma/client";
import type { PaymentStatus } from "~~/shared/types/enums";
import type {
  PrintDocument,
  PrintJobFailureCode,
  PrintJobStatus,
  PrintJobTimelineEntry,
  PrinterProfile,
} from "~~/shared/types/printing";
import {
  appendPrintJobTimelineEntry,
  buildPrintJobIdempotencyKey,
  canTransitionPrintJobStatus,
  checkPrintJobFreshness,
  isFencingTokenCurrent,
  MAX_PRINT_JOB_TIMELINE_ENTRIES,
} from "~~/shared/utils/printJobState";
import { composePrintOperations } from "~~/shared/utils/printComposer";
import { timingSafeCompareStrings } from "~~/server/utils/timingSafeCompare";
import {
  buildPrintDocument,
  decimalToMinorExact,
  deriveSourceRevision,
  decryptPaymentQrReceiverValue,
  loadPaymentQrReceiverKeyring,
  snapshotHashOf,
} from "~~/server/utils/printDocument";

export const PRINT_JOB_LEASE_TTL_MS = 30_000;
export const PRINT_JOB_MAX_CLAIM = 5;
export const PRINT_JOB_RENDER_VERSION = "prn05-1";

// createError is a Nitro auto-import at runtime; fall back to a plain error
// carrying statusCode so pure unit tests (vitest node env) still work.
const httpError = (statusCode: number, statusMessage: string): Error => {
  if (typeof createError === "function") {
    return createError({ statusCode, statusMessage });
  }
  const error = new Error(statusMessage) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
};

/** Bridge event types map 1:1 onto a target PrintJobStatus. */
export const PRINT_BRIDGE_EVENT_TYPES = [
  "RENDERING",
  "READY",
  "SENDING",
  "SENT",
  "ACKNOWLEDGED",
  "RETRY_WAIT",
  "FAILED",
  "NEEDS_REVIEW",
  "STALE_DOCUMENT",
] as const satisfies readonly PrintJobStatus[];

export type PrintBridgeEventType = (typeof PRINT_BRIDGE_EVENT_TYPES)[number];

const SAFE_FAILURE_CODES: readonly PrintJobFailureCode[] = [
  "FAILED_CONFIG",
  "FAILED_OFFLINE",
  "FAILED_TIMEOUT",
  "FAILED_DEVICE",
  "FAILED_RENDER",
  "STALE_DOCUMENT",
  "NEEDS_REVIEW",
];

// ============================
// BRIDGE CREDENTIAL AUTH
// ============================

export type BridgePrinterIdentity = {
  id: string;
  bridgeCredentialVersion: number | null;
};

/**
 * Authenticates a print-bridge request: `Authorization: Bearer <credential>`
 * is SHA-256 hashed and compared timing-safe against the printer's stored
 * `bridgeCredentialHash`. No user session is involved. Never log the token.
 */
export async function requireBridgePrinter(
  prisma: { printer: { findFirst: Function } },
  event: H3Event,
  printerId: string,
): Promise<BridgePrinterIdentity> {
  const header = event.node?.req?.headers?.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || !printerId) {
    throw httpError(401, "ต้องการ bridge credential");
  }

  const printer = await prisma.printer.findFirst({
    where: { id: printerId, deletedAt: null },
    select: { id: true, bridgeCredentialHash: true, bridgeCredentialVersion: true },
  });
  if (!printer?.bridgeCredentialHash) {
    throw httpError(401, "bridge credential ไม่ถูกต้อง");
  }

  const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
  // Both inputs are fixed-length hex digests; timing-safe comparison.
  if (!timingSafeCompareStrings(tokenHash, printer.bridgeCredentialHash)) {
    throw httpError(401, "bridge credential ไม่ถูกต้อง");
  }
  return { id: printer.id, bridgeCredentialVersion: printer.bridgeCredentialVersion ?? null };
}

// ============================
// PRINTER PROFILE
// ============================

/** Maps a Printer row onto the frozen PrinterProfile contract. */
export function printerProfileFromPrinterRow(row: {
  id: string;
  name: string;
  model: string;
  defaultTransport: PrinterProfile["defaultTransport"];
  paperWidthMm: number;
  printableDots: number;
  renderMode: PrinterProfile["renderMode"];
  capabilities: unknown;
}): PrinterProfile {
  const capabilities = (typeof row.capabilities === "object" && row.capabilities !== null
    ? row.capabilities
    : {}) as Partial<PrinterProfile["capabilities"]>;
  return {
    id: row.id,
    name: row.name,
    model: row.model === "XP_C260M" ? "XP-C260M" : "XP-C260M",
    defaultTransport: row.defaultTransport,
    paperWidthMm: row.paperWidthMm === 58 ? 58 : 80,
    printableDots: row.printableDots === 512 ? 512 : row.printableDots === 384 ? 384 : 576,
    renderMode: row.renderMode,
    capabilities: {
      partialCut: capabilities.partialCut === true,
      nativeQr: capabilities.nativeQr === true,
      nativeBarcode: capabilities.nativeBarcode === true,
      pdf417: capabilities.pdf417 === true,
      nvLogo: capabilities.nvLogo === true,
      buzzer: capabilities.buzzer === true,
      statusQuery: capabilities.statusQuery === true,
      cashDrawer: capabilities.cashDrawer === true,
      blackMark: capabilities.blackMark === true,
    },
  };
}

// ============================
// STALE GUARD (C9)
// ============================

export type StaleGuardJob = {
  sourceRevision: number;
  snapshotHasPaymentQr: boolean;
  sourceStatus: PaymentStatus;
  amountMinor: number;
  qrConfigVersion: number | null;
};

export type StaleGuardPayment = {
  status: PaymentStatus;
  amountMinor: number;
  updatedAt: Date;
};

export type StaleGuardSetting = {
  paymentQrEnabled: boolean;
  paymentQrActivated: boolean;
  paymentQrConfigVersion: number;
};

/**
 * C9 pre-send/claim stale guard: a job may only print while its source is
 * still the exact document it was snapshotted from. Returns the stale reasons
 * (empty = fresh). Compares against the CURRENT payment + AppSetting read in
 * the same transaction as the claim.
 */
export function validateJobFreshness(
  job: StaleGuardJob,
  currentPayment: StaleGuardPayment,
  appSetting: StaleGuardSetting,
): ReturnType<typeof checkPrintJobFreshness> {
  return checkPrintJobFreshness({
    snapshotSourceRevision: job.sourceRevision,
    currentSourceRevision: deriveSourceRevision(currentPayment.updatedAt),
    snapshotHasPaymentQr: job.snapshotHasPaymentQr,
    snapshotPaymentStatus: job.sourceStatus,
    currentPaymentStatus: currentPayment.status,
    snapshotAmountMinor: job.amountMinor,
    currentAmountMinor: currentPayment.amountMinor,
    snapshotQrConfigVersion: job.qrConfigVersion,
    currentQrConfigVersion: appSetting.paymentQrConfigVersion,
    currentPaymentQrEnabled: appSetting.paymentQrEnabled,
    currentReceiverActivated: appSetting.paymentQrActivated,
  });
}

// ============================
// TIMELINE
// ============================

export function appendTimeline(
  timeline: unknown,
  entry: PrintJobTimelineEntry,
): PrintJobTimelineEntry[] {
  const existing = Array.isArray(timeline) ? (timeline as PrintJobTimelineEntry[]) : [];
  return appendPrintJobTimelineEntry(existing, entry, MAX_PRINT_JOB_TIMELINE_ENTRIES);
}

// ============================
// JSON-SAFE PROJECTION (list/admin views — never the snapshot payload)
// ============================

type PrintJobRowLike = {
  id: string;
  printerId: string;
  kind: PrintDocument["kind"];
  documentId: string;
  documentNo: string;
  documentRevision: number;
  status: PrintJobStatus;
  sourcePaymentId: string;
  sourceStatus: PaymentStatus;
  sourceRevision: number;
  amountMinor: number;
  qrConfigVersion: number | null;
  snapshotHasPaymentQr: boolean;
  snapshotHash: string;
  renderVersion: string;
  snapshotExpiresAt: Date | null;
  requestedById: string;
  selectedTransport: PrinterProfile["defaultTransport"];
  idempotencyKey: string;
  reprintOfId: string | null;
  availableAt: Date;
  attemptCount: number;
  sendStartedAt: Date | null;
  leaseToken: string | null;
  leaseExpiresAt: Date | null;
  fencingToken: number | null;
  failureCode: string | null;
  failureMessageSafe: string | null;
  timeline: unknown;
  createdAt: Date;
  updatedAt: Date;
};

/** JSON-safe projection without the document snapshot (list/detail views). */
export function projectPrintJob(job: PrintJobRowLike) {
  return {
    id: job.id,
    printerId: job.printerId,
    kind: job.kind,
    documentId: job.documentId,
    documentNo: job.documentNo,
    documentRevision: job.documentRevision,
    status: job.status,
    source: {
      paymentId: job.sourcePaymentId,
      status: job.sourceStatus,
      revision: job.sourceRevision,
      amountMinor: job.amountMinor,
      qrConfigVersion: job.qrConfigVersion,
      snapshotHasPaymentQr: job.snapshotHasPaymentQr,
    },
    snapshotHash: job.snapshotHash,
    renderVersion: job.renderVersion,
    snapshotExpiresAt: job.snapshotExpiresAt?.toISOString() ?? null,
    requestedById: job.requestedById,
    selectedTransport: job.selectedTransport,
    idempotencyKey: job.idempotencyKey,
    reprintOfId: job.reprintOfId,
    availableAt: job.availableAt.toISOString(),
    attemptCount: job.attemptCount,
    sendStartedAt: job.sendStartedAt?.toISOString() ?? null,
    lease: {
      leaseToken: job.leaseToken ? "held" : null,
      leaseExpiresAt: job.leaseExpiresAt?.toISOString() ?? null,
      fencingToken: job.fencingToken,
    },
    failure: {
      code: job.failureCode,
      messageSafe: job.failureMessageSafe,
    },
    timeline: Array.isArray(job.timeline) ? job.timeline : [],
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

// ============================
// CLAIM
// ============================

export type ClaimedJobPayload = {
  jobId: string;
  leaseToken: string;
  fencingToken: number;
  leaseExpiresAt: string;
  kind: PrintDocument["kind"];
  documentNo: string;
  document: PrintDocument;
  operations: ReturnType<typeof composePrintOperations>["operations"];
  snapshotHash: string;
  renderVersion: string;
};

type ClaimDb = {
  $transaction: (fn: (tx: any) => Promise<ClaimedJobPayload[]>) => Promise<ClaimedJobPayload[]>;
};

type ClaimedRawRow = { id: string; fencingToken: number };

/**
 * Claims up to `maxJobs` (<= 5) QUEUED jobs for one printer atomically:
 * 1. application-layer stale-lease reclaim (expired pre-send leases back to
 *    QUEUED; expired SENDING leases to NEEDS_REVIEW — ambiguous, not retried)
 * 2. one raw `UPDATE ... FOR UPDATE SKIP LOCKED RETURNING` that assigns the
 *    new lease, fencing token and attempt count
 * 3. per-job C9 freshness validation; stale jobs end as STALE_DOCUMENT
 */
export async function claimPrintJobs(
  db: ClaimDb,
  input: {
    printerId: string;
    /** Profile used to compose the print operations for claimed jobs. */
    printerProfile: PrinterProfile;
    maxJobs?: number;
    now?: Date;
  },
): Promise<ClaimedJobPayload[]> {
  const maxJobs = Math.min(Math.max(1, Math.floor(input.maxJobs ?? 1)), PRINT_JOB_MAX_CLAIM);
  const now = input.now ?? new Date();
  const leaseExpiresAt = new Date(now.getTime() + PRINT_JOB_LEASE_TTL_MS);
  const leaseToken = randomUUID();

  return db.$transaction(async (tx) => {
    // 1. Stale-lease reclaim (C8 / prn02-claim-and-fencing.sql test d).
    await tx.printJob.updateMany({
      where: {
        printerId: input.printerId,
        deletedAt: null,
        status: { in: ["CLAIMED", "RENDERING", "READY"] },
        leaseExpiresAt: { lt: now },
        sendStartedAt: null,
      },
      data: { status: "QUEUED" },
    });
    await tx.printJob.updateMany({
      where: {
        printerId: input.printerId,
        deletedAt: null,
        status: "SENDING",
        leaseExpiresAt: { lt: now },
      },
      data: { status: "NEEDS_REVIEW" },
    });

    // 2. Atomic claim (SKIP LOCKED so concurrent bridges never share a job).
    const claimed = await tx.$queryRaw<ClaimedRawRow[]>`
      UPDATE "print_job"
      SET
        "status" = 'CLAIMED',
        "leaseToken" = ${leaseToken},
        "leaseExpiresAt" = ${leaseExpiresAt},
        "attemptCount" = "attemptCount" + 1,
        "fencingToken" = COALESCE("fencingToken", 0) + 1
      WHERE "id" IN (
        SELECT "id" FROM "print_job"
        WHERE "status" = 'QUEUED'
          AND "availableAt" <= ${now}
          AND "printerId" = ${input.printerId}
          AND "deletedAt" IS NULL
        ORDER BY "createdAt"
        FOR UPDATE SKIP LOCKED
        LIMIT ${maxJobs}
      )
      RETURNING "id", "fencingToken"
    `;

    if (!claimed || claimed.length === 0) return [];

    // 3. Per-job details, freshness (C9) and timeline — rows are locked.
    const payloads: ClaimedJobPayload[] = [];
    for (const row of claimed) {
      const job = await tx.printJob.findUnique({
        where: { id: row.id },
        select: {
          id: true,
          kind: true,
          documentNo: true,
          documentRevision: true,
          sourceRevision: true,
          sourceStatus: true,
          amountMinor: true,
          qrConfigVersion: true,
          snapshotHasPaymentQr: true,
          snapshot: true,
          snapshotHash: true,
          renderVersion: true,
          timeline: true,
          sourcePayment: {
            select: { status: true, updatedAt: true, amount: true },
          },
        },
      });
      if (!job) continue;

      const currentSetting = await tx.appSetting.findUnique({
        where: { id: "singleton" },
        select: {
          paymentQrEnabled: true,
          paymentQrActivatedAt: true,
          paymentQrReceiverCiphertext: true,
          paymentQrKeyVersion: true,
          paymentQrConfigVersion: true,
        },
      });
      const setting = {
        paymentQrEnabled: currentSetting?.paymentQrEnabled === true,
        paymentQrActivated: Boolean(
          currentSetting?.paymentQrReceiverCiphertext
            && currentSetting.paymentQrKeyVersion
            && currentSetting.paymentQrActivatedAt,
        ),
        paymentQrConfigVersion: currentSetting?.paymentQrConfigVersion ?? 0,
      };

      const freshness = validateJobFreshness(
        {
          sourceRevision: job.sourceRevision,
          snapshotHasPaymentQr: job.snapshotHasPaymentQr,
          sourceStatus: job.sourceStatus,
          amountMinor: job.amountMinor,
          qrConfigVersion: job.qrConfigVersion,
        },
        {
          status: job.sourcePayment.status,
          amountMinor: decimalToMinorExact(job.sourcePayment.amount),
          updatedAt: job.sourcePayment.updatedAt,
        },
        setting,
      );

      if (freshness.stale) {
        await tx.printJob.update({
          where: { id: job.id },
          data: {
            status: "STALE_DOCUMENT",
            leaseToken: null,
            leaseExpiresAt: null,
            timeline: appendTimeline(job.timeline, {
              at: now.toISOString(),
              status: "STALE_DOCUMENT",
              note: freshness.reasons.join(","),
            }),
          },
        });
        continue;
      }

      const timeline = appendTimeline(job.timeline, {
        at: now.toISOString(),
        status: "CLAIMED",
        note: null,
      });
      await tx.printJob.update({
        where: { id: job.id },
        data: { timeline },
      });

      const document = job.snapshot as PrintDocument;
      payloads.push({
        jobId: job.id,
        leaseToken,
        fencingToken: row.fencingToken,
        leaseExpiresAt: leaseExpiresAt.toISOString(),
        kind: job.kind,
        documentNo: job.documentNo,
        document,
        operations: composePrintOperations(document, input.printerProfile).operations,
        snapshotHash: job.snapshotHash,
        renderVersion: job.renderVersion,
      });
    }
    return payloads;
  });
}

// ============================
// JOB CREATE (C9/C10/C12, idempotent)
// ============================

const paymentInclude = {
  user: { select: { name: true, phoneNumber: true } },
  serviceOrder: {
    select: {
      id: true,
      orderNo: true,
      quotationNo: true,
      subtotalAmount: true,
      discountAmount: true,
      note: true,
      weightKg: true,
      serviceOrderItems: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" as const },
        select: {
          quantity: true,
          unitPrice: true,
          totalPrice: true,
          notes: true,
          isPackageIncluded: true,
          storefrontPrice: {
            select: {
              storefrontService: { select: { name: true } },
              storefrontItem: { select: { name: true } },
            },
          },
        },
      },
    },
  },
  packageSale: {
    select: {
      id: true,
      subtotalAmount: true,
      discountAmount: true,
      items: {
        orderBy: { createdAt: "asc" as const },
        select: {
          qty: true,
          unitPrice: true,
          totalPrice: true,
          product: { select: { name: true } },
        },
      },
    },
  },
} satisfies Prisma.PaymentRecordInclude;

export type CreatePrintJobInput = {
  actorId: string;
  kind: PrintDocument["kind"];
  /** RECEIPT -> paymentId; QUOTATION -> serviceOrderId (v1). */
  documentId: string;
  transport?: PrinterProfile["defaultTransport"];
  idempotencyKey: string;
  now?: Date;
};

export type CreatePrintJobResult = {
  existing: boolean;
  job: Record<string, unknown>;
};

type CreateDb = {
  $transaction: (fn: (tx: any) => Promise<CreatePrintJobResult>) => Promise<CreatePrintJobResult>;
};

/**
 * Creates a print job from ONE consistent transaction: payment + source
 * document + AppSetting QR settings read together; document snapshot built
 * server-side; exact minor-unit money; QR payload encoded + re-validated.
 * A P2002 on the idempotency scope returns the existing job instead of an
 * error (double-click / network retry).
 */
export async function createPrintJob(
  db: CreateDb,
  input: CreatePrintJobInput,
): Promise<CreatePrintJobResult> {
  const now = input.now ?? new Date();

  return db.$transaction(async (tx) => {
    // v1: the single logical printer is the target.
    const printer = await tx.printer.findFirst({
      where: { deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    if (!printer) {
      throw httpError(
        409,
        "ยังไม่ได้ลงทะเบียนเครื่องพิมพ์ กรุณาเพิ่มเครื่องพิมพ์ก่อน",
      );
    }
    const selectedTransport = input.transport ?? printer.defaultTransport;

    // Source payment (RECEIPT: by paymentId, QUOTATION: by the order's payment).
    const payment = await tx.paymentRecord.findFirst({
      where:
        input.kind === "RECEIPT"
          ? { id: input.documentId, deletedAt: null }
          : { serviceOrderId: input.documentId, deletedAt: null },
      include: paymentInclude,
    });
    if (!payment) {
      throw httpError(
        404,
        input.kind === "RECEIPT" ? "ไม่พบรายการชำระเงินที่ระบุ" : "ไม่พบใบเสนอราคาที่ระบุ",
      );
    }

    // AppSetting + legacy shop fallback, read in the SAME transaction (C10).
    const [setting, legacyShop] = await Promise.all([
      tx.appSetting.findUnique({ where: { id: "singleton" } }),
      tx.shopSetting.findUnique({ where: { id: "singleton" } }),
    ]);

    const settingSnapshot = {
      name: setting?.name ?? null,
      phone: setting?.phone ?? null,
      address: setting?.address ?? null,
      lineQrImageUrl: setting?.lineQrImageUrl ?? null,
      paymentQrEnabled: setting?.paymentQrEnabled ?? null,
      paymentQrProvider: setting?.paymentQrProvider ?? null,
      paymentQrReceiverType: setting?.paymentQrReceiverType ?? null,
      paymentQrReceiverCiphertext: setting?.paymentQrReceiverCiphertext ?? null,
      paymentQrReceiverLast4: setting?.paymentQrReceiverLast4 ?? null,
      paymentQrReceiverLabel: setting?.paymentQrReceiverLabel ?? null,
      paymentQrKeyVersion: setting?.paymentQrKeyVersion ?? null,
      paymentQrConfigVersion: setting?.paymentQrConfigVersion ?? null,
      paymentQrActivatedAt: setting?.paymentQrActivatedAt ?? null,
      lineQrEnabled: setting?.lineQrEnabled ?? null,
    };

    // Receiver plaintext only when configured AND activated; a decryption
    // failure simply omits the QR block (plan: never fallback silently).
    let receiverValue: string | null = null;
    if (
      settingSnapshot.paymentQrReceiverCiphertext
      && settingSnapshot.paymentQrKeyVersion
      && settingSnapshot.paymentQrActivatedAt
    ) {
      const resolved = decryptPaymentQrReceiverValue({
        ciphertext: settingSnapshot.paymentQrReceiverCiphertext,
        keyVersion: settingSnapshot.paymentQrKeyVersion,
        keyring: loadPaymentQrReceiverKeyring(),
      });
      receiverValue = resolved.ok ? resolved.value : null;
    }

    const built = buildPrintDocument({
      kind: input.kind,
      payment: {
        ...payment,
        packageSale: payment.packageSale
          ? {
              ...payment.packageSale,
              items: (payment.packageSale.items ?? []).map((item: { product: { name: string }; qty: number; unitPrice: Prisma.Decimal; totalPrice: Prisma.Decimal }) => ({
                productName: item.product.name,
                qty: item.qty,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
              })),
            }
          : null,
      },
      setting: settingSnapshot,
      legacyShop: legacyShop
        ? {
            name: legacyShop.name,
            phone: legacyShop.phone,
            address: legacyShop.address,
            lineQrImageUrl: legacyShop.lineQrImageUrl,
          }
        : null,
      receiverValue,
      now,
    });

    const documentId =
      input.kind === "RECEIPT" ? payment.id : payment.serviceOrder?.id ?? payment.id;
    const idempotencyKey = buildPrintJobIdempotencyKey({
      requestedById: input.actorId,
      documentType: input.kind,
      documentId: input.documentId,
      transport: selectedTransport,
      requestId: input.idempotencyKey,
    });

    try {
      const job = await tx.printJob.create({
        data: {
          printerId: printer.id,
          kind: input.kind,
          documentId,
          documentNo: built.document.documentNo,
          documentRevision: built.document.revision,
          status: "QUEUED",
          sourcePaymentId: payment.id,
          sourceStatus: built.sourceStatus,
          sourceRevision: built.sourceRevision,
          amountMinor: built.amountMinor,
          qrConfigVersion: built.qrConfigVersion,
          snapshotHasPaymentQr: built.snapshotHasPaymentQr,
          snapshot: built.document,
          snapshotHash: snapshotHashOf(built.document),
          renderVersion: PRINT_JOB_RENDER_VERSION,
          snapshotExpiresAt: null, // v1 retention: never auto-delete (C12)
          requestedById: input.actorId,
          selectedTransport,
          idempotencyKey,
          availableAt: now,
        },
      });
      return { existing: false, job };
    } catch (error) {
      // Idempotency (double-click / network retry): return the existing job.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
      const existingJob = await tx.printJob.findFirst({
        where: {
          requestedById: input.actorId,
          kind: input.kind,
          documentId,
          selectedTransport,
          idempotencyKey,
        },
      });
      if (!existingJob) {
        throw httpError(409, "งานพิมพ์ซ้ำกับที่สร้างไว้แล้ว แต่ไม่พบรายการเดิม");
      }
      return { existing: true, job: existingJob };
    }
  });
}

// ============================
// BRIDGE EVENTS
// ============================

export type PrintJobEventInput = {
  jobId: string;
  leaseToken: string;
  fencingToken: number;
  type: PrintBridgeEventType;
  failureCode?: string;
  failureMessageSafe?: string;
};

export type PrintJobEventResult =
  | { jobId: string; accepted: true }
  | { jobId: string; accepted: false; reason: string };

type EventDb = {
  $transaction: (fn: (tx: any) => Promise<PrintJobEventResult>) => Promise<PrintJobEventResult>;
};

/**
 * Applies one bridge event inside a transaction. The job must carry the
 * CURRENT leaseToken AND fencingToken (otherwise "stale-fencing"); the status
 * transition must be valid per the frozen state machine; FAILED is only
 * accepted before bytes were written (sendStartedAt null).
 */
export async function applyPrintJobEvent(
  db: EventDb,
  input: {
    printerId: string;
    event: PrintJobEventInput;
    now?: Date;
  },
): Promise<PrintJobEventResult> {
  const { event } = input;
  const now = input.now ?? new Date();

  return db.$transaction(async (tx) => {
    const job = await tx.printJob.findFirst({
      where: { id: event.jobId, printerId: input.printerId, deletedAt: null },
    });
    if (!job) return { jobId: event.jobId, accepted: false, reason: "not-found" };

    const leaseMatches = job.leaseToken !== null && job.leaseToken === event.leaseToken;
    const fencingMatches = isFencingTokenCurrent(job.fencingToken, event.fencingToken);
    if (!leaseMatches || !fencingMatches) {
      return { jobId: event.jobId, accepted: false, reason: "stale-fencing" };
    }

    if (!PRINT_BRIDGE_EVENT_TYPES.includes(event.type)) {
      return { jobId: event.jobId, accepted: false, reason: "unknown-event-type" };
    }
    const nextStatus = event.type as PrintJobStatus;
    if (!canTransitionPrintJobStatus(job.status, nextStatus)) {
      return { jobId: event.jobId, accepted: false, reason: "invalid-transition" };
    }

    const data: Record<string, unknown> = { status: nextStatus };

    if (nextStatus === "SENDING") {
      data.sendStartedAt = job.sendStartedAt ?? now;
    }
    if (nextStatus === "FAILED" || nextStatus === "NEEDS_REVIEW" || nextStatus === "STALE_DOCUMENT") {
      const failureCode = event.failureCode;
      if (nextStatus === "FAILED") {
        // FAILED is only allowed pre-send; after bytes were written the result
        // is ambiguous and must go through NEEDS_REVIEW instead.
        if (job.sendStartedAt) {
          return { jobId: event.jobId, accepted: false, reason: "failed-after-send" };
        }
        if (!failureCode || !SAFE_FAILURE_CODES.includes(failureCode as PrintJobFailureCode)) {
          return { jobId: event.jobId, accepted: false, reason: "invalid-failure-code" };
        }
      }
      data.failureCode = failureCode ?? (nextStatus === "STALE_DOCUMENT" ? "STALE_DOCUMENT" : "NEEDS_REVIEW");
      data.failureMessageSafe = event.failureMessageSafe?.slice(0, 500) ?? null;
    }

    // Terminal / hand-back events release the lease.
    if (["SENT", "ACKNOWLEDGED", "FAILED", "NEEDS_REVIEW", "STALE_DOCUMENT", "RETRY_WAIT"].includes(nextStatus)) {
      data.leaseToken = null;
      data.leaseExpiresAt = null;
    }

    data.timeline = appendTimeline(job.timeline, {
      at: now.toISOString(),
      status: nextStatus,
      note: event.failureMessageSafe?.slice(0, 200) ?? null,
    });

    await tx.printJob.update({ where: { id: job.id }, data });
    return { jobId: event.jobId, accepted: true };
  });
}
