# G3 production approval packet

Status: **Approval B combined PASSED (2026-09-02T19:54Z, `chat-2026-09-03-g3-b`,
blocker 0)**. Operator decision 2026-09-03: keep the Supabase Free Plan and
replace the PITR requirement with the `external-encrypted-backups` policy
(section 4). The final evaluation used a fresh production read-only preflight,
a fresh R2 backup (`20260902T195024Z`) with a passing restore drill
(`backup-drill-20260902T195024Z`), the external backup policy attestation, and
a fresh Vercel runtime observation (single production deployment
`dpl_9HDLPx…`, 0 workers). Approval C (production expand/backfill) has **not**
been requested or run and requires a separate operator approval with a
01:00–03:00 Asia/Bangkok window.
The authoritative rerun selected the one active, uncommented `DIRECT_URL`,
verified the Supabase CA over TLS, and completed all 8 aggregate SQL files in a
read-only transaction. An earlier non-authoritative invocation accidentally
selected the first commented localhost example and stopped before SQL; its
failure report is retained but must not be interpreted as a production check.

เอกสารนี้ใช้เมื่อจะพิสูจน์ DB-03/DB-05 กับรูปทรงและปริมาณข้อมูลใกล้ production
ก่อนพิจารณา DB-06 โดยแยก authority เป็นช่วงสั้น ๆ ชัดเจน ไม่ถือการอนุมัติช่วงหนึ่ง
เป็นสิทธิ์ของช่วงถัดไป

## 1. สถานะและคำตัดสินปัจจุบัน

- G1 ผ่านบน fresh replay/disposable PostgreSQL
- G2 ผ่านบน synthetic disposable PostgreSQL รวม actual old-binary rollback drill
- Production remediation `chat-2026-09-02-payment-receipt-remediation` แก้
  `receiptNo = paymentNo` เพียง 1 แถวใน `SERIALIZABLE` transaction หลังตรวจ
  candidate = 1, payment number มีค่า, collision = 0 และ user trigger = 0;
  invariant ภายใน transaction และหลัง commit จาก connection ใหม่เท่ากับ 0
- Approval A รอบใหม่ `chat-2026-09-02-g3-a-after-receipt-remediation` ผ่านทั้ง
  12 stages บน local PostgreSQL 17: enforced preflight failure = 0,
  mismatch/quarantine = 0, apply รอบสองและ final dry-runเปลี่ยน 0 แถว
- **Approval A เสร็จ และ Approval B combined ผ่านแล้ว (2026-09-02T19:54Z)**:
  `chat-2026-09-03-g3-b` ได้ `APPROVAL_B_PASS` blocker 0 — เหลือเพียง Approval C
  production expand/backfill ซึ่งต้องขออนุมัติ operator แยกต่างหาก
- Approval B `chat-2026-09-02-g3-b` ส่วน database ผ่านแล้ว: PostgreSQL 17.6,
  TLS peer verification, transaction read-only, SQL 8/8, query/invariant failure
  0, migration 47 แถวโดย unfinished/rolled-back = 0 และ backfill target หลัก = 0
- External backup policy ตามคำตัดสิน operator 2026-09-03 ผ่านครบ: backup สด
  `20260902T195024Z` (encrypted SHA-256 `57a214c6…754ed`), restore drill ผ่าน
  `backup-drill-20260902T195024Z`, runtime inventory บน Vercel ยืนยันแล้ว
  (deployment เดียวรับ traffic, worker 0) — หลักฐานรวมอยู่ใน
  `approval-b-attestation-final-2026-09-02T19:54:14Z.json` และ
  `approval-b-summary-final-2026-09-02T19:54:14Z.json` ใน restricted directory
- Platform observation รอบก่อนหน้า (BLOCKED 7 blockers ก่อนนโยบายใหม่มีผล)
  เก็บไว้เป็นประวัติที่
  `approval-b-summary-observed-20260902T165457Z.json`
- ยังไม่อนุญาต production migration/backfill, deploy หรือ DB-06

