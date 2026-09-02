#!/usr/bin/env node
// schema-diff.mjs — normalized schema fingerprint + allowlisted diff.
//
// Fingerprints the logical schema (tables, columns, enums, constraints,
// indexes) of a PostgreSQL database from the catalog, then diffs two
// fingerprints. Differences matching an entry in an allowlist file are
// expected; anything else fails. Used for:
//
//   * dump/restore equality checks (empty allowlist -> both sides identical)
//   * review of an expand migration (allowlist = exactly the additive changes)
//
// Usage:
//   node scripts/db-rehearsal/schema-diff.mjs fingerprint --url URL --out FILE
//     [--confirm-disposable]
//   node scripts/db-rehearsal/schema-diff.mjs diff --from URL --to URL
//     [--allowlist FILE] [--confirm-disposable]
//
// Allowlist file: JSON { "added": [line, ...], "removed": [line, ...] }.
// An entry matches a diff line exactly, or as a regex when prefixed with
// "re:". The empty allowlist { "added": [], "removed": [] } means the two
// schemas must be identical.
//
// Output URLs are only ever printed masked. No data is read — catalog only.
//
// Exit codes: 0 clean/fully allowlisted, 1 unexpected differences,
// 3 invalid allowlist file, 64 usage/config error.

import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);

if (!args.includes("--confirm-disposable")) {
  console.error(
    "refusing to run: pass --confirm-disposable to acknowledge the target database is disposable or an approved restore copy (never production)",
  );
  process.exit(64);
}

function argValue(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
}

const command = args[0];
if (command !== "fingerprint" && command !== "diff") {
  console.error("usage: schema-diff.mjs fingerprint|diff ... (--confirm-disposable required)");
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

let Client;
try {
  ({ Client } = await import("pg"));
} catch (error) {
  console.error("the `pg` client is not resolvable; run inside the repo (pnpm install)");
  console.error(String(error));
  process.exit(64);
}

// One deterministic line per catalog fact. Sorted, so the diff is a set diff.
const CATALOG_QUERIES = [
  {
    kind: "table",
    sql: `
      SELECT table_name AS name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    line: (row) => `table|${row.name}`,
  },
  {
    kind: "view",
    sql: `
      SELECT table_name AS name
      FROM information_schema.views
      WHERE table_schema = 'public'`,
    line: (row) => `view|${row.name}`,
  },
  {
    kind: "enum",
    sql: `
      SELECT t.typname AS name,
             string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS labels
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      GROUP BY t.typname`,
    line: (row) => `enum|${row.name}|${row.labels}`,
  },
  {
    kind: "column",
    sql: `
      SELECT table_name, column_name, data_type, udt_name,
             is_nullable, column_default, character_maximum_length,
             numeric_precision, numeric_scale, datetime_precision
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name NOT LIKE 'pg\\_%'
      ORDER BY table_name, column_name`,
    // NOTE: ordinal_position is deliberately excluded. Dropped columns leave
    // permanent attnum gaps, while pg_dump recreates tables with compressed
    // positions — so positions are not preserved by dump/restore. Column
    // identity is (table, name, type, nullability, default); Prisma accesses
    // columns by name, never by position.
    line: (row) =>
      `column|${row.table_name}|${row.column_name}` +
      `|${row.data_type === "ARRAY" ? `_array_of_${row.udt_name}` : row.udt_name}` +
      `|${row.is_nullable}` +
      `|${row.character_maximum_length ?? ""}` +
      `|${row.numeric_precision ?? ""},${row.numeric_scale ?? ""}` +
      `|${row.datetime_precision ?? ""}` +
      `|${row.column_default ?? ""}`,
  },
  {
    kind: "constraint",
    sql: `
      SELECT con.conname AS name, con.contype AS type,
             con.conrelid::regclass::text AS on_table,
             pg_get_constraintdef(con.oid) AS definition
      FROM pg_constraint con
      JOIN pg_class cls ON cls.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
      WHERE nsp.nspname = 'public'
      ORDER BY con.conname, con.oid`,
    line: (row) =>
      `constraint|${row.type}|${row.on_table}|${row.name}|${row.definition}`,
  },
  {
    kind: "index",
    sql: `
      SELECT indexname AS name, indexdef AS definition
      FROM pg_indexes
      WHERE schemaname = 'public'
      ORDER BY indexname`,
    line: (row) => `index|${row.name}|${row.definition}`,
  },
];

async function fingerprint(databaseUrl) {
  const client = new Client({
    connectionString: databaseUrl,
    statement_timeout: 30000,
    connectionTimeoutMillis: 10000,
  });
  try {
    await client.connect();
    const lines = [];
    for (const query of CATALOG_QUERIES) {
      const result = await client.query(query.sql);
      for (const row of result.rows) lines.push(query.line(row));
    }
    // Constraints duplicate some UNIQUE indexes under pg_indexes; that is
    // fine for diffing as long as both sides fingerprint the same way.
    lines.sort();
    return [...new Set(lines)];
  } finally {
    await client.end().catch(() => {});
  }
}

if (command === "fingerprint") {
  const url = argValue("--url");
  const out = argValue("--out");
  if (!url || !out) {
    console.error("fingerprint requires --url URL --out FILE");
    process.exit(64);
  }
  const lines = await fingerprint(url);
  writeFileSync(out, `${lines.join("\n")}\n`);
  console.log(JSON.stringify({ ok: true, target: masked(url), entries: lines.length }));
  process.exit(0);
}

// command === "diff"
const fromUrl = argValue("--from");
const toUrl = argValue("--to");
const allowlistPath = argValue("--allowlist");
if (!fromUrl || !toUrl) {
  console.error("diff requires --from URL --to URL [--allowlist FILE]");
  process.exit(64);
}

let allowlist = { added: [], removed: [] };
if (allowlistPath) {
  try {
    allowlist = JSON.parse(readFileSync(allowlistPath, "utf8"));
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: `invalid allowlist file: ${error.message}` }));
    process.exit(3);
  }
  for (const key of ["added", "removed"]) {
    if (!Array.isArray(allowlist[key])) {
      console.error(JSON.stringify({ ok: false, error: `allowlist.${key} must be an array` }));
      process.exit(3);
    }
  }
}

function entryMatches(entries, line) {
  return entries.some((entry) =>
    typeof entry === "string" && entry.startsWith("re:")
      ? new RegExp(entry.slice(3)).test(line)
      : entry === line,
  );
}

const [fromLines, toLines] = await Promise.all([fingerprint(fromUrl), fingerprint(toUrl)]);
const fromSet = new Set(fromLines);
const toSet = new Set(toLines);
const added = toLines.filter((line) => !fromSet.has(line));
const removed = fromLines.filter((line) => !toSet.has(line));
const unexpectedAdded = added.filter((line) => !entryMatches(allowlist.added, line));
const unexpectedRemoved = removed.filter((line) => !entryMatches(allowlist.removed, line));

const result = {
  ok: unexpectedAdded.length === 0 && unexpectedRemoved.length === 0,
  from: masked(fromUrl),
  to: masked(toUrl),
  counts: {
    fromEntries: fromLines.length,
    toEntries: toLines.length,
    added: added.length,
    removed: removed.length,
    unexpectedAdded: unexpectedAdded.length,
    unexpectedRemoved: unexpectedRemoved.length,
  },
  added,
  removed,
  unexpectedAdded,
  unexpectedRemoved,
};
console.log(JSON.stringify(result, null, 2));

process.exit(result.ok ? 0 : 1);
