/**
 * Pure planning helpers for the DB-05 backfill runner (unit-tested directly).
 *
 * These functions decide WHAT would change; the runner executes the plan
 * inside one batch transaction (see backfill.mts). The add-on classifier
 * delegates to the application's own `parseAddonUsages` so backfill semantics
 * cannot drift from application semantics.
 */
import { parseAddonUsages } from "../../../server/utils/serviceOrderCredits";
import type {
  BackfillMismatch,
  QuarantineEntry,
} from "../backfill-report-contract";

export const NOTIFICATION_FIELDS = [
  "notifyCustomerOnQuotation",
  "notifyCustomerOnReceived",
  "notifyCustomerOnProcessing",
  "notifyCustomerOnDelivering",
  "notifyCustomerOnCompleted",
  "notifyCustomerOnCancelled",
  "notifyCustomerReceipt",
  "notifyStaffOnNewOrder",
  "notifyCustomerOnPackageExpiring",
] as const;

export type NotificationField = (typeof NOTIFICATION_FIELDS)[number];

// ===========================================================================
// Planning helpers (pure, unit-tested)
// ===========================================================================

export type LegacyShopShape = {
  name: string;
  phone: string;
  address: string;
  logoUrl: string | null;
  lineQrImageUrl: string | null;
};

export type TargetSettingsShape = {
  name: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  lineQrImageUrl: string | null;
  lineQrEnabled: boolean | null;
} & Partial<Record<NotificationField, boolean | null>>;

export type SettingsPlan = {
  /** business_setting fields to write (destination slots still null). */
  updateData: Record<string, string | boolean>;
  /** Target value conflicts — reported, never overwritten. */
  mismatches: BackfillMismatch[];
};

/**
 * Null-safe, field-by-field copy plan for shop + notification settings.
 * `targetRow` may be null (singleton not created yet — caller creates it with
 * the full updateData). Legacy rows created by this same run carry only
 * defaults and are never treated as an authoritative source.
 */
export const planSettingsCopy = (
  legacyShop: LegacyShopShape | null,
  legacyNotification: Record<NotificationField, boolean> | null,
  targetRow: TargetSettingsShape | null,
): SettingsPlan => {
  const updateData: Record<string, string | boolean> = {};
  const mismatches: BackfillMismatch[] = [];

  const considerString = (field: string, source: string | null, dest: string | null) => {
    if (dest !== null && source !== null && dest !== source) {
      mismatches.push({
        checkId: "settings_target_conflict",
        subjectId: "singleton",
        detail: `field:${field}`,
      });
      return;
    }
    if (dest === null && source !== null) updateData[field] = source;
  };

  if (legacyShop) {
    considerString("name", legacyShop.name, targetRow?.name ?? null);
    considerString("phone", legacyShop.phone, targetRow?.phone ?? null);
    considerString("address", legacyShop.address, targetRow?.address ?? null);
    considerString("logoUrl", legacyShop.logoUrl, targetRow?.logoUrl ?? null);
    considerString("lineQrImageUrl", legacyShop.lineQrImageUrl, targetRow?.lineQrImageUrl ?? null);
  }

  // lineQrEnabled keeps the legacy behavior: enabled iff a LINE QR image URL
  // exists on the legacy shop row. Without a legacy shop source there is
  // nothing to derive from — leave the destination null instead of guessing.
  const derivedLineQrEnabled = legacyShop != null && legacyShop.lineQrImageUrl != null;
  if (legacyShop != null) {
    if (targetRow?.lineQrEnabled != null) {
      if (targetRow.lineQrEnabled !== derivedLineQrEnabled) {
        mismatches.push({
          checkId: "settings_target_conflict",
          subjectId: "singleton",
          detail: "field:lineQrEnabled",
        });
      }
    } else {
      updateData.lineQrEnabled = derivedLineQrEnabled;
    }
  }

  if (legacyNotification) {
    for (const field of NOTIFICATION_FIELDS) {
      const source = legacyNotification[field];
      const dest = targetRow?.[field] ?? null;
      if (dest !== null && dest !== source) {
        mismatches.push({
          checkId: "settings_target_conflict",
          subjectId: "singleton",
          detail: `field:${field}`,
        });
        continue;
      }
      if (dest === null) updateData[field] = source;
    }
  }

  return { updateData, mismatches };
};

export type AddonQuarantine = {
  index: number;
  reason: Extract<QuarantineEntry["reason"], "unknown-shape" | "invalid-json" | "missing-entitlement">;
};

export type ClassifiedAddonEntry = NonNullable<ReturnType<typeof parseAddonUsages>[number]> & {
  index: number;
};

export type ClassifiedAddonOrder = {
  valid: ClassifiedAddonEntry[];
  quarantine: AddonQuarantine[];
  /** True when the JSON column itself is not an array. */
  invalidJson: boolean;
};

/**
 * Classify one order's legacy JSON with the application parser. Entries that
 * the parser rejects are quarantined (never guessed into the ledger).
 */
export const classifyAddonOrder = (raw: unknown): ClassifiedAddonOrder => {
  if (!Array.isArray(raw)) {
    return { valid: [], quarantine: [], invalidJson: true };
  }
  const valid: ClassifiedAddonEntry[] = [];
  const quarantine: AddonQuarantine[] = [];
  raw.forEach((entry, index) => {
    const parsed = parseAddonUsages([entry]);
    if (parsed.length === 0) {
      quarantine.push({ index, reason: "unknown-shape" });
      return;
    }
    const usage = parsed[0];
    if (usage.refundedAt && !usage.deductedAt) {
      // Inserting a refund without a deduction would violate the
      // ledger_refunded_without_deducted invariant — quarantine instead.
      quarantine.push({ index, reason: "invalid-json" });
      return;
    }
    valid.push({ ...usage, index });
  });
  return { valid, quarantine, invalidJson: false };
};

export type ImageJoinPlan = {
  creates: Array<{ serviceOrderItemId: string; imageId: string }>;
  quarantine: Array<{ serviceOrderItemId: string; imageId: string; reason: "missing-image" }>;
};

/**
 * Plan legacy direct imageId -> join-row backfill. A join row is created only
 * when no row at all (active or soft-deleted) exists for the pair, with
 * sortOrder 0 and isDamaged false.
 */
export const planImageJoins = (
  items: Array<{ id: string; imageId: string }>,
  existingPairs: Set<string>,
  existingImageIds: Set<string>,
): ImageJoinPlan => {
  const creates: ImageJoinPlan["creates"] = [];
  const quarantine: ImageJoinPlan["quarantine"] = [];
  for (const item of items) {
    if (!existingImageIds.has(item.imageId)) {
      quarantine.push({ serviceOrderItemId: item.id, imageId: item.imageId, reason: "missing-image" });
      continue;
    }
    const pairKey = `${item.id}::${item.imageId}`;
    if (existingPairs.has(pairKey)) continue;
    creates.push({ serviceOrderItemId: item.id, imageId: item.imageId });
  }
  return { creates, quarantine };
};