ตัว harness ผ่าน self-test 12/12 กับ custom-format snapshot สังเคราะห์จาก schema
ก่อน DB-03: schema delta `+27/-0`, canonical drift 0, mismatch/quarantine 0,
apply รอบสองและ final dry-runเปลี่ยน 0 แถว หลักฐานชั่วคราวอยู่ที่
`/var/folders/f5/18ygctb55cncd7h4pchbp6hm0000gn/T/saijai-g3-production-shape.Yirmzb`.
ผลนี้ยืนยันเครื่องมือ ไม่ได้แทน production-shape evidence

Approved post-remediation backup อยู่ที่
`/Users/jirayu/dev/backup/saijai-phareab/saijai-production-post-remediation-20260902T141438Z.dump`,
SHA-256 `b3c00fdd02aa3d58cdd964e1d0cf5b9e052389b1581dc7d3a105e09381055c71`,
PostgreSQL 17.6, retention ไม่เกิน `2026-09-09 23:59 Asia/Bangkok`.
Aggregate remediation evidence อยู่ที่
`/Users/jirayu/dev/backup/saijai-phareab/production-payment-receipt-remediation-20260902T141204Z.json`
และ authoritative Approval A evidence อยู่ที่
`/var/folders/f5/18ygctb55cncd7h4pchbp6hm0000gn/T/saijai-g3-production-shape.HdVPdB`.

ผล rehearsal: DB-03 delta `+27/-0` โดย unexpected delta = 0; canonical comparison
มี allowed historical UNIQUE INDEX/constraint representation removal 1 รายการและ
unexpected delta = 0; settings dry/apply เปลี่ยน 1 แถวบน restore copy ส่วน
add-on/photo เปลี่ยน 0; ทุก operation รอบสองและ final เป็น 0. ไม่มี DB-05 apply
หรือ schema write ใดเกิดบน production.

Production-shape rehearsal เป็นขั้นลดความเสี่ยง ไม่ใช่การผ่าน G3 บน production
โดยอัตโนมัติ หลัง rehearsal ผ่านยังต้องขออนุมัติ production window แยกเพื่อรัน
read-only preflight และ DB-03/DB-05 บน production จริงก่อนตัดสิน G3

## 2. Approval A — สร้าง/ส่งมอบ backup และ rehearsal ในเครื่อง

นี่เป็น approval ที่แนะนำให้อนุมัติก่อน โดยมี scope เท่านั้น:

1. ผู้ดูแลฐานข้อมูลสร้าง **database-only PostgreSQL custom-format backup**
   จาก production แบบ read-only หรือส่งมอบ backup ที่มีอยู่และได้รับอนุมัติแล้ว
2. อนุญาตให้นำไฟล์นั้นมา mount แบบ read-only เข้า PostgreSQL container ใหม่บน
   `127.0.0.1` เพื่อ restore, migrate และ backfill เฉพาะสำเนาทิ้งได้
3. อนุญาตให้เก็บ raw evidence ชั่วคราวใน directory mode `0700`; raw report
   อาจมี database row identifiers แต่ runner ไม่พิมพ์ URL/credential และ
   `g3-summary.json` มีเฉพาะ aggregate
4. อนุญาตให้ลบ container และ evidence หลังตรวจตาม retention ที่ระบุด้านล่าง

ข้อมูลที่ approval ต้องระบุให้ครบ:

| Field | ค่าที่ต้องให้ |
| --- | --- |
| Approval reference | ticket/chat/change ID ที่ไม่ใช่ secret |
| Backup owner/operator | ผู้รับผิดชอบสร้างและยืนยัน source |
| Snapshot time | เวลาและ timezone ของ backup |
| PostgreSQL source major | ต้องเข้ากันกับ `G3_PG_IMAGE`; approved run นี้ใช้ 17 |
| Absolute local backup path | ส่งให้ runner โดยไม่ commit เข้า repo |
| SHA-256 | 64 lowercase hex; runner ปฏิเสธไฟล์ไม่ตรง |
| Backup format | `pg_dump --format=custom --no-owner --no-privileges` เท่านั้น |
| Backup/PITR state | เวลา backup ล่าสุด, PITR retention และผู้ยืนยันว่า restore source ใช้ได้ |
| Evidence retention | ผู้เข้าถึง, ที่เก็บ, เวลาลบ; แนะนำลบทันทีเมื่อ disposition ปิด |
| Permitted host | เครื่องนี้เท่านั้น เว้นแต่ระบุใหม่ |

