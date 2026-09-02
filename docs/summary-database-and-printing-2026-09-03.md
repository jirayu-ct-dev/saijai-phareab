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

- `pnpm test` → **431 passed / 1 skipped** (เพิ่มจาก 322 ด้วย printer tests ~109 กรณี)
- `pnpm exec nuxi typecheck` → **0 error** · `pnpm run build` → สำเร็จ
- PRN-02 rehearsal บน disposable Postgres ผ่านทุก stage

## 4. Production (2026-09-03)

- Backup สดก่อน deploy: `20260902T225803Z` (encrypted SHA-256 `7ceb6d9a…049ac`)
- PRN-02 migration apply ผ่าน (`prisma migrate deploy`) — **up to date 49 migrations**, additive เท่านั้น
- Push main → Vercel deploy — homepage 200 ปกติ
- **ฟีเจอร์ยังไม่ทำงานจริง** จนกว่าจะลงทะเบียนเครื่องผ่านหน้า admin + รัน bridge

## 5. สิ่งที่เหลือ

1. **HW-01** — เก็บ evidence จากตัวเครื่องจริง (interfaces/port/dots/capabilities ที่ firmware รองรับ)
2. **HW-02 Physical matrix** — พิมพ์ทดสอบจริง (ASCII/ไทย/ใบยาว/QR/feed-cut/offline/reconnect) ต้องมีเครื่อง
3. **Soak 7–14 วัน** ครบ → หยุด dual-write → DB-07 drop legacy tables
4. เปิด launchd hourly backup ให้ครบนโยบาย RPO
5. Wire ปุ่ม "พิมพ์" จากหน้าใบแจ้งราคา/ใบเสร็จเรียก `useAdminPrintJobs().createJob()` (composable พร้อมแล้ว)
