#!/usr/bin/env bash
# Rehearses the forward-only Printer/PrintJob removal on disposable PostgreSQL.
# It never reads .env and refuses non-loopback targets by construction.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_IMAGE="${REHEARSAL_PG_IMAGE:-postgres:16}"
PG_PORT="${REHEARSAL_PG_PORT:-5442}"
PG_USER="postgres"
PG_PASSWORD="rehearsal"
DB_NAME="rehearsal_print_drop"
RESTORE_DB="rehearsal_print_restore"
CONTAINER="saijai-print-drop-$RANDOM-$$"
STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/saijai-print-drop.XXXXXX")"
TEMP_PRISMA="$(mktemp -d "${TMPDIR:-/tmp}/saijai-print-prisma.XXXXXX")"
DB_URL="postgresql://${PG_USER}:${PG_PASSWORD}@127.0.0.1:${PG_PORT}/${DB_NAME}"
DROP_MIGRATION="20260903220000_direct_print_remove_queue"

cleanup() {
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -rf "$TEMP_PRISMA"
  if [[ "${REHEARSAL_KEEP_STAGE:-}" != "1" ]]; then rm -rf "$STAGE_DIR"; fi
}
trap cleanup EXIT
log() { printf '\n[print-drop] %s\n' "$*"; }

log "evidence directory: $STAGE_DIR"
docker run -d --name "$CONTAINER" \
  -e POSTGRES_USER="$PG_USER" -e POSTGRES_PASSWORD="$PG_PASSWORD" \
  -e POSTGRES_DB="$DB_NAME" -p "127.0.0.1:${PG_PORT}:5432" "$PG_IMAGE" >/dev/null
for _ in $(seq 1 60); do
  docker exec "$CONTAINER" pg_isready -U "$PG_USER" -d "$DB_NAME" >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$CONTAINER" pg_isready -U "$PG_USER" -d "$DB_NAME" >/dev/null

mkdir -p "$TEMP_PRISMA/migrations"
cp "$REPO_ROOT/prisma/schema.prisma" "$TEMP_PRISMA/schema.prisma"
cp "$REPO_ROOT/prisma/migrations/migration_lock.toml" "$TEMP_PRISMA/migrations/migration_lock.toml"
for migration in "$REPO_ROOT"/prisma/migrations/20*; do
  [[ "$(basename "$migration")" == "$DROP_MIGRATION" ]] && continue
  cp -R "$migration" "$TEMP_PRISMA/migrations/"
done

log "replaying schema immediately before the drop migration"
(cd "$REPO_ROOT" && DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" \
  REHEARSAL_SCHEMA_PATH="$TEMP_PRISMA/schema.prisma" \
  REHEARSAL_MIGRATIONS_PATH="$TEMP_PRISMA/migrations" \
  pnpm exec prisma migrate deploy --config scripts/db-rehearsal/prisma-temporary.config.ts) \
  >"$STAGE_DIR/pre-drop-replay.log" 2>&1

psql_db() { docker exec -i "$CONTAINER" psql -U "$PG_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 "$@"; }
psql_db -q <"$REPO_ROOT/scripts/db-rehearsal/fixture/01-synthetic-fixture.sql"
psql_db -q <<'SQL'
INSERT INTO "printer" ("id", "name", "defaultTransport", "paperWidthMm", "printableDots", "updatedAt")
VALUES ('printer_drop_rehearsal', 'Synthetic printer', 'WIFI', 80, 576, now());

INSERT INTO "print_job" (
  "id", "printerId", "kind", "documentId", "documentNo", "documentRevision",
  "sourcePaymentId", "sourceStatus", "sourceRevision", "amountMinor",
  "snapshotHasPaymentQr", "snapshot", "snapshotHash", "renderVersion",
  "requestedById", "selectedTransport", "idempotencyKey", "timeline", "updatedAt"
) SELECT
  'print_job_drop_rehearsal', 'printer_drop_rehearsal', 'RECEIPT', p."id", 'RC-DROP-1', 1,
  p."id", p."status", 1, 100,
  false, '{}'::jsonb, 'synthetic', 'direct-cutover',
  p."userId", 'WIFI', 'drop-rehearsal', '[]'::jsonb, now()
FROM "payment_record" p
ORDER BY p."id"
LIMIT 1;

DO $$
BEGIN
  IF (SELECT count(*) FROM "printer") < 1 OR (SELECT count(*) FROM "print_job") < 1 THEN
    RAISE EXCEPTION 'synthetic printer/job rows were not created';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid IN ('"printer"'::regclass, '"print_job"'::regclass)
      AND c.conrelid NOT IN ('"printer"'::regclass, '"print_job"'::regclass)
  ) THEN
    RAISE EXCEPTION 'unexpected external foreign key depends on printer tables';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_rewrite r
    JOIN pg_class v ON v.oid = r.ev_class
    JOIN pg_depend d ON d.objid = r.oid
    WHERE v.relkind IN ('v', 'm')
      AND d.refobjid IN ('"printer"'::regclass, '"print_job"'::regclass)
  ) THEN
    RAISE EXCEPTION 'unexpected view depends on printer tables';
  END IF;
