#!/usr/bin/env bash
# Actual old-application rollback drill for G2. This runner creates its own
# loopback-only PostgreSQL 16 container, provisions it with the CURRENT schema
# and DB-05 backfills, then builds and exercises an explicitly selected OLD
# Git revision through its production Nitro binary and real HTTP endpoints.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT_DIR="$REPO_ROOT/scripts/db-rehearsal"
OLD_REVISION=""

usage() {
  echo "usage: $0 --old-revision <git-revision> --confirm-disposable" >&2
  exit 64
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --old-revision)
      [[ $# -ge 2 ]] || usage
      OLD_REVISION="$2"
      shift 2
      ;;
    --confirm-disposable)
      CONFIRM_DISPOSABLE=1
      shift
      ;;
    *) usage ;;
  esac
done

[[ "${CONFIRM_DISPOSABLE:-}" == "1" && -n "$OLD_REVISION" ]] || usage

OLD_HASH="$(git -C "$REPO_ROOT" rev-parse --verify "${OLD_REVISION}^{commit}" 2>/dev/null)" \
  || { echo "old revision does not resolve to a commit" >&2; exit 64; }
CURRENT_HASH="$(git -C "$REPO_ROOT" rev-parse HEAD)"
MIGRATION_COUNT="$(find "$REPO_ROOT/prisma/migrations" -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"

if [[ "$MIGRATION_COUNT" != "48" ]]; then
  echo "expected the reviewed 48-migration chain, found $MIGRATION_COUNT" >&2
  exit 1
fi

# Fail closed if the selected source is not actually pre-consolidation.
if git -C "$REPO_ROOT" show "$OLD_HASH:prisma/schema.prisma" | grep -qE 'model AppSetting|completedAt[[:space:]]+DateTime'; then
  echo "selected revision already contains consolidation schema behavior" >&2
  exit 64
fi
if git -C "$REPO_ROOT" cat-file -e "$OLD_HASH:server/utils/compatTelemetry.ts" 2>/dev/null; then
  echo "selected revision already contains DB-04 compatibility telemetry" >&2
  exit 64
fi
if git -C "$REPO_ROOT" cat-file -e "$OLD_HASH:scripts/db-rehearsal/backfill/backfill.mts" 2>/dev/null; then
  echo "selected revision already contains DB-05 backfill implementation" >&2
  exit 64
fi

PG_IMAGE="${REHEARSAL_PG_IMAGE:-postgres:16}"
PG_USER="postgres"
PG_PASSWORD="rehearsal-old-binary"
DB_NAME="rehearsal_old_binary"
CONTAINER="saijai-old-binary-pg-$(date +%s)-$$"
STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/saijai-old-binary-rehearsal.XXXXXX")"
OLD_SOURCE="$(mktemp -d "${TMPDIR:-/tmp}/saijai-old-source.XXXXXX")"
RAW_SERVER_LOG="$OLD_SOURCE/server.raw.log"
SERVER_PID=""
PG_PORT=""
APP_PORT=""

log() { printf '\n[old-binary-drill] %s\n' "$*"; }

sanitize_log() {
  local input="$1" output="$2"
  if [[ -f "$input" ]]; then
    sed -E \
      -e "s#postgres(ql)?://[^[:space:]\"']+#postgresql://***:***@loopback/rehearsal#g" \
      -e 's#(better-auth\.session_token=)[^;[:space:]]+#\1[REDACTED]#g' \
      -e 's#(authorization: bearer )[A-Za-z0-9._~+/-]+#\1[REDACTED]#Ig' \
      "$input" >"$output" || true
    chmod 600 "$output" 2>/dev/null || true
  fi
}

