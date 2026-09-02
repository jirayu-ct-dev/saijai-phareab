/**
 * DB-04 compatibility telemetry contract.
 *
 * Structured, aggregate-only log lines for dual-write compatibility paths
 * during the settings/add-on/photo/payment consolidation window.
 *
 * Contract:
 * - metric names are stable snake_case identifiers suffixed `_total`
 * - dimensions are bounded: `path`/`result` come from closed unions derived
 *   from the real call sites, and `errorCode` passes through the sanitizer
 *   below; no record IDs, customer data, endpoint/IP, tokens, secrets, or raw
 *   error text ever enters the payload
 * - success is emitted after the surrounding transaction commits (callers own
 *   that ordering); failures are emitted from the error boundary with a
 *   sanitized error code only
 * - emitting telemetry must never throw or break the business transaction
 */
import type { AddonRefundOutcome } from "./serviceOrderCredits";

export const COMPAT_METRICS = {
  settingWrite: "db_compat_setting_write_total",
  settingRead: "db_compat_setting_read_total",
  addonRefund: "db_compat_addon_refund_total",
  itemPhotoWrite: "db_compat_item_photo_write_total",
  paymentStatusSync: "db_compat_payment_status_sync_total",
  orderTransition: "db_compat_order_transition_total",
} as const;

export type CompatMetric = (typeof COMPAT_METRICS)[keyof typeof COMPAT_METRICS];

// Bounded path dimensions — one union per metric, straight from the call sites.
export type CompatSettingPath = "business" | "shop" | "notification";
export type CompatAddonRefundPath = "status-patch" | "full-edit" | "delete";
export type CompatItemPhotoPath = "create" | "full-edit";
export type CompatPaymentSyncPath = "state" | "edit" | "cancel" | "delete";
export type CompatOrderTransitionPath = "status-patch" | "full-edit";

export type CompatPath =
  | CompatSettingPath
  | CompatAddonRefundPath
  | CompatItemPhotoPath
  | CompatPaymentSyncPath
  | CompatOrderTransitionPath;

// Bounded result dimensions.
export type CompatSyncResult = "success" | "failure";
// DB-06 read-cutover soak outcomes: the new AppSetting read matches the legacy
// row, diverges from it (mismatch — must stay zero), or falls back to legacy
// (null/unmigrated target field or missing target row).
export type CompatReadResult = "match" | "mismatch" | "fallback";
export type CompatAddonRefundResult = AddonRefundOutcome | "failure";
export type CompatOrderTransitionResult = "completed" | "transitioned" | "conflict" | "failure";

export type CompatTelemetryEvent =
  | { metric: typeof COMPAT_METRICS.settingWrite; path: CompatSettingPath; result: CompatSyncResult; errorCode?: string }
  | { metric: typeof COMPAT_METRICS.settingRead; path: CompatSettingPath; result: CompatReadResult; errorCode?: string }
  | { metric: typeof COMPAT_METRICS.addonRefund; path: CompatAddonRefundPath; result: CompatAddonRefundResult; errorCode?: string }
  | { metric: typeof COMPAT_METRICS.itemPhotoWrite; path: CompatItemPhotoPath; result: CompatSyncResult; errorCode?: string }
  | { metric: typeof COMPAT_METRICS.paymentStatusSync; path: CompatPaymentSyncPath; result: CompatSyncResult; errorCode?: string }
  | { metric: typeof COMPAT_METRICS.orderTransition; path: CompatOrderTransitionPath; result: CompatOrderTransitionResult; errorCode?: string };

/**
 * Error-code bound: at most 64 characters of `[A-Z0-9_]`, matching only the
 * code families the system really produces — Prisma `P####` codes, UPPER_SNAKE
 * application/h3 codes, and the internal `HTTP_<status>` fallback. Anything
 * else (free text, URLs, provider strings, secrets) becomes `UNKNOWN` so no
 * unbounded data can enter the payload.
 */
const MAX_ERROR_CODE_LENGTH = 64;
const SANITIZED_ERROR_CODE = /^(?:P\d{4}|HTTP_[1-5]\d{2}|[A-Z][A-Z0-9_]*)$/;

const isSanitizedErrorCode = (value: string): boolean =>
  value.length > 0 && value.length <= MAX_ERROR_CODE_LENGTH && SANITIZED_ERROR_CODE.test(value);

/**
 * Sanitized error identity: a stable error `code` when the error carries one
 * (h3 `data.code`, application codes, Prisma `P*` codes), otherwise the HTTP
 * status class. Never the message or stack; anything outside the sanitized
 * shape above becomes `UNKNOWN`.
 */
export const compatErrorCode = (error: unknown): string => {
  if (error && typeof error === "object") {
    const candidate = error as { code?: unknown; statusCode?: unknown; data?: { code?: unknown } };
    const dataCode = candidate.data?.code;
    const directCode = candidate.code;
    if (typeof dataCode === "string" && isSanitizedErrorCode(dataCode)) return dataCode;
    if (typeof directCode === "string" && isSanitizedErrorCode(directCode)) return directCode;
    if (
      typeof candidate.statusCode === "number" &&
      Number.isInteger(candidate.statusCode) &&
      candidate.statusCode >= 100 &&
      candidate.statusCode <= 599
    ) {
      return `HTTP_${candidate.statusCode}`;
    }
  }
  return "UNKNOWN";
};

export const emitCompatTelemetry = (event: CompatTelemetryEvent): void => {
  try {
    const payload: Record<string, string> = {
      metric: event.metric,
      path: event.path,
      result: event.result,
    };
    if (event.errorCode) payload.errorCode = event.errorCode;
    if (event.result === "failure") {
      console.error("[db-compat]", payload);
    } else {
      console.info("[db-compat]", payload);
    }
  } catch {
    // Telemetry must never break the business transaction.
  }
};

// Overloads keep metric/path pairs type-safe per metric at every call site.
export function emitCompatFailure(
  metric: typeof COMPAT_METRICS.settingWrite,
  path: CompatSettingPath,
  error: unknown,
): void;
export function emitCompatFailure(
  metric: typeof COMPAT_METRICS.addonRefund,
  path: CompatAddonRefundPath,
  error: unknown,
): void;
export function emitCompatFailure(
  metric: typeof COMPAT_METRICS.itemPhotoWrite,
  path: CompatItemPhotoPath,
  error: unknown,
): void;
export function emitCompatFailure(
  metric: typeof COMPAT_METRICS.paymentStatusSync,
  path: CompatPaymentSyncPath,
  error: unknown,
): void;
export function emitCompatFailure(
  metric: typeof COMPAT_METRICS.orderTransition,
  path: CompatOrderTransitionPath,
  error: unknown,
): void;
export function emitCompatFailure(metric: CompatMetric, path: CompatPath, error: unknown): void {
  // The overloads above guarantee metric/path pairing; the union object fits
  // the failure arm of each metric.
  emitCompatTelemetry({ metric, path, result: "failure", errorCode: compatErrorCode(error) } as CompatTelemetryEvent);
}

export const withCompatTelemetry = async <T>(
  path: CompatSettingPath,
  operation: () => Promise<T>,
): Promise<T> => {
  try {
    const result = await operation();
    emitCompatTelemetry({ metric: COMPAT_METRICS.settingWrite, path, result: "success" });
    return result;
  } catch (error) {
    emitCompatFailure(COMPAT_METRICS.settingWrite, path, error);
    throw error;
  }
};
