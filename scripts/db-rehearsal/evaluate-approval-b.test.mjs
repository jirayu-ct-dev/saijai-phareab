import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { evaluateApprovalBEvidence } from "./evaluate-approval-b.mjs";

const NOW = "2026-09-02T15:00:00.000Z";
const APPROVAL = "chat-2026-09-02-g3-b";
const evaluatorPath = fileURLToPath(new URL("./evaluate-approval-b.mjs", import.meta.url));
const SQL_FILES = [
  "01-table-row-counts.sql",
  "02-settings-singletons.sql",
  "03-subscribers.sql",
  "04-addon-ledger.sql",
  "05-images.sql",
  "06-payments.sql",
  "07-completion-timestamps.sql",
];

function makePreflight() {
  return {
    target: "production-approved-read-only",
    targetMode: "production-read-only",
    approvalReference: APPROVAL,
    enforce: true,
    failed: false,
    invariantFailures: [],
    files: [
      {
        file: "00-server-and-migration-context.sql",
        ok: true,
        rows: [
          {
            check_id: "server_and_migration_context",
            server_version_num: 170006,
            transaction_read_only: true,
            migration_rows: "47",
            applied_rows: "47",
            unfinished_rows: "0",
            rolled_back_rows: "0",
            pass: true,
          },
        ],
      },
      ...SQL_FILES.map((file) => ({
        file,
        ok: true,
        rows: [],
      })),
    ],
  };
}

function makeAttestation() {
  return {
    schemaVersion: 1,
    approvalReference: APPROVAL,
    attestedAt: "2026-09-02T14:55:00.000Z",
    operatorIdentifier: "must-not-appear-in-summary",
    backupPitr: {
      operatorVerified: true,
      latestBackupAt: "2026-09-02T14:00:00.000Z",
      pitrEnabled: true,
      latestRecoverableAt: "2026-09-02T14:50:00.000Z",
      restoreDrillReference: "chat-2026-09-02-g3-a-after-receipt-remediation",
    },
    runtimeInventory: {
      operatorVerified: true,
      observedAt: "2026-09-02T14:50:00.000Z",
      activeApplicationCount: 1,
      activeWorkerCount: 1,
      maintenanceMode: false,
      allActiveCompatibilityVersion: true,
      compatibilityRevision: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      deploymentIdentifiers: ["must-not-appear-in-summary"],
    },
  };
}

function makeExternalBackupPolicy() {
  return {
    mode: "external-encrypted-backups",
    intervalMinutes: 60,
    encrypted: true,
    retentionDays: 14,
    lastRestoreDrillAt: "2026-09-02T14:00:00.000Z",
  };
}

test("passes only when database and operator evidence jointly satisfy Approval B", () => {
  const result = evaluateApprovalBEvidence({
    preflight: makePreflight(),
    attestation: makeAttestation(),
    expectedApprovalReference: APPROVAL,
    now: NOW,
  });

  assert.equal(result.verdict, "APPROVAL_B_PASS");
  assert.deepEqual(result.blockers, []);
  assert.equal(result.database.transactionReadOnly, true);
  assert.equal(result.operator.runtimeTotal, 2);
});

test("blocks an incomplete or non-read-only production preflight", () => {
  const preflight = makePreflight();
  preflight.enforce = false;
  preflight.files[0].rows[0].transaction_read_only = false;
  preflight.files.pop();

  const result = evaluateApprovalBEvidence({
    preflight,
    attestation: makeAttestation(),
    expectedApprovalReference: APPROVAL,
    now: NOW,
  });

  assert.equal(result.verdict, "APPROVAL_B_BLOCKED");
  assert.ok(result.blockers.includes("preflight:enforcement-not-enabled"));
  assert.ok(result.blockers.includes("preflight:transaction-not-read-only"));
  assert.ok(result.blockers.some((reason) => reason.startsWith("preflight:missing-sql-file:")));
});

test("recomputes row invariants instead of trusting an empty failure summary", () => {
  const preflight = makePreflight();
  preflight.files[1].rows.push({
    check_id: "tampered_or_inconsistent_check",
    violating_rows: "1",
    pass: false,
  });

  const result = evaluateApprovalBEvidence({
    preflight,
    attestation: makeAttestation(),
    expectedApprovalReference: APPROVAL,
    now: NOW,
  });

  assert.equal(preflight.invariantFailures.length, 0);
  assert.equal(result.verdict, "APPROVAL_B_BLOCKED");
  assert.ok(result.blockers.includes("preflight:recomputed-invariant-failures=1"));
});

