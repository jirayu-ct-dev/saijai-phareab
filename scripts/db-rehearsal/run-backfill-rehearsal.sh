#!/usr/bin/env bash
# run-backfill-rehearsal.sh — DB-05 idempotent backfill rehearsal on a
# disposable PostgreSQL 16 container. NEVER targets production or a shared
# database.
#
# Pipeline (runbook: scripts/db-rehearsal/README.md, DB-05 verification):
#   1. fresh `prisma migrate deploy` replay of the full migration chain (DB A)
#   2. load the synthetic non-PII fixture
#   3. preflight --enforce on A
#   4. backfill dry-run (all 3 operations) — report shape + quarantine = 0
#   5. backfill apply (all 3 operations)
#   6. preflight --enforce on A after apply (backfill gaps must be closed)
#   7. backfill apply round two — rowsChanged MUST be 0 (idempotency)
#   8. idle dry-run on A (equality baseline for the restore check)
#   9. schema fingerprint + pg_dump A -> restore into DB B
#  10. on B: preflight --enforce + idle dry-run equality + allowlist schema diff
#  11. negative self-tests on B: backfill-negative overlay must make the
#      backfill fail closed (exit 2 quarantine / exit 1 mismatch) and the
#      violations overlay must make the preflight gate exit 3
#  12. partial unique indexes still present on both databases
#
# Usage:
#   scripts/db-rehearsal/run-backfill-rehearsal.sh
#
# Environment overrides:
#   REHEARSAL_PG_IMAGE / REHEARSAL_PG_PORT / REHEARSAL_KEEP_STAGE
#
# Exit codes: 0 all stages passed, 1 any stage failed (evidence kept).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$REPO_ROOT/scripts/db-rehearsal"
PG_IMAGE="${REHEARSAL_PG_IMAGE:-postgres:16}"
PG_PORT="${REHEARSAL_PG_PORT:-5439}"
PG_USER="postgres"
PG_PASSWORD="rehearsal"
DB_A="rehearsal_a"
DB_B="rehearsal_b"
CONTAINER="saijai-backfill-pg-$(date +%s)"
STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/saijai-backfill-rehearsal.XXXXXX")"

DB_A_URL="postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${DB_A}"
DB_B_URL="postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${DB_B}"

OPERATIONS=(settings-consolidation addon-usage-json-to-ledger item-photo-direct-to-join)

REHEARSAL_FAILED=0

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  if [[ "${REHEARSAL_KEEP_STAGE:-}" != "1" && "$REHEARSAL_FAILED" -eq 0 ]]; then
    rm -rf "$STAGE_DIR"
  fi
}
trap cleanup EXIT

log() { printf '\n[backfill-rehearsal] %s\n' "$*"; }
fail() { printf '\n[backfill-rehearsal] FAIL: %s\n' "$*" >&2; REHEARSAL_FAILED=1; }

# backfill <url> <mode> <operation> <out-log> ; sets BACKFILL_EXIT
backfill() {
  local url="$1" mode="$2" operation="$3" out="$4"
  set +e
  (cd "$REPO_ROOT" \
    && pnpm exec tsx scripts/db-rehearsal/backfill/backfill.mts \
        --operation "$operation" --mode "$mode" --url "$url" \
        --confirm-disposable --report-file "$out.json") >"$out" 2>&1
  BACKFILL_EXIT=$?
  set -e
}

log "evidence directory: $STAGE_DIR"
log "starting disposable container $CONTAINER ($PG_IMAGE on 127.0.0.1:$PG_PORT)"

docker run -d --name "$CONTAINER" \
  -e POSTGRES_USER="$PG_USER" -e POSTGRES_PASSWORD="$PG_PASSWORD" \
  -e POSTGRES_DB="$DB_A" \
  -p "127.0.0.1:${PG_PORT}:5432" "$PG_IMAGE" >/dev/null

for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U "$PG_USER" -d "$DB_A" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U "$PG_USER" -d "$DB_A" >/dev/null \
  || { fail "postgres container did not become ready"; exit 1; }
log "postgres is ready"

psql_a() { docker exec -i "$CONTAINER" psql -U "$PG_USER" -d "$DB_A" -v ON_ERROR_STOP=1 "$@"; }
psql_b() { docker exec -i "$CONTAINER" psql -U "$PG_USER" -d "$DB_B" -v ON_ERROR_STOP=1 "$@"; }

