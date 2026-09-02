#!/usr/bin/env bash
# Restore drill for the external-encrypted-backups policy
# (docs/db-g3-production-approval-packet.md section 4.1): download the latest
# encrypted backup from R2, decrypt it, verify the SHA-256 recorded at backup
# time, and prove pg_restore can read the archive. This is the drill evidence
# for backupPolicy.lastRestoreDrillAt; run the full 12-stage rehearsal
# (run-production-shape-rehearsal.sh) on the decrypted archive for Approval A
# reruns. Read-only against production. Secrets stay in the environment:
#
#   DIRECT_URL=... BACKUP_ENCRYPTION_KEY=... R2_ENDPOINT=... R2_BUCKET=... \
#     R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... \
#     scripts/production-backup/restore-drill.sh
#
# Exit codes: 0 ok, 1 drill failure, 64 usage.

set -euo pipefail

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/saijai-restore-drill.XXXXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT
umask 077

fail() {
  printf '%s\n' "$1" >&2
  exit "${2:-1}"
}

for tool in openssl node shasum; do
  command -v "$tool" >/dev/null 2>&1 || fail "missing required tool: $tool" 64
done
command -v pg_restore >/dev/null 2>&1 || command -v docker >/dev/null 2>&1 \
  || fail "pg_restore (or docker as fallback) is required" 64

[ -n "${R2_ENDPOINT:-}" ] || fail "R2_ENDPOINT is required" 64
[ -n "${R2_BUCKET:-}" ] || fail "R2_BUCKET is required" 64
[ -n "${BACKUP_ENCRYPTION_KEY:-}" ] || fail "BACKUP_ENCRYPTION_KEY is required" 64
[ -n "${R2_ACCESS_KEY_ID:-${AWS_ACCESS_KEY_ID:-}}" ] || fail "R2_ACCESS_KEY_ID is required" 64
[ -n "${R2_SECRET_ACCESS_KEY:-${AWS_SECRET_ACCESS_KEY:-}}" ] || fail "R2_SECRET_ACCESS_KEY is required" 64

R2_S3_MJS="$(cd "$(dirname "$0")" && pwd)/r2-s3.mjs"
PG_IMAGE="${BACKUP_PG_IMAGE:-postgres:17-alpine}"
PREFIX="${R2_PREFIX:-saijai-production}"

# Cutoff one day in the future lists every object in the bucket.
CUTOFF="$(date -u -v+1d +%Y-%m-%dT%H:%M:%SZ 2>/dev/null \
  || date -u -d "1 day" +%Y-%m-%dT%H:%M:%SZ)"
KEYS="$(node "$R2_S3_MJS" list-old --endpoint "$R2_ENDPOINT" \
  --bucket "$R2_BUCKET" --prefix "$PREFIX/" --cutoff "$CUTOFF")"
[ -n "$KEYS" ] || fail "no backup objects found under $PREFIX/" 1

LATEST="$(printf '%s\n' "$KEYS" | sort | grep '\.dump\.enc$' | tail -n 1)"
[ -n "$LATEST" ] || fail "no .dump.enc backup found under $PREFIX/" 1
STAMP="$(basename "$LATEST" .dump.enc)"
SUMMARY_KEY="${LATEST%.dump.enc}.summary.json"
echo "drilling latest backup: $LATEST"

node "$R2_S3_MJS" get --endpoint "$R2_ENDPOINT" --bucket "$R2_BUCKET" \
  --key "$LATEST" --file "$WORK_DIR/backup.dump.enc"
node "$R2_S3_MJS" get --endpoint "$R2_ENDPOINT" --bucket "$R2_BUCKET" \
  --key "$SUMMARY_KEY" --file "$WORK_DIR/backup.summary.json"

EXPECTED_SHA="$(node -e "console.log(JSON.parse(require('fs').readFileSync('$WORK_DIR/backup.summary.json','utf8')).dumpSha256)")"
[ -n "$EXPECTED_SHA" ] || fail "summary json has no dumpSha256" 1

openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 \
  -in "$WORK_DIR/backup.dump.enc" -out "$WORK_DIR/backup.dump" \
  -pass env:BACKUP_ENCRYPTION_KEY
ACTUAL_SHA="$(shasum -a 256 "$WORK_DIR/backup.dump" | awk '{print $1}')"
[ "$ACTUAL_SHA" = "$EXPECTED_SHA" ] || fail "SHA-256 mismatch after decrypt: expected $EXPECTED_SHA got $ACTUAL_SHA" 1

LIST_OUT="$WORK_DIR/pg_restore-list.txt"
if command -v pg_restore >/dev/null 2>&1; then
  pg_restore --list "$WORK_DIR/backup.dump" > "$LIST_OUT"
else
  docker run --rm --volume "$WORK_DIR:/backup" "$PG_IMAGE" \
    pg_restore --list /backup/backup.dump > "$LIST_OUT"
fi
# Custom-format archives list a ";     Format: CUSTOM" TOC header; the
# "PostgreSQL database dump" banner only exists in plain-text dumps.
grep -q "Format: CUSTOM" "$LIST_OUT" \
  || fail "pg_restore --list output does not look like a custom-format dump" 1

echo "drill ok: $LATEST"
echo "createdAt: $STAMP"
echo "decrypted sha256: $ACTUAL_SHA"
echo "restoreDrillReference: backup-drill-$STAMP"