ตัวอย่างคำอนุมัติที่ครบขอบเขต (ต้องแทน placeholder จริง):

> อนุมัติ Approval A อ้างอิง `<change-id>` ให้ใช้ backup custom-format ที่
> `<absolute-path>` SHA-256 `<sha256>` snapshot `<timestamp/timezone>` จาก
> PostgreSQL `<major>` เพื่อ restore และทดสอบใน local disposable container เท่านั้น
> เก็บ restricted evidence ถึง `<retention>` แล้วลบ ห้ามเชื่อม production,
> deploy หรือเริ่ม DB-06

การสร้าง backup เป็นงานของ operator จนกว่าจะอนุมัติให้ agent เชื่อม production
โดยตรง ตัวอย่างรูปแบบที่ต้องการ (ห้ามใส่ URL ลง command history):

```bash
pg_dump --dbname "$DATABASE_URL" --format=custom --no-owner --no-privileges \
  --file /approved/secure/location/saijai-production-shape.dump
shasum -a 256 /approved/secure/location/saijai-production-shape.dump
```

## 3. คำสั่ง rehearsal หลัง Approval A

คำสั่งนี้ไม่อ่าน `.env`, ไม่เชื่อม source database และไม่ใช้ port production:

```bash
G3_KEEP_STAGE=1 G3_PG_IMAGE=postgres:17 \
  ./scripts/db-rehearsal/run-production-shape-rehearsal.sh \
  --backup-file /absolute/path/to/approved.dump \
  --expected-sha256 <approved-64-char-sha256> \
  --expected-source-pg-major <approved-major> \
  --approval-reference <change-id> \
  --confirm-approved-backup \
  --confirm-local-disposable \
  --keep-stage
```

Runner ทำ 12 stages แบบ fail-closed:

1. ตรวจ flag, absolute non-symlink file และ SHA-256 ก่อนเปิด container
2. mount archive read-only, ตรวจ `pg_restore --list`, แล้ว restore เฉพาะ
   application-owned `public` schema ด้วย `--single-transaction`, `--no-owner`,
   `--no-privileges` และ `--schema=public`; Supabase-managed schemas/extensions ไม่อยู่
   ในขอบเขต DB-03/DB-05 และไม่ถูกจำลองใน vanilla PostgreSQL rehearsal image
3. fingerprint และ clone schema ก่อน migration
4. `prisma migrate deploy` บน restore copy ด้วย lock/statement timeout
5. เทียบ delta ก่อน/หลังให้เป็นเฉพาะ DB-03 additive 27 columns
6. fresh replay schema อีกฐานแล้วเทียบกับ restore copy ด้วย exact production
   allowlist 1 รายการสำหรับ historical unique-index/constraint representation;
   summary ต้องแสดง allowed removal และ drift อื่นทั้งหมดต้องเป็นศูนย์
7. enforced read-only preflight ก่อน write
8. dry-run ทั้งสาม backfill; mismatch/quarantine ใด ๆ หยุดก่อน apply
9. apply บน restore copy เท่านั้น แล้ว enforced reconciliation
10. apply รอบสองต้องเปลี่ยน 0 แถว
11. final dry-run ต้องเปลี่ยน 0 แถวและไม่มี mismatch/quarantine
12. สร้าง aggregate-only verdict และยืนยัน HEAD/working-tree hash ไม่เปลี่ยน

Runner ตรวจ SHA-256 ของ archive ซ้ำก่อนสรุปผล และส่ง lock/statement timeout
เข้า migration กับ backfill connection; timeout หรือไฟล์เปลี่ยนระหว่างรันถือว่า fail

### Pass criteria ของ production-shape rehearsal

- restore และ canonical schema comparison ผ่าน ไม่มี unexpected schema drift;
  อนุญาตเฉพาะ historical unique-index/constraint representation 1 รายการที่
  `schema-g3-production-allowlist.json` ระบุแบบ exact และต้องรายงานใน summary
- migration delta ไม่มี drop/rename/index/constraint ที่ไม่อยู่ใน DB-03
- preflight query/invariant failure = 0
- required zero checks ทั้ง add-on ledger และ image join = 0 รวม active join gap
- dry-run/apply ไม่มี mismatch และ quarantine
- apply รอบสองและ final dry-run `rowsChanged = 0` ทุก operation
- timings ถูกบันทึกเพื่อ sizing window; การวัดบน isolated copy ไม่ใช่หลักฐาน
  lock contention ของ production จริง
