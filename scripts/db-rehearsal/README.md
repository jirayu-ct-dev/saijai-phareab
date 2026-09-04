# scripts/db-rehearsal — disposable migration rehearsal + read-only preflight

Migration rehearsal, compatibility, preflight, and schema-comparison tools for
the database consolidation work. Nothing here targets a production or shared
database unless the separately approved production read-only mode is selected.
This README is the canonical runbook for these scripts.

`run-preflight.mjs` รองรับสอง schema profiles:

- `--profile current` ตรวจ schema หลัง migration `20260905000000_consolidate_current_database_flow` และถูกใช้โดย `run-rehearsal.sh`
- `--profile legacy` เป็นค่า default สำหรับหลักฐาน/backfill ก่อน contract เท่านั้น

หลัง apply contract แล้วต้องระบุ `--profile current`; legacy profile อ้างตารางและคอลัมน์ที่ถูกลบไปแล้ว
`run-backfill-rehearsal.sh` เป็นหลักฐานของ DB-05 ก่อน contract และไม่ใช่ runner สำหรับ current HEAD; ใช้ `run-rehearsal.sh` สำหรับ schema ปัจจุบัน

## Direct Print schema removal

`run-direct-print-drop-rehearsal.sh` recreates the schema immediately before
the forward-only printer drop, loads synthetic printer/job rows, records an
aggregate inventory, verifies no unexpected FK/view dependency, applies the
drop, compares count+checksum signatures for every business table, checks the
result against `prisma/schema.prisma`, and proves the pre-drop backup restores.

```bash
REHEARSAL_KEEP_STAGE=1 bash scripts/db-rehearsal/run-direct-print-drop-rehearsal.sh
```

`sql/08-printer-drop-preflight.sql` is the separate read-only production
preflight. It reports aggregates only and does not authorize the migration.

## Contents

| Path | Purpose |
| --- | --- |
| `sql/00-server-and-migration-context.sql` | 8.0 PostgreSQL/read-only state and aggregate Prisma migration status |
| `sql/01-table-row-counts.sql` | 8.1 per-table total/active/soft-deleted counts (28 tables) |
| `sql/02-settings-singletons.sql` | 8.2 singleton count = 1 for the three setting tables |
| `sql/03-subscribers.sql` | 8.3 subscriber invariants (no orphan user, active policy) |
| `sql/04-addon-ledger.sql` | 8.4 legacy JSON vs normalized ledger, credits consistency |
| `sql/05-images.sql` | 8.5 direct image IDs, join rows, duplicate pairs, orphan report |
| `sql/06-payments.sql` | 8.6 source XOR, lifetime cardinality, user/amount match, sale-status mapping |
| `sql/07-completion-timestamps.sql` | 8.7 placeholder-ready `"completedAt"` checks (cutover-gated) |
| `run-preflight.sh` | bash/psql runner, read-only transaction + timeout + rollback |
| `run-preflight.mjs` | Node runner (transitive `pg` client) with `--enforce` invariant gates |
| `approval-b-attestation.example.json` | non-secret shape for operator/platform backup, PITR, and runtime attestation |
| `evaluate-approval-b.mjs` | fail-closed aggregate Approval B evaluator for SQL report + operator attestation |
| `schema-diff.mjs` | normalized schema fingerprint + allowlisted diff between two databases |
| `schema-allowlist.json` | expected schema differences (empty = must be identical) |
| `fixture/01-synthetic-fixture.sql` | dedicated synthetic non-PII dataset satisfying every hard invariant |
| `fixture/02-violations-overlay.sql` | negative self-test overlay: gate must exit 3 after loading |
| `sql-current/` | aggregate-only invariants สำหรับ consolidated schema |
| `fixture/04-current-fixture.sql` | synthetic non-PII dataset สำหรับ consolidated schema |
| `fixture/05-current-violations-overlay.sql` | negative self-test ของ current profile |
| `run-rehearsal.sh` | one-command rehearsal on a disposable `postgres:16` container (see below) |
| `run-old-binary-drill.sh` | actual pre-consolidation Nitro binary + HTTP rollback drill for G2 |
| `old-binary-http-check.mjs` | guarded Better Auth login, legacy read/write, and preservation assertions used by the old-binary drill |
| `backfill-report-contract.ts` | DB-05 dry-run/report contract: shape, idempotency rule, exit codes |

## Safety properties

- Every SQL file is aggregate-only (`COUNT`/booleans). No row payloads, no PII
  columns, no secrets in output.