END $$;
SQL

psql_db -Atc "SELECT json_build_object('printerRows',(SELECT count(*) FROM printer),'printJobRows',(SELECT count(*) FROM print_job),'printerBytes',pg_total_relation_size('printer'),'printJobBytes',pg_total_relation_size('print_job'));" \
  >"$STAGE_DIR/preflight-aggregate.json"
docker exec "$CONTAINER" pg_dump -U "$PG_USER" -Fc "$DB_NAME" >"$STAGE_DIR/pre-drop-backup.dump"

signature() {
  local output="$1"
  : >"$output"
  while IFS= read -r table; do
    psql_db -Atc "SELECT '${table}|' || count(*) || '|' || md5(COALESCE(string_agg(md5(to_jsonb(t)::text), '' ORDER BY md5(to_jsonb(t)::text)), '')) FROM \"${table}\" t;" </dev/null >>"$output"
  done < <(psql_db -Atc "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('printer','print_job','_prisma_migrations') ORDER BY tablename;")
}

signature "$STAGE_DIR/business-before.txt"
log "applying explicit drop migration"
psql_db -q <"$REPO_ROOT/prisma/migrations/$DROP_MIGRATION/migration.sql"
signature "$STAGE_DIR/business-after.txt"
diff -u "$STAGE_DIR/business-before.txt" "$STAGE_DIR/business-after.txt" >"$STAGE_DIR/business-signature.diff"

psql_db -q <<'SQL'
DO $$
BEGIN
  IF to_regclass('public.printer') IS NOT NULL OR to_regclass('public.print_job') IS NOT NULL THEN
    RAISE EXCEPTION 'printer tables remain after migration';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname IN ('PrinterModel','PrintTransport','PrintRenderMode','PrintDocumentKind','PrintJobStatus')) THEN
    RAISE EXCEPTION 'printer enum remains after migration';
  END IF;
END $$;
SQL

log "checking database shape against prisma/schema.prisma"
(cd "$REPO_ROOT" && DATABASE_URL="$DB_URL" DIRECT_URL="$DB_URL" \
  pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script) \
  >"$STAGE_DIR/prisma-diff.sql" 2>"$STAGE_DIR/prisma-diff.log"
# Prisma cannot express the two intentional partial unique indexes retained by
# the existing migration chain. No other generated statement is accepted.
grep -q 'DROP INDEX "user_normalizedPhoneNumber_active_key"' "$STAGE_DIR/prisma-diff.sql"
grep -q 'DROP INDEX "customer_claim_token_userId_active_key"' "$STAGE_DIR/prisma-diff.sql"
UNEXPECTED_DIFF="$(sed -E '/^[[:space:]]*($|--)/d' "$STAGE_DIR/prisma-diff.sql" \
  | grep -Fv 'DROP INDEX "user_normalizedPhoneNumber_active_key";' \
  | grep -Fv 'DROP INDEX "customer_claim_token_userId_active_key";' || true)"
if [[ -n "$UNEXPECTED_DIFF" ]]; then
  printf '%s\n' "$UNEXPECTED_DIFF" >&2
  exit 1
fi

log "verifying the pre-drop backup can restore the removed rows"
docker exec "$CONTAINER" createdb -U "$PG_USER" "$RESTORE_DB"
docker exec -i "$CONTAINER" pg_restore -U "$PG_USER" -d "$RESTORE_DB" --no-owner --no-privileges \
  <"$STAGE_DIR/pre-drop-backup.dump" >"$STAGE_DIR/restore.log" 2>&1
docker exec "$CONTAINER" psql -U "$PG_USER" -d "$RESTORE_DB" -Atc \
  "SELECT (SELECT count(*) FROM printer) || '|' || (SELECT count(*) FROM print_job);" \
  >"$STAGE_DIR/restored-printer-counts.txt"
grep -Eq '^[1-9][0-9]*\|[1-9][0-9]*$' "$STAGE_DIR/restored-printer-counts.txt"

log "ALL STAGES PASSED"
log "evidence: preflight aggregate, business signatures, prisma diff, and verified pre-drop backup"
