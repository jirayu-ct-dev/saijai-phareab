// ============================
// PRINTING (pure contracts)
// ============================
//
// Pure TypeScript contracts for the XP-C260M print system (PRN-01).
// Nothing here may depend on Prisma, the database, network transports,
// hardware or any runtime dependency. All shapes are JSON-safe.
//
// Canonical decisions C7–C12 of docs/plan-database-printing-master-orchestration.md:
// v1 has only `Printer` and `PrintJob` concepts; QR settings live in AppSetting
// (only the setting *shape* needed by eligibility is defined here); money uses
// exact integer minor units (`amountMinor`).

import type { PaymentStatus } from "./enums";
import type { ReceiptPayload } from "./receipt";

// ============================
// PRINT DOCUMENT (Document boundary)
// ============================

export type PrintDocumentKind = "RECEIPT" | "QUOTATION";

/** Customer fields safe for a print document; derived from ReceiptPayload. */
export type PrintCustomerInfo = Pick<ReceiptPayload["customer"], "name" | "phoneNumber">;

export type ShopPrintInfo = {
  name: string;
  addressLine: string | null;
  phoneNumber: string | null;
  taxId: string | null;
};

/**
 * Money in a print document uses exact integer minor units (satang), never a
 * JavaScript float. Display formatting happens at the render boundary.
 */
export type PrintLineItem = {
  name: string;
  quantity: number;
  unitPriceMinor: number;
  totalPriceMinor: number;
  note: string | null;
};

export type PrintTotals = {
  subtotalAmountMinor: number;
  discountAmountMinor: number;
  totalAmountMinor: number;
};

/**
 * QR blocks are semantic: payment QR (amount-bound PromptPay) is separate from
 * LINE QR so the renderer can space/label them without binding business logic
 * into the ESC/POS composer. `qrBlocks` is always built server-side from
 * document state + settings snapshot; never accepted from the browser.
 */
export type PrintQrBlock =
  | {
      kind: "PAYMENT";
      payload: string;
      amountMinor: number;
      currency: "THB";
      receiverLabel: string;
      caption: string;
    }
  | {
      kind: "LINE";
      imageUrl: string;
      caption: string;
    };

export type PrintDocument = {
  kind: PrintDocumentKind;
  documentId: string;
  documentNo: string;
  revision: number;
  /** ISO 8601 string. */
  issuedAt: string;
  shop: ShopPrintInfo;
  customer: PrintCustomerInfo;
  items: PrintLineItem[];
  totals: PrintTotals;
  note: string | null;
  qrBlocks: PrintQrBlock[];
};

// ============================
// PRINT OPERATIONS (Hybrid ESC/POS composer input)
// ============================

export type PrintOperation =
  | { type: "initialize" }
  | { type: "raster"; bytes: Uint8Array; widthDots: number }
  | { type: "nativeQr"; data: string; size: number }
  | { type: "nativeBarcode"; symbology: string; data: string }
  | { type: "nvLogo"; key: string }
  | { type: "feed"; lines: number }
  | { type: "partialCut" }
  | { type: "buzzer"; pattern: string }
  | { type: "drawerPulse"; pin: number; onMs: number; offMs: number };

// ============================
// PRINTER PROFILE
// ============================

export type PrinterModel = "XP-C260M";

export type PrintTransport = "WIFI" | "ETHERNET" | "USB" | "BLUETOOTH";

export type PaperWidthMm = 80 | 58;

export type PrintableDots = 576 | 512 | 384;

export type PrintRenderMode = "RASTER" | "HYBRID";

/** Optional capabilities are all default-false until physically verified. */
export type PrinterCapabilities = {
  partialCut: boolean;
  nativeQr: boolean;
  nativeBarcode: boolean;
  pdf417: boolean;
  nvLogo: boolean;
  buzzer: boolean;
  statusQuery: boolean;
  cashDrawer: boolean;
  blackMark: boolean;
};

export type PrinterProfile = {
  id: string;
  name: string;
  model: PrinterModel;
  defaultTransport: PrintTransport;
  paperWidthMm: PaperWidthMm;
  printableDots: PrintableDots;
  renderMode: PrintRenderMode;
  capabilities: PrinterCapabilities;
};

// ============================
// PRINT JOB LIFECYCLE
// ============================

