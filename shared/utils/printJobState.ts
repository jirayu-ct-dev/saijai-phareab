// ============================
// PRINT JOB STATE MACHINE (pure)
// ============================
//
// Pure helpers for the PrintJob lifecycle, exactly per
// docs/plan-xprinter-wifi-printing.md ("Print job model และ state machine")
// and canonical decisions C8–C10 of the master plan:
//
//   QUEUED -> CLAIMED -> RENDERING -> READY -> SENDING -> SENT -> ACKNOWLEDGED
//   QUEUED/CLAIMED/RENDERING/READY -> RETRY_WAIT -> QUEUED (on availableAt)
//   QUEUED/CLAIMED/RENDERING/READY -> STALE_DOCUMENT
//   SENDING -> NEEDS_REVIEW (never silent retry after bytes were written)
//   NEEDS_REVIEW -> RESOLVED_PRINTED | RESOLVED_NOT_PRINTED | REPRINTED
//   Any early state -> FAILED (non-retryable or attempts exhausted)
//
// No Prisma, no network, no hardware. All inputs/outputs are JSON-safe.

import type {
  PaymentQrSettingSnapshot,
  PrintDocumentKind,
  PrintJobFailureCode,
  PrintJobIdempotencyScope,
  PrintJobStatus,
  PrintJobTimelineEntry,
  PrinterCapabilities,
} from "../types/printing";
import type { PaymentStatus } from "../types/enums";

// ============================
// TRANSITION TABLE
// ============================

const EARLY_STATUSES = ["QUEUED", "CLAIMED", "RENDERING", "READY"] as const;

export const PRINT_JOB_TRANSITIONS: Record<PrintJobStatus, PrintJobStatus[]> = Object.freeze({
  QUEUED: ["CLAIMED", "RETRY_WAIT", "FAILED", "STALE_DOCUMENT"],
  CLAIMED: ["RENDERING", "RETRY_WAIT", "FAILED", "STALE_DOCUMENT"],
  RENDERING: ["READY", "RETRY_WAIT", "FAILED", "STALE_DOCUMENT"],
  READY: ["SENDING", "RETRY_WAIT", "FAILED", "STALE_DOCUMENT"],
  SENDING: ["SENT", "NEEDS_REVIEW"],
  SENT: ["ACKNOWLEDGED"],
  ACKNOWLEDGED: [],
  RETRY_WAIT: ["QUEUED"],
  STALE_DOCUMENT: [],
  NEEDS_REVIEW: ["RESOLVED_PRINTED", "RESOLVED_NOT_PRINTED", "REPRINTED"],
  RESOLVED_PRINTED: [],
  RESOLVED_NOT_PRINTED: [],
  REPRINTED: [],
  FAILED: [],
});

export function canTransitionPrintJobStatus(
  from: PrintJobStatus,
  to: PrintJobStatus,
): boolean {
  return (PRINT_JOB_TRANSITIONS[from] ?? []).includes(to);
}

export function isPrintJobStatusTerminal(status: PrintJobStatus): boolean {
  return PRINT_JOB_TRANSITIONS[status].length === 0;
}

// ============================
// SAFE FAILURE CODES — user-facing Thai labels
// ============================

export const PRINT_JOB_FAILURE_CODE_LABELS: Readonly<
  Record<PrintJobFailureCode, string>
> = Object.freeze({
  FAILED_CONFIG: "ตั้งค่าเครื่องพิมพ์ไม่ถูกต้อง",
  FAILED_OFFLINE: "เครื่องพิมพ์ไม่พร้อมใช้งาน",
  FAILED_TIMEOUT: "หมดเวลาเชื่อมต่อเครื่องพิมพ์",
  FAILED_DEVICE: "เครื่องพิมพ์รายงานปัญหา (กระดาษ/ฝาปิด)",
  FAILED_RENDER: "เตรียมเอกสารสำหรับพิมพ์ไม่สำเร็จ",
  STALE_DOCUMENT: "เอกสารไม่ตรงกับข้อมูลล่าสุด จึงไม่พิมพ์",
  NEEDS_REVIEW: "ส่งงานไม่ชัดเจน ต้องตรวจใบที่เครื่องพิมพ์ก่อน",
});

// ============================
// PRINTER CAPABILITIES (all default-false until physically verified)
// ============================

export function createPrinterCapabilities(
  overrides: Partial<PrinterCapabilities> = {},
): PrinterCapabilities {
  return {
    partialCut: false,
    nativeQr: false,
    nativeBarcode: false,
    pdf417: false,
    nvLogo: false,
    buzzer: false,
    statusQuery: false,
    cashDrawer: false,
    blackMark: false,
    ...overrides,
  };
}

// ============================
// IDEMPOTENCY SCOPE KEY
// ============================

/**
 * Deterministic key over (requester, document, transport, client request ID).
 * JSON encoding prevents delimiter-injection from a client-supplied
 * `requestId`; every component must be a non-empty string.
 */
