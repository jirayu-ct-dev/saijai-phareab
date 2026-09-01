#!/usr/bin/env node
// run-preflight.mjs — Node alternative to run-preflight.sh.
//
// Opens one connection, runs `BEGIN TRANSACTION READ ONLY` + a local
// statement_timeout, executes every sql/*.sql in order, prints each result
// set as JSON on stdout, then issues ROLLBACK. Any failure exits non-zero
// after rollback; nothing is ever written.
//
// Safety gates mirror the bash runner: requires DATABASE_URL and the
// --confirm-disposable flag. The URL is never printed; only a masked
// host/database name is shown.
//
// Usage:
//   DATABASE_URL=... node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable
//
// Dependency note: uses the `pg` client that is already present in
// node_modules (transitive). No new dependency is installed.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

if (!args.includes("--confirm-disposable")) {
  console.error(
    "refusing to run: pass --confirm-disposable to acknowledge the target database is disposable or an approved restore copy (never production)",
  );
  process.exit(64);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set; see .env.example for the variable layout");
  process.exit(64);
}

const timeoutMs = Number(process.env.PREFLIGHT_TIMEOUT_MS ?? 30000);

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

let Client;
try {
  ({ Client } = await import("pg"));
} catch (error) {
  console.error("the `pg` client is not resolvable; use run-preflight.sh with psql instead");
  console.error(String(error));
  process.exit(64);
}

const sqlDir = join(scriptDir, "sql");
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
});

const report = { target: masked(databaseUrl), statementTimeoutMs: timeoutMs, files: [] };
let failed = false;

try {
  await client.connect();
  await client.query("BEGIN TRANSACTION READ ONLY");
  await client.query(`SET LOCAL statement_timeout = ${Number.isFinite(timeoutMs) ? timeoutMs : 30000}`);

  for (const file of sqlFiles) {
    const sql = readFileSync(join(sqlDir, file), "utf8");
    try {
      const result = await client.query(sql);
      const entry = { file, ok: true, rowCount: result.rowCount, rows: result.rows };
      if (result.rows.length === 0 && result.rowCount === 0) {
        // DO blocks (e.g. 07-completion-timestamps.sql) report via NOTICE;
        // the notices are attached to the query result.
        if (result.notices?.length) entry.notices = result.notices.map((n) => n.message);
      } else if (result.notices?.length) {
        entry.notices = result.notices.map((n) => n.message);
      }
      report.files.push(entry);
      console.log(JSON.stringify(entry));
    } catch (error) {
      failed = true;
      const entry = { file, ok: false, error: error.message };
      if (error.notices?.length) entry.notices = error.notices.map((n) => n.message);
      report.files.push(entry);
      console.error(JSON.stringify(entry));
      break; // stop at first failing script; ROLLBACK still runs
    }
  }
} catch (error) {
  failed = true;
  console.error(JSON.stringify({ ok: false, stage: "connection-or-transaction", error: error.message }));
} finally {
  try {
    await client.query("ROLLBACK");
  } catch (error) {
    console.error(JSON.stringify({ ok: false, stage: "rollback", error: error.message }));
  }
  await client.end().catch(() => {});
}

report.failed = failed;
console.log(JSON.stringify(report));

// Exit code conventions (same as documented for backfill dry-run reports):
//   0 success, 1 script/query failure, 64 usage/config error
process.exit(failed ? 1 : 0);