# ---- stage 1: fresh migration replay --------------------------------------
log "stage 1/12: fresh prisma migrate deploy replay of the full migration chain"
if ! (cd "$REPO_ROOT" \
      && DATABASE_URL="$DB_A_URL" DIRECT_URL="$DB_A_URL" \
      pnpm exec prisma migrate deploy) >"$STAGE_DIR/migrate-deploy.log" 2>&1; then
  fail "prisma migrate deploy failed — see $STAGE_DIR/migrate-deploy.log"
  exit 1
fi
APPLIED=$(grep -c 'Applying migration' "$STAGE_DIR/migrate-deploy.log" || true)
echo "$APPLIED" >"$STAGE_DIR/migrations-applied.count"
if [[ "$APPLIED" -ne 48 ]]; then
  fail "expected 48 migrations in the chain, applied $APPLIED"
  exit 1
fi
log "applied $APPLIED migrations"

# ---- stage 2: synthetic fixture -------------------------------------------
log "stage 2/12: loading synthetic non-PII fixture"
psql_a -q <"$SCRIPT_DIR/fixture/01-synthetic-fixture.sql" >"$STAGE_DIR/fixture.log" 2>&1 \
  || { fail "fixture load failed — see $STAGE_DIR/fixture.log"; exit 1; }

# ---- stage 3: enforced preflight on A --------------------------------------
log "stage 3/12: preflight --enforce on the replayed database"
if ! (cd "$REPO_ROOT" \
      && DATABASE_URL="$DB_A_URL" \
      node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable --enforce \
        --report-file "$STAGE_DIR/preflight-before.json") \
      >"$STAGE_DIR/preflight-before.log" 2>&1; then
  fail "preflight on A failed — see $STAGE_DIR/preflight-before.log"
  exit 1
fi

# ---- stage 4: backfill dry-run (report shape, no quarantine) ---------------
log "stage 4/12: backfill dry-run for all operations"
for op in "${OPERATIONS[@]}"; do
  backfill "$DB_A_URL" dry-run "$op" "$STAGE_DIR/dry-$op"
  if [[ "$BACKFILL_EXIT" -ne 0 ]]; then
    fail "dry-run $op expected exit 0, got $BACKFILL_EXIT — see $STAGE_DIR/dry-$op.log"
    exit 1
  fi
done
node -e '
  const fs = require("node:fs");
  const REQUIRED = ["operation","mode","cursor","startedAt","finishedAt","rowsScanned","rowsChanged","mismatches","quarantine","exitCode"];
  for (const path of process.argv.slice(1)) {
    const r = JSON.parse(fs.readFileSync(path, "utf8"));
    for (const key of REQUIRED) if (!(key in r)) throw new Error(`${path}: missing ${key}`);
    if (r.mode !== "dry-run") throw new Error(`${path}: wrong mode`);
    if (r.mismatches.length !== 0 || r.quarantine.length !== 0) {
      throw new Error(`${path}: clean fixture must not quarantine or mismatch`);
    }
    if (r.rowsChanged === 0) throw new Error(`${path}: fixture has nothing to backfill — check the fixture`);
  }
  console.log("dry-run reports: shape ok, quarantine 0, unknown 0");
' "$STAGE_DIR"/dry-*.json >"$STAGE_DIR/dry-run-shape.log" 2>&1 \
  || { fail "dry-run report shape check failed — see $STAGE_DIR/dry-run-shape.log"; exit 1; }
cat "$STAGE_DIR/dry-run-shape.log"

# ---- stage 5: backfill apply ------------------------------------------------
log "stage 5/12: backfill apply for all operations"
for op in "${OPERATIONS[@]}"; do
  backfill "$DB_A_URL" apply "$op" "$STAGE_DIR/apply-$op"
  if [[ "$BACKFILL_EXIT" -ne 0 ]]; then
    fail "apply $op expected exit 0, got $BACKFILL_EXIT — see $STAGE_DIR/apply-$op.log"
    exit 1
  fi
done
node -e '
  const fs = require("node:fs");
  const expected = { "settings-consolidation": 1, "addon-usage-json-to-ledger": 2, "item-photo-direct-to-join": 1 };
  for (const [op, rows] of Object.entries(expected)) {
    const r = JSON.parse(fs.readFileSync(process.argv[1] + "/apply-" + op + ".json", "utf8"));
    if (r.rowsChanged !== rows) throw new Error(`${op}: expected rowsChanged ${rows}, got ${r.rowsChanged}`);
  }
  console.log("apply reports: rowsChanged match the fixture targets");
' "$STAGE_DIR" >"$STAGE_DIR/apply-counts.log" 2>&1 \
  || { fail "apply counts differ from the fixture targets — see $STAGE_DIR/apply-counts.log"; exit 1; }
cat "$STAGE_DIR/apply-counts.log"

