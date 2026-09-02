# สรุปงานทั้งหมด — Database Consolidation (G3–G5) และระบบพิมพ์ XP-C260M (PRN-02–07)

> อัปเดตล่าสุด: 2026-09-03 · branch `glm/xprinter-database` = main · commits
> `775a0c6` → `b1dfe9e` → `8f7537f` → `6d4a7cc` → `a8b9b02` → `823e555` → `e880779`

เอกสารนี้สรุปงานทั้งหมดที่ทำในช่วงแผนควบคุมกลาง
[`plan-database-printing-master-orchestration.md`](./plan-database-printing-master-orchestration.md)
รายละเอียด gate/หลักฐานอยู่ในเอกสารหลักและ
[`db-g3-production-approval-packet.md`](./db-g3-production-approval-packet.md)

---

## 1. Database consolidation — สถานะปัจจุบัน

| ขั้น | สถานะ | สิ่งที่ทำ |
| --- | --- | --- |
| G1–G2 (expand + backfill ready) | ✅ เสร็จ | characterization tests, rehearsal ครบ (replay/restore/dump/negative), old-binary drill 13/13 |
| G3 Approval A/B/C | ✅ ผ่านหมด | backup เข้ารหัส + restore drill, preflight read-only บน production, DB-03 expand + DB-05 backfill บน production จริง (mismatch 0, quarantine 0, รอบสองเปลี่ยน 0 แถว) |
| DB-06 Read cutover | ✅ deploy แล้ว | อ่านจาก AppSetting เป็นหลัก (per-field fallback legacy), telemetry `[db-compat]` match/mismatch/fallback — 7 จุดอ่านทั้งหมด, live buildId `b44a3e64…` |
| G4/G5 Soak | ⏳ ตามปฏิทิน | หน้าต่าง 7–14 วัน เริ่ม 2026-09-03 — เกณฑ์: `db_compat_setting_read_total{result="mismatch"|"fallback"} = 0` ตลอด (ตรวจจาก Vercel logs กรอง `[db-compat]`) |
| DB-07 (หยุด dual-write + drop legacy) | ⏸ รอ soak จบ | หลัง soak ครบ: หยุด dual-write ทีละกลุ่ม → drop `shop_setting`/`notification_setting` เป็น migration ย่อย (ต้อง backup/drill ใหม่ก่อน) |

**นโยบาย backup** (Supabase Free Plan, แทน PITR): `external-encrypted-backups` — backup
เต็มเข้ารหัส AES-256 ทุก ≤ 60 นาที (สคริปต์ `scripts/production-backup/`), retention ≥ 14
วัน, restore drill ≤ 30 วัน · **ต้องเปิด launchd ทุกชั่วโมงให้ครบ RPO** (ยังรัน manual อยู่)

## 2. ระบบพิมพ์ XP-C260M — สิ่งที่สร้าง (PRN-01 ถึง PRN-06)

### PRN-01 Pure contracts (เดิม, verified)
- `shared/types/printing.ts` — PrintDocument/Operation/PrinterProfile/PrintJobStatus 14 สถานะ
- `shared/utils/printJobState.ts` — transition table + lease/fencing/stale policy
- `server/utils/paymentQr/` — EMVCo TLV, CRC-16, exact `amountMinor` (string math)

### PRN-02 Printer/PrintJob schema (`6d4a7cc`)
- `prisma/schema.prisma`: models `Printer` + `PrintJob` (C7 — 2 tables เท่านั้น)
- `prisma/migrations/20260903120000_prn02_printer_print_job/` — additive CREATE TABLE/TYPE/INDEX เท่านั้น
- `scripts/printing-rehearsal/run-prn02-constraints.sh` — rehearsal บน disposable Postgres ผ่าน 6 stages:
  replay 49/49 · idempotency unique-scope (23505) · concurrent claim FOR UPDATE SKIP LOCKED ผู้ชนะเดียว
  · fencing 1→2 · stale-lease reclaim · PrismaClient smoke
- guard test `tests/server/printJobSchema.test.ts`

### PRN-05 Hybrid renderer (`6d4a7cc`)
- `shared/utils/printComposer.ts` — PrintDocument + profile → `PrintOperation[]`
  (native QR + raster fallback ใช้ payload เดียวกัน, band splitting, compose report)