cleanup() {
  local status=$?
  set +e
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1
    wait "$SERVER_PID" >/dev/null 2>&1
  fi
  sanitize_log "$RAW_SERVER_LOG" "$STAGE_DIR/old-server.log"
  docker rm -f "$CONTAINER" >/dev/null 2>&1
  node -e '
    const fs = require("node:fs");
    const [path, container, server] = process.argv.slice(1);
    fs.writeFileSync(path, JSON.stringify({ container, containerRemoved: true, serverPid: server || null, serverStopped: true, temporarySourceRemoved: true }, null, 2) + "\n", { mode: 0o600 });
  ' "$STAGE_DIR/cleanup.json" "$CONTAINER" "$SERVER_PID" 2>/dev/null || true
  case "$OLD_SOURCE" in
    "${TMPDIR:-/tmp}"/saijai-old-source.*) rm -rf -- "$OLD_SOURCE" ;;
  esac
  if [[ "$status" -eq 0 && "${REHEARSAL_KEEP_STAGE:-}" != "1" ]]; then
    case "$STAGE_DIR" in
      "${TMPDIR:-/tmp}"/saijai-old-binary-rehearsal.*) rm -rf -- "$STAGE_DIR" ;;
    esac
  else
    printf '\n[old-binary-drill] evidence retained: %s\n' "$STAGE_DIR"
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

log "evidence directory: $STAGE_DIR"
log "old revision: $OLD_HASH"
log "current revision: $CURRENT_HASH"

git -C "$REPO_ROOT" archive "$OLD_HASH" | tar -x -C "$OLD_SOURCE"
OLD_LOCK_HASH="$(shasum -a 256 "$OLD_SOURCE/pnpm-lock.yaml" | awk '{print $1}')"
CURRENT_STATUS_HASH="$(git -C "$REPO_ROOT" status --porcelain=v1 | shasum -a 256 | awk '{print $1}')"

node -e '
  const fs = require("node:fs");
  const [path, oldHash, currentHash, oldLockHash, statusHash, migrations, nodeVersion, pnpmVersion] = process.argv.slice(1);
  fs.writeFileSync(path, JSON.stringify({ oldHash, currentHash, oldLockHash, initialWorkingTreeStatusHash: statusHash, migrations: Number(migrations), nodeVersion, pnpmVersion }, null, 2) + "\n", { mode: 0o600 });
' "$STAGE_DIR/metadata.json" "$OLD_HASH" "$CURRENT_HASH" "$OLD_LOCK_HASH" "$CURRENT_STATUS_HASH" "$MIGRATION_COUNT" "$(node --version)" "$(pnpm --version)"

log "starting unique disposable PostgreSQL container $CONTAINER"
docker run -d --name "$CONTAINER" \
  -e POSTGRES_USER="$PG_USER" \
  -e POSTGRES_PASSWORD="$PG_PASSWORD" \
  -e POSTGRES_DB="$DB_NAME" \
  -p "127.0.0.1::5432" \
  "$PG_IMAGE" >"$STAGE_DIR/container.id"

PG_PORT="$(docker port "$CONTAINER" 5432/tcp | sed -E 's/.*:([0-9]+)$/\1/' | tail -n 1)"
[[ "$PG_PORT" =~ ^[0-9]+$ && "$PG_PORT" != "54329" ]] \
  || { echo "failed to allocate a safe PostgreSQL port" >&2; exit 1; }
DB_URL="postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${DB_NAME}"

for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U "$PG_USER" -d "$DB_NAME" >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U "$PG_USER" -d "$DB_NAME" >/dev/null \
  || { echo "disposable PostgreSQL did not become ready" >&2; exit 1; }

psql_db() {
  docker exec -i "$CONTAINER" psql -U "$PG_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"
}

