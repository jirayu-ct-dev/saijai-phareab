// ============================
// PRINT DOCUMENT BUILDER (PRN-03)
// ============================
//
// Builds the frozen PrintDocument snapshot server-side from the source payment
// (and its order/package source) plus the AppSetting QR configuration, inside
// the same transaction that creates the PrintJob (C10 exact money, C12
// snapshot safety, plan-xprinter-wifi-printing.md "Payment QR design").
//
// - Money: Prisma Decimal -> exact integer minor units via string math only.
// - QR: payload built with server/utils/paymentQr encoder and re-validated with
//   the independent validator before entering the snapshot. Ineligible or
//   failing blocks are omitted entirely — never a silent fallback.
// - Snapshot contains only document-necessary fields; nothing is logged here.

import { createCipheriv, createDecipheriv, createHash } from "node:crypto";
import type { PaymentStatus } from "~~/shared/types/enums";
import type {
  PaymentQrSettingSnapshot,
  PrintDocument,
  PrintLineItem,
  PrintQrBlock,
} from "~~/shared/types/printing";
import {
  evaluatePaymentQrEligibility,
  isPaymentQrReceiverActivated,
} from "~~/shared/utils/printJobState";
import { formatMinor } from "~~/shared/utils/printComposer";
import { buildPromptPayPayload } from "~~/server/utils/paymentQr/encoder";
import { validatePromptPayPayload } from "~~/server/utils/paymentQr/validator";

// ============================
// EXACT MONEY (C10)
// ============================

/** Minimal structural shape of Prisma.Decimal used here (no float math). */
export type DecimalLike = { toFixed: (fractionDigits: number) => string };

export type DecimalInput = DecimalLike | string | number;

/**
 * Converts a database decimal to exact integer minor units (satang) using
 * string math only (C10). Zero is allowed here — documents may total 0 when a
 * package covers everything; QR eligibility rejects zero separately.
 */
export function decimalToMinorExact(value: DecimalInput): number {
  let text: string;
  if (typeof value === "string") {
    text = value.trim();
  } else if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Amount must be finite");
    text = value.toFixed(2);
  } else {
    text = value.toFixed(2);
  }
  if (!/^-?\d+(\.\d{1,})?$/.test(text)) {
    throw new Error(`Amount must be a decimal string, got ${JSON.stringify(text)}`);
  }
  const negative = text.startsWith("-");
  const unsigned = negative ? text.slice(1) : text;
  const [whole, decimalPart = ""] = unsigned.split(".");
  if (decimalPart.length > 2) {
    throw new Error(`Amount has more than 2 decimal places: ${text}`);
  }
  const minor = BigInt(`${whole}${decimalPart.padEnd(2, "0")}`);
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Amount exceeds the safe integer range for minor units");
  }
  return Number(negative ? -minor : minor);
}

// ============================
// SNAPSHOT HASH (C12)
// ============================

/** Deterministic JSON (sorted object keys) so the snapshot hash is stable. */
export function canonicalJsonStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(canonicalJsonStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJsonStringify(v)}`).join(",")}}`;
}

export function snapshotHashOf(document: PrintDocument): string {
  return createHash("sha256").update(canonicalJsonStringify(document), "utf8").digest("hex");
}

// ============================
// PAYMENT QR RECEIVER (encrypted at rest)
// ============================

/**
 * Keyring for receiver decryption: env `PAYMENT_QR_RECEIVER_KEYS` is a JSON
 * object mapping key version ("1", "2", ...) to a base64-encoded 32-byte
 * AES-256-GCM key. Server-only; the plaintext key never leaves the process.
 */
export function loadPaymentQrReceiverKeyring(): Record<string, Buffer> {
  const raw = process.env.PAYMENT_QR_RECEIVER_KEYS;
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object") return {};
  const keyring: Record<string, Buffer> = {};
  for (const [version, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== "string") continue;
    const key = Buffer.from(value, "base64");
    if (key.length === 32) keyring[version] = key;
  }
  return keyring;
}

export type PaymentQrReceiverResolution =
  | { ok: true; value: string }
  | { ok: false; reason: "MISSING_CIPHERTEXT" | "MISSING_KEY_VERSION" | "DECRYPT_FAILED" };