- archive ไม่ถูกแก้, repo ไม่ถูกแก้, container ถูกลบหลังจบ

ถ้ามี quarantine ห้ามใช้ override flag เพราะ runner ไม่มี bypass โดยตั้งใจ ต้องสร้าง
disposition ที่ระบุจำนวน/reason/owner/remediation โดยไม่เผย PII แล้วแก้บนกระบวนการที่
อนุมัติ จากนั้นสร้าง snapshot ใหม่และ rerun จนผ่าน

## 4. Approval B — read-only production preflight (แยกจาก A)

ขอหลัง Approval A ผ่านเท่านั้น Scope ที่ต้องอนุมัติแยก:

- ให้ agent อ่าน `DATABASE_URL`/`DIRECT_URL` จากตำแหน่งที่ผู้ใช้ระบุโดยไม่แสดงค่า
- เชื่อม production เพื่อ query aggregate-only ภายใน `READ ONLY` transaction
- ใช้ statement timeout ที่อนุมัติ และเก็บเฉพาะ sanitized aggregate report
- ตรวจ PostgreSQL version, migration status, row counts, invariants, active
  deployments/workers และ backup/PITR freshness

Approval B **ไม่ให้สิทธิ์** migration, backfill apply, settings resync, deploy,
restart, seed, reset, dump, restore ทับฐานใด ๆ หรือ DB-06

ผล authoritative production preflight วันที่ 2026-09-02:

- aggregate report:
  `/Users/jirayu/dev/backup/saijai-phareab/production-preflight-20260902T163522Z.json`
  (mode `0600`, SHA-256
  `92314daf5ae747c8b2b36c630c2e156a4b369b80fc8d681bd7970c4c9e5177d5`)
- restricted log:
  `/Users/jirayu/dev/backup/saijai-phareab/production-preflight-20260902T163522Z.log`
  (mode `0600`)
- runner exit `0`, `failed=false`, SQL 8/8, transaction read-only, invariant
  failure 0; report ผ่าน URL/credential leak checks
- pending attestation:
  `/Users/jirayu/dev/backup/saijai-phareab/approval-b-attestation-pending-20260902T163522Z.json`
  (mode `0600`, SHA-256
  `62028ccb597babcfb6e156fbb7815d5fb8926de61ee93805c8b201ef3c1a276e`)
- aggregate combined verdict:
  `/Users/jirayu/dev/backup/saijai-phareab/approval-b-summary-20260902T163522Z.json`
  (mode `0600`, SHA-256
  `6329fdc7416ea673170e6d6b63e8202f77c465c1451953f69075461094698710`),
  `APPROVAL_B_BLOCKED` เฉพาะ operator/PITR/runtime evidence 8 รายการ

Non-authoritative stopped invocation (เก็บเพื่อ audit เท่านั้น):

- aggregate failure report:
  `/Users/jirayu/dev/backup/saijai-phareab/production-preflight-20260902T161736Z.json`
  (mode `0600`, SHA-256
  `252b801d6b69397ce561a1da642935fd19d5b0ce281a78eafcb243306bb79ee5`)
- restricted log:
  `/Users/jirayu/dev/backup/saijai-phareab/production-preflight-20260902T161736Z.log`
  (mode `0600`)
- runner exit `1`, `failed=true`, SQL file count `0`; invocation loader เลือก
  commented localhost example แทน active key; ไม่มี production SQL หรือ write

เมื่อได้รับ Approval B แล้ว ให้โหลด URL จากตำแหน่งที่ผู้ใช้อนุมัติโดยไม่พิมพ์ค่า
และรัน Node runner ดังนี้ (`--enforce` ถูกบังคับอัตโนมัติใน production mode):

หาก `.env` มี commented example และ active key พร้อมกัน ต้องเลือกเฉพาะบรรทัด
`DIRECT_URL=` ที่ไม่ขึ้นต้นด้วย `#`; ห้ามใช้ parser ที่ยอมรับ commented key.