# ---- stage 6: preflight after apply -----------------------------------------
log "stage 6/12: preflight --enforce on A after apply (backfill gaps must be closed)"
if ! (cd "$REPO_ROOT" \
      && DATABASE_URL="$DB_A_URL" \
      node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable --enforce \
        --report-file "$STAGE_DIR/preflight-after.json") \
      >"$STAGE_DIR/preflight-after.log" 2>&1; then
  fail "preflight on A after apply failed — see $STAGE_DIR/preflight-after.log"
  exit 1
fi
node -e '
  const fs = require("node:fs");
  const report = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  const values = {};
  for (const file of report.files) for (const row of file.rows) values[row.check_id] = row.value;
  for (const check of ["json_orders_without_ledger_rows", "item_direct_image_id_without_join_row", "credits_json_vs_ledger_mismatched_pairs", "ledger_refunded_without_deducted"]) {
    if (values[check] !== "0") throw new Error(`${check} = ${values[check]}, expected 0 after apply`);
  }
  console.log("backfill gap checks are all zero after apply");
' "$STAGE_DIR/preflight-after.json" >"$STAGE_DIR/post-apply-gaps.log" 2>&1 \
  || { fail "backfill gap checks not zero — see $STAGE_DIR/post-apply-gaps.log"; exit 1; }
cat "$STAGE_DIR/post-apply-gaps.log"

# ---- stage 7: idempotency (apply round two) ---------------------------------
log "stage 7/12: backfill apply round two — rowsChanged must be 0"
for op in "${OPERATIONS[@]}"; do
  backfill "$DB_A_URL" apply "$op" "$STAGE_DIR/apply2-$op"
  if [[ "$BACKFILL_EXIT" -ne 0 ]]; then
    fail "apply round two $op expected exit 0, got $BACKFILL_EXIT — see $STAGE_DIR/apply2-$op.log"
    exit 1
  fi
done
node -e '
  const fs = require("node:fs");
  for (const path of process.argv.slice(1)) {
    const r = JSON.parse(fs.readFileSync(path, "utf8"));
    if (r.rowsChanged !== 0) throw new Error(`${path}: rowsChanged ${r.rowsChanged}, expected 0`);
  }
  console.log("second apply changed 0 rows for all operations");
' "$STAGE_DIR"/apply2-*.json >"$STAGE_DIR/idempotency.log" 2>&1 \
  || { fail "idempotency violated — see $STAGE_DIR/idempotency.log"; exit 1; }
cat "$STAGE_DIR/idempotency.log"

# ---- stage 8: idle dry-run baseline -----------------------------------------
log "stage 8/12: idle dry-run on A (equality baseline for the restored copy)"
for op in "${OPERATIONS[@]}"; do
  backfill "$DB_A_URL" dry-run "$op" "$STAGE_DIR/idle-$op"
  if [[ "$BACKFILL_EXIT" -ne 0 ]]; then
    fail "idle dry-run $op expected exit 0, got $BACKFILL_EXIT"
    exit 1
  fi
done

# ---- stage 9: fingerprint + dump + restore ----------------------------------
log "stage 9/12: fingerprinting schema and dumping database A, restoring into B"
(cd "$REPO_ROOT" \
  && node scripts/db-rehearsal/schema-diff.mjs fingerprint \
      --url "$DB_A_URL" --out "$STAGE_DIR/schema-a.txt" --confirm-disposable) \
  >"$STAGE_DIR/fingerprint-a.log" 2>&1 \
  || { fail "schema fingerprint of A failed"; exit 1; }
docker exec "$CONTAINER" pg_dump -U "$PG_USER" --no-owner --no-privileges "$DB_A" \
  >"$STAGE_DIR/rehearsal-dump.sql"
docker exec "$CONTAINER" psql -U "$PG_USER" -c "CREATE DATABASE \"$DB_B\"" >/dev/null
psql_b -q <"$STAGE_DIR/rehearsal-dump.sql" >"$STAGE_DIR/restore.log" 2>&1 \
  || { fail "restore failed — see $STAGE_DIR/restore.log"; exit 1; }

# ---- stage 10: restored copy verification ------------------------------------
log "stage 10/12: preflight, dry-run equality and schema diff on the restored copy"
if ! (cd "$REPO_ROOT" \
      && DATABASE_URL="$DB_B_URL" \
      node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable --enforce \
        --report-file "$STAGE_DIR/preflight-b.json") \
      >"$STAGE_DIR/preflight-b.log" 2>&1; then
  fail "preflight on restored B failed — see $STAGE_DIR/preflight-b.log"
  exit 1
