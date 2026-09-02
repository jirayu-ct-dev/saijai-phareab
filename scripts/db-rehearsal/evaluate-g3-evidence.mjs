#!/usr/bin/env node
// Produce an aggregate-only G3 verdict from a production-shape rehearsal.
// Raw backfill reports may contain database identifiers and stay in the
// mode-0700 temporary evidence directory; this summary never copies them.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const OPERATIONS = [
  "settings-consolidation",
  "addon-usage-json-to-ledger",
  "item-photo-direct-to-join",
];

export const REQUIRED_ZERO_CHECKS = [
  "json_orders_without_ledger_rows",
  "credits_json_vs_ledger_mismatched_pairs",
  "ledger_refunded_without_deducted",
  "ledger_rows_without_entitlement",
  "item_direct_image_id_without_join_row",
  "item_direct_image_id_without_active_join_row",
  "duplicate_active_item_image_pairs",
  "join_rows_without_image_row",
];

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const compactBackfill = (report) => ({
  rowsScanned: Number(report.rowsScanned),
  rowsChanged: Number(report.rowsChanged),
  mismatchCount: report.mismatches?.length ?? 0,
  quarantineCount: report.quarantine?.length ?? 0,
  exitCode: Number(report.exitCode),
});

export function evaluateG3Evidence(evidenceDir) {
  const reasons = [];
  const operations = {};
  const phases = ["dry", "apply", "apply2", "final"];

  for (const operation of OPERATIONS) {
    operations[operation] = {};
    for (const phase of phases) {
      const path = join(evidenceDir, `${phase}-${operation}.json`);
      try {
        operations[operation][phase] = compactBackfill(readJson(path));
      } catch {
        reasons.push(`missing-or-invalid:${phase}:${operation}`);
      }
    }
  }

  for (const [operation, reports] of Object.entries(operations)) {
    for (const phase of phases) {
      const report = reports[phase];
      if (!report) continue;
      if (report.exitCode !== 0) reasons.push(`${phase}:${operation}:exitCode=${report.exitCode}`);
      if (report.mismatchCount !== 0) reasons.push(`${phase}:${operation}:mismatches=${report.mismatchCount}`);
      if (report.quarantineCount !== 0) reasons.push(`${phase}:${operation}:quarantine=${report.quarantineCount}`);
    }
    if (reports.apply2 && reports.apply2.rowsChanged !== 0) {
      reasons.push(`apply2:${operation}:rowsChanged=${reports.apply2.rowsChanged}`);
    }
    if (reports.final && reports.final.rowsChanged !== 0) {
      reasons.push(`final:${operation}:rowsChanged=${reports.final.rowsChanged}`);
    }
    if (reports.dry && reports.apply && reports.dry.rowsChanged !== reports.apply.rowsChanged) {
      reasons.push(
        `dry-vs-apply:${operation}:rowsChanged=${reports.dry.rowsChanged}/${reports.apply.rowsChanged}`,
      );
    }
  }

  const schema = {};
  for (const name of ["db03", "canonical"]) {
    try {
      const report = readJson(join(evidenceDir, `schema-diff-${name}.json`));
      schema[name] = {
        ok: report.ok === true,
        added: Number(report.counts?.added ?? report.added?.length ?? 0),
        removed: Number(report.counts?.removed ?? report.removed?.length ?? 0),
        unexpectedAdded: Number(report.counts?.unexpectedAdded ?? report.unexpectedAdded?.length),
        unexpectedRemoved: Number(report.counts?.unexpectedRemoved ?? report.unexpectedRemoved?.length),
      };
      if (
        !schema[name].ok ||
        schema[name].unexpectedAdded !== 0 ||
        schema[name].unexpectedRemoved !== 0
      ) {
        reasons.push(`schema-diff-${name}:unexpected-delta`);
      }
    } catch {
      reasons.push(`missing-or-invalid:schema-diff-${name}`);
    }
  }

  let migrationStatusUpToDate = false;
  try {
    migrationStatusUpToDate = readFileSync(join(evidenceDir, "migrate-status.log"), "utf8").includes(
      "Database schema is up to date!",
    );
  } catch {
    // The missing status and a status that is not current are the same gate.
  }
  if (!migrationStatusUpToDate) reasons.push("migration-status:not-up-to-date-or-missing");

  let preflightBeforeClean = false;
  let preflightBefore = {
    queryFailed: null,
    invariantFailureCount: null,
    failures: [],
  };
  try {
    const before = readJson(join(evidenceDir, "preflight-before.json"));
    const failures = (before.invariantFailures ?? []).map((failure) => ({
      checkId: String(failure.check_id ?? "UNKNOWN"),
      reason: String(failure.reason ?? "unknown"),
    }));
    preflightBefore = {
      queryFailed: before.failed === true,
      invariantFailureCount: failures.length,
      failures,
    };
    preflightBeforeClean = !preflightBefore.queryFailed && failures.length === 0;
  } catch {
    // Reported below as a single aggregate blocker.
  }
  if (!preflightBeforeClean) {
    if (preflightBefore.failures.length > 0) {
      for (const failure of preflightBefore.failures) {
        reasons.push(`preflight-before:${failure.checkId}:${failure.reason}`);
      }
    } else {
      reasons.push("preflight-before:not-clean-or-missing");
    }
  }

  const requiredZero = {};
  let invariantFailureCount = null;
  try {
    const preflight = readJson(join(evidenceDir, "preflight-after.json"));
    invariantFailureCount = preflight.invariantFailures?.length ?? 0;
    if (preflight.failed) reasons.push("preflight-after:query-failure");
    if (invariantFailureCount !== 0) {
      reasons.push(`preflight-after:invariantFailures=${invariantFailureCount}`);
    }
    const rows = preflight.files.flatMap((file) => file.rows ?? []);
    for (const checkId of REQUIRED_ZERO_CHECKS) {
      const row = rows.find((candidate) => candidate.check_id === checkId);
      const value = row ? Number(row.value ?? row.violating_rows) : null;
      requiredZero[checkId] = value;
      if (value === null || !Number.isFinite(value)) reasons.push(`preflight-after:${checkId}:missing`);
      else if (value !== 0) reasons.push(`preflight-after:${checkId}=${value}`);
    }
  } catch {
    reasons.push("missing-or-invalid:preflight-after");
  }

  let timingsMs = null;
  try {
    timingsMs = readJson(join(evidenceDir, "timings.json"));
  } catch {
    reasons.push("missing-or-invalid:timings");
  }

  return {
    verdict: reasons.length === 0 ? "G3_REHEARSAL_PASS" : "G3_REHEARSAL_BLOCKED",
    scope: "approved production-shape backup restored into an isolated loopback PostgreSQL container",
    schema,
    migrationStatusUpToDate,
    preflightBeforeClean,
    preflightBefore,
    operations,
    reconciliation: { invariantFailureCount, requiredZero },
    timingsMs,
    blockerCount: reasons.length,
    blockers: reasons,
  };
}

function argValue(args, flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const evidenceDir = argValue(args, "--evidence-dir");
  const out = argValue(args, "--out");
  if (!evidenceDir || !out) {
    console.error("usage: evaluate-g3-evidence.mjs --evidence-dir DIR --out FILE");
    process.exit(64);
  }
  const verdict = evaluateG3Evidence(evidenceDir);
  writeFileSync(out, `${JSON.stringify(verdict, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ verdict: verdict.verdict, blockerCount: verdict.blockerCount }));
  process.exit(verdict.verdict === "G3_REHEARSAL_PASS" ? 0 : 3);
}