- `shared/utils/escpos.ts` — ESC/POS encoder: ESC @, GS v 0 raster, GS ( k QR, GS V partial cut,
  TIS-620 สำหรับไทย (combining marks zero-width), `PrintEncodeError` typed, `formatMinor` integer-only
- tests `tests/shared/printComposer.test.ts` + `tests/shared/escpos.test.ts`

### PRN-03 APIs (`a8b9b02`)
- `server/utils/printJobQueue.ts` — `claimPrintJobs` (tx เดียว: stale-lease reclaim + SENDING
  หมดอายุ→NEEDS_REVIEW + SKIP LOCKED + C9 freshness→STALE_DOCUMENT), `applyPrintJobEvent`
  (บังคับ leaseToken+fencingToken, ห้าม FAILED หลัง sendStartedAt, timeline จำกัด 20)
- `server/utils/printDocument.ts` — สร้าง snapshot (C10 exact money, canonical sha256,
  receiver AES-256-GCM ด้วย keyring env `PAYMENT_QR_RECEIVER_KEYS`, QR eligibility ตาม C9)
- Endpoints: `/api/admin/printers` (create/update `[id].put`/delete/credential rotate),
  `/api/admin/print-jobs` (create + idempotency P2002→existing, resolve, reprint),
  `/api/admin/print-bridge` (heartbeat/claim/events — Bearer credential, timing-safe SHA-256)
- `server/middleware/auth-session.ts` — เพิ่ม policy `printers`/`print-jobs` (EMPLOYEE, ADMIN)
  และ `print-bridge` (no roles — ตรวจ credential ใน handler)

### PRN-04 Local Print Bridge (`a8b9b02`)
- `print-bridge/` — zero-dependency Node 24 ESM (แยกจาก app image):
  - durable outbox (JSON-lines + fsync ทุก append, resume หลัง crash → bytes-written โดยไม่ SENT = NEEDS_REVIEW)
  - per-printer mutex, graceful shutdown
  - `transport/tcp.js` (node:net — host/port อยู่ local config เท่านั้น ไม่ส่งหา server) + `transport/fake.js`
  - runner ตาม C8: ก่อนเขียน bytes → FAILED + backoff 3 ครั้ง / หลังเขียนหรือไม่ชัด → NEEDS_REVIEW ไม่ retry
  - config 0600, credential ไม่ถูก log
- tests `tests/server/printBridge*.test.ts` (29 กรณี) · run: `node print-bridge/bin/bridge.mjs --help`

### PRN-06 Admin UI (`823e555`)
- หน้า `/admin/printing` — 3 sections: เครื่องพิมพ์ (ลงทะเบียน/แก้ไข/ลบ/rotate credential แสดงครั้งเดียว),
  คิวงานพิมพ์ (filter, reprint, resolve NEEDS_REVIEW สองทางเลือก), สถานะ Bridge
- `app/composables/useAdminPrinters.ts` / `useAdminPrintJobs.ts`,
  `app/components/admin/PrinterForm.vue`, `app/utils/printFormOptions.ts`
- กฎสำคัญที่คงไว้: SENT = "ส่งไปที่เครื่องพิมพ์แล้ว" ไม่อ้างว่าพิมพ์ออกจริง ·
  legacy browser-direct printing (`useThermalPrinter.ts`) ไม่ถูกแตะ (rollback path)

## 3. Verification รวม

- `pnpm test` → **432 passed / 1 skipped** (เพิ่มจาก 322 ด้วย printer tests ~110 กรณี)
- `pnpm exec nuxi typecheck` → **0 error** · `pnpm run build` → สำเร็จ
- PRN-02 rehearsal บน disposable Postgres ผ่านทุก stage
- **e2e บน local Docker (fake printer) ผ่าน** — ดูหัวข้อ 6

### บั๊กที่จับได้จาก e2e (mock tests มองไม่เห็น) — แก้แล้ว (`65415f2`)

1. `createPrintJob` ไม่ส่ง `timeline` (คอลัมน์ Json ไม่มี DB default) → เพิ่ม first timeline entry
2. `sourceRevision` = epoch ms ล้น Int32 → เปลี่ยนเป็น `BigInt` + migration
   `20260903130000_prn02_source_revision_bigint` (ALTER COLUMN TYPE BIGINT — apply บน production
   แล้วหลัง backup `20260902T232348Z`) + แปลง BigInt→Number ที่ JSON boundary
3. จับ P2002 แล้ว query ต่อใน transaction ที่ Postgres abort ไปแล้ว (25P02) →
   pre-check ก่อน create + lookup ด้วย connection ใหม่นอก transaction

## 4. Production (2026-09-03)

- Backup ก่อน deploy printer code: `20260902T225803Z` · backup ก่อน BigInt migration: `20260902T232348Z`
- Migrations `prn02_printer_print_job` + `prn02_source_revision_bigint` apply ผ่าน — **up to date 50 migrations** (additive เท่านั้น)
- Push main → Vercel deploy — homepage 200 ปกติ
- **ฟีเจอร์ยังไม่ทำงานจริง** จนกว่าจะลงทะเบียนเครื่องผ่านหน้า admin + รัน bridge

## 5. Docker สำหรับทดสอบระบบพิมพ์ (ใหม่)

- `docker-compose.print-test.yml` — overlay ของ `docker-compose.local.yml`:
  - `print-seed` ลงทะเบียนเครื่องพิมพ์ทดสอบ (`prt_local_test`, credential `local-bridge-credential` — demo only)
  - `fake-printer` TCP 9100 จำลอง XP-C260M — บันทึกทุกงานเป็นไฟล์ `.bin` + ตรวจ ESC/POS initialize
  - `bridge` รัน `print-bridge/` จริง poll app ทุก 5 วินาที
- `.dockerignore` แยก `print-bridge` ออกจาก app image
- รัน: `docker compose -f docker-compose.local.yml up --build -d` แล้ว
  `docker compose -f docker-compose.local.yml -f docker-compose.print-test.yml up -d`

## 6. ผลทดสอบ e2e บน localhost:3004 (2026-09-03)

- login admin → สร้าง job (RECEIPT) → bridge claim → ส่ง ESC/POS 676 bytes
  เริ่ม `1b40 1b74 16` (initialize + Thai codepage) → fake printer บันทึกไฟล์
- ถอดรหัส TIS-620 ได้ใบเสร็จสมบูรณ์: ชื่อร้าน/ที่อยู่/เลขที่/วันที่แบบ Bangkok/รายการ/ยอด — ภาษาไทยถูกต้อง
- Job สถานะ `SENT` · idempotency: ส่งซ้ำ key เดิมได้ `existing:true` + งานเดิม (ไม่พิมพ์ซ้ำ)
- bridge logs สะอาด (0 error) · คิวงานดูได้ที่ `/admin/printing`

## 7. สิ่งที่เหลือ

1. **HW-01** — เก็บ evidence จากตัวเครื่องจริง (interfaces/port/dots/capabilities ที่ firmware รองรับ)
2. **HW-02 Physical matrix** — พิมพ์ทดสอบจริง (ASCII/ไทย/ใบยาว/QR/feed-cut/offline/reconnect) ต้องมีเครื่อง
3. **Soak 7–14 วัน** ครบ → หยุด dual-write → DB-07 drop legacy tables
4. เปิด launchd hourly backup ให้ครบนโยบาย RPO

> อัพเดต (2026-09-03): ข้อ 5 เดิม "Wire ปุ่มพิมพ์จากหน้าใบแจ้งราคา/ใบเสร็จ" **เสร็จแล้ว** — ปุ่มพิมพ์หลักบนหน้า admin quotation/receipt เดินคิวงานพิมพ์ใหม่ผ่าน `createJob()` (รองรับ transport ทุกแบบที่ลงทะเบียนไว้ผ่าน bridge) และคงปุ่ม "พิมพ์เชื่อมตรง (เดิม)" ไว้ภายใต้ rollback flag `NUXT_PUBLIC_PRINT_LEGACY_DIRECT` (ตั้ง `false` เพื่อซ่อน) ตามสเปก PRN-06; e2e บน local compose ผ่าน (QUOTATION/RECEIPT → SENT → fake printer ได้ ESC/POS ไทยถูกต้อง)
