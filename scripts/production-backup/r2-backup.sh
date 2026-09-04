#!/usr/bin/env bash
# Hourly encrypted production backup for the external-encrypted-backups policy
# (see scripts/production-backup/README.md): pg_dump -> AES-256
# encryption -> Cloudflare R2 upload -> retention prune. Fail-closed; never
# prints connection strings or keys. Run from cron/launchd with secrets in the
# environment, never committed:
#
#   DIRECT_URL=... BACKUP_ENCRYPTION_KEY=... R2_ENDPOINT=... R2_BUCKET=... \
#     AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
#     scripts/production-backup/r2-backup.sh
#
# Exit codes: 0 ok, 1 upload/prune failure, 2 dump/encrypt failure, 64 usage.

set -euo pipefail

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
PREFIX="${R2_PREFIX:-saijai-production}"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/saijai-production-backup.XXXXXXXX")"
LOCK_DIR="/tmp/saijai-production-backup.lock"
cleanup() { rm -rf "$WORK_DIR"; }
trap cleanup EXIT
umask 077

fail() {
  printf '%s\n' "$1" >&2
  exit "${2:-1}"
}

PG_IMAGE="${BACKUP_PG_IMAGE:-postgres:17-alpine}"
for tool in openssl node; do
  command -v "$tool" >/dev/null 2>&1 || fail "missing required tool: $tool" 64
done
command -v pg_dump >/dev/null 2>&1 || command -v docker >/dev/null 2>&1 \
  || fail "pg_dump (or docker as fallback) is required" 64

[ -n "${DIRECT_URL:-${DATABASE_URL:-}}" ] || fail "DIRECT_URL (or DATABASE_URL) is required" 64
[ -n "${BACKUP_ENCRYPTION_KEY:-}" ] || fail "BACKUP_ENCRYPTION_KEY is required" 64
[ -n "${R2_ENDPOINT:-}" ] || fail "R2_ENDPOINT is required (https://<account>.r2.cloudflarestorage.com)" 64
[ -n "${R2_BUCKET:-}" ] || fail "R2_BUCKET is required" 64
[ -n "${R2_ACCESS_KEY_ID:-${AWS_ACCESS_KEY_ID:-}}" ] || fail "R2_ACCESS_KEY_ID is required" 64
[ -n "${R2_SECRET_ACCESS_KEY:-${AWS_SECRET_ACCESS_KEY:-}}" ] || fail "R2_SECRET_ACCESS_KEY is required" 64
R2_S3_MJS="$(cd "$(dirname "$0")" && pwd)/r2-s3.mjs"
case "$RETENTION_DAYS" in ''|*[!0-9]*) fail "BACKUP_RETENTION_DAYS must be a positive integer" 64 ;; esac
[ "$RETENTION_DAYS" -ge 14 ] || fail "policy requires retention >= 14 days" 64

mkdir "$LOCK_DIR" 2>/dev/null || fail "another backup run is in progress" 1
trap 'rm -rf "$WORK_DIR" "$LOCK_DIR"' EXIT

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP_FILE="$WORK_DIR/${PREFIX}-${STAMP}.dump"
ENC_FILE="${DUMP_FILE}.enc"
SUMMARY_FILE="$WORK_DIR/${PREFIX}-${STAMP}.summary.json"
echo "backup start: $STAMP"

# --no-owner/--no-privileges keep the archive restorable into any database.
# Without host pg_dump, dump from a container on the same major as production
# so the archive restores cleanly.
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump --dbname "$DIRECT_URL" --format=custom --no-owner --no-privileges \
    --file "$DUMP_FILE"
else
  docker run --rm --env DIRECT_URL \
    --volume "$WORK_DIR:/backup" "$PG_IMAGE" \
    pg_dump --dbname "$DIRECT_URL" --format=custom --no-owner --no-privileges \
    --file "/backup/$(basename "$DUMP_FILE")"
fi
[ -s "$DUMP_FILE" ] || fail "pg_dump produced an empty archive" 2

# AES-256 with PBKDF2 (openssl enc CLI has no AEAD support; PBKDF2 + high
# iteration count is the accepted alternative for at-rest encryption here).
openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt \
  -in "$DUMP_FILE" -out "$ENC_FILE" -pass env:BACKUP_ENCRYPTION_KEY
[ -s "$ENC_FILE" ] || fail "encryption produced an empty file" 2

DUMP_SHA="$(shasum -a 256 "$DUMP_FILE" | awk '{print $1}')"
ENC_SHA="$(shasum -a 256 "$ENC_FILE" | awk '{print $1}')"
# Round-trip check proves the key can restore this archive before it leaves.
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -in "$ENC_FILE" -out "$WORK_DIR/roundtrip.dump" -pass env:BACKUP_ENCRYPTION_KEY
ROUNDTRIP_SHA="$(shasum -a 256 "$WORK_DIR/roundtrip.dump" | awk '{print $1}')"
[ "$ROUNDTRIP_SHA" = "$DUMP_SHA" ] || fail "round-trip decrypt mismatch" 2

cat > "$SUMMARY_FILE" <<EOF
{"createdAt":"$STAMP","dumpSha256":"$DUMP_SHA","encryptedSha256":"$ENC_SHA","encryption":"aes-256-cbc-pbkdf2-600k","retentionDays":$RETENTION_DAYS}
EOF

OBJECT_BASE="$PREFIX/$STAMP"
node "$R2_S3_MJS" put --endpoint "$R2_ENDPOINT" --bucket "$R2_BUCKET" \
  --key "$OBJECT_BASE.dump.enc" --file "$ENC_FILE"
node "$R2_S3_MJS" put --endpoint "$R2_ENDPOINT" --bucket "$R2_BUCKET" \
  --key "$OBJECT_BASE.summary.json" --file "$SUMMARY_FILE"

# Retention: policy gate reads retentionDays from the attestation; prune keeps
# the bucket inside it. R2 lifecycle rules are the recommended backstop.
CUTOFF="$(date -u -v-${RETENTION_DAYS}d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
  || date -u -d "$RETENTION_DAYS days ago" +%Y-%m-%dT%H:%M:%SZ)"
EXPIRED="$(node "$R2_S3_MJS" list-old --endpoint "$R2_ENDPOINT" \
  --bucket "$R2_BUCKET" --prefix "$PREFIX/" --cutoff "$CUTOFF")" || EXPIRED=""
if [ -n "$EXPIRED" ]; then
  while IFS= read -r key; do
    [ -n "$key" ] || continue
    node "$R2_S3_MJS" delete --endpoint "$R2_ENDPOINT" \
      --bucket "$R2_BUCKET" --key "$key" >/dev/null
  done <<EOF2
$EXPIRED
EOF2
  echo "pruned objects older than $CUTOFF"
fi

echo "backup ok: s3://$R2_BUCKET/$OBJECT_BASE.dump.enc"
echo "encrypted sha256: $ENC_SHA"
echo "latestBackupAt: $STAMP"