log "stage 1/13: replay current 48-migration chain"
(cd "$REPO_ROOT" && \
  DOTENV_CONFIG_PATH=/dev/null DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" \
  pnpm exec prisma migrate deploy) >"$STAGE_DIR/migrate-deploy.log" 2>&1
APPLIED="$(grep -c 'Applying migration' "$STAGE_DIR/migrate-deploy.log" || true)"
[[ "$APPLIED" == "48" ]] || { echo "migration replay applied $APPLIED of 48" >&2; exit 1; }
echo "$APPLIED" >"$STAGE_DIR/migrations-applied.count"

log "stage 2/13: load synthetic non-PII fixture"
psql_db -q <"$SCRIPT_DIR/fixture/01-synthetic-fixture.sql" >"$STAGE_DIR/fixture.log" 2>&1

log "stage 3/13: enforce preflight before DB-05"
(cd "$REPO_ROOT" && DATABASE_URL="$DB_URL" \
  node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable --enforce \
    --report-file "$STAGE_DIR/preflight-before.json") >"$STAGE_DIR/preflight-before.log" 2>&1

backfill() {
  local mode="$1" operation="$2" prefix="$3"
  (cd "$REPO_ROOT" && pnpm exec tsx scripts/db-rehearsal/backfill/backfill.mts \
    --operation "$operation" --mode "$mode" --url "$DB_URL" \
    --confirm-disposable --report-file "$STAGE_DIR/${prefix}-${operation}.json") \
    >"$STAGE_DIR/${prefix}-${operation}.log" 2>&1
}

OPERATIONS=(settings-consolidation addon-usage-json-to-ledger item-photo-direct-to-join)

log "stage 4/13: apply all three DB-05 backfills"
for operation in "${OPERATIONS[@]}"; do backfill apply "$operation" apply; done

log "stage 5/13: prove DB-05 idempotency"
for operation in "${OPERATIONS[@]}"; do backfill apply "$operation" apply2; done
node -e '
  const fs = require("node:fs");
  for (const file of process.argv.slice(1)) {
    const report = JSON.parse(fs.readFileSync(file, "utf8"));
    if (report.rowsChanged !== 0 || report.exitCode !== 0) throw new Error(`${file}: not idle`);
  }
' "$STAGE_DIR"/apply2-*.json

log "stage 6/13: enforce reconciliation after DB-05"
(cd "$REPO_ROOT" && DATABASE_URL="$DB_URL" \
  node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable --enforce \
    --report-file "$STAGE_DIR/preflight-after-backfill.json") >"$STAGE_DIR/preflight-after-backfill.log" 2>&1

log "stage 7/13: capture pre-binary schema and aggregate preservation baseline"
(cd "$REPO_ROOT" && node scripts/db-rehearsal/schema-diff.mjs fingerprint \
  --url "$DB_URL" --out "$STAGE_DIR/schema-before.txt" --confirm-disposable) \
  >"$STAGE_DIR/fingerprint-before.log" 2>&1
psql_db -Atc '
  SELECT json_build_object(
    '\''addonJsonRows'\'', (SELECT COUNT(*) FROM "service_order" WHERE id = '\''fxso5'\'' AND "addonUsages" IS NOT NULL),
    '\''addonLedgerRows'\'', (SELECT COUNT(*) FROM "service_order_addon_usage" WHERE "serviceOrderId" = '\''fxso5'\''),
    '\''directImageRows'\'', (SELECT COUNT(*) FROM "service_order_item" WHERE id = '\''fxsoi4'\'' AND "imageId" IS NOT NULL),
    '\''imageJoinRows'\'', (SELECT COUNT(*) FROM "service_order_item_image" WHERE "serviceOrderItemId" = '\''fxsoi4'\''),
    '\''partialIndexes'\'', (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = '\''public'\'' AND indexname IN ('\''user_normalizedPhoneNumber_active_key'\'', '\''customer_claim_token_userId_active_key'\''))
  );' >"$STAGE_DIR/preservation-before.json"
node -e '
  const fs = require("node:fs");
  const snapshot = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (snapshot.partialIndexes !== 2) throw new Error(`expected both partial indexes, found ${snapshot.partialIndexes}`);
' "$STAGE_DIR/preservation-before.json"

log "stage 8/13: install, generate and build actual old source archive"
(cd "$OLD_SOURCE" && pnpm install --frozen-lockfile) >"$STAGE_DIR/old-install.log" 2>&1
(cd "$OLD_SOURCE" && DOTENV_CONFIG_PATH=/dev/null DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" \
  pnpm exec prisma generate) >"$STAGE_DIR/old-prisma-generate.log" 2>&1
(cd "$OLD_SOURCE" && \
  DOTENV_CONFIG_PATH=/dev/null \
  DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" \
  BETTER_AUTH_URL="http://127.0.0.1:3000" BETTER_AUTH_TRUSTED_ORIGINS="http://127.0.0.1:3000" \
  BETTER_AUTH_SECRET="synthetic-old-binary-secret-with-sufficient-length" \
  NUXT_PUBLIC_HOSTNAME="127.0.0.1" NUXT_PUBLIC_BASE_URL="http://127.0.0.1:3000" \
  INTERNAL_BASE_URL="http://127.0.0.1:3000" NUXT_PUBLIC_LIFF_ID="synthetic" \
  LINE_BIZ_CHAT_URL="https://example.test/line" CLOUDINARY_NAME="synthetic" \
  CLOUDINARY_API_KEY="" CLOUDINARY_API_SECRET="" \
  LINE_LIFF_CLIENT_ID="synthetic" LINE_LIFF_CLIENT_SECRET="synthetic" \
  LINE_CHANNEL_ACCESS_TOKEN="" LINE_CHANNEL_ID="" LINE_CHANNEL_SECRET="" \
  LINE_MESSAGING_API="" LINE_MESSAGING_DATA_API="" LINE_MESSAGING_OAUTH_ISSUE_TOKENV3="" \
  RESEND_API_KEY="" RESEND_FROM="fixture@example.test" CRON_SECRET="" \
  pnpm run build) >"$STAGE_DIR/old-build.log" 2>&1
echo 0 >"$STAGE_DIR/old-build.exit"

APP_PORT="$(node -e 'const net=require("node:net");const s=net.createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})')"
BASE_URL="http://127.0.0.1:${APP_PORT}"

log "stage 9/13: start actual old .output server on loopback"
(cd "$OLD_SOURCE" && \
  DOTENV_CONFIG_PATH=/dev/null \
  DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" \
  BETTER_AUTH_URL="$BASE_URL" BETTER_AUTH_TRUSTED_ORIGINS="$BASE_URL" \
  BETTER_AUTH_SECRET="synthetic-old-binary-secret-with-sufficient-length" \
  TRUSTED_PROXIES="127.0.0.1,::1" NUXT_PUBLIC_HOSTNAME="127.0.0.1" \
  NUXT_PUBLIC_BASE_URL="$BASE_URL" INTERNAL_BASE_URL="$BASE_URL" \
  NUXT_PUBLIC_LIFF_ID="synthetic" LINE_BIZ_CHAT_URL="https://example.test/line" \
  CLOUDINARY_NAME="synthetic" CLOUDINARY_API_KEY="" CLOUDINARY_API_SECRET="" \
  LINE_LIFF_CLIENT_ID="synthetic" LINE_LIFF_CLIENT_SECRET="synthetic" \
  LINE_CHANNEL_ACCESS_TOKEN="" LINE_CHANNEL_ID="" LINE_CHANNEL_SECRET="" \
  LINE_MESSAGING_API="" LINE_MESSAGING_DATA_API="" LINE_MESSAGING_OAUTH_ISSUE_TOKENV3="" \
  RESEND_API_KEY="" RESEND_FROM="fixture@example.test" CRON_SECRET="" \
  HOST="127.0.0.1" PORT="$APP_PORT" NODE_ENV="production" \
  node .output/server/index.mjs) >"$RAW_SERVER_LOG" 2>&1 &
SERVER_PID=$!

READY=0
for _ in $(seq 1 120); do
  if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then break; fi
  if curl --silent --fail --max-time 2 "$BASE_URL/api/public/shop-settings" >/dev/null 2>&1; then READY=1; break; fi
  sleep 1
done
[[ "$READY" == "1" ]] || { echo "old application did not become HTTP-ready" >&2; exit 1; }
echo '{"ready":true,"endpoint":"GET /api/public/shop-settings"}' >"$STAGE_DIR/server-ready.json"

log "stage 10/13: exercise public, authenticated read and legacy write paths via HTTP"
(cd "$REPO_ROOT" && \
  DATABASE_URL="$DB_URL" OLD_BINARY_TEST_PASSWORD="synthetic-password-12345" \
  node scripts/db-rehearsal/old-binary-http-check.mjs \
    --base-url "$BASE_URL" --report-file "$STAGE_DIR/http-check.json" --confirm-disposable) \
  >"$STAGE_DIR/http-check.log" 2>&1
if grep -Eiq 'prisma[[:space:]]+migrate|Applying migration' "$RAW_SERVER_LOG"; then
  echo "old server attempted or reported a migration" >&2
  exit 1
fi
echo '{"oldServerMigrationAttempt":false}' >"$STAGE_DIR/server-migration-check.json"

log "stage 11/13: verify schema/data preservation after old-only write"
(cd "$REPO_ROOT" && node scripts/db-rehearsal/schema-diff.mjs fingerprint \
  --url "$DB_URL" --out "$STAGE_DIR/schema-after.txt" --confirm-disposable) \
  >"$STAGE_DIR/fingerprint-after.log" 2>&1
cmp "$STAGE_DIR/schema-before.txt" "$STAGE_DIR/schema-after.txt"
echo '{"schemaUnchanged":true}' >"$STAGE_DIR/schema-equality.json"
psql_db -Atc '
  SELECT json_build_object(
    '\''addonJsonRows'\'', (SELECT COUNT(*) FROM "service_order" WHERE id = '\''fxso5'\'' AND "addonUsages" IS NOT NULL),
    '\''addonLedgerRows'\'', (SELECT COUNT(*) FROM "service_order_addon_usage" WHERE "serviceOrderId" = '\''fxso5'\''),
    '\''directImageRows'\'', (SELECT COUNT(*) FROM "service_order_item" WHERE id = '\''fxsoi4'\'' AND "imageId" IS NOT NULL),
    '\''imageJoinRows'\'', (SELECT COUNT(*) FROM "service_order_item_image" WHERE "serviceOrderItemId" = '\''fxsoi4'\''),
    '\''partialIndexes'\'', (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = '\''public'\'' AND indexname IN ('\''user_normalizedPhoneNumber_active_key'\'', '\''customer_claim_token_userId_active_key'\''))
  );' >"$STAGE_DIR/preservation-after.json"
cmp "$STAGE_DIR/preservation-before.json" "$STAGE_DIR/preservation-after.json"
node -e '
  const fs = require("node:fs");
  const snapshot = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (snapshot.partialIndexes !== 2) throw new Error(`expected both partial indexes, found ${snapshot.partialIndexes}`);
' "$STAGE_DIR/preservation-after.json"

log "stage 12/13: post-drill preflight and expected resync detection"
(cd "$REPO_ROOT" && DATABASE_URL="$DB_URL" \
  node scripts/db-rehearsal/run-preflight.mjs --confirm-disposable --enforce \
    --report-file "$STAGE_DIR/preflight-after-old-binary.json") \
  >"$STAGE_DIR/preflight-after-old-binary.log" 2>&1
set +e
backfill dry-run settings-consolidation expected-resync
RESYNC_EXIT=$?
set -e
[[ "$RESYNC_EXIT" == "1" ]] || { echo "expected settings resync mismatch exit 1, got $RESYNC_EXIT" >&2; exit 1; }
node -e '
  const fs = require("node:fs");
  const report = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
  if (report.rowsChanged !== 0 || !report.mismatches.some((row) => row.detail === "field:name")) {
    throw new Error("old-only write was not detected as a fail-closed settings mismatch");
  }
' "$STAGE_DIR/expected-resync-settings-consolidation.json"

log "stage 13/13: prove current checkout was not mutated by archive/build"
FINAL_STATUS_HASH="$(git -C "$REPO_ROOT" status --porcelain=v1 | shasum -a 256 | awk '{print $1}')"
[[ "$CURRENT_STATUS_HASH" == "$FINAL_STATUS_HASH" ]] \
  || { echo "current working-tree state changed during the drill" >&2; exit 1; }
[[ "$(git -C "$REPO_ROOT" rev-parse HEAD)" == "$CURRENT_HASH" ]] \
  || { echo "current HEAD changed during the drill" >&2; exit 1; }

node -e '
  const fs = require("node:fs");
  const [path, oldHash, currentHash, statusHash, pgPort, appPort] = process.argv.slice(1);
  fs.writeFileSync(path, JSON.stringify({ ok: true, verdict: "G2_PASS", oldHash, currentHash, finalWorkingTreeStatusHash: statusHash, topology: { database: "loopback disposable PostgreSQL 16", databaseName: "rehearsal_old_binary", pgPort: Number(pgPort), application: "actual old Nitro production binary", appPort: Number(appPort) }, expectedTargetStaleness: true, resyncRequirement: "Return to the compatibility app (which still reads legacy settings), then re-save changed settings through its admin API before DB-06; DB-05 correctly refuses to overwrite a non-empty mismatched target." }, null, 2) + "\n", { mode: 0o600 });
' "$STAGE_DIR/summary.json" "$OLD_HASH" "$CURRENT_HASH" "$FINAL_STATUS_HASH" "$PG_PORT" "$APP_PORT"

log "ALL 13 STAGES PASSED"
log "G2 evidence is sufficient on synthetic disposable data; G3 remains pending"