test("blocks duplicate or unexpected SQL evidence", () => {
  const preflight = makePreflight();
  preflight.files.push(preflight.files[1], { file: "99-unreviewed.sql", ok: true, rows: [] });

  const result = evaluateApprovalBEvidence({
    preflight,
    attestation: makeAttestation(),
    expectedApprovalReference: APPROVAL,
    now: NOW,
  });

  assert.ok(result.blockers.includes("preflight:duplicate-sql-file-evidence"));
  assert.ok(result.blockers.includes("preflight:unexpected-sql-file:99-unreviewed.sql"));
});

test("blocks stale backup, PITR, attestation, and runtime inventory", () => {
  const attestation = makeAttestation();
  attestation.attestedAt = "2026-08-31T14:00:00.000Z";
  attestation.backupPitr.latestBackupAt = "2026-08-31T14:00:00.000Z";
  attestation.backupPitr.latestRecoverableAt = "2026-09-02T12:00:00.000Z";
  attestation.runtimeInventory.observedAt = "2026-09-02T12:00:00.000Z";

  const result = evaluateApprovalBEvidence({
    preflight: makePreflight(),
    attestation,
    expectedApprovalReference: APPROVAL,
    now: NOW,
  });

  assert.equal(result.verdict, "APPROVAL_B_BLOCKED");
  assert.ok(result.blockers.includes("attestation:stale-or-invalid"));
  assert.ok(result.blockers.includes("backup:stale-or-invalid"));
  assert.ok(result.blockers.includes("pitr:recovery-point-stale-or-invalid"));
  assert.ok(result.blockers.includes("runtime:inventory-stale-or-invalid"));
});

test("blocks runtime inventory that cannot prove compatibility", () => {
  const attestation = makeAttestation();
  attestation.runtimeInventory.allActiveCompatibilityVersion = false;
  attestation.runtimeInventory.compatibilityRevision = "";

  const result = evaluateApprovalBEvidence({
    preflight: makePreflight(),
    attestation,
    expectedApprovalReference: APPROVAL,
    now: NOW,
  });

  assert.equal(result.verdict, "APPROVAL_B_BLOCKED");
  assert.ok(result.blockers.includes("runtime:not-all-active-on-compatibility-version"));
  assert.ok(result.blockers.includes("runtime:compatibility-revision-missing-or-invalid"));
});

test("allows zero active runtimes only when maintenance mode is attested", () => {
  const withoutMaintenance = makeAttestation();
  withoutMaintenance.runtimeInventory.activeApplicationCount = 0;
  withoutMaintenance.runtimeInventory.activeWorkerCount = 0;

  const blocked = evaluateApprovalBEvidence({
    preflight: makePreflight(),
    attestation: withoutMaintenance,
    expectedApprovalReference: APPROVAL,
    now: NOW,
  });
  assert.ok(blocked.blockers.includes("runtime:no-active-runtime-and-not-in-maintenance"));

  withoutMaintenance.runtimeInventory.maintenanceMode = true;
  const passed = evaluateApprovalBEvidence({
    preflight: makePreflight(),
    attestation: withoutMaintenance,
    expectedApprovalReference: APPROVAL,
    now: NOW,
  });
  assert.equal(passed.verdict, "APPROVAL_B_PASS");
});

test("passes with the external encrypted backup policy without PITR evidence", () => {
  const attestation = makeAttestation();
  attestation.backupPitr.pitrEnabled = false;
  attestation.backupPitr.latestRecoverableAt = null;
  attestation.backupPolicy = makeExternalBackupPolicy();

  const result = evaluateApprovalBEvidence({
    preflight: makePreflight(),
    attestation,
    expectedApprovalReference: APPROVAL,
    now: NOW,
  });

  assert.equal(result.verdict, "APPROVAL_B_PASS");
  assert.deepEqual(result.blockers, []);
  assert.equal(result.operator.backupPolicyMode, "external-encrypted-backups");
  assert.equal(result.operator.externalBackupEncrypted, true);
  assert.equal(result.operator.externalBackupIntervalMinutes, 60);
  assert.equal(result.operator.externalBackupRetentionDays, 14);
  assert.equal(result.operator.restoreDrillFresh, true);
  assert.equal(result.operator.pitrEnabled, false);
});

