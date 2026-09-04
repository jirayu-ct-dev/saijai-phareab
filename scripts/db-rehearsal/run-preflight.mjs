#!/usr/bin/env node
// run-preflight.mjs — Node alternative to run-preflight.sh.
//
// Opens one connection, runs `BEGIN TRANSACTION READ ONLY` + a local
// statement_timeout, executes every sql/*.sql in order, prints each result
// set as JSON on stdout, then issues ROLLBACK. Any failure exits non-zero
// after rollback; nothing is ever written.
//
// Safety gates require DATABASE_URL and exactly one target confirmation.
// Production mode is intentionally stricter: it requires a sanitized approval
// reference and a new report path outside the repository, forces invariant enforcement, labels
// the target without printing host/database details, and sets PostgreSQL's
// default_transaction_read_only before any application query is issued.
//
// Usage:
//   DATABASE_URL=... node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable
//   DATABASE_URL=... node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable --profile current
//   DATABASE_URL=... node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable --enforce
//   DATABASE_URL=... node scripts/db-rehearsal/run-preflight.mjs \
//     --confirm-production-read-only --approval-reference <non-secret-id> \
//     --report-file /absolute/restricted/path/approval-b.json
//
// --enforce evaluates invariants and exits 3 when any fails:
//   * any result row with pass = false
//   * any result row with violating_rows > 0
//   * any check whose id is in the zero-required list reporting a non-zero value
//   * any DO-block invariant surfaced via NOTICE (check_id=... value=... pass=...)
// Without --enforce the runner stays report-only (exit 0 unless a script fails).
//
// Optional: REHEARSAL_COMPLETED_AT_CUTOVER (ISO-8601) is passed to
// 07-completion-timestamps.sql as `SET LOCAL rehearsal.completed_at_cutover`;
// see that file for the cutover-gated completedAt rules.
//
// Dependency note: uses the `pg` client that is already present in
// node_modules (transitive). No new dependency is installed.

import { createHash } from "node:crypto";
import { chmodSync, lstatSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(dirname(scriptDir));
const args = process.argv.slice(2);

const disposableMode = args.includes("--confirm-disposable");
const productionMode = args.includes("--confirm-production-read-only");

if (!disposableMode && !productionMode) {
  console.error(
    "refusing to run without an explicit target confirmation: pass --confirm-disposable or --confirm-production-read-only",
  );
  process.exit(64);
}

if (disposableMode === productionMode) {
  console.error("refusing to run: pass exactly one target confirmation flag");
  process.exit(64);
}

function argValue(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}
const reportFile = argValue("--report-file");
const approvalReference = argValue("--approval-reference");
const profile = argValue("--profile") ?? "legacy";
const enforce = productionMode || args.includes("--enforce");

if (!["legacy", "current"].includes(profile)) {
  console.error("--profile must be legacy or current");
  process.exit(64);
}

if (productionMode) {
  if (!approvalReference || !/^[A-Za-z0-9._:-]{3,128}$/.test(approvalReference)) {
    console.error(
      "production read-only mode requires --approval-reference with a non-secret identifier using only letters, digits, '.', '_', ':' or '-'",
    );
    process.exit(64);
  }
  if (!reportFile || !isAbsolute(reportFile)) {
    console.error("production read-only mode requires an absolute --report-file path");
    process.exit(64);
  }
  const reportRelativeToRepo = relative(repoRoot, resolve(reportFile));
  if (
    reportRelativeToRepo === "" ||
    (reportRelativeToRepo !== ".." &&
      !reportRelativeToRepo.startsWith(`..${sep}`) &&
      !isAbsolute(reportRelativeToRepo))
  ) {
    console.error("production read-only report must be stored outside the repository");
    process.exit(64);
  }
}

// check ids reported as a bare `value` column that must be 0. The rest of the
// zero-gates carry a `pass`/`violating_rows` column and are covered by the
// generic rules above. `json_orders_without_ledger_rows` is deliberately
// absent: it is the legitimate DB-05 backfill target, so it stays report-only.
const ZERO_REQUIRED_CHECK_IDS = new Set([
  // 04-addon-ledger
  "orders_with_non_array_addon_usages_json",
  "orders_with_malformed_addon_usages_entries",
  "ledger_refunded_without_deducted",
  "ledger_rows_without_entitlement",
  "credits_json_vs_ledger_mismatched_pairs",
  // 05-images
  "item_direct_image_id_without_image_row",
  "duplicate_active_item_image_pairs",
  "join_rows_without_image_row",
]);

const NOTICE_INVARIANT_PATTERN =
  /check_id=(\S+)\s+value=(\S+)\s+pass=(\S+)/g;

function parseNoticeInvariants(notices) {
  const invariants = [];
  for (const notice of notices ?? []) {
    const message = typeof notice === "string" ? notice : notice.message;
    if (!message) continue;
    for (const match of message.matchAll(NOTICE_INVARIANT_PATTERN)) {
      invariants.push({ check_id: match[1], value: match[2], pass: match[3] });
    }
  }
  return invariants;
}

function evaluateInvariants(report) {
  const failures = [];
  const numeric = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };
  for (const file of report.files) {
    if (!file.ok) continue;
    for (const row of file.rows ?? []) {
      const id = row.check_id ?? "(unnamed)";
      if (row.pass === false) failures.push({ file: file.file, check_id: id, reason: "pass=false" });
      // `violating_rows` without a companion `pass` column is a gate; when a
      // `pass` column exists it is authoritative and `violating_rows` may be
      // a plain context count (e.g. subscriber_totals, payment histograms).
      if (
        !("pass" in row) &&
        row.violating_rows !== null &&
        row.violating_rows !== undefined &&
        Number(row.violating_rows) > 0
      ) {
        failures.push({
          file: file.file,
          check_id: id,
          reason: `violating_rows=${row.violating_rows}`,
        });
      }
      if (
        ZERO_REQUIRED_CHECK_IDS.has(id) &&
        row.value !== null &&
        row.value !== undefined &&
        Number(row.value) !== 0
      ) {
        failures.push({ file: file.file, check_id: id, reason: `value=${row.value}` });
      }
    }
    for (const invariant of file.invariants ?? []) {
      const numericValue = numeric(invariant.value);
      if (invariant.pass === "false" || invariant.pass === false) {
        failures.push({
          file: file.file,
          check_id: invariant.check_id,
          reason: `pass=false value=${invariant.value}`,
        });
      } else if (
        ZERO_REQUIRED_CHECK_IDS.has(invariant.check_id) &&
        numericValue !== null &&
        numericValue !== 0
      ) {
        failures.push({
          file: file.file,
          check_id: invariant.check_id,
          reason: `value=${invariant.value}`,
        });
      }
    }
  }
  return failures;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set; see .env.example for the variable layout");
  process.exit(64);
}