/**
 * Decrypts the receiver identifier (application-layer AES-256-GCM, ciphertext
 * format `v<keyVersion>.<ivB64>.<tagB64>.<dataB64>`). A missing keyring or a
 * failed decryption is reported, never guessed (plan: omit the block on
 * decrypt/validation failure).
 */
export function decryptPaymentQrReceiverValue(input: {
  ciphertext: string;
  keyVersion: number;
  keyring: Record<string, Buffer>;
}): PaymentQrReceiverResolution {
  const { ciphertext, keyVersion, keyring } = input;
  const key = keyring[String(keyVersion)];
  if (!key) return { ok: false, reason: "DECRYPT_FAILED" };
  const parts = ciphertext.split(".");
  if (parts.length !== 4 || parts[0] !== `v${keyVersion}`) {
    return { ok: false, reason: "DECRYPT_FAILED" };
  }
  try {
    const iv = Buffer.from(parts[1]!, "base64");
    const tag = Buffer.from(parts[2]!, "base64");
    const data = Buffer.from(parts[3]!, "base64");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
    if (!plaintext) return { ok: false, reason: "DECRYPT_FAILED" };
    return { ok: true, value: plaintext };
  } catch {
    return { ok: false, reason: "DECRYPT_FAILED" };
  }
}

export function encryptPaymentQrReceiverValue(input: {
  value: string;
  keyVersion: number;
  key: Buffer;
}): string {
  const { value, keyVersion, key } = input;
  const iv = Buffer.from(crypto.getRandomValues(new Uint8Array(12)));
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v${keyVersion}.${iv.toString("base64")}.${tag.toString("base64")}.${data.toString("base64")}`;
}

/** Resolves the AppSetting QR portion into the frozen snapshot shape. */
export function buildPaymentQrSettingSnapshot(
  setting: PrintSettingSource,
): PaymentQrSettingSnapshot {
  return {
    paymentQrEnabled: setting.paymentQrEnabled === true,
    paymentQrProvider: setting.paymentQrProvider === "BANK_MERCHANT" ? "BANK_MERCHANT" : "PROMPTPAY_LOCAL",
    paymentQrReceiverType:
      setting.paymentQrReceiverType === "NATIONAL_OR_TAX_ID" || setting.paymentQrReceiverType === "EWALLET"
        ? setting.paymentQrReceiverType
        : "MOBILE",
    paymentQrReceiverCiphertext: setting.paymentQrReceiverCiphertext ?? null,
    paymentQrReceiverLast4: setting.paymentQrReceiverLast4 ?? null,
    paymentQrReceiverLabel: setting.paymentQrReceiverLabel ?? null,
    paymentQrKeyVersion: setting.paymentQrKeyVersion ?? null,
    paymentQrConfigVersion: setting.paymentQrConfigVersion ?? 0,
    paymentQrActivatedAt: setting.paymentQrActivatedAt
      ? typeof setting.paymentQrActivatedAt === "string"
        ? setting.paymentQrActivatedAt
        : setting.paymentQrActivatedAt.toISOString()
      : null,
    lineQrEnabled: setting.lineQrEnabled ?? Boolean(setting.lineQrImageUrl),
  };
}

// ============================
// SOURCE SHAPES (structural — filled from the tx read)
// ============================

export type PrintShopLegacySource = {
  name: string | null;
  phone: string | null;
  address: string | null;
  lineQrImageUrl: string | null;
} | null;

/** AppSetting row shape (structural) as read inside the create transaction. */
export type PrintSettingSource = {
  name: string | null;
  phone: string | null;
  address: string | null;
  lineQrImageUrl: string | null;
  paymentQrEnabled: boolean | null;
  paymentQrProvider: string | null;
  paymentQrReceiverType: string | null;
  paymentQrReceiverCiphertext: string | null;
  paymentQrReceiverLast4: string | null;
  paymentQrReceiverLabel: string | null;
  paymentQrKeyVersion: number | null;
  paymentQrConfigVersion: number | null;
  paymentQrActivatedAt: Date | string | null;
  lineQrEnabled: boolean | null;
};

export type PrintPaymentSource = {
  id: string;
  paymentNo: string | null;
  receiptNo: string | null;
  amount: DecimalInput;
  status: PaymentStatus;
  note: string | null;
  updatedAt: Date;
  user: { name: string | null; phoneNumber: string | null } | null;
  serviceOrder: {
    id: string;
    orderNo: string | null;
    quotationNo: string | null;
    subtotalAmount: DecimalInput;
    discountAmount: DecimalInput;
    note: string | null;
    weightKg: DecimalInput | null;
    serviceOrderItems: Array<{
      quantity: number;
      unitPrice: DecimalInput;
      totalPrice: DecimalInput;
      notes: string | null;
      isPackageIncluded: boolean;
      storefrontPrice: {
        storefrontService: { name: string } | null;
        storefrontItem: { name: string } | null;
      } | null;
    }> | null;
  } | null;
  packageSale: {
    id: string;
    subtotalAmount: DecimalInput;
    discountAmount: DecimalInput;
    items: Array<{
      productName: string;
      qty: number;
      unitPrice: DecimalInput;
      totalPrice: DecimalInput;
    }> | null;
  } | null;
};

// ============================
// DOCUMENT BUILDER
// ============================

export type BuildPrintDocumentResult = {
  document: PrintDocument;
  /** Exact minor units of the source payment (C10). */
  amountMinor: number;
  /** Payment row revision (updatedAt ms) captured at snapshot time (C9). */
  sourceRevision: number;
  sourceStatus: PaymentStatus;
  /** QR config version at snapshot time; null when no payment QR in snapshot. */
  qrConfigVersion: number | null;
  snapshotHasPaymentQr: boolean;
};

/**
 * Builds the print document from the payment source + settings read in the
 * SAME transaction as the job create (C10 consistent read).
 */
export function buildPrintDocument(input: {
  kind: PrintDocument["kind"];
  payment: PrintPaymentSource;
  setting: PrintSettingSource;
  legacyShop?: PrintShopLegacySource;
  /** Decrypted receiver value, or null when not available/eligible. */
  receiverValue: string | null;
  now: Date;
}): BuildPrintDocumentResult {
  const { kind, payment, setting, legacyShop, receiverValue, now } = input;

  const shopName = setting.name ?? legacyShop?.name ?? "";
  const shopAddress = setting.address ?? legacyShop?.address ?? null;
  const shopPhone = setting.phone ?? legacyShop?.phone ?? null;
  const lineQrImageUrl = setting.lineQrImageUrl ?? legacyShop?.lineQrImageUrl ?? null;

  const amountMinor = decimalToMinorExact(payment.amount);
  const customerName = payment.user?.name?.trim() || "ลูกค้า";

  // ---- Line items ----
  const items: PrintLineItem[] = [];
  if (payment.serviceOrder) {
    const order = payment.serviceOrder;
    for (const item of order.serviceOrderItems ?? []) {
      const serviceName = item.storefrontPrice?.storefrontService?.name ?? "";
      const itemName = item.storefrontPrice?.storefrontItem?.name ?? "";
      const name = `${serviceName} ${itemName}`.trim() || "รายการบริการ";
      items.push({
        name,
        quantity: item.quantity,
        unitPriceMinor: decimalToMinorExact(item.unitPrice),
        totalPriceMinor: decimalToMinorExact(item.totalPrice),
        note: item.notes ?? (item.isPackageIncluded ? "รวมในแพ็กเกจ" : null),
      });
    }
    // Wash-fold (kg) orders have no per-item rows: one exact synthetic line.
    if (order.weightKg != null && items.length === 0) {
      const washFoldMinor = decimalToMinorExact(order.subtotalAmount);
      items.push({
        name: `ซัก-พับ (กิโล) ${order.weightKg} กก.`,
        quantity: 1,
        unitPriceMinor: washFoldMinor,
        totalPriceMinor: washFoldMinor,
        note: null,
      });
    }
    if (items.length === 0) {
      // Orders with neither rows nor weight (e.g. fully package-covered) still
      // need at least one line so the document is never empty.
      items.push({
        name: "รายการบริการ",
        quantity: 1,
        unitPriceMinor: amountMinor,
        totalPriceMinor: amountMinor,
        note: null,
      });
    }
  } else if (payment.packageSale) {
    for (const item of payment.packageSale.items ?? []) {
      items.push({
        name: item.productName,
        quantity: item.qty,
        unitPriceMinor: decimalToMinorExact(item.unitPrice),
        totalPriceMinor: decimalToMinorExact(item.totalPrice),
        note: null,
      });
    }
  }

  const subtotalMinor = payment.serviceOrder
    ? decimalToMinorExact(payment.serviceOrder.subtotalAmount)
    : payment.packageSale
      ? decimalToMinorExact(payment.packageSale.subtotalAmount)
      : amountMinor;
  const discountMinor = payment.serviceOrder
    ? decimalToMinorExact(payment.serviceOrder.discountAmount)
    : payment.packageSale
      ? decimalToMinorExact(payment.packageSale.discountAmount)
      : 0;

  // ---- QR blocks (payment first, then LINE — plan Display policy) ----
  const qrBlocks: PrintQrBlock[] = [];
  const settingSnapshot = buildPaymentQrSettingSnapshot(setting);
  const receiverActivated = isPaymentQrReceiverActivated(settingSnapshot);

  const eligibility = evaluatePaymentQrEligibility({
    documentKind: kind,
    paymentStatus: payment.status,
    amountMinor,
    paymentQrEnabled: settingSnapshot.paymentQrEnabled,
    receiverActivated,
  });

  let snapshotHasPaymentQr = false;
  if (eligibility.eligible && receiverValue) {
    try {
      const payload = buildPromptPayPayload({
        receiverType: settingSnapshot.paymentQrReceiverType,
        receiverValue,
        amountMinor,
      });
      const validation = validatePromptPayPayload({
        payload,
        expectedReceiverType: settingSnapshot.paymentQrReceiverType,
        expectedReceiverValue: receiverValue,
        expectedAmountMinor: amountMinor,
      });
      if (validation.valid) {
        const receiverLabel = settingSnapshot.paymentQrReceiverLabel ?? "ผู้รับเงิน";
        qrBlocks.push({
          kind: "PAYMENT",
          payload,
          amountMinor,
          currency: "THB",
          receiverLabel,
          caption: `สแกนชำระเงิน ฿${formatMinor(amountMinor)} บาท (รับโดย ${receiverLabel})`,
        });
        snapshotHasPaymentQr = true;
      }
    } catch {
      // Encoder/validation failure: omit the block entirely, never fallback.
      snapshotHasPaymentQr = false;
    }
  }

  // Default recommendation: LINE QR on receipts only (payment QR on quotation).
  const lineQrEnabled = settingSnapshot.lineQrEnabled;
  if (kind === "RECEIPT" && lineQrEnabled && lineQrImageUrl) {
    qrBlocks.push({
      kind: "LINE",
      imageUrl: lineQrImageUrl,
      caption: "สแกนเพื่อติดตามสถานะงานผ่าน LINE",
    });
  }

  const documentNo =
    kind === "RECEIPT"
      ? payment.receiptNo ?? payment.paymentNo ?? payment.id
      : payment.serviceOrder?.quotationNo ?? payment.serviceOrder?.orderNo ?? payment.id;

  const document: PrintDocument = {
    kind,
    documentId: kind === "RECEIPT" ? payment.id : payment.serviceOrder?.id ?? payment.id,
    documentNo,
    revision: 1,
    issuedAt: now.toISOString(),
    shop: {
      name: shopName,
      addressLine: shopAddress || null,
      phoneNumber: shopPhone || null,
      taxId: null,
    },
    customer: {
      name: customerName,
      phoneNumber: payment.user?.phoneNumber ?? null,
    },
    items,
    totals: {
      subtotalAmountMinor: subtotalMinor,
      discountAmountMinor: discountMinor,
      totalAmountMinor: amountMinor,
    },
    note: payment.note ?? null,
    qrBlocks,
  };

  return {
    document,
    amountMinor,
    sourceRevision: deriveSourceRevision(payment.updatedAt),
    sourceStatus: payment.status,
    qrConfigVersion: snapshotHasPaymentQr ? settingSnapshot.paymentQrConfigVersion : null,
    snapshotHasPaymentQr,
  };
}

/**
 * Payment rows carry no revision counter column; the row's updatedAt (ms
 * precision) is the revision marker. Any update to the payment invalidates
 * snapshots taken before it (C9 stale guard).
 */
export function deriveSourceRevision(updatedAt: Date): number {
  return updatedAt.getTime();
}
