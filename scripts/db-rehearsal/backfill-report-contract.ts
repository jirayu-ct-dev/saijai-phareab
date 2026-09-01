/**
 * Backfill dry-run/report contract (preparation only — DB-05).
 *
 * Nothing in this file executes anything. It freezes the report shape,
 * idempotency rule, and exit-code conventions that the Phase 4 backfills
 * (settings, add-on ledger, item photos) must emit, so that the runners and
 * the reconciliation checks agree before any backfill is written.
 *
 * Source of requirements: docs/plan-database-consolidation.md section 6
 * Phase 4 ("Completion check": second run changes zero rows, mismatch = 0,
 * quarantine = 0 or each entry has a recorded disposition) and section 8.
 */

export type BackfillOperation =
  | "settings-consolidation"
  | "addon-usage-json-to-ledger"
  | "item-photo-direct-to-join";

export type BackfillMode = "dry-run" | "apply";

export type QuarantineReason =
  | "invalid-json" // legacy payload cannot be parsed with the application validator
  | "missing-entitlement" // referenced entitlement no longer exists
  | "missing-image" // direct imageId has no image row
  | "unknown-shape" // entry does not match the known StoredAddonUsage shape
  | "duplicate-semantics" // more than one candidate target for one source row
  | "source-row-missing"; // source row disappeared mid-batch

export type Disposition = "pending" | "approved-skip" | "approved-fix" | "resolved";

export interface QuarantineEntry {
  /** Stable business key of the offending source row (e.g. service order id). */
  subjectId: string;
  /** Affected sub-item, e.g. array index or column name; null when not applicable. */
  subjectPart: string | null;
  reason: QuarantineReason;
  /** Aggregate-safe detail; must not contain PII or raw payloads. */
  detail?: string;
  disposition: Disposition;
}

export interface BackfillMismatch {
  /** Identifier of the reconciliation check, e.g. "credits_json_vs_ledger". */
  checkId: string;
  subjectId: string;
  /** Aggregate-safe detail; must not contain PII or raw payloads. */
  detail: string;
}

export interface BackfillReport {
  operation: BackfillOperation;
  mode: BackfillMode;
  /**
   * Opaque resumable checkpoint (last processed source key). A fresh run may
   * start from the recorded cursor; NULL/absent means a full scan.
   */
  cursor: string | null;
  startedAt: string; // ISO-8601, Asia/Bangkok business semantics
  finishedAt: string;
  /** Number of source rows examined. */
  rowsScanned: number;
  /**
   * Number of destination rows inserted/updated/deleted. A second `apply`
   * run with no interleaving writes MUST report 0.
   */
  rowsChanged: number;
  mismatches: BackfillMismatch[];
  quarantine: QuarantineEntry[];
  /**
   * exitCode must equal the process exit code and follows the conventions
   * below so a CI job can gate on it without parsing the JSON.
   */
  exitCode: BackfillExitCode;
}

/**
 * Exit-code conventions:
 *   0 — success: rowsChanged consistent with idempotency, mismatches = 0,
 *       quarantine empty or every entry has an approved/resolved disposition
 *   1 — mismatch threshold exceeded (report kept; do not retry blindly)
 *   2 — quarantine entries exist without an approved disposition
 *   3 — aborted: invariant, connection, or transaction error; any partial
 *       batch must have been rolled back so the run leaves no data behind
 *   64 — configuration/usage error (wrong mode, missing cursor epoch, etc.)
 */
export type BackfillExitCode = 0 | 1 | 2 | 3 | 64;

/**
 * Idempotency rule (mandatory for every backfill operation):
 *
 *   A destination value is written only when the destination slot is still
 *   empty/absent, and only when there is no semantically matching target row
 *   yet. A backfill never overwrites a destination value that already passed
 *   verification, never deletes or mutates source rows/columns, and never
 *   guesses values it cannot prove. Because writes are guarded by semantic
 *   existence checks, replaying the same operation yields rowsChanged = 0.
 *
 *   The dry-run mode performs the exact same scan and matching logic but
 *   issues no writes and reports what would change in rowsChanged plus a
 *   per-item breakdown in the runner's own output (kept out of this contract
 *   on purpose so reports stay aggregate-safe).
 */
export const BACKFILL_IDEMPOTENCY_RULE = [
  "write only into empty/absent destination slots",
  "skip when a semantically matching target row already exists",
  "never overwrite verified destination values",
  "never delete or mutate source rows or source columns",
  "never guess unprovable values — quarantine instead",
  "second apply run must report rowsChanged = 0",
] as const;
