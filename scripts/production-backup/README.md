# Production database backup operations

These scripts implement the external encrypted PostgreSQL backup path. They are
operational tools, not part of the Nuxt runtime, and do not grant permission to
connect to production. Use them only in an approved scheduler or maintenance
window with secrets supplied through its secret manager.

## Backup

`r2-backup.sh` creates a custom-format `pg_dump`, encrypts it with AES-256-CBC
and PBKDF2, verifies a local decrypt round trip, uploads the encrypted archive
and checksum summary to Cloudflare R2, and prunes objects older than the
configured retention. The minimum accepted retention is 14 days.

Required environment:

- `DIRECT_URL` (or `DATABASE_URL`)
- `BACKUP_ENCRYPTION_KEY`
- `R2_ENDPOINT`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` (AWS-compatible names also work)

Optional environment:

- `BACKUP_RETENTION_DAYS` (default and minimum: `14`)
- `R2_PREFIX` (default: `saijai-production`)
- `BACKUP_PG_IMAGE` (default: `postgres:17-alpine`)

Run from the repository root without printing environment values:

```bash
scripts/production-backup/r2-backup.sh
```

The production VPS runs `saijai-db-backup.timer` daily at 19:00 UTC
(02:00 Asia/Bangkok). It reads its secrets from the root-only
`/etc/saijai-db-backup.env`; check the schedule with
`systemctl list-timers saijai-db-backup.timer` and run logs with
`journalctl -u saijai-db-backup.service`. Each successful run keeps the newest
14 days in R2. The bucket also has an enabled 14-day lifecycle rule scoped to
`saijai-production/` as a retention backstop if the VPS timer stops running.

## Restore drill

`restore-drill.sh` downloads the newest encrypted archive and summary, decrypts
it, verifies the recorded SHA-256, and confirms that `pg_restore` can read the
custom-format archive. It does not restore over production.

```bash
scripts/production-backup/restore-drill.sh
```

A successful metadata drill is not a full application restore test. Use
`scripts/db-rehearsal/run-production-shape-rehearsal.sh` with an explicitly
approved backup when a disposable full restore and schema/application checks
are required.

## Security and evidence

- Keep database URLs, encryption keys, R2 credentials, archives, and raw
  evidence outside Git.
- Keep the encryption key outside both PostgreSQL and the R2 bucket.
- Restrict scheduler and evidence files to the service account or operator.
- Treat log lines containing object names and timestamps as operational data.
- Never infer authorization for production reads, dumps, restore, migration,
  backfill, deploy, or restart from this README.

Exit codes are documented in each script. Tests for the S3-compatible signing
and list parser live in `r2-s3.test.mjs`.