```bash
DATABASE_URL="...loaded without printing..." \
PREFLIGHT_TIMEOUT_MS=30000 \
PREFLIGHT_SSL_ROOT_CERT=/absolute/path/to/approved-ca.pem \
node scripts/db-rehearsal/run-preflight.mjs \
  --confirm-production-read-only \
  --approval-reference <non-secret-change-id> \
  --report-file /absolute/restricted/path/production-preflight.json
```

Runner บังคับ `default_transaction_read_only=on` ตั้งแต่ connection,
เปิด `REPEATABLE READ READ ONLY`, ตรวจ `transaction_read_only=on`, ใช้
statement/lock timeout, บังคับ non-symlink PEM CA + TLS peer verification
(บันทึกเฉพาะ CA SHA-256) และเขียน report ใหม่แบบ exclusive mode `0600` นอก repo
(ไม่ overwrite ไฟล์เดิมหรือ follow symlink) โดย production report
ไม่บันทึก host/database และ production error output เก็บเฉพาะ bounded error code
ไม่เก็บ driver message. SQL ยืนยัน version, Prisma migration aggregate,
row counts และ invariants ได้ แต่ **ยืนยัน PITR/backup freshness หรือ inventory
ของ active deployment/worker ทั้งหมดไม่ได้**; สองข้อนี้ต้องมี operator/platform
attestation แยกก่อนตัดสิน Approval B ผ่าน ห้ามอนุมานจาก `pg_stat_activity`.

ใช้ `scripts/db-rehearsal/approval-b-attestation.example.json` เป็น shape เท่านั้น
แล้วคัดลอกไปกรอกใน restricted directory นอก repo. Evaluator
`evaluate-approval-b.mjs` จะ fail-closed หาก approval reference ไม่ตรง, SQL
report ไม่ครบ 8 ไฟล์/ไม่ได้ enforce/read-only, invariant หรือ migration status
ไม่สะอาด, attestation/backup เก่ากว่า 24 ชั่วโมง, PITR recovery point หรือ runtime
inventory เก่ากว่า 1 ชั่วโมง, operator ไม่ยืนยัน หรือยังมี active runtime ที่ไม่ใช่
compatibility version. เวลาที่อยู่ในอนาคตเกิน 5 นาทีถือว่า invalid.

### 4.1 นโยบาย backup ทดแทน PITR (คำตัดสิน operator 2026-09-03)

Supabase โปรเจกต์นี้คงอยู่ Free Plan โดยคำตัดสินของ operator และไม่เปิด PITR
ข้อบังคับ PITR ของ gate จึงถูกแทนด้วยนโยบาย `external-encrypted-backups`
ซึ่ง evaluator บังคับเมื่อ attestation มี `backupPolicy.mode =
"external-encrypted-backups"` (attestation ที่ไม่มีฟิลด์นี้ยังต้องผ่านเกณฑ์ PITR
เดิมเหมือนก่อน):

| Field | ค่าที่กำหนด | Blocker เมื่อไม่ผ่าน |
| --- | --- | --- |
| `intervalMinutes` | จำนวนเต็ม 1–60 (backup เต็มแบบ encrypted ทุก ≤ 60 นาที, RPO ≤ 1 ชม. เท่าเกณฑ์ PITR เดิม) | `backup-policy:interval-missing-or-invalid` |
| `encrypted` | `true` (เข้ารหัส AES-256 ขึ้นไปก่อนออกจาก Supabase, key เก็บนอก Supabase) | `backup-policy:encryption-not-attested` |
| `retentionDays` | จำนวนเต็ม ≥ 14 | `backup-policy:retention-insufficient` |
| `lastRestoreDrillAt` | ไม่เก่ากว่า 30 วัน | `backup-policy:restore-drill-stale-or-invalid` |
| `latestBackupAt` (ใน `backupPitr`) | ไม่เก่ากว่า interval + 5 นาที และไม่เก่ากว่า 24 ชั่วโมง | `backup:backup-cadence-stale-or-invalid` |

การยืนยัน restore ยังผูกกับ `backupPitr.restoreDrillReference` เหมือนเดิม
หาก interval ไม่ถูกต้อง evaluator จะบังคับความสดของ backup ที่ window เข้มสุด
(60 นาที) เพื่อให้ยัง fail-closed การจัด schedule backup จริง เช่น cron ที่เรียก
`pg_dump` แล้วเข้ารหัสส่งเก็บ provider อื่น เป็นงาน operator นอก repo และต้องมี
drill ผ่านภายใน 30 วันก่อนตัดสิน Approval B