test("blocks an external backup policy that misses policy or cadence fields", () => {
  const attestation = makeAttestation();
  attestation.backupPitr.pitrEnabled = false;
  attestation.backupPitr.latestRecoverableAt = null;
  attestation.backupPolicy = {
    ...makeExternalBackupPolicy(),
    encrypted: false,
    intervalMinutes: 120,
    retentionDays: 1,
    lastRestoreDrillAt: "2026-07-01T14:00:00.000Z",
  };
  attestation.backupPitr.latestBackupAt = "2026-09-02T11:00:00.000Z";

  const result = evaluateApprovalBEvidence({
    preflight: makePreflight(),
    attestation,
    expectedApprovalReference: APPROVAL,
    now: NOW,
  });

  assert.equal(result.verdict, "APPROVAL_B_BLOCKED");
  assert.ok(result.blockers.includes("backup-policy:encryption-not-attested"));
  assert.ok(result.blockers.includes("backup-policy:interval-missing-or-invalid"));
  assert.ok(result.blockers.includes("backup-policy:retention-insufficient"));
  assert.ok(result.blockers.includes("backup-policy:restore-drill-stale-or-invalid"));
  assert.ok(result.blockers.includes("backup:backup-cadence-stale-or-invalid"));
  assert.ok(!result.blockers.some((reason) => reason.startsWith("pitr:")));
});

test("summary is aggregate-only and rejects approval-reference mismatch", () => {
  const attestation = makeAttestation();
  attestation.approvalReference = "different-approval";

  const result = evaluateApprovalBEvidence({
    preflight: makePreflight(),
    attestation,
    expectedApprovalReference: APPROVAL,
    now: NOW,
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.verdict, "APPROVAL_B_BLOCKED");
  assert.ok(result.blockers.includes("attestation:approval-reference-mismatch"));
  assert.equal(serialized.includes("must-not-appear-in-summary"), false);
  assert.equal(serialized.includes("deploymentIdentifiers"), false);
  assert.equal(serialized.includes("operatorIdentifier"), false);
});

test("CLI writes a new mode-0600 aggregate summary and refuses overwrite", () => {
  const evidenceDir = mkdtempSync(join(tmpdir(), "saijai-approval-b-evaluator."));
  try {
    const preflightPath = join(evidenceDir, "preflight.json");
    const attestationPath = join(evidenceDir, "attestation.json");
    const summaryPath = join(evidenceDir, "summary.json");
    const nowMs = Date.now();
    const attestation = makeAttestation();
    attestation.attestedAt = new Date(nowMs - 60_000).toISOString();
    attestation.backupPitr.latestBackupAt = new Date(nowMs - 5 * 60_000).toISOString();
    attestation.backupPitr.latestRecoverableAt = new Date(nowMs - 60_000).toISOString();
    attestation.runtimeInventory.observedAt = new Date(nowMs - 60_000).toISOString();
    writeFileSync(preflightPath, JSON.stringify(makePreflight()));
    writeFileSync(attestationPath, JSON.stringify(attestation));

    const args = [
      evaluatorPath,
      "--preflight-report",
      preflightPath,
      "--operator-attestation",
      attestationPath,
      "--approval-reference",
      APPROVAL,
      "--out",
      summaryPath,
      "--confirm-production-evidence",
    ];
    const first = spawnSync(process.execPath, args, { encoding: "utf8" });
    const summary = JSON.parse(readFileSync(summaryPath, "utf8"));

    assert.equal(first.status, 0);
    assert.equal(summary.verdict, "APPROVAL_B_PASS");
    assert.equal(statSync(summaryPath).mode & 0o777, 0o600);
    assert.equal(JSON.stringify(summary).includes("must-not-appear-in-summary"), false);

    const second = spawnSync(process.execPath, args, { encoding: "utf8" });
    assert.equal(second.status, 1);
    assert.match(second.stderr, /APPROVAL_B_EVALUATION_ERROR/);
  } finally {
    rmSync(evidenceDir, { recursive: true, force: true });
  }
});