- The runners wrap everything in `BEGIN TRANSACTION READ ONLY` … `ROLLBACK`
  with a local `statement_timeout`, so a stray mutation would be rejected by
  PostgreSQL itself, and nothing commits even on success.
- Both runners refuse to run without explicit target confirmation and without
  `DATABASE_URL`. The Node runner additionally supports the separately approved
  production read-only mode described below. Disposable connection URLs are
  printed masked (`***:***@host/db`); production mode prints no host/database
  details. Never `cat` `.env`; reference `.env.example` for the variable layout.

## Usage

```bash
# from an environment that has psql and a disposable database
DATABASE_URL="postgresql://USER:PASSWORD@DISPOSABLE_HOST:5432/DISPOSABLE_DB" \
  ./scripts/db-rehearsal/run-preflight.sh --confirm-disposable

# Node equivalent
DATABASE_URL="..." node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable
```

The SQL scripts assume the schema produced by replaying the full
`prisma/migrations` chain on the current branch (they reference the consolidated
column set, e.g. `service_order."addonUsages"` JSONB). `07` self-detects the
Prisma-mapped `service_order."completedAt"` column and reports
`SKIPPED_COLUMN_NOT_PRESENT` only when run against a pre-DB-03 schema.

## Approval B production read-only preflight

Do not use this mode without a separate, explicit Approval B. It forces
`--enforce`, requires a sanitized approval reference and a new absolute report
path outside the repository, identifies its session with a fixed application name, sets
`default_transaction_read_only=on`, opens a repeatable-read read-only
transaction, verifies `transaction_read_only=on`, applies statement/lock
timeouts, requires a non-symlink PEM CA file, enables TLS peer verification,
records only its SHA-256, and writes the report mode `0600`. The runner refuses to overwrite
an existing report or follow an existing symlink. Production connection/query
failures expose only a bounded driver error code, not the driver message.

```bash
DATABASE_URL="...loaded without printing..." \
PREFLIGHT_TIMEOUT_MS=30000 \
PREFLIGHT_SSL_ROOT_CERT=/absolute/path/to/approved-ca.pem \
node scripts/db-rehearsal/run-preflight.mjs \
  --confirm-production-read-only \
  --approval-reference chat-YYYY-MM-DD-g3-b \
  --report-file /absolute/restricted/path/production-preflight.json
```

The SQL evidence covers PostgreSQL version/read-only state, aggregate Prisma
migration status, table counts, and application invariants. Database SQL cannot
prove the platform's PITR/backup freshness or enumerate every deployed
application/worker. Approval B therefore also requires operator evidence for
those two items; do not infer them from `pg_stat_activity` or from a clean SQL
report. This mode authorizes no migration, backfill, deploy, restart, dump,
restore, seed, settings resync, or DB-06 work.

Copy `approval-b-attestation.example.json` to the approved restricted evidence
directory outside the repository and have the operator/platform owner fill it.
Never edit the example into real production evidence inside the repository.
The evaluator requires the attestation and latest backup to be no older than
24 hours, the latest PITR recovery point and runtime inventory to be no older
than 1 hour, and timestamps not to be more than 5 minutes in the future. It
also requires every active app/worker to be on the compatibility revision (or
an explicitly attested maintenance window with zero active runtimes).

```bash
node scripts/db-rehearsal/evaluate-approval-b.mjs \
  --preflight-report /absolute/restricted/path/production-preflight.json \
  --operator-attestation /absolute/restricted/path/operator-attestation.json \
  --approval-reference chat-YYYY-MM-DD-g3-b \
  --out /absolute/restricted/path/approval-b-summary.json \
  --confirm-production-evidence
```

The evaluator writes a new aggregate-only mode-`0600` summary and exits `0`
for `APPROVAL_B_PASS`, `3` for `APPROVAL_B_BLOCKED`, `1` for invalid/unreadable
evidence, or `64` for unsafe/missing CLI arguments. It never copies operator or
deployment identifiers into the summary. It also recomputes row/NOTICE
invariants from the SQL evidence instead of trusting only the runner's
`invariantFailures` summary, and rejects duplicate, missing, or unreviewed SQL
evidence files.

## Expected baseline

Compare each result with the production snapshot in
`docs/plan-database-consolidation.md` section 2.2 (dated 2026-09-01 — a
snapshot, not a constant; always re-baseline with a fresh preflight before a
migration). Hard invariants that must be 0:

