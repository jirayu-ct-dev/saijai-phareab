// ============================
// PRINTING (pure contracts)
// ============================
//
// Pure TypeScript contracts for the XP-C260M print system (PRN-01).
// Nothing here may depend on Prisma, the database, network transports,
// hardware or any runtime dependency. All shapes are JSON-safe.
//
// Direct Print keeps reusable document/operation/profile contracts without a
// durable Printer/PrintJob lifecycle. QR settings remain in AppSetting and
// money uses exact integer minor units (`amountMinor`).

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
  /** Server-approved public asset; never an arbitrary printer-supplied URL. */
  logoUrl?: string | null;
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

/** Server-owned display rows derived from existing business data. */
export type PrintDisplayRow = {
  label: string;
  value: string;
};

export type PrintSupplementalSection = {
  title: string;
  lines: string[];
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
  /** Established business-facing title; defaults from kind for old callers. */
  title?: string;
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
  /** Canonical ordered info rows matching the receipt/quotation UI. */
  informationRows?: PrintDisplayRow[];
  /** Canonical ordered summary rows, including displayed price/discount. */
  summaryRows?: PrintDisplayRow[];
  /** Established final-total label/value (for example package-covered use). */
  totalDisplay?: PrintDisplayRow;
  /** Package/add-on history and similar variable-length business sections. */
  supplementalSections?: PrintSupplementalSection[];
  /** Document-specific closing copy sourced from the established UI. */
  footerLines?: string[];
  qrBlocks: PrintQrBlock[];
};

// ============================
// PRINT OPERATIONS (Hybrid ESC/POS composer input)
// ============================

/**
 * Text style for the additive PRN-05 text operation (additive extension of the
 * frozen PRN-01 union; no existing variant was changed or removed). Encoded by
 * the ESC/POS text path in shared/utils/escpos.ts.
 */
export type PrintTextStyle = "normal" | "bold" | "large";

export type PrintOperation =
  | { type: "initialize" }
  | {
      type: "text";
      value: string;
      style?: PrintTextStyle;
      align?: "left" | "center" | "right";
      /** Optional semantic columns so raster output can anchor the right value. */
      columns?: { left: string; right: string };
      /** Four-column receipt row rendered at fixed paper-relative anchors. */
      tableColumns?: {
        item: string;
        unitPrice: string;
        quantity: string;
        total: string;
      };
    } // PRN-05 (additive)
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

/**
 * Thai text strategy for the verified XP-C260M firmware. Raster is the
 * production default because physical output disproved native page 70.
 * Native pages remain explicit diagnostic options only.
 */
export type ThaiPrintStrategy = "native-cp874" | "native-thai-255" | "raster-thai";

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
// DIRECT PRINT LIFECYCLE
// ============================

/**
 * One immediate print attempt. Direct printing deliberately has no durable
 * queue or automatic retry: once sending starts the physical outcome can no
 * longer be inferred safely from a browser/network error.
 */
export type DirectPrintResultCode =
  | "SENT"
  | "BUSY"
  | "NOT_CONNECTED"
  | "OFFLINE"
  | "TIMEOUT"
  | "UNKNOWN_PROGRESS";

export type DirectPrintResult =
  | { ok: true; code: "SENT" }
  | {
      ok: false;
      code: Exclude<DirectPrintResultCode, "SENT">;
      /** True means bytes may already have reached the printer. */
      bytesMayHaveBeenWritten: boolean;
    };

// ============================
// LAN PRINT GATEWAY
// ============================

/** Browser-safe descriptor. Network addresses remain Gateway-local. */
export type LanPrinterDescriptor = {
  id: string;
  name: string;
  model: PrinterModel;
  online: boolean;
};

/** Short-lived discovery identity; it cannot be used as a network target. */
export type LanPrinterCandidate = {
  id: string;
  name: string;
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
