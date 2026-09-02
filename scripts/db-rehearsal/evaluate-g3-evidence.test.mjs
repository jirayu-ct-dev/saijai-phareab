import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  evaluateG3Evidence,
  OPERATIONS,
  REQUIRED_ZERO_CHECKS,
} from "./evaluate-g3-evidence.mjs";

const makeEvidence = () => {
  const dir = mkdtempSync(join(tmpdir(), "saijai-g3-evaluator."));
  const report = (phase) => ({
    operation: "placeholder",
    mode: phase === "dry" || phase === "final" ? "dry-run" : "apply",
    rowsScanned: 5,
    rowsChanged: phase === "apply" ? 2 : phase === "dry" ? 2 : 0,
    mismatches: [],
    quarantine: [],
    exitCode: 0,
  });
  for (const operation of OPERATIONS) {
    for (const phase of ["dry", "apply", "apply2", "final"]) {
      writeFileSync(join(dir, `${phase}-${operation}.json`), JSON.stringify(report(phase)));
    }
  }
  writeFileSync(
    join(dir, "preflight-after.json"),
    JSON.stringify({
      failed: false,
      invariantFailures: [],
      files: [{ rows: REQUIRED_ZERO_CHECKS.map((check_id) => ({ check_id, value: "0" })) }],
    }),
  );
  writeFileSync(join(dir, "timings.json"), JSON.stringify({ restore: 10, migrateDeploy: 5 }));
  writeFileSync(join(dir, "schema-diff-db03.json"), JSON.stringify({ ok: true, unexpectedAdded: [], unexpectedRemoved: [] }));
  writeFileSync(join(dir, "schema-diff-canonical.json"), JSON.stringify({ ok: true, unexpectedAdded: [], unexpectedRemoved: [] }));
  writeFileSync(join(dir, "migrate-status.log"), "Database schema is up to date!\n");
  writeFileSync(join(dir, "preflight-before.json"), JSON.stringify({ failed: false, invariantFailures: [] }));
  return dir;
};

test("passes only complete zero-mismatch, zero-quarantine, idempotent evidence", () => {
  const dir = makeEvidence();
  try {
    const result = evaluateG3Evidence(dir);
    assert.equal(result.verdict, "G3_REHEARSAL_PASS");
    assert.deepEqual(result.blockers, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("reports an allowlisted canonical representation difference without hiding it", () => {
  const dir = makeEvidence();
  try {
    writeFileSync(
      join(dir, "schema-diff-canonical.json"),
      JSON.stringify({
        ok: true,
        counts: { added: 0, removed: 1, unexpectedAdded: 0, unexpectedRemoved: 0 },
        added: [],
        removed: [
          'constraint|u|package_expiry_notification|package_expiry_notification_entitlementId_daysBefore_endAtS_key|UNIQUE ("entitlementId", "daysBefore", "endAtSnapshot")',
        ],
        unexpectedAdded: [],
        unexpectedRemoved: [],
      }),
    );

    const result = evaluateG3Evidence(dir);
    assert.equal(result.verdict, "G3_REHEARSAL_PASS");
    assert.equal(result.schema.canonical.removed, 1);
    assert.equal(result.schema.canonical.unexpectedRemoved, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("blocks an active-image gap even when generic preflight enforcement has no failure", () => {
  const dir = makeEvidence();
  try {
    const path = join(dir, "preflight-after.json");
    const report = JSON.parse(readFile(path));
    report.files[0].rows.find((row) => row.check_id === "item_direct_image_id_without_active_join_row").value = "1";
    writeFileSync(path, JSON.stringify(report));
    const result = evaluateG3Evidence(dir);
    assert.equal(result.verdict, "G3_REHEARSAL_BLOCKED");
    assert.ok(result.blockers.includes("preflight-after:item_direct_image_id_without_active_join_row=1"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("reports sanitized preflight-before check evidence without row identifiers", () => {
  const dir = makeEvidence();
  try {
    writeFileSync(
      join(dir, "preflight-before.json"),
      JSON.stringify({
        failed: false,
        invariantFailures: [
          {
            file: "06-payments.sql",
            check_id: "paid_payment_missing_receipt_no",
            reason: "pass=false",
            subjectId: "must-not-leak",
          },
        ],
      }),
    );

    const result = evaluateG3Evidence(dir);
    assert.equal(result.verdict, "G3_REHEARSAL_BLOCKED");
    assert.deepEqual(result.preflightBefore.failures, [
      { checkId: "paid_payment_missing_receipt_no", reason: "pass=false" },
    ]);
    assert.equal(JSON.stringify(result).includes("must-not-leak"), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("blocks second-apply writes and does not expose subject identifiers", () => {
  const dir = makeEvidence();
  try {
    const path = join(dir, `apply2-${OPERATIONS[0]}.json`);
    const report = JSON.parse(readFile(path));
    report.rowsChanged = 1;
    report.mismatches = [{ subjectId: "sensitive-row-id" }];
    writeFileSync(path, JSON.stringify(report));
    const result = evaluateG3Evidence(dir);
    assert.equal(result.verdict, "G3_REHEARSAL_BLOCKED");
    assert.equal(JSON.stringify(result).includes("sensitive-row-id"), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function readFile(path) {
  return readFileSync(path, "utf8");
}