- `subscriber_without_user`, `active_subscriber_policy` violations
- `ledger_refunded_without_deducted`, `ledger_rows_without_entitlement`,
  `credits_json_vs_ledger_mismatched_pairs`
- `duplicate_active_item_image_pairs`, `join_rows_without_image_row`,
  `item_direct_image_id_without_image_row`
- every `payment_*` `violating_rows` column (zero/multiple source, duplicate
  source, user/amount mismatch, mapping mismatch, PAID invariants, delete-state
  symmetry)

Report-only values (`image_active_orphans_report_only`, JSON non-empty counts,
histograms) are context, not gates. Rows that carry both `violating_rows` and a
`pass` column are context even when the count is non-zero (e.g.
`subscriber_totals`) — the `pass` column is authoritative there.

## Invariant enforcement (`--enforce`)

Without flags the Node runner only reports. With `--enforce` it evaluates
every check and exits `3` when any of the following fails:

- a result row with `pass = false`
- a result row with `violating_rows > 0` and no `pass` column
- a check in the runner's zero-required list reporting a non-zero value
  (malformed add-on JSON, ledger refund without deduction, dangling
  entitlement, image/join integrity, credits mismatch)
- a DO-block invariant surfaced via NOTICE (`check_id=… value=… pass=…`,
  produced by `07-completion-timestamps.sql`)

`07-completion-timestamps.sql` is cutover-aware: legacy `COMPLETED` orders
keep `completedAt = NULL` (plan F5) and are report-only. The hard
post-cutover rule (COMPLETED orders created after the cutover must be
stamped) activates only when `REHEARSAL_COMPLETED_AT_CUTOVER` (ISO-8601) is
set, which the runner forwards as a transaction-local GUC.

## One-command rehearsal

`run-rehearsal.sh` requires Docker and performs the full evidence pipeline on
a disposable `postgres:16` container (default `127.0.0.1:5439`, never a
shared host):

1. fresh `prisma migrate deploy` replay of the whole migration chain
2. load `fixture/01-synthetic-fixture.sql`
3. `run-preflight.mjs --enforce` (must pass)
4. schema fingerprint + `pg_dump`
5. restore into a second database
6. `--enforce` preflight on the restore + report equality + `schema-diff.mjs`
   with the (empty) allowlist — restore must be identical
7. negative self-test: load `fixture/02-violations-overlay.sql` and require
   the gate to exit `3`

```bash
./scripts/db-rehearsal/run-rehearsal.sh            # full pipeline
REHEARSAL_KEEP_STAGE=1 ./scripts/db-rehearsal/run-rehearsal.sh   # keep evidence dir
```

`schema-diff.mjs` can also be used standalone to review an expand migration:

```bash
node scripts/db-rehearsal/schema-diff.mjs fingerprint --url "$OLD_URL" --out old.txt --confirm-disposable
node scripts/db-rehearsal/schema-diff.mjs diff --from "$OLD_URL" --to "$NEW_URL" \
  --allowlist scripts/db-rehearsal/schema-allowlist.json --confirm-disposable
```

The allowlist is JSON `{ "added": [...], "removed": [...] }`; an entry is an
exact fingerprint line or `re:`-prefixed regex. It must stay empty for
dump/restore equality checks and contain only the reviewed additive changes
for a migration review. Column fingerprints intentionally exclude
`ordinal_position`: dropped columns leave permanent attnum gaps that
`pg_dump` compresses on restore, and Prisma addresses columns by name.

## DB-05 backfill runner

`backfill/backfill.mts` implements the three idempotent Phase-4 backfills
(settings consolidation, add-on JSON → ledger, direct image → join row) as
`dry-run`/`apply` runs. It refuses anything but a loopback `rehearsal*`
database, imports the application's own `parseAddonUsages` so classification
cannot drift from application semantics, writes only into empty destination
slots, never mutates or clears source rows, and emits a report conforming to
`backfill-report-contract.ts` (exit `0` ok / `1` mismatch / `2` unapproved
quarantine / `3` aborted / `64` usage).

```bash
pnpm exec tsx scripts/db-rehearsal/backfill/backfill.mts \
  --operation addon-usage-json-to-ledger --mode dry-run \
  --url "$REHEARSAL_URL" --confirm-disposable --report-file report.json
```

