# scripts/db-rehearsal — disposable migration rehearsal + read-only preflight

Preparation artifacts for packet DB-02 (see
`docs/plan-database-printing-master-orchestration.md` Wave 1 and
`docs/plan-database-consolidation.md` section 9.2). Nothing here targets a
production or shared database. The runbook with full workflows lives at
`docs/db-rehearsal-runbook.md`.

## Contents

| Path | Purpose |
| --- | --- |
| `sql/01-table-row-counts.sql` | 8.1 per-table total/active/soft-deleted counts (28 tables) |
| `sql/02-settings-singletons.sql` | 8.2 singleton count = 1 for the three setting tables |
| `sql/03-subscribers.sql` | 8.3 subscriber invariants (no orphan user, active policy) |
| `sql/04-addon-ledger.sql` | 8.4 legacy JSON vs normalized ledger, credits consistency |
| `sql/05-images.sql` | 8.5 direct image IDs, join rows, duplicate pairs, orphan report |
| `sql/06-payments.sql` | 8.6 source XOR, lifetime cardinality, user/amount match, sale-status mapping |
| `sql/07-completion-timestamps.sql` | 8.7 placeholder-ready `completed_at` checks |
| `run-preflight.sh` | bash/psql runner, read-only transaction + timeout + rollback |
| `run-preflight.mjs` | Node runner equivalent (uses the transitive `pg` client) |
| `backfill-report-contract.ts` | DB-05 dry-run/report contract: shape, idempotency rule, exit codes |

## Safety properties

- Every SQL file is aggregate-only (`COUNT`/booleans). No row payloads, no PII
  columns, no secrets in output.
- The runners wrap everything in `BEGIN TRANSACTION READ ONLY` … `ROLLBACK`
  with a local `statement_timeout`, so a stray mutation would be rejected by
  PostgreSQL itself, and nothing commits even on success.
- Both runners refuse to run without `--confirm-disposable` and without
  `DATABASE_URL`. Connection URLs are only ever printed masked
  (`***:***@host/db`). Never `cat` `.env`; reference `.env.example` for the
  variable layout.

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
column set, e.g. `service_order."addonUsages"` JSONB). `07` self-detects that
`service_order.completed_at` does not exist yet and reports
`SKIPPED_COLUMN_NOT_PRESENT` until the Phase 2 expand migration lands.

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
histograms) are context, not gates.

## Runner exit codes

- `0` — all scripts executed, transaction rolled back
- `1` — a script failed (query error or statement timeout); runner stops at
  the first failure and still rolls back
- `64` — usage/config error (missing flag, missing `DATABASE_URL`, missing
  `psql`/`pg`)
- `66` — no SQL scripts found