fi
for op in "${OPERATIONS[@]}"; do
  backfill "$DB_B_URL" dry-run "$op" "$STAGE_DIR/restore-$op"
  if [[ "$BACKFILL_EXIT" -ne 0 ]]; then
    fail "dry-run on restored B ($op) expected exit 0, got $BACKFILL_EXIT"
    exit 1
  fi
done
node -e '
  const fs = require("node:fs");
  const strip = (p) => {
    const r = JSON.parse(fs.readFileSync(p, "utf8"));
    delete r.startedAt; delete r.finishedAt;
    return r;
  };
  for (const op of ["settings-consolidation", "addon-usage-json-to-ledger", "item-photo-direct-to-join"]) {
    const a = JSON.stringify(strip(process.argv[1] + "/idle-" + op + ".json"), null, 0);
    const b = JSON.stringify(strip(process.argv[1] + "/restore-" + op + ".json"), null, 0);
    if (a !== b) throw new Error(`${op}: backfill reports differ after dump/restore`);
  }
  console.log("backfill reports identical after dump/restore (ignoring timestamps)");
' "$STAGE_DIR" >"$STAGE_DIR/restore-equality.log" 2>&1 \
  || { fail "restore report equality failed — see $STAGE_DIR/restore-equality.log"; exit 1; }
cat "$STAGE_DIR/restore-equality.log"
(cd "$REPO_ROOT" \
  && node scripts/db-rehearsal/schema-diff.mjs diff \
      --from "$DB_A_URL" --to "$DB_B_URL" \
      --allowlist "$SCRIPT_DIR/schema-allowlist.json" --confirm-disposable) \
  >"$STAGE_DIR/schema-diff-restore.json" 2>&1 \
  || { fail "schema diff A vs B not clean — see $STAGE_DIR/schema-diff-restore.json"; exit 1; }

# ---- stage 11: rollback rehearsal — old read paths on the backfilled copy ----
log "stage 11/12: legacy read paths must still work on the backfilled database"
if ! (cd "$REPO_ROOT" \
      && pnpm exec tsx scripts/db-rehearsal/backfill/legacy-read-check.mts \
          --url "$DB_B_URL" --confirm-disposable) \
      >"$STAGE_DIR/legacy-read-check.log" 2>&1; then
  fail "legacy read-path check failed — see $STAGE_DIR/legacy-read-check.log"
  exit 1
fi
tail -n 1 "$STAGE_DIR/legacy-read-check.log"

# ---- stage 12: negative self-tests (fail closed) -----------------------------
log "stage 12/12: negative self-tests — backfill must quarantine, gate must exit 3"
psql_b -q <"$SCRIPT_DIR/fixture/03-backfill-negative-overlay.sql" \
  >"$STAGE_DIR/backfill-overlay.log" 2>&1 \
  || { fail "backfill negative overlay failed to load"; exit 1; }

backfill "$DB_B_URL" dry-run addon-usage-json-to-ledger "$STAGE_DIR/neg-addon"
if [[ "$BACKFILL_EXIT" -ne 2 ]]; then
  fail "negative add-on dry-run expected exit 2 (quarantine), got $BACKFILL_EXIT — see $STAGE_DIR/neg-addon.log"
  exit 1
fi
node -e '
  const fs = require("node:fs");
  const r = JSON.parse(fs.readFileSync(process.argv[1] + ".json", "utf8"));
  const reasons = r.quarantine.map((q) => q.reason).sort();
  for (const reason of ["invalid-json", "unknown-shape", "missing-entitlement"]) {
    if (!reasons.includes(reason)) throw new Error(`missing quarantine reason ${reason}`);
  }
  const fxso7 = r.quarantine.filter((q) => q.subjectId === "fxso7");
  if (fxso7.length === 0 || fxso7.some((q) => q.reason !== "missing-entitlement")) {
    throw new Error("fxso7 must be quarantined with reason missing-entitlement only");
  }
  if (r.rowsChanged !== 0) throw new Error("a quarantined order must not be migrated at all");
  console.log("negative add-on dry-run quarantined", r.quarantine.length, "entries and changed 0 rows");
' "$STAGE_DIR/neg-addon" >"$STAGE_DIR/neg-addon-check.log" 2>&1 \
  || { fail "negative add-on quarantine content wrong — see $STAGE_DIR/neg-addon-check.log"; exit 1; }
cat "$STAGE_DIR/neg-addon-check.log"

# Apply on the negative copy: the quarantined orders must stay untouched —
# rowsChanged 0 and no ledger row materialized for fxso7 (order-level fail
# closed).
backfill "$DB_B_URL" apply addon-usage-json-to-ledger "$STAGE_DIR/neg-addon-apply"
if [[ "$BACKFILL_EXIT" -ne 2 ]]; then
  fail "negative add-on apply expected exit 2 (quarantine), got $BACKFILL_EXIT — see $STAGE_DIR/neg-addon-apply.log"
  exit 1