let productionCa = null;
let productionCaSha256 = null;
if (productionMode) {
  const caPath = process.env.PREFLIGHT_SSL_ROOT_CERT;
  if (!caPath || !isAbsolute(caPath)) {
    console.error("production read-only mode requires absolute PREFLIGHT_SSL_ROOT_CERT");
    process.exit(64);
  }
  try {
    const stat = lstatSync(caPath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 64 || stat.size > 1024 * 1024) {
      throw new Error("unsafe-ca-file");
    }
    productionCa = readFileSync(caPath, "utf8");
    if (!productionCa.includes("-----BEGIN CERTIFICATE-----") || !productionCa.includes("-----END CERTIFICATE-----")) {
      throw new Error("invalid-ca-pem");
    }
    productionCaSha256 = createHash("sha256").update(productionCa).digest("hex");
  } catch {
    console.error("PREFLIGHT_SSL_ROOT_CERT must be a readable non-symlink PEM certificate file");
    process.exit(64);
  }
}

const timeoutMs = Number(process.env.PREFLIGHT_TIMEOUT_MS ?? 30000);
if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
  console.error("PREFLIGHT_TIMEOUT_MS must be an integer between 1000 and 60000");
  process.exit(64);
}

function masked(url) {
  try {
    const parsed = new URL(url);
    if (parsed.username) parsed.username = "***";
    if (parsed.password) parsed.password = "***";
    return `${parsed.hostname}:${parsed.port || 5432}${parsed.pathname}`;
  } catch {
    return "***unparseable-url***";
  }
}

function errorDetail(error) {
  if (!productionMode) return { error: error?.message ?? String(error) };
  const code = typeof error?.code === "string" && /^[A-Z0-9_]{2,32}$/.test(error.code)
    ? error.code
    : "UNKNOWN";
  return { errorCode: code };
}

let Client;
try {
  ({ Client } = await import("pg"));
} catch (error) {
  console.error("the `pg` client is not resolvable; use run-preflight.sh with psql instead");
  console.error(String(error));
  process.exit(64);
}

const sqlDir = join(scriptDir, profile === "current" ? "sql-current" : "sql");
const sqlFiles = readdirSync(sqlDir)
  .filter((name) => /^\d+.*\.sql$/.test(name))
  .sort();