export function buildPrintJobIdempotencyKey(
  scope: PrintJobIdempotencyScope,
): string {
  const parts: string[] = [
    scope.requestedById,
    scope.documentType,
    scope.documentId,
    scope.transport,
    scope.requestId,
  ];
  for (const part of parts) {
    if (typeof part !== "string" || part.length === 0) {
      throw new Error("Idempotency scope components must be non-empty strings");
    }
  }
  return JSON.stringify(parts);
}

// ============================
// BOUNDED TIMELINE
// ============================

export const MAX_PRINT_JOB_TIMELINE_ENTRIES = 20;

/** Appends an entry, dropping the oldest ones beyond the bound. */
export function appendPrintJobTimelineEntry(
  timeline: readonly PrintJobTimelineEntry[],
  entry: PrintJobTimelineEntry,
  maxEntries: number = MAX_PRINT_JOB_TIMELINE_ENTRIES,
): PrintJobTimelineEntry[] {
  if (!Number.isInteger(maxEntries) || maxEntries < 1) {
    throw new Error("maxEntries must be a positive integer");
  }
  const next = [...timeline, entry];
  return next.length > maxEntries ? next.slice(next.length - maxEntries) : next;
}

// ============================
// FENCING TOKEN
// ============================

/**
 * Events (claims, state reports) must carry the job's current fencing token.
 * A token from an older lease is rejected; equality is required because the
 * token only ever increases with a new lease.
 */
export function isFencingTokenCurrent(
  currentFencingToken: number | null,
  presentedFencingToken: number | null,
): boolean {
  if (
    currentFencingToken === null ||
    presentedFencingToken === null ||
    !Number.isSafeInteger(currentFencingToken) ||
    !Number.isSafeInteger(presentedFencingToken)
  ) {
    return false;
  }
  return presentedFencingToken === currentFencingToken;
}

// ============================
// LEASE EXPIRY
// ============================

export type PrintJobLeaseExpiryDecision =
  | "LEASE_ACTIVE"
  | "RECLAIMABLE"
  | "NEEDS_REVIEW";

/**
 * Decides what an expired lease means:
 * - lease still active -> LEASE_ACTIVE
 * - expired and bytes never started (sendStartedAt null) -> RECLAIMABLE
 *   (job goes back to the queue, bounded retries)
 * - expired after sending started -> NEEDS_REVIEW (ambiguous; may have
 *   printed; never auto-retried)
 */
export function resolvePrintJobLeaseExpiry(input: {
  leaseExpiresAt: string;
  sendStartedAt: string | null;
  now: string;
}): PrintJobLeaseExpiryDecision {
  const { leaseExpiresAt, sendStartedAt, now } = input;
  const expiresAtMs = Date.parse(leaseExpiresAt);
  const nowMs = Date.parse(now);
  if (Number.isNaN(expiresAtMs) || Number.isNaN(nowMs)) {
    throw new Error("leaseExpiresAt and now must be valid ISO date strings");
  }
  if (nowMs < expiresAtMs) {
    return "LEASE_ACTIVE";
  }
  return sendStartedAt === null ? "RECLAIMABLE" : "NEEDS_REVIEW";
}

// ============================
// RETRY CLASSIFICATION
// ============================

export type PrintJobFailureClassification =
  | "RETRY_WAIT"
  | "FAILED"
  | "NEEDS_REVIEW";

/**
 * Automatic retry is allowed only before `sendStartedAt` and is bounded by
 * `maxAttempts`. A failure after bytes were written is ambiguous and must
 * always be reconciled by a human (NEEDS_REVIEW), never retried.
 */
export function classifyPrintJobFailure(input: {
  sendStartedAt: string | null;
  attemptCount: number;
  maxAttempts: number;
}): PrintJobFailureClassification {
  const { sendStartedAt, attemptCount, maxAttempts } = input;
  if (!Number.isInteger(attemptCount) || attemptCount < 0) {
    throw new Error("attemptCount must be a non-negative integer");
  }
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error("maxAttempts must be a positive integer");
  }
  if (sendStartedAt !== null) {
    return "NEEDS_REVIEW";
  }
  return attemptCount >= maxAttempts ? "FAILED" : "RETRY_WAIT";
}

// ============================
// PAYMENT QR ELIGIBILITY (create-time)
// ============================

export type PaymentQrIneligibilityReason =
  | "QR_DISABLED"
  | "DOCUMENT_NOT_QUOTATION"
  | "PAYMENT_NOT_UNPAID"
  | "AMOUNT_NOT_POSITIVE"
  | "RECEIVER_NOT_ACTIVATED";

export type PaymentQrEligibilityResult = {
  eligible: boolean;
  reasons: PaymentQrIneligibilityReason[];
};

/**
 * Display policy (C9 / "Payment QR design" — Display policy):
 *   setting enabled AND kind == QUOTATION AND payment UNPAID AND
 *   amountMinor > 0 AND receiver configuration valid and activated.
 * Receipts (PAID), cancelled documents and zero amounts never get a
 * payment QR — omit the block, never fall back silently.
 */
