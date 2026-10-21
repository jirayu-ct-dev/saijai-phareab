---
name: saijai-production-backup
description: Operate and recover Saijai Phareab's Supabase PostgreSQL backups encrypted in Cloudflare R2; use for backup status, retention, restore drills, or a database recovery incident.
---

# Saijai production database backup

Use this workflow for the Saijai production database backup in Cloudflare R2. It documents the current VPS setup and the safe checks for recovering an archive. It does not authorize production reads, writes, restores, migrations, or deletion; follow the user's current request for those actions.

## Current setup

- Production PostgreSQL is in Supabase. Cloudflare R2 bucket: `saijai-production-backups`; prefix: `saijai-production/`.
- The VPS runs `saijai-db-backup.timer` at 19:00 UTC (02:00 Asia/Bangkok). It calls `scripts/production-backup/r2-backup.sh` and reads root-only `/etc/saijai-db-backup.env`.
- The VPS uses ignored `secrets/production-backup.env`, mode `0600` inside a mode `0700` `secrets/` directory. It contains the production `DIRECT_URL`, the VPS IP-restricted R2 token pair, and the encryption key. Never print the file, commit it, attach it, or enable shell tracing while it is loaded.
- Mac recovery uses ignored `secrets/production-backup-mac.env` with mode `0600` in the same mode `0700` directory. It contains a long-lived R2 Object Read only token scoped to `saijai-production-backups` and the encryption key, but no database URL and no write credentials. Its token has no source-IP restriction so the Mac can recover from changing networks. Anyone who obtains this file can download and decrypt production backups; keep it local and protected. Do not use it to create or prune backups.
- Backups are custom-format `pg_dump` archives encrypted with AES-256-CBC and PBKDF2 (600,000 iterations). The summary beside each archive records the plaintext SHA-256. The encryption key must remain available independently of R2.
- The backup job prunes objects older than 14 days. The R2 bucket also has a 14-day lifecycle rule for `saijai-production/` as a backstop.

## Check backup health

1. On the VPS, check `systemctl is-active saijai-db-backup.timer` and `systemctl list-timers saijai-db-backup.timer`.
2. Review `journalctl -u saijai-db-backup.service` for the latest `backup ok` or failure. Logs may contain object names and timestamps; do not paste them publicly.
3. To verify R2 access, decryption, checksum, and archive readability, run `scripts/production-backup/restore-drill.sh` with the backup environment loaded on either the VPS or Mac. On Mac, use the dedicated read-only recovery environment below. It downloads the latest archive, decrypts it in a temporary directory, checks the summary hash, and runs `pg_restore --list`. It never restores to a database.
4. A completed run is confirmed only when the service result is `success` and the restore drill passes. If either fails, retain existing R2 objects and the encryption key while diagnosing.

For a manual backup from the project checkout, load the VPS credential file without echoing values:

```bash
set -a
. secrets/production-backup.env
set +a
```

After loading it, run `scripts/production-backup/r2-backup.sh` only for a requested new backup, or `scripts/production-backup/restore-drill.sh` to verify an existing archive. Do not run either command with `set -x`.

For a Mac-only read and recovery drill, load only the read-only file and run:

```bash
set -euo pipefail
set -a
. secrets/production-backup-mac.env
set +a
scripts/production-backup/restore-drill.sh
```

This Mac credential cannot upload or delete R2 objects. The drill downloads the latest encrypted archive, verifies decryption and checksum, and confirms `pg_restore --list`; it does not restore to Supabase or another database. Do not load `secrets/production-backup.env` on a Mac just to run this drill.

## Restore safely

The routine restore drill is not a database restore. For a full rehearsal, use `scripts/db-rehearsal/run-production-shape-rehearsal.sh`; it requires an explicitly approved decrypted archive, a checksum, the source PostgreSQL major, an approval reference, and confirmation that its local Docker database is disposable. It never connects to production and restores only the application-owned `public` schema into an isolated container.

To prepare that exact archive for a full local rehearsal, first run the metadata drill and use its reported timestamp to select the matching R2 key:

```bash
set -euo pipefail
umask 077
set -a
. secrets/production-backup.env
set +a
ARCHIVE_KEY='saijai-production/<approved-timestamp>.dump.enc'
SUMMARY_KEY="${ARCHIVE_KEY%.dump.enc}.summary.json"
RESTORE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/saijai-approved-restore.XXXXXXXX")"
chmod 700 "$RESTORE_DIR"
node scripts/production-backup/r2-s3.mjs get --endpoint "$R2_ENDPOINT" --bucket "$R2_BUCKET" --key "$ARCHIVE_KEY" --file "$RESTORE_DIR/backup.dump.enc"
node scripts/production-backup/r2-s3.mjs get --endpoint "$R2_ENDPOINT" --bucket "$R2_BUCKET" --key "$SUMMARY_KEY" --file "$RESTORE_DIR/summary.json"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -in "$RESTORE_DIR/backup.dump.enc" -out "$RESTORE_DIR/backup.dump" -pass env:BACKUP_ENCRYPTION_KEY
EXPECTED_SHA="$(node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).dumpSha256)' "$RESTORE_DIR/summary.json")"
ACTUAL_SHA="$(shasum -a 256 "$RESTORE_DIR/backup.dump" | awk '{print $1}')"
test "$ACTUAL_SHA" = "$EXPECTED_SHA"
docker run --rm --volume "$RESTORE_DIR:/backup:ro" "${BACKUP_PG_IMAGE:-postgres:17-alpine}" pg_restore --list /backup/backup.dump > "$RESTORE_DIR/archive-list.txt"
SOURCE_PG_MAJOR="$(sed -n 's/^;[[:space:]]*Dumped from database version: //p' "$RESTORE_DIR/archive-list.txt" | head -n 1 | cut -d. -f1)"
test -n "$SOURCE_PG_MAJOR"
```

Only after the user approves the exact archive and disposable rehearsal, set `APPROVAL_REFERENCE` to the ticket or chat reference and run:

```bash
scripts/db-rehearsal/run-production-shape-rehearsal.sh \
  --backup-file "$RESTORE_DIR/backup.dump" \
  --expected-sha256 "$EXPECTED_SHA" \
  --expected-source-pg-major "$SOURCE_PG_MAJOR" \
  --approval-reference "$APPROVAL_REFERENCE" \
  --confirm-approved-backup --confirm-local-disposable
```

Keep this temporary directory mode `0700`; it contains a plaintext production dump.

For a real production recovery:

1. Identify the recovery point and destination with the user. Prefer a separate recovery project/database or the provider's supported recovery mechanism when suitable.
2. Use the matching `.summary.json` and `.dump.enc` pair. Decrypt with the saved `BACKUP_ENCRYPTION_KEY`, verify the decrypted archive against `dumpSha256`, and confirm `pg_restore --list` succeeds before choosing a restore target.
3. Keep the original Supabase project and archive intact until the recovered database has been checked. Never use the source `DIRECT_URL` as the restore destination and never restore over production without explicit, current user approval.
4. After recovery, validate schema/migration state, key application data and login/order flows before any DNS or application cutover.

If the key is missing, decryption or checksum verification fails, or the source PostgreSQL major is unclear, stop before any database write. Do not regenerate the key: a different key cannot decrypt existing archives.