fi
node -e '
  const fs = require("node:fs");
  const r = JSON.parse(fs.readFileSync(process.argv[1] + ".json", "utf8"));
  if (r.rowsChanged !== 0) throw new Error(`negative apply rowsChanged ${r.rowsChanged}, expected 0`);
  console.log("negative add-on apply changed 0 rows");
' "$STAGE_DIR/neg-addon-apply" >"$STAGE_DIR/neg-addon-apply-check.log" 2>&1 \
  || { fail "negative add-on apply check failed — see $STAGE_DIR/neg-addon-apply-check.log"; exit 1; }
cat "$STAGE_DIR/neg-addon-apply-check.log"
FXSO7_ROWS=$(docker exec "$CONTAINER" psql -U "$PG_USER" -d "$DB_B" -tAc \
  "SELECT COUNT(*) FROM \"service_order_addon_usage\" WHERE \"serviceOrderId\" = 'fxso7'")
FXSO6_ROWS=$(docker exec "$CONTAINER" psql -U "$PG_USER" -d "$DB_B" -tAc \
  "SELECT COUNT(*) FROM \"service_order_addon_usage\" WHERE \"serviceOrderId\" = 'fxso6'")
if [[ "$FXSO7_ROWS" -ne 0 || "$FXSO6_ROWS" -ne 0 ]]; then
  fail "quarantined orders must have no ledger rows (fxso7=$FXSO7_ROWS, fxso6=$FXSO6_ROWS)"
  exit 1
fi
log "quarantined orders fxso6/fxso7 have no ledger rows after apply"

backfill "$DB_B_URL" dry-run settings-consolidation "$STAGE_DIR/neg-settings"
if [[ "$BACKFILL_EXIT" -ne 1 ]]; then
  fail "negative settings dry-run expected exit 1 (mismatch), got $BACKFILL_EXIT"
  exit 1
fi
node -e '
  const fs = require("node:fs");
  const r = JSON.parse(fs.readFileSync(process.argv[1] + ".json", "utf8"));
  if (r.rowsChanged !== 0) throw new Error("a mismatched target must never be overwritten");
  if (!r.mismatches.some((m) => m.detail === "field:name")) throw new Error("expected a name field mismatch");
  console.log("negative settings dry-run reported the conflict and changed 0 rows");
' "$STAGE_DIR/neg-settings" >"$STAGE_DIR/neg-settings-check.log" 2>&1 \
  || { fail "negative settings mismatch content wrong — see $STAGE_DIR/neg-settings-check.log"; exit 1; }
cat "$STAGE_DIR/neg-settings-check.log"

psql_b -q <"$SCRIPT_DIR/fixture/02-violations-overlay.sql" \
  >"$STAGE_DIR/violations-overlay.log" 2>&1 \
  || { fail "violations overlay failed to load"; exit 1; }
set +e
(cd "$REPO_ROOT" \
  && DATABASE_URL="$DB_B_URL" \
  node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable --enforce) \
  >"$STAGE_DIR/preflight-negative.log" 2>&1
NEGATIVE_EXIT=$?
set -e
if [[ "$NEGATIVE_EXIT" -ne 3 ]]; then
  fail "negative preflight expected exit 3, got $NEGATIVE_EXIT — see $STAGE_DIR/preflight-negative.log"
  exit 1
fi
log "negative self-tests correctly failed closed (backfill 2/1, preflight 3)"

# ---- stage 12: partial unique indexes ----------------------------------------
log "stage 12/12: partial unique indexes must survive on both databases"
for db in "$DB_A" "$DB_B"; do
  docker exec "$CONTAINER" psql -U "$PG_USER" -d "$db" -tAc \
    "SELECT indexname FROM pg_indexes WHERE indexname IN ('user_normalizedPhoneNumber_active_key','customer_claim_token_userId_active_key') ORDER BY indexname" \
    >"$STAGE_DIR/partial-indexes-$db.txt"
  COUNT=$(grep -c . "$STAGE_DIR/partial-indexes-$db.txt" || true)
  if [[ "$COUNT" -ne 2 ]]; then
    fail "$db: expected 2 partial unique indexes, found $COUNT"
    exit 1
  fi
done
log "both partial unique indexes present on A and B"

# ---- summary ------------------------------------------------------------------
log "ALL 12 STAGES PASSED"
log "evidence in $STAGE_DIR (kept only when REHEARSAL_KEEP_STAGE=1 or on failure)"
exit 0