export type PrintJobStatus =
  | "QUEUED"
  | "CLAIMED"
  | "RENDERING"
  | "READY"
  | "SENDING"
  | "SENT"
  | "ACKNOWLEDGED"
  | "RETRY_WAIT"
  | "STALE_DOCUMENT"
  | "NEEDS_REVIEW"
  | "RESOLVED_PRINTED"
  | "RESOLVED_NOT_PRINTED"
  | "REPRINTED"
  | "FAILED";

/**
 * Safe failure codes only. Never store raw printer responses, stack traces,
 * endpoints or credentials in `failureMessageSafe`.
 */
export type PrintJobFailureCode =
  | "FAILED_CONFIG"
  | "FAILED_OFFLINE"
  | "FAILED_TIMEOUT"
  | "FAILED_DEVICE"
  | "FAILED_RENDER"
  | "STALE_DOCUMENT"
  | "NEEDS_REVIEW";

/** Per-printer lease held by the Local Print Bridge while processing a job. */
export type PrintJobLease = {
  leaseToken: string | null;
  /** ISO 8601 string, or null when no lease is held. */
  leaseExpiresAt: string | null;
  /** Monotonically increasing token; events must carry the current value. */
  fencingToken: number | null;
};

/** One bounded, safe timeline entry (no raw payloads, no PII). */
export type PrintJobTimelineEntry = {
  /** ISO 8601 string. */
  at: string;
  status: PrintJobStatus;
  note: string | null;
};

/** Snapshot provenance of the rendered document. */
export type PrintJobSnapshotRef = {
  snapshotHash: string;
  renderVersion: string;
  /** ISO 8601 string, or null (retention decided in D11). */
  snapshotExpiresAt: string | null;
};

/** Source payment facts captured at job creation (never client-supplied). */
export type PrintJobSource = {
  sourcePaymentId: string;
  /** Document revision the snapshot was rendered from. */
  sourceRevision: number;
  /** Payment status at creation. */
  sourceStatus: PaymentStatus;
  /** Exact minor units at creation. */
  amountMinor: number;
  /** QR config version at creation; null when the snapshot has no payment QR. */
  qrConfigVersion: number | null;
  /** Whether the rendered snapshot contains a PAYMENT QR block. */
  snapshotHasPaymentQr: boolean;
};

/** Core mutable lifecycle state of a PrintJob (JSON-safe projection). */
export type PrintJobLifecycleState = {
  status: PrintJobStatus;
  attemptCount: number;
  /** ISO 8601 string; when this passes a queued job becomes claimable again. */
  availableAt: string;
  /** ISO 8601 string when bytes were first written to the transport. */
  sendStartedAt: string | null;
  lease: PrintJobLease;
  failure: {
    code: PrintJobFailureCode | null;
    messageSafe: string | null;
  };
  timeline: PrintJobTimelineEntry[];
};

// ============================
// IDEMPOTENCY
// ============================

/**
 * Unique scope of a create-job request: requester + document + transport +
 * client-generated request ID (guards double-click / network retry).
 */
export type PrintJobIdempotencyScope = {
  requestedById: string;
  documentType: PrintDocumentKind;
  documentId: string;
  transport: PrintTransport;
  requestId: string;
};

// ============================
// PAYMENT QR SETTINGS (AppSetting shape for eligibility; no Prisma model here)
// ============================

export type PaymentQrReceiverType = "MOBILE" | "NATIONAL_OR_TAX_ID" | "EWALLET";

export type PaymentQrProviderKind = "PROMPTPAY_LOCAL" | "BANK_MERCHANT";

/**
 * Shape of the payment-QR portion of AppSetting used by eligibility checks.
 * The receiver identifier itself is stored encrypted (ciphertext + key
 * version); APIs only ever expose type, label and last 4 digits.
 */
export type PaymentQrSettingSnapshot = {
  paymentQrEnabled: boolean;
  paymentQrProvider: PaymentQrProviderKind;
  paymentQrReceiverType: PaymentQrReceiverType;
  paymentQrReceiverCiphertext: string | null;
  paymentQrReceiverLast4: string | null;
  paymentQrReceiverLabel: string | null;
  paymentQrKeyVersion: number | null;
  paymentQrConfigVersion: number;
  /** ISO 8601 string; non-null only after a successful activation test. */
  paymentQrActivatedAt: string | null;
  lineQrEnabled: boolean;
};
