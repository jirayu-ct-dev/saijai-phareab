#!/usr/bin/env node
// Combine the aggregate-only production preflight with separately supplied
// operator/platform attestations. The output deliberately excludes operator,
// deployment, host, database, and credential identifiers.

import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

// Operator decision 2026-09-03: stay on the Supabase Free Plan and satisfy the
// backup gate with this policy instead of PITR. RPO stays at the PITR-era 1 hour.
export const EXTERNAL_BACKUP_POLICY = {
  mode: "external-encrypted-backups",
  maxIntervalMinutes: 60,
  minRetentionDays: 14,
  maxRestoreDrillAgeMs: 30 * DAY_MS,
};

export const EXPECTED_SQL_FILES = [
  "00-server-and-migration-context.sql",
  "01-table-row-counts.sql",
  "02-settings-singletons.sql",
  "03-subscribers.sql",
  "04-addon-ledger.sql",
  "05-images.sql",
  "06-payments.sql",
  "07-completion-timestamps.sql",
];

const REQUIRED_BARE_ZERO_CHECKS = new Set([
  "orders_with_non_array_addon_usages_json",
  "orders_with_malformed_addon_usages_entries",
  "ledger_refunded_without_deducted",
  "ledger_rows_without_entitlement",
  "credits_json_vs_ledger_mismatched_pairs",
  "item_direct_image_id_without_image_row",
  "duplicate_active_item_image_pairs",
  "join_rows_without_image_row",
]);

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(dirname(scriptDir));

function ageIsWithin(value, nowMs, maximumAgeMs) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const age = nowMs - timestamp;
  return age >= -FUTURE_TOLERANCE_MS && age <= maximumAgeMs;
}

function safeRevision(value) {
  return typeof value === "string" && /^[A-Za-z0-9._:@/-]{7,128}$/.test(value);
}