if (sqlFiles.length === 0) {
  console.error(`no SQL scripts found under ${sqlDir}`);
  process.exit(66);
}

const client = new Client({
  connectionString: databaseUrl,
  statement_timeout: timeoutMs,
  connectionTimeoutMillis: 10000,
  application_name: productionMode
    ? "saijai_g3_approval_b_read_only"
    : "saijai_db_rehearsal_preflight",
  options: "-c default_transaction_read_only=on",
  ssl: productionMode ? { ca: productionCa, rejectUnauthorized: true } : undefined,
});

// Notices (RAISE NOTICE from DO blocks, e.g. 07-completion-timestamps.sql)
// are collected from the client event because not every pg version attaches
// them to the query result.
const noticeBuffer = [];
client.on("notice", (notice) => {
  noticeBuffer.push(typeof notice === "string" ? notice : notice.message);
});

const report = {
  target: productionMode ? "production-approved-read-only" : masked(databaseUrl),
  targetMode: productionMode ? "production-read-only" : "disposable",
  approvalReference: productionMode ? approvalReference : null,
  tls: productionMode
    ? { enabled: true, rejectUnauthorized: true, caSha256: productionCaSha256 }
    : null,
  statementTimeoutMs: timeoutMs,
  enforce,
  completedAtCutover: process.env.REHEARSAL_COMPLETED_AT_CUTOVER ?? null,
  profile,
  files: [],
};
let failed = false;

try {
  await client.connect();
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  await client.query(`SET LOCAL statement_timeout = ${Number.isFinite(timeoutMs) ? timeoutMs : 30000}`);
  await client.query("SET LOCAL lock_timeout = '5000ms'");
  const readOnly = await client.query("SHOW transaction_read_only");
  if (readOnly.rows[0]?.transaction_read_only !== "on") {
    throw new Error("fail-closed: PostgreSQL did not confirm transaction_read_only=on");
  }
  if (process.env.REHEARSAL_COMPLETED_AT_CUTOVER) {
    // Custom GUC consumed by 07-completion-timestamps.sql; set_config with
    // is_local=true is transaction-scoped (SET does not take bind params)
    // and rolls back with the READ ONLY transaction.
    await client.query("SELECT set_config('rehearsal.completed_at_cutover', $1, true)", [
      process.env.REHEARSAL_COMPLETED_AT_CUTOVER,
    ]);
  }

  for (const file of sqlFiles) {
    const sql = readFileSync(join(sqlDir, file), "utf8");
    try {
      const result = await client.query(sql);
      const entry = { file, ok: true, rowCount: result.rowCount, rows: result.rows };
      const notices = [
        ...noticeBuffer.splice(0, noticeBuffer.length),
        ...(result.notices ?? []).map((n) => (typeof n === "string" ? n : n.message)),
      ];
      const invariants = parseNoticeInvariants(notices);
      if (invariants.length > 0) entry.invariants = invariants;
      else if (notices.length) entry.notices = notices;
      report.files.push(entry);
      console.log(JSON.stringify(entry));
    } catch (error) {
      failed = true;
      const entry = { file, ok: false, ...errorDetail(error) };
      if (!productionMode && error.notices?.length) {
        entry.notices = error.notices.map((n) => n.message);
      }
      report.files.push(entry);
      console.error(JSON.stringify(entry));
      break; // stop at first failing script; ROLLBACK still runs
    }
  }
} catch (error) {
  failed = true;
  console.error(JSON.stringify({
    ok: false,
    stage: "connection-or-transaction",
    ...errorDetail(error),
  }));
} finally {
  try {
    await client.query("ROLLBACK");
  } catch (error) {
    console.error(JSON.stringify({ ok: false, stage: "rollback", ...errorDetail(error) }));
  }
  await client.end().catch(() => {});
}

report.failed = failed;
let invariantFailures = [];
if (!failed && enforce) {
  invariantFailures = evaluateInvariants(report);
  report.invariantFailures = invariantFailures;
}
console.log(JSON.stringify(report));
if (reportFile) {
  writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  chmodSync(reportFile, 0o600);
}

// Exit code conventions (same as documented for backfill dry-run reports):
//   0 success, 1 script/query failure, 3 invariant enforcement failure,
//   64 usage/config error
if (failed) process.exit(1);
if (enforce && invariantFailures.length > 0) {
  for (const failure of invariantFailures) {
    console.error(JSON.stringify({ ok: false, stage: "invariant", ...failure }));
  }
  process.exit(3);
}
process.exit(0);
