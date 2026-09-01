# Migration rehearsal runbook — packet DB-02

Status: **preparation complete; fresh replay PENDING** (no usable disposable
PostgreSQL on this machine at the time of writing — see
[8. Current status](#8-current-status)).

This runbook covers, for the Saijai Phareab database consolidation plan
(`docs/plan-database-consolidation.md`):

1. a read-only review of the migration chain, especially the overlap flagged
   between `20260519000000_db_audit_fixes` and `20260522000000_reconcile_schema`
2. three disposable-database options (Docker, local PostgreSQL, CI)
3. exact environment wiring and replay steps
4. how to run the read-only preflight/reconciliation scripts in
   `scripts/db-rehearsal/`
5. the backfill dry-run/report contract for packet DB-05

Hard rules, unchanged from the plans:

- Never run replay, preflight with a write credential, seed, or reset against
  production or any shared database.
- Never print, commit, or paste secret values; reference `.env.example` for the
  variable layout and never `cat` `.env`.
- Never edit an applied migration; every schema change is a new migration.
- There is no working lint command in this repository; do not invent one.

---

## 1. Migration chain review (read-only, no migration was modified)

- `prisma/migrations/` contains **47 migration directories** plus
  `migration_lock.toml` (48 entries). `prisma migrate` applies them in
  lexicographic timestamp order; the timestamps are unique and strictly
  increasing, so the application order is unambiguous.
- `pnpm exec prisma validate` passes on the current branch.
- The chain ends with feature removals (`20260818000000`–`20260818040000`)
  that drop tables/features added by earlier migrations (`line_rich_menu`,
  pickup confirmations, walk-in orders, delivery rounds). A fresh replay
  therefore creates and then drops these objects — expected, not an error.

### 1.1 The flagged overlap, in three migrations

| Migration | What it does |
| --- | --- |
| `20260505100000_add_package_expiry_notification` | creates `UNIQUE INDEX "package_expiry_notification_entitlementId_daysBefore_key"` on `("entitlementId", "daysBefore")` |
| `20260519000000_db_audit_fixes` | (a) adds `CHECK "payment_record_single_source"` enforcing at most one source FK (`memberEntitlementId`/`packageSaleId`/`serviceOrderId`) per payment; (b) creates indexes `service_order_status_deletedAt_createdAt_idx`, `service_order_quotationNo_idx`, `member_entitlement_customerId_status_idx`; (c) **drops** the `…_daysBefore_key` index and re-adds dedup as a `UNIQUE ("entitlementId", "daysBefore", "endAtSnapshot")` **constraint** |
| `20260519104500_audit_database` | renames the auto-generated constraint index `package_expiry_notification_entitlementId_daysBefore_endAtSnaps` to `…_endAtS_key` |
| `20260522000000_reconcile_schema` | **intentional no-op** (comments only) |

What actually happened: production had drifted from the migration history
(Basket removal and the db_audit_fixes index work had been applied by hand or
by `db push`). `20260522000000_reconcile_schema` records that reconciliation as
an empty migration instead of re-running the duplicated operations. The AGENTS.md
warning therefore resolves to: **on a fresh replay nothing is applied twice** —
the "overlap" exists only in the history bookkeeping, not in the executed SQL.

### 1.2 Replay risks observed during review

1. **63-character identifier truncation.** The constraint name
   `package_expiry_notification_entitlementId_daysBefore_endAtSnapshot_key`
   exceeds PostgreSQL's 63-byte identifier limit. `ALTER TABLE … ADD
   CONSTRAINT` auto-creates its backing index with the truncated name
   (`…_endAtSnaps`), and `20260519104500_audit_database` renames exactly that
   truncated name. This is deterministic on current PostgreSQL, but it is the
   most fragile step in the chain: if the constraint/index naming ever differs,
   the rename fails and `prisma migrate deploy` stops there. That failure mode
   is safe (no partial schema beyond the applied prefix) — record it and stop.
2. **Forward dependencies are satisfied.** The `payment_record_single_source`
   CHECK references `memberEntitlementId`/`packageSaleId`/`serviceOrderId`,
   all present since `20260331170742_v2` — no missing-column risk on replay.
3. **The no-op migration is also a claim.** Because `20260522000000_reconcile_schema`
   executes nothing, the fresh-replay schema equals the drifted production
   schema only via everything around it (including `20260807000000_sync_current_schema`,
   which creates `line_rich_menu` and drops a column default, later removed by
   `20260818030000_remove_rich_menu_feature`). Do not argue "history matches
   production" from the no-op alone — prove final-shape equality with
   `prisma migrate diff` (section 4, step 5).
4. **Create-then-drop pairs.** `line_rich_menu` (created `20260807000000`,
   dropped `20260818030000`) and other removed features mean the replayed
   schema must be compared against `prisma/schema.prisma`, not against any
   intermediate state.

---

## 2. Disposable database options

Pick whichever is available. The database must be disposable or an approved
restore copy; it must never be the production/shared instance. Use PostgreSQL
16 to match production expectations.

### Option A — Docker `postgres:16` (when the daemon works)

> Docker daemon is currently UNAVAILABLE on this machine (verified). Use this
> when it is restored.

```bash
docker run -d --name saijai-rehearsal-pg \
  -e POSTGRES_USER=rehearsal \
  -e POSTGRES_PASSWORD=rehearsal \
  -e POSTGRES_DB=rehearsal \
  -p 54329:5432 postgres:16

# wait for readiness
docker exec saijai-rehearsal-pg pg_isready -U rehearsal

# tear down when finished (data is disposable by design)
docker rm -f saijai-rehearsal-pg
```

### Option B — local PostgreSQL (Homebrew or Postgres.app)

> Verified absent on this machine right now: `psql`/`pg_ctl`/`initdb`/`postgres`
> are not on PATH; `/Applications/Postgres.app`, `/opt/homebrew/opt/postgresql*`,
> `/usr/local/opt/postgresql*`, and `/Library/PostgreSQL` do not exist. Use this
> option only after installing a local server; it must remain a
> rehearsal-only instance/port.

```bash
# Homebrew route (keep it off the default port 5432 to avoid collisions)
brew install postgresql@16
initdb -D /tmp/saijai-rehearsal-pg -U rehearsal
pg_ctl -D /tmp/saijai-rehearsal-pg -o "-p 54329" -l /tmp/saijai-rehearsal-pg.log start
createdb -U rehearsal -p 54329 rehearsal
# stop when finished
pg_ctl -D /tmp/saijai-rehearsal-pg stop
```

Postgres.app route: install from postgresapp.com, then use its `psql`/`bin`
tools with a dedicated `rehearsal` database on a dedicated port.

### Option C — CI route (GitHub Actions, document-only)

No `.github/` workflow was created. When replay evidence is needed and no
local engine exists, add a workflow equivalent to the sketch below (temporary
or hand-triggered; do not run it on shared secrets):

```yaml
name: migration-rehearsal
on: workflow_dispatch
jobs:
  replay:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: rehearsal
          POSTGRES_PASSWORD: rehearsal
          POSTGRES_DB: rehearsal
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U rehearsal"
          --health-interval 5s --health-timeout 5s --health-retries 10
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4   # version must satisfy the committed lockfile
      - uses: actions/setup-node@v4
        with:
          node-version: 24           # matches "engines" in package.json
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Replay full migration chain
        run: pnpm exec prisma migrate deploy
        env:
          DIRECT_URL: postgresql://rehearsal:rehearsal@localhost:5432/rehearsal
      - name: Migration status
        run: pnpm exec prisma migrate status
        env:
          DIRECT_URL: postgresql://rehearsal:rehearsal@localhost:5432/rehearsal
      - name: Schema equals prisma/schema.prisma
        run: |
          pnpm exec prisma migrate diff \
            --from-url "postgresql://rehearsal:rehearsal@localhost:5432/rehearsal" \
            --to-schema-datamodel prisma/schema.prisma \
            --script > schema-diff.sql
          test ! -s schema-diff.sql || { cat schema-diff.sql; exit 1; }
        env:
          DIRECT_URL: postgresql://rehearsal:rehearsal@localhost:5432/rehearsal
      - name: Read-only preflight/reconciliation
        run: ./scripts/db-rehearsal/run-preflight.sh --confirm-disposable
        env:
          DATABASE_URL: postgresql://rehearsal:rehearsal@localhost:5432/rehearsal
      - name: Read-only preflight (Node runner equivalent)
        run: node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable
        env:
          DATABASE_URL: postgresql://rehearsal:rehearsal@localhost:5432/rehearsal
```

These credentials are for a throwaway CI-side container only. Verify the exact
`prisma migrate diff` flags against the installed Prisma version at run time.

---

## 3. Environment wiring

`prisma.config.ts` wires Prisma CLI (migrations) to `DIRECT_URL`, while the
application runtime uses `DATABASE_URL` through the Prisma singleton. Both must
point at the **same disposable database** during a rehearsal.

```bash
# Example layout only — substitute the disposable target; never echo real secrets.
export DATABASE_URL="postgresql://rehearsal:rehearsal@localhost:54329/rehearsal"
export DIRECT_URL="$DATABASE_URL"
```

- `.env.example` documents the full variable layout; do not paste values from
  `.env` into terminals, logs, or this repository.
- If you temporarily repoint a local `.env` at the disposable database, restore
  it afterwards and never commit it.

## 4. Fresh replay procedure

```bash
# 0. record baseline evidence (no secrets)
git rev-parse HEAD
pnpm exec prisma --version

# 1. provision a disposable PostgreSQL (section 2) and export both URLs

# 2. replay the whole chain (47 migrations) — no --skip flags, no edits
pnpm exec prisma migrate deploy

# 3. confirm the recorded history
pnpm exec prisma migrate status

# 4. confirm the replayed schema equals prisma/schema.prisma
pnpm exec prisma migrate diff \
  --from-url "$DIRECT_URL" \
  --to-schema-datamodel prisma/schema.prisma --script > /tmp/schema-diff.sql
# expect an empty file; a non-empty diff is a finding, not something to fix by editing migrations

# 5. schema validation and generation still pass
pnpm exec prisma validate
pnpm exec prisma generate

# 6. read-only preflight/reconciliation against the replayed database
./scripts/db-rehearsal/run-preflight.sh --confirm-disposable
# Node equivalent: node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable
```

### Expected evidence to record (secret-free)

- commit SHA, branch, Prisma CLI version, PostgreSQL server version
  (`SELECT version();` — version string only)
- `prisma migrate deploy` full output (47 applied migrations, per-migration
  timing if verbose), or the exact failure statement if it stops
- `prisma migrate status` output ("Database schema is up to date!")
- the schema-diff result (expected: empty)
- the preflight JSON/rows output from `scripts/db-rehearsal/` (aggregate-only
  by construction) with the hard invariants called out as zero
- replay wall-clock duration, to size the production migration window later

## 5. Read-only preflight/reconciliation

Covered in `scripts/db-rehearsal/README.md`. Summary:

- `sql/01`…`sql/07` implement reconciliation checklist sections 8.1–8.7 of
  `docs/plan-database-consolidation.md`; every query is aggregate-only and
  safe inside a `READ ONLY` transaction.
- `07-completion-timestamps.sql` self-detects that `service_order.completed_at`
  does not exist yet and reports `SKIPPED_COLUMN_NOT_PRESENT`; after the DB-03
  expand migration it reports the real invariants.
- Runners enforce `--confirm-disposable`, `statement_timeout`
  (`--timeout-ms`/`PREFLIGHT_TIMEOUT_MS`), and `BEGIN TRANSACTION READ ONLY …
  ROLLBACK`.
- Use these same scripts against an approved **restore copy** for the
  "production-shape restore" rehearsal path (plan section 9.2 item 2); that
  path stays pending until a restore source exists (Phase 0 backup gate).

## 6. Backfill dry-run/report contract (preparation only — DB-05)

Frozen in `scripts/db-rehearsal/backfill-report-contract.ts`. Highlights:

- **Report shape** (`BackfillReport`): `operation`, `mode` (`dry-run` |
  `apply`), `cursor` (opaque resumable checkpoint), `startedAt`/`finishedAt`,
  `rowsScanned`, `rowsChanged`, `mismatches[]` (`checkId`, `subjectId`,
  aggregate-safe `detail`), `quarantine[]` (`subjectId`, `subjectPart`,
  `reason` ∈ {invalid-json, missing-entitlement, missing-image, unknown-shape,
  duplicate-semantics, source-row-missing}, `disposition`), `exitCode`.
- **Idempotency rule**: write only into empty/absent destination slots, skip
  when a semantically matching target row exists, never overwrite verified
  values, never mutate/delete source rows, never guess unprovable values —
  quarantine instead. Therefore a second `apply` run must report
  `rowsChanged = 0`; anything else blocks the gate (G3).
- **Exit codes**: `0` success (mismatch 0, quarantine empty or dispositioned);
  `1` mismatch threshold exceeded; `2` quarantine needs review; `3` aborted
  with rollback (no partial data left); `64` configuration/usage error.
- `dry-run` mode performs the identical scan/match logic with zero writes.

## 7. Third rehearsal path (rollback compatibility)

Plan section 9.2 item 3 (expand → dual-write → backfill → roll the app back)
requires the DB-03/DB-04 deliverables and cannot be exercised yet. It is listed
here so the path is not forgotten; run it on the same kind of disposable
database, never on production.

---

## 8. Current status

| Item | Status |
| --- | --- |
| Read-only migration chain review | done (section 1; no migration modified) |
| Read-only preflight/reconciliation scripts + runners | done (`scripts/db-rehearsal/`) |
| Disposable workflow documented (Docker / local / CI) | done (section 2) |
| Backfill report contract | done (section 6, TypeScript contract file) |
| **Fresh replay of the 47-migration chain** | **PENDING** |
| **Production-shape restore rehearsal** | **PENDING** (requires an approved backup/restore source) |

Why replay is pending: the Docker daemon is unavailable on this machine and no
local PostgreSQL server exists — verified missing: `psql`, `pg_ctl`, `initdb`,
`postgres` not on PATH; `/Applications/Postgres.app`, `/opt/homebrew/opt/postgresql*`,
`/usr/local/opt/postgresql*`, `/Library/PostgreSQL` all absent. No database was
installed, and no production/shared database was contacted. Unblock by any of:
starting the Docker daemon and using section 2 Option A, installing a local
PostgreSQL (Option B), or running the documented CI job (Option C). The first
successful replay should append its evidence under this section and in the
orchestration plan's execution ledger.