export function evaluateApprovalBEvidence({
  preflight,
  attestation,
  expectedApprovalReference,
  now = new Date().toISOString(),
}) {
  const blockers = [];
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new TypeError("now must be a valid ISO-8601 timestamp");

  if (preflight?.target !== "production-approved-read-only") {
    blockers.push("preflight:unexpected-target-label");
  }
  if (preflight?.targetMode !== "production-read-only") {
    blockers.push("preflight:not-production-read-only-mode");
  }
  if (preflight?.approvalReference !== expectedApprovalReference) {
    blockers.push("preflight:approval-reference-mismatch");
  }
  if (preflight?.enforce !== true) blockers.push("preflight:enforcement-not-enabled");
  if (preflight?.failed !== false) blockers.push("preflight:query-failed-or-missing");

  const invariantFailureCount = Array.isArray(preflight?.invariantFailures)
    ? preflight.invariantFailures.length
    : null;
  if (invariantFailureCount === null) blockers.push("preflight:invariant-result-missing");
  else if (invariantFailureCount !== 0) {
    blockers.push(`preflight:invariant-failures=${invariantFailureCount}`);
  }

  const files = Array.isArray(preflight?.files) ? preflight.files : [];
  const filesByName = new Map(files.map((file) => [file?.file, file]));
  if (filesByName.size !== files.length) blockers.push("preflight:duplicate-sql-file-evidence");
  for (const file of filesByName.keys()) {
    if (!EXPECTED_SQL_FILES.includes(file)) blockers.push(`preflight:unexpected-sql-file:${file}`);
  }
  for (const file of EXPECTED_SQL_FILES) {
    const evidence = filesByName.get(file);
    if (!evidence) blockers.push(`preflight:missing-sql-file:${file}`);
    else if (evidence.ok !== true) blockers.push(`preflight:sql-file-failed:${file}`);
  }

  let recomputedInvariantFailures = 0;
  for (const file of files) {
    for (const row of file?.rows ?? []) {
      if (row.pass === false) recomputedInvariantFailures += 1;
      if (!("pass" in row) && Number(row.violating_rows) > 0) {
        recomputedInvariantFailures += 1;
      }
      if (REQUIRED_BARE_ZERO_CHECKS.has(row.check_id) && Number(row.value) !== 0) {
        recomputedInvariantFailures += 1;
      }
    }
    for (const invariant of file?.invariants ?? []) {
      if (invariant.pass === false || invariant.pass === "false" || invariant.pass === "f") {
        recomputedInvariantFailures += 1;
      }
    }
  }
  if (recomputedInvariantFailures !== 0) {
    blockers.push(`preflight:recomputed-invariant-failures=${recomputedInvariantFailures}`);
  }

  const context = filesByName
    .get("00-server-and-migration-context.sql")
    ?.rows?.find((row) => row.check_id === "server_and_migration_context");
  const transactionReadOnly = context?.transaction_read_only === true;
  if (!transactionReadOnly) blockers.push("preflight:transaction-not-read-only");
  if (context?.pass !== true || Number(context?.unfinished_rows) !== 0) {
    blockers.push("preflight:migration-status-not-clean");
  }

  if (attestation?.schemaVersion !== 1) blockers.push("attestation:unsupported-schema-version");
  if (attestation?.approvalReference !== expectedApprovalReference) {
    blockers.push("attestation:approval-reference-mismatch");
  }
  const attestationFresh = ageIsWithin(attestation?.attestedAt, nowMs, DAY_MS);
  if (!attestationFresh) blockers.push("attestation:stale-or-invalid");

  const backup = attestation?.backupPitr ?? {};
  if (backup.operatorVerified !== true) blockers.push("backup:operator-verification-missing");
  const backupFresh = ageIsWithin(backup.latestBackupAt, nowMs, DAY_MS);
  if (!backupFresh) blockers.push("backup:stale-or-invalid");
  const restoreDrillReferenced =
    typeof backup.restoreDrillReference === "string" &&
    /^[A-Za-z0-9._:-]{3,128}$/.test(backup.restoreDrillReference);
  if (!restoreDrillReferenced) blockers.push("backup:restore-drill-reference-missing-or-invalid");

  const policy = attestation?.backupPolicy ?? {};
  const externalBackupPolicy = policy?.mode === EXTERNAL_BACKUP_POLICY.mode;
  let backupPolicyMode = "supabase-pitr-or-unspecified";
  let externalBackupEncrypted = false;
  let externalBackupIntervalMinutes = null;
  let externalBackupRetentionDays = null;
  let restoreDrillFresh = false;
  let pitrFresh = false;
  if (externalBackupPolicy) {
    backupPolicyMode = EXTERNAL_BACKUP_POLICY.mode;
    externalBackupEncrypted = policy.encrypted === true;
    if (!externalBackupEncrypted) blockers.push("backup-policy:encryption-not-attested");
    const intervalMinutes = Number(policy.intervalMinutes);
    const intervalValid =
      Number.isInteger(intervalMinutes) &&
      intervalMinutes >= 1 &&
      intervalMinutes <= EXTERNAL_BACKUP_POLICY.maxIntervalMinutes;
    if (!intervalValid) blockers.push("backup-policy:interval-missing-or-invalid");
    else externalBackupIntervalMinutes = intervalMinutes;
    const retentionDays = Number(policy.retentionDays);
    const retentionValid =
      Number.isInteger(retentionDays) && retentionDays >= EXTERNAL_BACKUP_POLICY.minRetentionDays;
    if (!retentionValid) blockers.push("backup-policy:retention-insufficient");
    else externalBackupRetentionDays = retentionDays;
    restoreDrillFresh = ageIsWithin(
      policy.lastRestoreDrillAt,
      nowMs,
      EXTERNAL_BACKUP_POLICY.maxRestoreDrillAgeMs,
    );
    if (!restoreDrillFresh) blockers.push("backup-policy:restore-drill-stale-or-invalid");
    const cadenceWindowMinutes = intervalValid
      ? intervalMinutes
      : EXTERNAL_BACKUP_POLICY.maxIntervalMinutes;
    const cadenceFresh = ageIsWithin(
      backup.latestBackupAt,
      nowMs,
      cadenceWindowMinutes * 60 * 1000 + FUTURE_TOLERANCE_MS,
    );
    if (!cadenceFresh) blockers.push("backup:backup-cadence-stale-or-invalid");
  } else {
    if (backup.pitrEnabled !== true) blockers.push("pitr:not-enabled-or-unverified");
    pitrFresh = ageIsWithin(backup.latestRecoverableAt, nowMs, HOUR_MS);
    if (!pitrFresh) blockers.push("pitr:recovery-point-stale-or-invalid");
  }

  const runtime = attestation?.runtimeInventory ?? {};
  if (runtime.operatorVerified !== true) blockers.push("runtime:operator-verification-missing");
  const runtimeFresh = ageIsWithin(runtime.observedAt, nowMs, HOUR_MS);
  if (!runtimeFresh) blockers.push("runtime:inventory-stale-or-invalid");
  const activeApplicationCount = Number(runtime.activeApplicationCount);
  const activeWorkerCount = Number(runtime.activeWorkerCount);
  const validCounts =
    Number.isInteger(activeApplicationCount) && activeApplicationCount >= 0 &&
    Number.isInteger(activeWorkerCount) && activeWorkerCount >= 0;
  if (!validCounts) blockers.push("runtime:active-counts-missing-or-invalid");
  const runtimeTotal = validCounts ? activeApplicationCount + activeWorkerCount : null;
  if (runtimeTotal === 0 && runtime.maintenanceMode !== true) {
    blockers.push("runtime:no-active-runtime-and-not-in-maintenance");
  }
  if (runtime.allActiveCompatibilityVersion !== true) {
    blockers.push("runtime:not-all-active-on-compatibility-version");
  }
  const compatibilityRevisionPresent = safeRevision(runtime.compatibilityRevision);
  if (!compatibilityRevisionPresent) {
    blockers.push("runtime:compatibility-revision-missing-or-invalid");
  }

  return {
    verdict: blockers.length === 0 ? "APPROVAL_B_PASS" : "APPROVAL_B_BLOCKED",
    scope: "production read-only preflight plus operator/platform attestation",
    approvalReference: expectedApprovalReference,
    evaluatedAt: new Date(nowMs).toISOString(),
    database: {
      queryFailed: preflight?.failed !== false,
      invariantFailureCount,
      recomputedInvariantFailureCount: recomputedInvariantFailures,
      sqlFilesPresent: EXPECTED_SQL_FILES.filter((file) => filesByName.has(file)).length,
      sqlFilesRequired: EXPECTED_SQL_FILES.length,
      transactionReadOnly,
      serverVersionNum: Number.isFinite(Number(context?.server_version_num))
        ? Number(context.server_version_num)
        : null,
      migrationRows: Number.isFinite(Number(context?.migration_rows))
        ? Number(context.migration_rows)
        : null,
      unfinishedMigrationRows: Number.isFinite(Number(context?.unfinished_rows))
        ? Number(context.unfinished_rows)
        : null,
      rolledBackMigrationRows: Number.isFinite(Number(context?.rolled_back_rows))
        ? Number(context.rolled_back_rows)
        : null,
    },
    operator: {
      attestationFresh,
      backupVerified: backup.operatorVerified === true,
      backupFresh,
      backupPolicyMode,
      externalBackupEncrypted,
      externalBackupIntervalMinutes,
      externalBackupRetentionDays,
      restoreDrillFresh,
      pitrEnabled: backup.pitrEnabled === true,
      pitrFresh,
      restoreDrillReferenced,
      runtimeVerified: runtime.operatorVerified === true,
      runtimeFresh,
      runtimeTotal,
      activeApplicationCount: validCounts ? activeApplicationCount : null,
      activeWorkerCount: validCounts ? activeWorkerCount : null,
      maintenanceMode: runtime.maintenanceMode === true,
      allActiveCompatibilityVersion: runtime.allActiveCompatibilityVersion === true,
      compatibilityRevisionPresent,
    },
    blockerCount: blockers.length,
    blockers,
  };
}