Pure planning helpers live in `backfill/plan.mts` and are unit-tested in
`tests/server/backfillPlanning.test.ts`. The add-on operation is exported for
`tests/server/backfillAddonRunner.test.ts`, which pins the order-level
fail-closed rule: an order with any parseable entry whose entitlement no
longer exists is quarantined whole — no ledger row is created for any pair of
that order. `backfill/legacy-read-check.mts` re-reads the legacy rows
(shop/notification settings, legacy JSON, direct image ids, legacy
`business_setting` columns) to prove the old read paths still work after a
backfill.

`run-backfill-rehearsal.sh` runs the full 12-stage DB-05 rehearsal on a
disposable container: fresh 48-migration replay → fixture → enforced
preflight → dry-run (shape + quarantine = 0) → apply → enforced preflight
(gap checks zero) → second apply (`rowsChanged` = 0) → dump/restore →
preflight + report equality + allowlist diff on the restore → legacy
read-path check → negative self-tests (parser-invalid overlay must quarantine
with exit `2`; the parser-clean missing-entitlement order `fxso7` must
quarantine `missing-entitlement` only, and an `apply` on the negative copy
must change 0 rows with no ledger rows for `fxso6`/`fxso7`; settings mismatch
must exit `1`; violations overlay must make the preflight gate exit `3`) →
both partial unique indexes still present.

## Actual old-application binary drill

`run-old-binary-drill.sh` accepts an explicit Git revision and rejects one
that already contains `AppSetting`, `completedAt`, DB-04 telemetry, or DB-05
backfill code. It never checks out over the current tree: the old source comes
from `git archive` and is built with its own frozen lockfile.

```bash
REHEARSAL_KEEP_STAGE=1 ./scripts/db-rehearsal/run-old-binary-drill.sh \
  --old-revision 8d87759298fec3030313802b63d33416d4da910f \
  --confirm-disposable
```

The 13 stages create a unique loopback PostgreSQL 16 container, replay all 48
current migrations, load the non-PII fixture, apply every DB-05 operation and
prove second-apply idempotency, fingerprint the schema, install/generate/build
the old application, start its real `.output/server/index.mjs`, and call its
public and authenticated HTTP APIs. Final checks require unchanged schema and
domain preservation counts, both partial indexes, clean enforced preflight,
no server migration attempt, unchanged current HEAD/status, and cleanup.

The old-only write deliberately leaves target settings stale. Return to the
read-old compatibility application and re-save the changed settings through
its admin API before DB-06. A DB-05 dry-run reports that conflict and refuses
to overwrite it, as designed.

## Approved production-shape restore rehearsal (G3 preparation)

`run-production-shape-rehearsal.sh` accepts only one explicitly approved,
checksummed PostgreSQL custom-format archive. It never connects to the source
database or reads `.env`: the archive is mounted read-only into a unique
loopback PostgreSQL container. The runner validates the complete archive, then
restores only the application-owned `public` schema. Provider-managed Supabase
schemas and extensions (for example `supabase_vault`) are deliberately excluded
because DB-03/DB-05 and all schema fingerprints operate only on `public`, and
the disposable vanilla PostgreSQL image does not provide those extensions. It
then applies pending migrations with timeouts, requires the before/after delta to match
`schema-db03-expand-allowlist.json`, compares the migrated copy with a fresh
canonical replay using `schema-g3-production-allowlist.json`, runs preflight and all DB-05 operations, proves second-apply
and final-dry-run idempotency, and emits an aggregate-only G3 verdict.

The production allowlist contains one exact, behavior-equivalent historical
difference: production has the valid unique index for package-expiry
notifications but no corresponding `pg_constraint` row. Prisma reports no
datamodel diff for that key. The aggregate verdict records the one allowed
removal, while any other schema difference still blocks the run. The empty
`schema-allowlist.json` remains mandatory for ordinary dump/restore equality.

Raw backfill evidence can contain database row identifiers and is kept only
in a mode-0700 temporary directory when requested or when a run fails. The
archive and raw evidence must never be committed. Passing this rehearsal only
provides evidence for a separately approved production operation; it does not
authorize production migration, backfill, deploy, restart, or read cutover.

## Runner exit codes

- `0` — all scripts executed, transaction rolled back
- `1` — a script failed (query error or statement timeout); runner stops at
  the first failure and still rolls back
- `3` — `--enforce` invariant failure (see above)
- `64` — usage/config error (missing flag, missing `DATABASE_URL`, missing
  `psql`/`pg`)
- `66` — no SQL scripts found
