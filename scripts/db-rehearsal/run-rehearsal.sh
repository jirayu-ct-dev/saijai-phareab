#!/usr/bin/env bash
# run-rehearsal.sh — end-to-end migration rehearsal on a disposable
# PostgreSQL 16 container. NEVER targets production or a shared database.
#
# Pipeline (all against throwaway containers/databases):
#   1. fresh `prisma migrate deploy` replay of the full migration chain (DB A)
#   2. load the synthetic non-PII fixture
#   3. preflight with --enforce (invariants must pass; exit 3 otherwise)
#   4. schema fingerprint of A
#   5. pg_dump A -> restore into DB B
#   6. preflight --enforce on B + report equality with A + empty-allowlist
#      schema diff (restore must be shape- and data-report-identical)
#   7. negative self-test: load the violations overlay into B and require the
#      runner to exit 3 (proves the gate fails closed)
#   8. stop and remove the container
#
# Usage:
#   scripts/db-rehearsal/run-rehearsal.sh
#
# Environment overrides:
#   REHEARSAL_PG_IMAGE   docker image (default postgres:16)
#   REHEARSAL_PG_PORT    host port for the container (default 5439)
#   REHEARSAL_KEEP_STAGE keep the evidence directory instead of deleting it
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
CONTAINER="saijai-rehearsal-pg-$(date +%s)"
STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/saijai-rehearsal.XXXXXX")"

DB_A_URL="postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${DB_A}"
DB_B_URL="postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${DB_B}"

REHEARSAL_FAILED=0

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  if [[ "${REHEARSAL_KEEP_STAGE:-}" != "1" && "$REHEARSAL_FAILED" -eq 0 ]]; then
    rm -rf "$STAGE_DIR"
  fi
}
trap cleanup EXIT

log() { printf '\n[rehearsal] %s\n' "$*"; }
fail() { printf '\n[rehearsal] FAIL: %s\n' "$*" >&2; REHEARSAL_FAILED=1; }

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

# ---- stage 1: fresh migration replay (full chain) ------------------------
log "stage 1/7: fresh prisma migrate deploy replay of the full migration chain"
if ! (cd "$REPO_ROOT" \
      && DATABASE_URL="$DB_A_URL" DIRECT_URL="$DB_A_URL" \
      pnpm exec prisma migrate deploy) >"$STAGE_DIR/migrate-deploy.log" 2>&1; then
  fail "prisma migrate deploy failed — see $STAGE_DIR/migrate-deploy.log"
  tail -n 40 "$STAGE_DIR/migrate-deploy.log" >&2
  exit 1
fi
grep -c 'Applying migration' "$STAGE_DIR/migrate-deploy.log" >"$STAGE_DIR/migrations-applied.count" || true
log "applied $(cat "$STAGE_DIR/migrations-applied.count") migrations"

# ---- stage 2: synthetic fixture ------------------------------------------
log "stage 2/7: loading synthetic non-PII fixture"
psql_a -q <"$SCRIPT_DIR/fixture/04-current-fixture.sql" >"$STAGE_DIR/fixture.log" 2>&1 \
  || { fail "fixture load failed — see $STAGE_DIR/fixture.log"; exit 1; }

# ---- stage 3: enforced preflight on A ------------------------------------
log "stage 3/7: preflight --enforce on the replayed database"
if ! (cd "$REPO_ROOT" \
      && DATABASE_URL="$DB_A_URL" \
      node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable --enforce --profile current \
        --report-file "$STAGE_DIR/preflight-a.json") \
      >"$STAGE_DIR/preflight-a.log" 2>&1; then
  fail "preflight on A failed — see $STAGE_DIR/preflight-a.log"
  tail -n 40 "$STAGE_DIR/preflight-a.log" >&2
  exit 1
fi
log "preflight on A passed all invariants"

# ---- stage 4: schema fingerprint + dump ----------------------------------
log "stage 4/7: fingerprinting schema and dumping database A"
(cd "$REPO_ROOT" && DATABASE_URL="x" \
  node scripts/db-rehearsal/schema-diff.mjs fingerprint \
    --url "$DB_A_URL" --out "$STAGE_DIR/schema-a.txt" --confirm-disposable) \
  >"$STAGE_DIR/fingerprint-a.log" 2>&1 \
  || { fail "schema fingerprint of A failed — see $STAGE_DIR/fingerprint-a.log"; exit 1; }