**เครื่องมือ backup ที่เตรียมไว้ (คำตัดสิน operator 2026-09-03: เก็บที่
Cloudflare R2)** ที่ `scripts/production-backup/`:

- `r2-backup.sh`: `pg_dump` (custom-format, ใช้ docker postgres:17-alpine เมื่อ
  host ไม่มี `pg_dump`) → เข้ารหัส AES-256-CBC + PBKDF2 (600k iterations,
  key จาก `BACKUP_ENCRYPTION_KEY`) → ตรวจ round-trip decrypt ก่อน upload →
  อัปโหลดไป R2 พร้อม summary JSON (SHA-256 ของ dump ทั้งก่อน/หลังเข้ารหัส,
  timestamp UTC) → ลบ object เก่ากว่า retention (default 14 วัน)
- `r2-s3.mjs`: S3 client ขนาดจิ๋วด้วย `node:crypto` (ไม่เพิ่ม dependency)
  พิสูจน์ SigV4 กับ test vector ทางการของ AWS แล้ว (`r2-s3.test.mjs` 3/3 รวม
  regression ของ canonical query sorting ที่ R2 เคยตอน `SignatureDoesNotMatch`)
- `restore-drill.sh`: drill จาก backup ล่าสุดใน R2 — download → decrypt →
  ตรวจ SHA-256 กับ summary ที่บันทึกตอน backup → `pg_restore --list` (docker
  fallback) และพิมพ์ `restoreDrillReference: backup-drill-<timestamp>` สำหรับ
  attestation; ใช้เป็นหลักฐาน `lastRestoreDrillAt` ได้เมื่อผ่าน
