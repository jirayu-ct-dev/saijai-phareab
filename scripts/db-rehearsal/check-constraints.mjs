#!/usr/bin/env node
// G5 read-only constraint/index health check against a live PostgreSQL.
// Aggregate counts only; runs entirely inside a READ ONLY transaction.
//
//   DATABASE_URL=... node scripts/db-rehearsal/check-constraints.mjs \
//     --ssl-root-cert /absolute/ca.pem --report-file /absolute/out.json

import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

const scriptDir = new URL(".", import.meta.url).pathname;

function argValue(flag) {
  const args = process.argv.slice(2);
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

const reportFile = argValue("--report-file");
if (!isAbsolute(reportFile ?? "")) {
  console.error("usage: check-constraints.mjs --ssl-root-cert ABS_CA_PEM --report-file ABS_OUT_JSON");
  process.exit(64);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set");
  process.exit(64);
}

const caPath = argValue("--ssl-root-cert");
const ssl =
  caPath && isAbsolute(caPath)
    ? { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true }
    : undefined;

const CHECKS = {
  invalidIndexes:
    "SELECT count(*)::int AS value FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid WHERE NOT i.indisvalid AND c.relnamespace = 'public'::regnamespace",
  notReadyIndexes:
    "SELECT count(*)::int AS value FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid WHERE NOT i.indisready AND c.relnamespace = 'public'::regnamespace",
  notValidConstraints:
    "SELECT count(*)::int AS value FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid WHERE NOT k.convalidated AND c.relnamespace = 'public'::regnamespace",
  // Platform-owned schemas (e.g. Supabase realtime) are excluded from the
  // gate but still reported by name so the disposition is visible evidence.
  platformNotValidConstraints:
    "SELECT string_agg(c.relnamespace::regnamespace || '.' || k.conname, ',' ORDER BY k.conname) AS value FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid WHERE NOT k.convalidated AND c.relnamespace <> 'public'::regnamespace",
  pendingConstraints:
    "SELECT count(*)::int AS value FROM pg_constraint WHERE convalidated AND contype IN ('f','c') AND NOT conparentid = 0 AND coninhcount = 0 AND conislocal = false",
  unusualConstraintsTotal:
    "SELECT count(*)::int AS value FROM pg_constraint WHERE contype IN ('p','u','f','c') AND connamespace = 'public'::regnamespace",
  unusualIndexesTotal:
    "SELECT count(*)::int AS value FROM pg_index i JOIN pg_class c ON c.oid = i.indrelid WHERE c.relnamespace = 'public'::regnamespace",
};

const { Client } = await import("pg");
const client = new Client({
  connectionString: databaseUrl,
  statement_timeout: 30000,
  connectionTimeoutMillis: 10000,
  application_name: "saijai_g5_constraint_check",
  options: "-c default_transaction_read_only=on",
  ssl,
});

await client.connect();
const results = {};
let failed = false;
try {
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  for (const [checkId, sql] of Object.entries(CHECKS)) {
    try {
      const row = (await client.query(sql)).rows[0];
      results[checkId] = Number(row.value);
    } catch (error) {
      results[checkId] = `ERROR:${error?.code ?? "UNKNOWN"}`;
      failed = true;
    }
  }
  await client.query("ROLLBACK");
} finally {
  await client.end();
}

const report = {
  target: "g5-constraint-health-check",
  targetMode: "production-read-only",
  approvalReference: argValue("--approval-reference") ?? null,
  checkedAt: new Date().toISOString(),
  results,
  invalid: results.invalidIndexes !== 0 || results.notReadyIndexes !== 0 || results.notValidConstraints !== 0,  failed,
};
writeFileSync(reportFile, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
console.log(JSON.stringify({ results: report.results, invalid: report.invalid, failed: report.failed }));
process.exit(failed || report.invalid ? 1 : 0);