function argValue(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

function outsideRepo(path) {
  if (!path || !isAbsolute(path)) return false;
  const rel = relative(repoRoot, resolve(path));
  return rel !== "" && (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const preflightPath = argValue(args, "--preflight-report");
  const attestationPath = argValue(args, "--operator-attestation");
  const expectedApprovalReference = argValue(args, "--approval-reference");
  const out = argValue(args, "--out");
  if (!args.includes("--confirm-production-evidence")) {
    console.error("refusing to evaluate without --confirm-production-evidence");
    process.exit(64);
  }
  if (
    !outsideRepo(preflightPath) ||
    !outsideRepo(attestationPath) ||
    !outsideRepo(out) ||
    !/^[A-Za-z0-9._:-]{3,128}$/.test(expectedApprovalReference ?? "")
  ) {
    console.error(
      "usage: evaluate-approval-b.mjs --preflight-report ABSOLUTE_OUTSIDE_REPO --operator-attestation ABSOLUTE_OUTSIDE_REPO --approval-reference ID --out NEW_ABSOLUTE_OUTSIDE_REPO --confirm-production-evidence",
    );
    process.exit(64);
  }

  let verdict;
  try {
    verdict = evaluateApprovalBEvidence({
      preflight: JSON.parse(readFileSync(preflightPath, "utf8")),
      attestation: JSON.parse(readFileSync(attestationPath, "utf8")),
      expectedApprovalReference,
    });
    writeFileSync(out, `${JSON.stringify(verdict, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    chmodSync(out, 0o600);
  } catch (error) {
    console.error(JSON.stringify({ verdict: "APPROVAL_B_EVALUATION_ERROR", errorCode: error?.code ?? "INVALID_EVIDENCE" }));
    process.exit(1);
  }
  console.log(JSON.stringify({ verdict: verdict.verdict, blockerCount: verdict.blockerCount }));
  process.exit(verdict.verdict === "APPROVAL_B_PASS" ? 0 : 3);
}