export function evaluatePaymentQrEligibility(input: {
  documentKind: PrintDocumentKind;
  paymentStatus: PaymentStatus;
  amountMinor: number;
  paymentQrEnabled: boolean;
  receiverActivated: boolean;
}): PaymentQrEligibilityResult {
  const { documentKind, paymentStatus, amountMinor, paymentQrEnabled, receiverActivated } = input;
  const reasons: PaymentQrIneligibilityReason[] = [];
  if (!paymentQrEnabled) reasons.push("QR_DISABLED");
  if (documentKind !== "QUOTATION") reasons.push("DOCUMENT_NOT_QUOTATION");
  if (paymentStatus !== "UNPAID") reasons.push("PAYMENT_NOT_UNPAID");
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    reasons.push("AMOUNT_NOT_POSITIVE");
  }
  if (!receiverActivated) reasons.push("RECEIVER_NOT_ACTIVATED");
  return { eligible: reasons.length === 0, reasons };
}

export function isPaymentQrEligible(input: Parameters<typeof evaluatePaymentQrEligibility>[0]): boolean {
  return evaluatePaymentQrEligibility(input).eligible;
}

/** Receiver configuration is "valid and activated" for eligibility purposes. */
export function isPaymentQrReceiverActivated(
  setting: Pick<
    PaymentQrSettingSnapshot,
    | "paymentQrEnabled"
    | "paymentQrReceiverCiphertext"
    | "paymentQrKeyVersion"
    | "paymentQrActivatedAt"
  >,
): boolean {
  return Boolean(
    setting.paymentQrEnabled &&
      setting.paymentQrReceiverCiphertext &&
      setting.paymentQrKeyVersion &&
      setting.paymentQrActivatedAt,
  );
}

// ============================
// STALE-DOCUMENT PRE-SEND CHECK
// ============================

export type PrintJobStaleReason =
  | "REVISION_MISMATCH"
  | "PAYMENT_STATUS_CHANGED"
  | "AMOUNT_MISMATCH"
  | "AMOUNT_NOT_POSITIVE"
  | "QR_DISABLED"
  | "RECEIVER_NOT_ACTIVATED"
  | "QR_CONFIG_VERSION_MISMATCH";

export type PrintJobFreshnessResult = {
  /** true -> finish as STALE_DOCUMENT, do not print. */
  stale: boolean;
  reasons: PrintJobStaleReason[];
};

/**
 * Pre-send / pre-claim stale guard (C9): a job whose snapshot contains a
 * payment QR block may only print when the source is still the exact
 * UNPAID quotation it was rendered from — same revision, same exact amount,
 * same QR config version, QR still enabled and receiver still activated.
 * Snapshots without a payment QR only require the source revision to be
 * unchanged (document content identical).
 */
export function checkPrintJobFreshness(input: {
  snapshotSourceRevision: number;
  currentSourceRevision: number;
  snapshotHasPaymentQr: boolean;
  snapshotPaymentStatus: PaymentStatus;
  currentPaymentStatus: PaymentStatus;
  snapshotAmountMinor: number;
  currentAmountMinor: number;
  snapshotQrConfigVersion: number | null;
  currentQrConfigVersion: number | null;
  currentPaymentQrEnabled: boolean;
  currentReceiverActivated: boolean;
}): PrintJobFreshnessResult {
  const {
    snapshotSourceRevision,
    currentSourceRevision,
    snapshotHasPaymentQr,
    snapshotPaymentStatus,
    currentPaymentStatus,
    snapshotAmountMinor,
    currentAmountMinor,
    snapshotQrConfigVersion,
    currentQrConfigVersion,
    currentPaymentQrEnabled,
    currentReceiverActivated,
  } = input;

  const reasons: PrintJobStaleReason[] = [];
  if (snapshotSourceRevision !== currentSourceRevision) {
    reasons.push("REVISION_MISMATCH");
  }
  if (snapshotHasPaymentQr) {
    if (currentPaymentStatus !== "UNPAID" || currentPaymentStatus !== snapshotPaymentStatus) {
      reasons.push("PAYMENT_STATUS_CHANGED");
    }
    if (!Number.isSafeInteger(currentAmountMinor) || currentAmountMinor <= 0) {
      reasons.push("AMOUNT_NOT_POSITIVE");
    } else if (currentAmountMinor !== snapshotAmountMinor) {
      reasons.push("AMOUNT_MISMATCH");
    }
    if (!currentPaymentQrEnabled) reasons.push("QR_DISABLED");
    if (!currentReceiverActivated) reasons.push("RECEIVER_NOT_ACTIVATED");
    if (currentQrConfigVersion !== snapshotQrConfigVersion) {
      reasons.push("QR_CONFIG_VERSION_MISMATCH");
    }
  }
  return { stale: reasons.length > 0, reasons };
}