- ตั้งเวลาเช่น `10 * * * *` (ทุกชั่วโมง นาทีที่ 10) โดย secret ทั้งหมด
  (`DIRECT_URL`, `BACKUP_ENCRYPTION_KEY`, `R2_ENDPOINT`, `R2_BUCKET`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`) อยู่ใน environment ของ cron
  เท่านั้น ห้าม commit หรือ echo; แนะนำเพิ่ม R2 lifecycle rule ≥ retention
  เป็น backstop และรัน restore drill ด้วย `restore-drill.sh` (drill รายงาน) หรือ
  `run-production-shape-rehearsal.sh` (rehearsal 12 stages จาก archive ที่ถอด
  รหัสแล้ว) แล้วบันทึก reference ลง attestation. สถานะจริง 2026-09-02: operator
  รัน backup สำเร็จแล้ว 2 รอบ (ล่าสุด `latestBackupAt 20260902T185436Z`,
  encrypted SHA-256 `071c025f…db3a1`) เหลือตั้ง launchd รันทุกชั่วโมงและ drill
  หนึ่งรอบก่อนกรอก attestation

### 4.2 Runtime inventory บน Vercel

Production application รันบน Vercel (operator ยืนยัน 2026-09-03) จึงไม่มี
long-lived worker process ให้กรอก `runtimeInventory` ดังนี้:

- `activeApplicationCount` = จำนวน production deployment ที่ active (รับ traffic)
  ปกติคือ 1; alias/previous deployments ที่ยังรับ traffic ต้องนับรวม
- `activeWorkerCount` = 0 งานตามเวลา (`notify:expiring-packages` /
  `/api/admin/cron/package-expiry`) ต้องทำงานจริงผ่าน Vercel Cron หรือ external
  scheduler ที่เรียก endpoint ด้วย `CRON_SECRET` และ operator ต้องยืนยันผล run
  ล่าสุดก่อน attestation
- `compatibilityRevision` = git commit SHA หรือ Vercel deployment ID
  (`dpl_...`) ของ deployment ที่ active ทุกตัว และต้องเป็น revision เดียวกับที่
  ผ่าน rehearsal/old-binary drill ที่อ้างอิงใน Approval C
- `deploymentIdentifiers` กรอกใน attestation ที่ restricted directory เท่านั้น;
  summary ของ evaluator ไม่คัดลอกค่าเหล่านี้ออกมา

สถานะที่สังเกตได้แล้ว (2026-09-02T19:40:26Z, log export 34 request lines
หน้าต่าง 19:08–19:36 UTC): deployment รับ traffic มีตัวเดียว (deployment ID
เดียว, branch `main`, environment `production`, region `iad1`) ครอบทุก host
(`saijaiphareab.shop`, `www.` และ deployment domain) — บันทึกที่
`approval-b-runtime-observation-20260902T194026Z.json` ใน restricted directory.
`activeApplicationCount: 1`, `activeWorkerCount: 0`. หน้าต่าง log ไม่ครอบคลุม
02:00 UTC จึงไม่เห็น cron run; cron ยืนยันแยกจาก schedule ใน `nuxt.config.ts` +
`CRON_SECRET`. Evaluation รอบสุดท้าย `chat-2026-09-03-g3-b` ทำตามเงื่อนไขความสด:
backup สด 19:50:24Z, live observation 19:54:14Z → `APPROVAL_B_PASS` blocker 0
(หลักฐาน `approval-b-summary-final-2026-09-02T19:54:14Z.json`).

```bash
node scripts/db-rehearsal/evaluate-approval-b.mjs \
  --preflight-report /absolute/restricted/path/production-preflight.json \
  --operator-attestation /absolute/restricted/path/operator-attestation.json \
  --approval-reference <non-secret-change-id> \
  --out /absolute/restricted/path/approval-b-summary.json \
  --confirm-production-evidence
```

ผลมีเพียง `APPROVAL_B_PASS`, `APPROVAL_B_BLOCKED` หรือ evaluation error และ
summary ไม่คัดลอก operator/deployment identifiers. การผ่าน Approval B ยังไม่ให้
สิทธิ์ Approval C หรือ DB-06. Evaluator คำนวณ row/NOTICE invariants ซ้ำเองและ
ปฏิเสธ SQL evidence ที่ขาด ซ้ำ หรือมีไฟล์นอก reviewed set จึงไม่เชื่อเฉพาะ
`invariantFailures=[]` จาก report.

## 5. Approval C — production expand/backfill window (แยกจาก A/B)

ขอเมื่อ Approval A rehearsal และ Approval B preflight ผ่าน ต้องระบุ:

- commit/image SHA, DB-03 migration ID, operator และ rollback owner
- maintenance window, lock timeout, statement timeout และ stop conditions
- backup timestamp ภายใต้ external backup policy (หรือ PITR recovery point
  หากเปิดใช้ในอนาคต) ที่ผ่าน restore drill
- active app/worker ทุกตัวเป็น compatibility version
- ถ้ามี old-only settings write ใน rollback window ต้อง re-save ผ่าน compatibility
  admin API เพื่อ dual-write แล้ว dry-run ให้ mismatch = 0 ก่อน apply
- ลำดับ: DB-03 expand → DB-05 dry-run → apply → enforced reconciliation →
  apply รอบสอง → final dry-run

หยุดทันทีเมื่อ checksum/source ไม่ตรง, migration/schema drift, timeout,
mismatch, quarantine, invariant failure หรือรอบสองเปลี่ยนมากกว่า 0 แถว

Draft คำขอ Approval C (operator เลือก window 2026-09-03; กรอก placeholder จริง
หลัง backup automation + attestation ครบ):

> ขออนุมัติ Approval C อ้างอิง `<change-id>` รัน DB-03 expand migration
> `20260902000000_db03_expand_appsetting_completed_at` และ DB-05 backfill
> ทั้งสาม operation บน production ภายใน maintenance window
> `<วันที่> 01:00–03:00 Asia/Bangkok` โดยข้อมูลทั้งหมดคงอยู่ (additive schema +
> idempotent backfill, apply รอบสองและ final ต้องเปลี่ยน 0 แถว) ใช้ commit/image
> `<git-sha>` ที่ active บน Vercel ทุก deployment, backup ล่าสุด
> `<timestamp>` จาก external encrypted backup policy ที่ผ่าน restore drill
> `<reference>`, lock timeout `<ms>` / statement timeout `<ms>`, rollback owner
> `<operator>` และ stop conditions ตาม packet นี้

Approval C **ไม่รวม DB-06** การเปลี่ยน read source/soak ต้องเป็น approval และ
implementation task ถัดไปหลัง G3 ผ่านจริง

## 6. Evidence และการตัดสินหลังรัน

ไฟล์ส่งต่อหลักคือ `g3-summary.json` (aggregate-only), `migrate-deploy.log`,
`migrate-status.log`, `schema-diff-db03.json`, `schema-diff-canonical.json`,
`preflight-before.json`, `preflight-after.json` และ `timings.json`

Raw `dry/apply/apply2/final-*.json` และ logs อาจมี row identifiers:

- ห้าม commit, upload ไป public service หรือ paste ลง chat ทั้งไฟล์
- รายงานเฉพาะ count/reason category ที่ sanitize แล้ว
- จำกัด owner-only permission และลบตาม retention approval
- backup ต้นฉบับอยู่นอก repoและไม่ถูกลบโดย runner

ผลลัพธ์มีเพียง:

- `G3_REHEARSAL_PASS`: พร้อมขอ Approval B/C แต่ G3 production ยังไม่ผ่าน
- `G3_REHEARSAL_BLOCKED`: หยุด, ทำ disposition/remediation, snapshot ใหม่และ rerun
- execution error: หลักฐานไม่พอ ห้ามตีความเป็น pass

DB-06 เริ่มได้ต่อเมื่อ production DB-03/DB-05 evidence ครบเกณฑ์ G3 และผู้ใช้
อนุมัติ DB-06 โดยตรงเท่านั้น

## 7. Approval C — execution record (2026-09-03, `chat-2026-09-03-g3-c`)

**สถานะ: DONE — ผ่านครบทุกขั้น ไม่มี stop condition ถูกเรียกใช้.** Operator
อนุมัติคำเดียว "เริ่มเลย" (2026-09-03) หลังผ่าน Approval B; เริ่มลำดับ 03:05–03:15
Asia/Bangkok — เลยขอบหน้าต่าง 01:00–03:00 ไป ~5 นาที (deviation ที่บันทึกไว้;
operator อยู่เฝ้าตลอด, traffic ระดับต่ำสุดของคืน)

- หลักฐานก่อนรัน: backup `20260902T195024Z` ผ่าน drill
  `backup-drill-20260902T195024Z`, preflight สด 19:53Z สะอาด 8/8, runtime
  inventory deployment เดียวบน Vercel, `migrate status` มี migration ค้างตัวเดียว
- **DB-03**: `prisma migrate deploy` ใช้ migration เดียว
  `20260902000000_db03_expand_appsetting_completed_at` (additive เท่านั้น) —
  สำเร็จ; หลังรัน `migrate status` = "Database schema is up to date!" (48
  migrations)
- **DB-05** ทั้งสาม operation (dry → apply → apply2 → final):
  - settings-consolidation: dry จะเปลี่ยน 1, apply เปลี่ยน 1 (สร้าง appSetting
    singleton จาก legacy shop/notification), apply2 = 0, final = 0
  - addon-usage-json-to-ledger: 0 แถวทั้งหมด (production ไม่มี legacy JSON)
  - item-photo-direct-to-join: 0 แถวทั้งหมด (production ไม่มี direct imageId)
  - mismatch = 0, quarantine = 0 ทุกเฟส
- **Reconciliation**: preflight-after สด — `failed=false`,
  `invariantFailures=[]`, รวม invariant ใหม่หลัง expand:
  `non_completed_orders_with_completed_at = 0`; completed 14 ออเดอร์ทั้งหมดยัง
  `completedAt = NULL` ตามนโยบาย F5 (report-only)
- Post-migration backup รันแล้วผ่าน (ดู R2 summary ล่าสุด)
- Runner: `backfill.mts` เพิ่มโหมด `--confirm-production` (fail-closed: ปฏิเสธ
  loopback/rehearsal*, บังคับ sslmode + `--ssl-root-cert` CA PEM — node pg
  ตีความ require เป็น verify-full จึงต้องเชื่อ CA ผู้ให้บริการเอง) พร้อมแสดง
  error code เมื่อ abort; `pnpm test` 312 ผ่าน
- หลักฐานใน restricted directory: `db03-migrate-deploy-*.log`,
  `dry/apply/apply2/final-<operation>.json|log`,
  `production-preflight-after-*.json|log`
