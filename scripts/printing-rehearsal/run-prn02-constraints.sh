#!/usr/bin/env bash
# run-prn02-constraints.sh — PRN-02 rehearsal on a disposable PostgreSQL 16
# container. NEVER targets production or a shared database.
#
# Pipeline:
#   1. fresh `prisma migrate deploy` replay of the full migration chain
#      (all migrations, including 20260903120000_prn02_printer_print_job)
#   2. seed FK fixtures + idempotency unique-scope assertion (23505 on
#      duplicate print_job_idempotency_scope, distinct scope accepted)
#   3. concurrent claim: two parallel sessions run the canonical claim
#      UPDATE ... FOR UPDATE SKIP LOCKED — exactly one may win
#   4. fencing token increments monotonically via
#      UPDATE ... SET "fencingToken" = COALESCE("fencingToken",0)+1 RETURNING
#   5. stale lease re-claim works once lease_expires_at < now()
#   6. stop and remove the container
#
# Usage:
#   scripts/printing-rehearsal/run-prn02-constraints.sh
#
# Environment overrides:
#   PRN02_PG_IMAGE   docker image (default postgres:16-alpine)
#   PRN02_PG_PORT    host port for the container (default 55432)
#   PRN02_KEEP       keep the container running on failure (default off)
#
# Exit codes: 0 all checks passed, 1 any check failed (container kept when
# PRN02_KEEP=1).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$REPO_ROOT/scripts/printing-rehearsal"
PG_IMAGE="${PRN02_PG_IMAGE:-postgres:16-alpine}"
PG_PORT="${PRN02_PG_PORT:-55432}"
PG_USER="postgres"
PG_PASSWORD="replay"
DB_NAME="prn02_rehearsal"
CONTAINER="prn02-rehearsal-$(date +%s)"

DB_URL="postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${DB_NAME}"

JOB_ID="pj_prn02_claim_me"

FAILED=0