docker exec "$CONTAINER" pg_dump -U "$PG_USER" --no-owner --no-privileges "$DB_A" \
  >"$STAGE_DIR/rehearsal-dump.sql"
log "dump written ($(wc -l <"$STAGE_DIR/rehearsal-dump.sql" | tr -d ' ') lines)"

# ---- stage 5: restore into B ----------------------------------------------
log "stage 5/7: restoring dump into a second empty database"
docker exec "$CONTAINER" psql -U "$PG_USER" -c "CREATE DATABASE \"$DB_B\"" >/dev/null
psql_b -q <"$STAGE_DIR/rehearsal-dump.sql" >"$STAGE_DIR/restore.log" 2>&1 \
  || { fail "restore failed — see $STAGE_DIR/restore.log"; exit 1; }

# ---- stage 6: verify B matches A ------------------------------------------
log "stage 6/7: preflight --enforce, report equality and schema diff on the restored copy"
if ! (cd "$REPO_ROOT" \
      && DATABASE_URL="$DB_B_URL" \
      node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable --enforce --profile current \
        --report-file "$STAGE_DIR/preflight-b.json") \
      >"$STAGE_DIR/preflight-b.log" 2>&1; then
  fail "preflight on restored B failed — see $STAGE_DIR/preflight-b.log"
  tail -n 40 "$STAGE_DIR/preflight-b.log" >&2
  exit 1
fi

node -e '
  const fs = require("node:fs");
  const strip = (p) => {
    const r = JSON.parse(fs.readFileSync(p, "utf8"));
    delete r.target;
    return r;
  };
  const a = JSON.stringify(strip(process.argv[1]), null, 0);
  const b = JSON.stringify(strip(process.argv[2]), null, 0);
  if (a !== b) {
    console.error("preflight reports differ between A and restored B");
    process.exit(1);
  }
  console.log("preflight reports identical (ignoring masked target)");
' "$STAGE_DIR/preflight-a.json" "$STAGE_DIR/preflight-b.json" \
  >"$STAGE_DIR/report-equality.log" 2>&1 \
  || { fail "preflight report equality failed — see $STAGE_DIR/report-equality.log"; exit 1; }
cat "$STAGE_DIR/report-equality.log"

(cd "$REPO_ROOT" \
  && node scripts/db-rehearsal/schema-diff.mjs diff \
      --from "$DB_A_URL" --to "$DB_B_URL" \
      --allowlist "$SCRIPT_DIR/schema-allowlist.json" --confirm-disposable) \
  >"$STAGE_DIR/schema-diff-restore.json" 2>&1 \
  || { fail "schema diff A vs B not clean — see $STAGE_DIR/schema-diff-restore.json"; exit 1; }
log "restored copy is schema- and report-identical to A"

# ---- stage 7: negative self-test (gate must fail closed) ------------------
log "stage 7/7: negative self-test — violations overlay must make the gate exit 3"
psql_b -q <"$SCRIPT_DIR/fixture/05-current-violations-overlay.sql" \
  >"$STAGE_DIR/violations-overlay.log" 2>&1 \
  || { fail "violations overlay failed to load — see $STAGE_DIR/violations-overlay.log"; exit 1; }

set +e
(cd "$REPO_ROOT" \
  && DATABASE_URL="$DB_B_URL" \
  node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable --enforce --profile current) \
  >"$STAGE_DIR/preflight-negative.log" 2>&1
NEGATIVE_EXIT=$?
set -e
if [[ "$NEGATIVE_EXIT" -ne 3 ]]; then
  fail "negative self-test expected exit 3 (invariant failure), got $NEGATIVE_EXIT — see $STAGE_DIR/preflight-negative.log"
  tail -n 20 "$STAGE_DIR/preflight-negative.log" >&2
  exit 1
fi
log "negative self-test correctly failed with exit 3"

# ---- summary ---------------------------------------------------------------
log "ALL STAGES PASSED"
log "evidence in $STAGE_DIR (kept only when REHEARSAL_KEEP_STAGE=1 or on failure):"
log "  migrate-deploy.log, migrations-applied.count, preflight-a/b.json,"
log "  schema-a.txt, rehearsal-dump.sql, schema-diff-restore.json,"
log "  preflight-negative.log"
exit 0
