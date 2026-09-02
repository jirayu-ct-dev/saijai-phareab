#!/usr/bin/env bash
# Restore one explicitly approved PostgreSQL custom-format backup into a new,
# isolated loopback container and exercise DB-03/DB-05/G3 there. Only the
# application-owned public schema is restored; provider-managed Supabase
# schemas/extensions are outside the DB-03/DB-05 scope and are not available
# in the vanilla PostgreSQL rehearsal image. This script never connects to
# production and never reads .env.
set -euo pipefail
umask 077

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$REPO_ROOT/scripts/db-rehearsal"
PG_IMAGE="${G3_PG_IMAGE:-postgres:16}"
BACKUP_FILE=""
EXPECTED_SHA256=""
EXPECTED_SOURCE_PG_MAJOR=""
APPROVAL_REFERENCE=""
CONFIRM_BACKUP=0
CONFIRM_LOCAL=0
LOCK_TIMEOUT_MS="${G3_LOCK_TIMEOUT_MS:-5000}"
STATEMENT_TIMEOUT_MS="${G3_STATEMENT_TIMEOUT_MS:-600000}"
KEEP_STAGE="${G3_KEEP_STAGE:-0}"

usage() {
  cat >&2 <<'USAGE'
usage: run-production-shape-rehearsal.sh \
  --backup-file /absolute/path/to/approved.dump \
  --expected-sha256 <64-lowercase-hex> \
  --expected-source-pg-major <integer> \
  --approval-reference <ticket-or-chat-reference> \
  --confirm-approved-backup --confirm-local-disposable [--keep-stage]

The input must be a database-only PostgreSQL custom-format archive created
with --format=custom --no-owner --no-privileges. The command never connects
to the source database; it only mounts the approved archive read-only.
USAGE
  exit 64
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backup-file) [[ $# -ge 2 ]] || usage; BACKUP_FILE="$2"; shift 2 ;;
    --expected-sha256) [[ $# -ge 2 ]] || usage; EXPECTED_SHA256="$2"; shift 2 ;;
    --expected-source-pg-major) [[ $# -ge 2 ]] || usage; EXPECTED_SOURCE_PG_MAJOR="$2"; shift 2 ;;
    --approval-reference) [[ $# -ge 2 ]] || usage; APPROVAL_REFERENCE="$2"; shift 2 ;;
    --confirm-approved-backup) CONFIRM_BACKUP=1; shift ;;
    --confirm-local-disposable) CONFIRM_LOCAL=1; shift ;;
    --keep-stage) KEEP_STAGE=1; shift ;;
    *) echo "unknown argument: $1" >&2; usage ;;
  esac
done

[[ "$CONFIRM_BACKUP" -eq 1 && "$CONFIRM_LOCAL" -eq 1 ]] || usage
[[ -n "$BACKUP_FILE" && -n "$EXPECTED_SHA256" && -n "$EXPECTED_SOURCE_PG_MAJOR" && -n "$APPROVAL_REFERENCE" ]] || usage
[[ "$EXPECTED_SHA256" =~ ^[0-9a-f]{64}$ ]] || { echo "expected SHA-256 must be 64 lowercase hex characters" >&2; exit 64; }
[[ "$EXPECTED_SOURCE_PG_MAJOR" =~ ^[1-9][0-9]*$ ]] || { echo "expected source PostgreSQL major must be an integer" >&2; exit 64; }
[[ "$BACKUP_FILE" = /* ]] || { echo "backup path must be absolute" >&2; exit 64; }
[[ -f "$BACKUP_FILE" && ! -L "$BACKUP_FILE" ]] || { echo "backup must be a regular, non-symlink file" >&2; exit 66; }
[[ "$BACKUP_FILE" != *','* && "$BACKUP_FILE" != *$'\n'* ]] || { echo "backup path may not contain comma or newline" >&2; exit 64; }
[[ "$LOCK_TIMEOUT_MS" =~ ^[1-9][0-9]*$ && "$STATEMENT_TIMEOUT_MS" =~ ^[1-9][0-9]*$ ]] \
  || { echo "timeout values must be positive integers" >&2; exit 64; }

for command in docker node pnpm shasum stat; do
  command -v "$command" >/dev/null 2>&1 || { echo "required command not found: $command" >&2; exit 69; }
done
docker info >/dev/null 2>&1 || { echo "Docker daemon is not available" >&2; exit 69; }

BACKUP_REAL="$(cd "$(dirname "$BACKUP_FILE")" && pwd -P)/$(basename "$BACKUP_FILE")"
ACTUAL_SHA256="$(shasum -a 256 "$BACKUP_REAL" | awk '{print $1}')"
[[ "$ACTUAL_SHA256" = "$EXPECTED_SHA256" ]] || { echo "backup SHA-256 does not match the approved value" >&2; exit 65; }
BACKUP_BYTES="$(stat -f '%z' "$BACKUP_REAL" 2>/dev/null || stat -c '%s' "$BACKUP_REAL")"

CONTAINER="saijai-g3-pg-$(date +%s)-$$"
DB_TARGET="rehearsal_g3"
DB_BEFORE="rehearsal_g3_before"
DB_EXPECTED="rehearsal_g3_expected"
PG_USER="postgres"
PG_PASSWORD="rehearsal-g3-local-only"
STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/saijai-g3-production-shape.XXXXXX")"
chmod 700 "$STAGE_DIR"
FAILED=1
START_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD)"
START_STATUS_HASH="$(git -C "$REPO_ROOT" status --porcelain=v1 -z | shasum -a 256 | awk '{print $1}')"
OPERATIONS=(settings-consolidation addon-usage-json-to-ledger item-photo-direct-to-join)

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  if [[ "$FAILED" -ne 0 && -d "$STAGE_DIR" && ! -f "$STAGE_DIR/g3-summary.json" ]]; then
    node "$SCRIPT_DIR/evaluate-g3-evidence.mjs" --evidence-dir "$STAGE_DIR" \
      --out "$STAGE_DIR/g3-summary.json" >/dev/null 2>&1 || true
  fi
  if [[ "$KEEP_STAGE" != "1" && "$FAILED" -eq 0 ]]; then
    rm -rf -- "$STAGE_DIR"
  else
    printf '\n[g3-rehearsal] restricted evidence retained at %s\n' "$STAGE_DIR" >&2
    printf '[g3-rehearsal] it may contain database row identifiers; protect and delete it after review\n' >&2
  fi
}
trap cleanup EXIT

log() { printf '\n[g3-rehearsal] %s\n' "$*"; }
now_ms() { node -e 'process.stdout.write(String(Date.now()))'; }
record_timing() {
  node -e '
    const fs = require("node:fs");
    const path = process.argv[1]; const key = process.argv[2]; const value = Number(process.argv[3]);
    let data = {}; try { data = JSON.parse(fs.readFileSync(path, "utf8")); } catch {}
    data[key] = value; fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  ' "$STAGE_DIR/timings.json" "$1" "$2"
}

log "approval accepted for one exact archive (reference recorded; value not printed)"
log "archive checksum verified; size ${BACKUP_BYTES} bytes"
log "evidence directory: $STAGE_DIR (mode 0700)"

docker run -d --name "$CONTAINER" \
  -e POSTGRES_USER="$PG_USER" -e POSTGRES_PASSWORD="$PG_PASSWORD" -e POSTGRES_DB="$DB_TARGET" \
  -p '127.0.0.1::5432' \
  --mount "type=bind,source=${BACKUP_REAL},target=/approved/source.dump,readonly" \
  "$PG_IMAGE" >/dev/null

for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U "$PG_USER" -d "$DB_TARGET" >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U "$PG_USER" -d "$DB_TARGET" >/dev/null \
  || { echo "PostgreSQL container did not become ready" >&2; exit 1; }
PG_PORT="$(docker port "$CONTAINER" 5432/tcp | awk -F: 'NR==1 {print $NF}')"
[[ "$PG_PORT" =~ ^[0-9]+$ ]] || { echo "could not resolve loopback PostgreSQL port" >&2; exit 1; }
DB_URL="postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${DB_TARGET}"
BEFORE_URL="postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${DB_BEFORE}"
EXPECTED_URL="postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${DB_EXPECTED}"

log "stage 1/12: validate archive and restore application-owned public schema into isolated database"
docker exec "$CONTAINER" pg_restore --list /approved/source.dump >"$STAGE_DIR/archive-list.txt" 2>"$STAGE_DIR/archive-validate.log" \
  || { echo "archive is not a readable custom-format pg_dump for $PG_IMAGE" >&2; exit 1; }
SOURCE_PG_VERSION="$(sed -n 's/^;[[:space:]]*Dumped from database version: //p' "$STAGE_DIR/archive-list.txt" | head -n 1)"
SOURCE_PG_MAJOR="${SOURCE_PG_VERSION%%.*}"
[[ -n "$SOURCE_PG_VERSION" && "$SOURCE_PG_MAJOR" = "$EXPECTED_SOURCE_PG_MAJOR" ]] \
  || { echo "archive source PostgreSQL major does not match the approved value" >&2; exit 65; }
RESTORE_START="$(now_ms)"
docker exec "$CONTAINER" pg_restore --exit-on-error --single-transaction --no-owner --no-privileges \
  --schema=public \
  -U "$PG_USER" -d "$DB_TARGET" /approved/source.dump >"$STAGE_DIR/restore.log" 2>&1 \
  || { echo "restore failed; inspect restricted restore.log" >&2; exit 1; }
record_timing restore "$(( $(now_ms) - RESTORE_START ))"

log "stage 2/12: capture source metadata and clone the pre-migration schema"
docker exec "$CONTAINER" psql -X -U "$PG_USER" -d "$DB_TARGET" -Atqc \
  "SELECT current_setting('server_version'), pg_database_size(current_database())" >"$STAGE_DIR/database-metadata.txt"
(cd "$REPO_ROOT" && node scripts/db-rehearsal/schema-diff.mjs fingerprint \
  --url "$DB_URL" --out "$STAGE_DIR/schema-before.txt" --confirm-disposable) >"$STAGE_DIR/fingerprint-before.log" 2>&1
docker exec "$CONTAINER" psql -X -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 -c \
  "CREATE DATABASE \"$DB_BEFORE\" TEMPLATE \"$DB_TARGET\"" >"$STAGE_DIR/clone-before.log" 2>&1

log "stage 3/12: apply pending migrations with lock/statement timeouts"
MIGRATE_START="$(now_ms)"
if ! (cd "$REPO_ROOT" && DOTENV_CONFIG_PATH=/dev/null DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" \
  PGOPTIONS="-c lock_timeout=${LOCK_TIMEOUT_MS} -c statement_timeout=${STATEMENT_TIMEOUT_MS}" \
  pnpm exec prisma migrate deploy) >"$STAGE_DIR/migrate-deploy.log" 2>&1; then
  echo "migration replay on the restore copy failed or timed out" >&2
  exit 1
fi
record_timing migrateDeploy "$(( $(now_ms) - MIGRATE_START ))"
(cd "$REPO_ROOT" && DOTENV_CONFIG_PATH=/dev/null DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" \
  pnpm exec prisma migrate status) >"$STAGE_DIR/migrate-status.log" 2>&1

log "stage 4/12: require schema delta to be empty or exactly DB-03 additive changes"
(cd "$REPO_ROOT" && node scripts/db-rehearsal/schema-diff.mjs diff \
  --from "$BEFORE_URL" --to "$DB_URL" \
  --allowlist "$SCRIPT_DIR/schema-db03-expand-allowlist.json" --confirm-disposable) \
  >"$STAGE_DIR/schema-diff-db03.json" 2>&1 \
  || { echo "unexpected schema delta after migrate deploy" >&2; exit 1; }

log "stage 5/12: replay the canonical schema separately and allow only reviewed production drift"
docker exec "$CONTAINER" psql -X -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 -c \
  "CREATE DATABASE \"$DB_EXPECTED\"" >"$STAGE_DIR/create-expected.log" 2>&1
(cd "$REPO_ROOT" && DOTENV_CONFIG_PATH=/dev/null DATABASE_URL="$EXPECTED_URL" DIRECT_URL="$EXPECTED_URL" \
  pnpm exec prisma migrate deploy) >"$STAGE_DIR/migrate-expected.log" 2>&1 \
  || { echo "canonical fresh migration replay failed" >&2; exit 1; }
(cd "$REPO_ROOT" && node scripts/db-rehearsal/schema-diff.mjs diff \
  --from "$EXPECTED_URL" --to "$DB_URL" \
  --allowlist "$SCRIPT_DIR/schema-g3-production-allowlist.json" --confirm-disposable) \
  >"$STAGE_DIR/schema-diff-canonical.json" 2>&1 \
  || { echo "restored production-shape schema drifts from the canonical migration chain" >&2; exit 1; }

log "stage 6/12: enforced read-only preflight before backfill"
(cd "$REPO_ROOT" && DOTENV_CONFIG_PATH=/dev/null DATABASE_URL="$DB_URL" \
  node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable --enforce \
  --report-file "$STAGE_DIR/preflight-before.json") >"$STAGE_DIR/preflight-before.log" 2>&1 \
  || { echo "preflight failed before backfill; no backfill writes were attempted" >&2; exit 3; }

run_backfill() {
  local phase="$1" mode="$2" operation="$3"
  local start exit_code
  start="$(now_ms)"
  set +e
  (cd "$REPO_ROOT" && DOTENV_CONFIG_PATH=/dev/null \
    PGOPTIONS="-c lock_timeout=${LOCK_TIMEOUT_MS} -c statement_timeout=${STATEMENT_TIMEOUT_MS}" \
    pnpm exec tsx scripts/db-rehearsal/backfill/backfill.mts \
    --operation "$operation" --mode "$mode" --url "$DB_URL" --confirm-disposable \
    --report-file "$STAGE_DIR/${phase}-${operation}.json") >"$STAGE_DIR/${phase}-${operation}.log" 2>&1
  exit_code=$?
  set -e
  record_timing "${phase}_${operation}" "$(( $(now_ms) - start ))"
  return "$exit_code"
}

log "stage 7/12: dry-run all backfills; any mismatch/quarantine blocks writes"
for operation in "${OPERATIONS[@]}"; do
  if ! run_backfill dry dry-run "$operation"; then
    echo "dry-run blocked for $operation; no backfill apply was attempted" >&2
    exit 3
  fi
done

log "stage 8/12: apply all backfills on the isolated restore copy"
for operation in "${OPERATIONS[@]}"; do
  run_backfill apply apply "$operation" \
    || { echo "backfill apply failed for $operation" >&2; exit 3; }
done

log "stage 9/12: enforced reconciliation and explicit G3 zero-gap checks"
(cd "$REPO_ROOT" && DOTENV_CONFIG_PATH=/dev/null DATABASE_URL="$DB_URL" \
  node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable --enforce \
  --report-file "$STAGE_DIR/preflight-after.json") >"$STAGE_DIR/preflight-after.log" 2>&1 \
  || { echo "post-backfill preflight failed" >&2; exit 3; }

log "stage 10/12: second apply must change zero rows"
for operation in "${OPERATIONS[@]}"; do
  run_backfill apply2 apply "$operation" \
    || { echo "second backfill apply failed for $operation" >&2; exit 3; }
done

log "stage 11/12: final dry-run must be idle and conflict-free"
for operation in "${OPERATIONS[@]}"; do
  run_backfill final dry-run "$operation" \
    || { echo "final dry-run failed for $operation" >&2; exit 3; }
done

log "stage 12/12: repository integrity and aggregate-only G3 verdict"
FINAL_BACKUP_SHA256="$(shasum -a 256 "$BACKUP_REAL" | awk '{print $1}')"
[[ "$FINAL_BACKUP_SHA256" = "$ACTUAL_SHA256" ]] \
  || { echo "backup file changed while the rehearsal was running" >&2; exit 65; }
END_HEAD="$(git -C "$REPO_ROOT" rev-parse HEAD)"
END_STATUS_HASH="$(git -C "$REPO_ROOT" status --porcelain=v1 -z | shasum -a 256 | awk '{print $1}')"
[[ "$END_HEAD" = "$START_HEAD" && "$END_STATUS_HASH" = "$START_STATUS_HASH" ]] \
  || { echo "repository state changed during rehearsal" >&2; exit 1; }
node "$SCRIPT_DIR/evaluate-g3-evidence.mjs" --evidence-dir "$STAGE_DIR" --out "$STAGE_DIR/g3-summary.json" \
  || { echo "G3 rehearsal is blocked; inspect aggregate summary and restricted raw evidence" >&2; exit 3; }
PG_IMAGE_ID="$(docker image inspect "$PG_IMAGE" --format '{{.Id}}')"
TARGET_PG_VERSION="$(docker exec "$CONTAINER" psql -X -U "$PG_USER" -d "$DB_TARGET" -Atqc 'SHOW server_version')"
DOCKER_SERVER_VERSION="$(docker info --format '{{.ServerVersion}}')"
node -e '
  const fs = require("node:fs"); const path = process.argv[1];
  const data = JSON.parse(fs.readFileSync(path, "utf8"));
  data.approval = { reference: process.argv[2], backupSha256: process.argv[3], backupBytes: Number(process.argv[4]) };
  data.repository = { head: process.argv[5], statusHashUnchanged: true };
  data.environment = { sourcePostgresVersion: process.argv[6], targetPostgresVersion: process.argv[7], postgresImage: process.argv[8], postgresImageId: process.argv[9], dockerServerVersion: process.argv[10] };
  fs.writeFileSync(path, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
' "$STAGE_DIR/g3-summary.json" "$APPROVAL_REFERENCE" "$ACTUAL_SHA256" "$BACKUP_BYTES" "$START_HEAD" \
  "$SOURCE_PG_VERSION" "$TARGET_PG_VERSION" "$PG_IMAGE" "$PG_IMAGE_ID" "$DOCKER_SERVER_VERSION"

FAILED=0
log "G3 production-shape rehearsal PASSED (this does not authorize production access or DB-06)"
if [[ "$KEEP_STAGE" = "1" ]]; then
  log "aggregate verdict: $STAGE_DIR/g3-summary.json"
fi