cleanup() {
  if [[ "${PRN02_KEEP:-0}" = "1" && "$FAILED" -ne 0 ]]; then
    printf '\n[prn02] KEEP=1 and failed — container %s left running\n' "$CONTAINER" >&2
  else
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

log() { printf '\n[prn02] %s\n' "$*"; }
fail() { printf '\n[prn02] FAIL: %s\n' "$*" >&2; FAILED=1; }

psql_db() {
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$PG_USER" -d "$DB_NAME" "$@"
}

log "starting disposable container $CONTAINER ($PG_IMAGE on 127.0.0.1:$PG_PORT)"

docker run -d --name "$CONTAINER" \
  -e POSTGRES_USER="$PG_USER" -e POSTGRES_PASSWORD="$PG_PASSWORD" \
  -p "127.0.0.1:${PG_PORT}:5432" "$PG_IMAGE" >/dev/null

log "waiting for PostgreSQL readiness"
for _ in $(seq 1 60); do
  if docker exec "$CONTAINER" pg_isready -U "$PG_USER" -d postgres >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done
docker exec "$CONTAINER" pg_isready -U "$PG_USER" -d postgres >/dev/null

log "creating database $DB_NAME"
docker exec "$CONTAINER" psql -U "$PG_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\"" >/dev/null

# ---------------------------------------------------------------------------
# Stage 1 — full migration-chain replay
# ---------------------------------------------------------------------------
log "stage 1: prisma migrate deploy (full chain) against $DB_NAME"

if (cd "$REPO_ROOT" && \
    DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" \
    pnpm exec prisma migrate deploy); then
  log "migrate deploy succeeded"
else
  fail "prisma migrate deploy did not complete"
  exit 1
fi

MIGRATION_DIRS="$(ls -d "$REPO_ROOT/prisma/migrations"/*/ | wc -l | tr -d ' ')"
APPLIED="$(psql_db -t -A -c 'SELECT count(*) FROM "_prisma_migrations"')"
log "migrations applied: $APPLIED (migration directories: $MIGRATION_DIRS)"
if [[ "$APPLIED" != "$MIGRATION_DIRS" ]]; then
  fail "applied migration count ($APPLIED) != migration directory count ($MIGRATION_DIRS)"
fi

# ---------------------------------------------------------------------------
# Stage 2 — seed fixtures + idempotency scope assertion
# ---------------------------------------------------------------------------
log "stage 2: seed + idempotency unique-scope assertion"
psql_db < "$SCRIPT_DIR/prn02-seed-and-idempotency.sql" \
  || fail "seed/idempotency stage failed"

# ---------------------------------------------------------------------------
# Stage 3 — concurrent claim: two parallel sessions, exactly one winner
# ---------------------------------------------------------------------------
log "stage 3: concurrent claim (FOR UPDATE SKIP LOCKED), exactly one winner"

CLAIM_SQL="BEGIN;
SET LOCAL lock_timeout = '10s';
WITH claim AS (
  UPDATE \"print_job\"
  SET \"status\" = 'CLAIMED',
      \"leaseToken\" = 'lease-' || gen_random_uuid()::text,
      \"leaseExpiresAt\" = now() + interval '30 seconds',
      \"attemptCount\" = \"attemptCount\" + 1
  WHERE \"id\" IN (
    SELECT \"id\" FROM \"print_job\"
    WHERE \"status\" = 'QUEUED' AND \"availableAt\" <= now()
    ORDER BY \"createdAt\"
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  RETURNING \"id\"
)
SELECT coalesce(count(*), 0) AS claimed FROM claim;
SELECT pg_sleep(1.5);
COMMIT;"

OUT_A="$(mktemp)"
OUT_B="$(mktemp)"

( docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$PG_USER" -d "$DB_NAME" \
    -c "$CLAIM_SQL" >"$OUT_A" 2>&1 ) &
PID_A=$!
sleep 0.3
( docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$PG_USER" -d "$DB_NAME" \
    -c "$CLAIM_SQL" >"$OUT_B" 2>&1 ) &
PID_B=$!

wait "$PID_A" || true
wait "$PID_B" || true

WIN_A="$(psql_db -t -A -c \
  "SELECT \"status\" FROM \"print_job\" WHERE \"id\" = '$JOB_ID'")"

# Count how many sessions actually claimed a row (the RETURNING count line).
COUNT_A="$(grep -cE '^\s*[1-9][0-9]*\s*$' "$OUT_A" || true)"
COUNT_B="$(grep -cE '^\s*[1-9][0-9]*\s*$' "$OUT_B" || true)"
WINNERS=$(( COUNT_A + COUNT_B ))

log "session A claimed: ${COUNT_A}, session B claimed: ${COUNT_B}, final job status: ${WIN_A:-none}"
if [[ "$WINNERS" -ne 1 ]]; then
  fail "expected exactly one winning claim, got $WINNERS (A=$COUNT_A B=$COUNT_B)"
  printf -- '--- session A output ---\n%s\n--- session B output ---\n%s\n' "$(cat "$OUT_A")" "$(cat "$OUT_B")" >&2
else
  log "OK: exactly one concurrent claim won"
fi
rm -f "$OUT_A" "$OUT_B"

# ---------------------------------------------------------------------------
# Stage 4+5 — fencing token increment + stale lease re-claim
# ---------------------------------------------------------------------------
log "stage 4+5: fencing token + stale lease re-claim"
psql_db < "$SCRIPT_DIR/prn02-claim-and-fencing.sql" \
  || fail "fencing/stale-lease stage failed"

# ---------------------------------------------------------------------------
# Stage 6 — generated-client smoke: enum serialization round-trip
# ---------------------------------------------------------------------------
log "stage 6: generated PrismaClient insert/read smoke (enum @map round-trip)"

if (cd "$REPO_ROOT" && \
    DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" \
    pnpm exec tsx scripts/printing-rehearsal/prn02-client-smoke.ts); then
  log "client smoke passed"
else
  fail "generated-client smoke failed"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
if [[ "$FAILED" -eq 0 ]]; then
  log "ALL PRN-02 CONSTRAINT CHECKS PASSED"
else
  fail "one or more PRN-02 constraint checks failed"
fi

if [[ "$FAILED" -ne 0 ]]; then
  exit 1
fi
