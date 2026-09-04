# แผนเปลี่ยนระบบพิมพ์เป็น Direct Print และลบ Printer Database

สถานะ: repository Direct Print/database removal implementation เสร็จ แต่ network target ถูกแก้ไขเป็น LAN Print Gateway; งาน G3/G5/G8/G9 ต่อจากนี้ให้ใช้ [`plan-lan-print-gateway-env-orchestration.md`](./plan-lan-print-gateway-env-orchestration.md) เป็นแผนควบคุมหลัก

หมายเหตุ: decision เดิมที่ Bridge bind เฉพาะ `127.0.0.1` ถูก supersede เพราะ requirement ล่าสุดต้องให้อุปกรณ์ทุกเครื่องในเครือข่ายร้านเลือก printer ได้ แผนนี้ยังเป็นหลักฐานของ renderer, queue removal และ database migration เท่านั้น

ผู้ควบคุมงาน: primary agent เป็นผู้รวมงาน ตรวจหลักฐาน และขออนุมัติ production mutation

ขอบเขต: ระบบพิมพ์ใบเสร็จ/ใบเสนอราคา, Local Print Bridge และ schema ที่เกี่ยวกับเครื่องพิมพ์เท่านั้น

## 1. เป้าหมายและเกณฑ์จบงาน

เปลี่ยนระบบพิมพ์จาก server-side durable queue เป็น flow เดียวที่ผู้ใช้กดพิมพ์แล้วระบบเชื่อมต่อและส่งงานทันที:

```text
หน้าใบเสร็จ/ใบเสนอราคา
        |
        v
กด "พิมพ์" เพียงปุ่มเดียว
        |
        +-- Wi-Fi/Ethernet --> Local Print Bridge --> XP-C260M
        +-- USB -----------> WebUSB -------------> XP-C260M
        `-- Bluetooth -----> Web Bluetooth ------> XP-C260M
```

งานเสร็จเมื่อ:

- มีปุ่มพิมพ์เพียงปุ่มเดียวบนหน้าเอกสาร
- transport พร้อมอยู่แล้วต้องส่งงานทันทีโดยไม่สร้างคิว
- transport ยังไม่พร้อมต้องเปิด connect-on-demand และทำงานพิมพ์เดิมต่อหลังเชื่อมสำเร็จ
- Wi-Fi เป็นเส้นทางหลักผ่าน Local Print Bridge บนเครื่องร้าน
- USB, Bluetooth และ Ethernet ยังใช้ได้เมื่อ hardware/browser รองรับ
- ทุก transport ใช้ document และ Hybrid renderer ชุดเดียวกัน
- LINE QR ใช้ค่าจาก `/admin/settings/shop` เท่านั้น
- ไม่มีหน้า `/admin/printing`, printer registration, heartbeat หรือ queue management
- target schema ไม่มี `printer`, `print_job` และ enum ที่สร้างมาเพื่อสองตารางนี้
- PDF/PNG และ business flow อื่นไม่เปลี่ยนพฤติกรรม

## 2. ข้อเท็จจริงที่ตรวจพบ

- หน้า admin receipt และ quotation ใช้ `print-mode="both"`: ปุ่มหลักสร้าง `PrintJob` ส่วนปุ่มรองใช้ browser-direct printing
- browser-direct ปัจจุบันรองรับ WebUSB และ Web Bluetooth แต่ยังไม่มี Wi-Fi/Ethernet direct path
- Local Print Bridge ปัจจุบัน poll server, claim job, ส่ง heartbeat/event และมี durable outbox
- browser เปิด raw TCP socket ไปยังเครื่องพิมพ์ LAN ไม่ได้ จึงยังต้องมี local process สำหรับ Wi-Fi/Ethernet
- direct ESC/POS endpoint ปัจจุบัน rasterize เอกสารทั้งใบผ่าน Puppeteer/PNG; ไม่ใช่ Hybrid output ที่ต้องการ
- Hybrid composer, ESC/POS encoder, payment QR encoder/validator และ TCP transport มีอยู่แล้วและควร reuse
- `lineQrImageUrl` มี UI อยู่ที่ `/admin/settings/shop` และแสดงในเอกสารอยู่แล้ว
- Prisma มี `Printer`, `PrintJob` และ database enums 5 ตัวจากระบบคิว
- working tree มีงาน audit อื่นค้างอยู่ ห้าม reset, overwrite หรือ refactor นอกขอบเขต

## 3. Canonical decisions

### D1 — ไม่มี durable print queue

ห้ามสร้างหรือบันทึกงานพิมพ์ในฐานข้อมูล งานหนึ่งครั้งมี lifecycle เฉพาะใน browser/local bridge ระหว่างคำสั่งนั้น

ยังต้องมี in-memory mutex ต่อเครื่องเพื่อป้องกัน byte stream ชนกัน แต่ mutex ไม่ใช่ queue:

- งานแรกกำลังส่ง: lock ถูกถือไว้
- งานที่สองเข้ามา: ตอบ `BUSY`/HTTP 409 ทันที
- UI แจ้งให้รอแล้วกดใหม่ ไม่ enqueue และไม่ retry อัตโนมัติ

### D2 — Local Bridge คงอยู่เฉพาะ Wi-Fi/Ethernet

Bridge ใหม่เป็น local direct adapter:

- bind เฉพาะ loopback เช่น `127.0.0.1`
- อ่าน printer host/port จาก local config ที่ permission จำกัด
- ไม่รับ host/port จาก browser
- ไม่มี `printerId`, server credential, polling, heartbeat, claim, events หรือ outbox
- เปิดเพียง health endpoint และ immediate print endpoint
- ตรวจ exact allowed origin, content type, request size และ timeout
- log เฉพาะ safe error code; ห้าม log payload, IP, credential หรือข้อมูลลูกค้า

### D3 — Connect-on-demand

ปุ่มพิมพ์เป็น orchestrator เดียว:

1. ป้องกัน double submit
2. ใช้ transport ที่พร้อมอยู่แล้ว
3. หากยังไม่พร้อม ให้เริ่ม connect flow จาก user gesture เดิม
4. ขอ bytes จาก authenticated server endpoint
5. ส่ง bytes ครั้งเดียว
6. แสดงผลว่า "ส่งไปยังเครื่องพิมพ์แล้ว" ไม่อ้างว่ากระดาษออกจริง

Transport policy:

- Wi-Fi/Ethernet: probe Local Bridge แล้วส่งผ่าน TCP transport ของ Bridge
- USB: WebUSB device permission/handle
- Bluetooth: Web Bluetooth GATT permission/characteristic
- ไม่พบ transport: เปิด modal เลือกการเชื่อมต่อ โดยไม่มีหน้า settings ถาวร
- จดจำเฉพาะชนิด transport/paper profile ที่ไม่เป็น secret ใน browser local state

### D4 — Hybrid rendering เป็น server-owned boundary

Server อ่านข้อมูลเอกสารล่าสุดและสร้าง canonical `PrintDocument` จากข้อมูลจริง ห้ามรับยอดเงิน, QR payload, customer ownership หรือ printer destination จาก browser

Hybrid policy:

- native ESC/POS สำหรับ initialization, alignment, ASCII/ตัวเลข, feed และ capability ที่พิสูจน์แล้ว
- ภาษาไทยใช้ native text เฉพาะเมื่อ physical test ยืนยัน code page/combining marks; ไม่ผ่านให้ raster เฉพาะ Thai block
- Payment QR ใช้ native command เมื่อ unit จริงผ่าน; ไม่ผ่านใช้ raster ของ payloadเดียวกัน
- LINE QR เป็น raster จาก `lineQrImageUrl`
- cut, buzzer, drawer และ status query ปิดเป็นค่าเริ่มต้นจน unit จริงพิสูจน์ capability
- ห้าม hard-code port, printable dots หรือ capability จากชื่อรุ่นเพียงอย่างเดียว

### D5 — Shop Setting เป็น source of truth ของ LINE QR

- `AppSetting.lineQrImageUrl` เก็บรูป LINE QR เดิม
- `AppSetting.lineQrEnabled` เป็น business display toggle และอยู่ที่ `/admin/settings/shop`
- ไม่มีสำเนา LINE QR หรือ toggle ใน printer UI
- LINE QR แสดงท้าย receipt เมื่อ enabled และมีรูปเท่านั้น
- quotation ไม่แสดง LINE QR เว้นแต่มี requirement ใหม่
- payment QR เป็นคนละ featureและคง encrypted receiver/config fields เดิม

### D6 — ลบ Printer database แต่ไม่ลบ QR business settings

ลบ:

- table `print_job`
- table `printer`
- enum `PrintJobStatus`
- enum `PrintDocumentKind`
- enum `PrintRenderMode`
- enum `PrintTransport`
- enum `PrinterModel`
- relation `User.printJobsRequested`
- relation `PaymentRecord.printJobs`

เก็บ:

- shop identity, logo และ LINE QR
- `lineQrEnabled`
- payment QR configuration/encrypted receiver
- payment, service order, receipt และ quotation data

ห้ามแก้ migration ที่เคย apply แล้ว ให้เพิ่ม forward-only drop migration ใหม่

## 4. Target code shape

### Browser

- `useThermalPrinter` เป็น façade เดียว: connect, disconnect, probe, print และสถานะ
- `PrinterConnectModal` เป็น connect-on-demand UI; ไม่มี profile editor
- receipt/quotation เรียก action เดียวและไม่มี queue-specific props/events
- PDF/PNG handlers ไม่เปลี่ยน

### Server

- authenticated direct-render endpoint รับเฉพาะ document type/id และ safe output profile
- endpoint อ่าน payment/order/settings ปัจจุบันเอง
- endpoint สร้าง payment QR จาก exact minor units ฝั่ง server
- endpoint compose และคืน `application/octet-stream`
- endpoint ไม่เปิด network socketและไม่รับ printer address

### Local Bridge

- `GET /health`: รายงาน available/busy/version แบบไม่เผย target
- `POST /print`: รับ ESC/POS binary, acquire mutex, connect/write/end แล้วตอบทันที
- `OPTIONS`: exact-origin CORS/Local Network Access preflight
- payload limit และ connect/write timeout บังคับใช้ก่อน side effect
- failure หลังเริ่ม write ถือว่า progress ไม่แน่ชัดและห้าม auto-retry

## 5. Execution plan

### Phase 0 — Baseline and ownership

1. อ่าน `AGENTS.md`, `git status`, diff และ untracked files ใหม่อีกครั้ง
2. บันทึกไฟล์ audit ที่ค้างอยู่และหลีกเลี่ยง ownership overlap
3. รัน baseline:

```bash
pnpm test
pnpm exec nuxi typecheck
pnpm exec prisma validate
pnpm run build
```

Gate G0:

- baseline ถูกบันทึกพร้อม exit code
- ไม่มีไฟล์ผู้ใช้ถูก reset/ลบ
- ระบุไฟล์ printing-owned ชัดเจน

### Phase 1 — Hardware profile

อ่าน label และ self-test/config page ของ XP-C260M จริง:

- hardware/firmware revision
- interfaces ที่มีจริง
- paper width และ printable dots
- network protocol/port
- Thai code page behavior
- native QR, partial cut และ status support

สร้าง safe compile-time/device profile จากหลักฐานนี้โดยไม่เก็บ IP หรือ Wi-Fi credential ใน repo/database

Gate G1:

- มีภาพหรือบันทึก self-test ที่ redact แล้ว
- profile ไม่อาศัย model-family assumption
- ยังไม่ส่ง cut/drawer/test page โดยไม่มีการยืนยันเป้าหมาย

### Phase 2 — Characterization and direct contracts

เพิ่ม tests ก่อนเปลี่ยน behavior:

- receipt/quotation render อ่าน source data และ settings ปัจจุบัน
- payment QR ใช้ exact amount และไม่รับ payload จาก client
- LINE QR ใช้ `lineQrImageUrl` และ `lineQrEnabled`
- print action ป้องกัน double click
- failure หลังเริ่มส่งไม่ retry
- concurrent direct jobs ไม่ interleave

กำหนด direct result contract เช่น `SENT`, `BUSY`, `NOT_CONNECTED`, `OFFLINE`, `TIMEOUT`, `UNKNOWN_PROGRESS`

Gate G2: focused tests แดงด้วย behavior เดิมและผ่านหลัง implementation

### Phase 3 — Local Bridge direct mode

1. reuse TCP transport และ mutex ที่พิสูจน์แล้ว
2. แทน polling loopด้วย loopback HTTP service
3. ลด config เหลือ allowed app origin, tcp host/port และ timeout
4. ตัด server credential, printer id, polling interval และ outbox path
5. เพิ่ม request limit, origin enforcement, preflight และ safe logging
6. เพิ่ม fake-printer integration test

Browser feasibility gate:

- ทดสอบ HTTPS app origin -> loopback Bridge บน Chrome/Edge เครื่องร้าน
- ยืนยัน Local Network Access permission, CORS และ preflight
- ถ้า loopback HTTP ไม่ผ่าน ห้าม drop queue จนกว่าจะเปลี่ยน Bridge เป็น trusted local HTTPS/native wrapper แล้วทดสอบผ่าน

Gate G3: health + immediate print ผ่าน browser จริงและ fake TCP printer โดยไม่มี DB/API polling

### Phase 4 — Direct Hybrid render endpoint

1. แยก document builder ออกจาก `PrintJob` transaction assumptions
2. อ่าน payment, service order/package sale และ `AppSetting` ใน consistent server read
3. สร้าง `PrintDocument` และ QR blocks ฝั่ง server
4. เพิ่ม async bitmap providers สำหรับ Thai/payment QR/LINE QR ตาม capability
5. compose เป็น operations แล้ว encode เป็น ESC/POS bytes
6. คืน bytes โดยไม่สร้าง DB row
7. จำกัด id/type/width ด้วย schema validation และ role checks

Gate G4:

- receipt/quotation fixtures ได้ bytes deterministic ตาม profile
- LINE/payment QR scan payload ตรง source
- request ไม่มี printer host/port หรือ QR receiver plaintext
- `prisma.printJob`/`prisma.printer` ไม่ถูกเรียก

### Phase 5 — One-button UI cutover

1. เอา `printMode`, `printQueue`, `isQueueing` และ rollback button ออกจาก `ThermalSlip`
2. receipt/quotation ใช้ `handlePrint` เดียว
3. connected แล้วให้ fetch bytes และส่งทันที
4. not connected แล้วให้เปิด modal และ resume pending print หลัง connect
5. เพิ่ม loading, busy, unsupported-browser, offline และ unknown-progress copy ภาษาไทย
6. ลบลิงก์/เมนู `/admin/printing`
7. เชื่อม `lineQrEnabled` toggle เข้า `/admin/settings/shop`

Gate G5:

- ปุ่มเดียวทำงานบน narrow/wide viewport และ keyboard
- ไม่มี dead action หรือลิงก์ `/admin/printing`
- PDF/PNG ยังทำงานเหมือนเดิม

### Phase 6 — Remove queue surfaces

ลบหรือ trim เฉพาะส่วนที่หมดการใช้งาน:

- `app/pages/admin/printing.vue`
- `app/components/admin/PrinterForm.vue`
- `app/composables/useAdminPrinters.ts`
- `app/composables/useAdminPrintJobs.ts`
- `app/utils/printFormOptions.ts`
- `server/api/admin/printers/**`
- `server/api/admin/print-jobs/**`
- `server/api/admin/print-bridge/**`
- `server/utils/printJobQueue.ts`
- print-job lifecycle types/helpers/tests
- heartbeat, polling, claim/event, retry/outbox codeใน `print-bridge/`
- printer route policies ใน `server/middleware/auth-session.ts`
- `NUXT_PUBLIC_PRINT_LEGACY_DIRECT`

เก็บและปรับ:

- print document types
- Hybrid composer
- ESC/POS encoder
- payment QR encoder/parser/validator
- raster utilities
- TCP/WebUSB/Web Bluetooth transports
- mutex และ direct bridge tests

Gate G6: `rg` ไม่พบ runtime route/import/reference ของ printer DB หรือ queue APIs

### Phase 7 — Destructive schema migration

แก้ `prisma/schema.prisma` ให้ลบ models/enums/back-relations แล้วเพิ่ม migration ใหม่ ไม่แก้ migration เก่า

Migration ใช้ explicit drop โดยไม่ใช้ `CASCADE` เพื่อให้ fail เมื่อมี dependency ที่ไม่รู้จัก:

```sql
DROP TABLE "print_job";
DROP TABLE "printer";
DROP TYPE "PrintJobStatus";
DROP TYPE "PrintDocumentKind";
DROP TYPE "PrintRenderMode";
DROP TYPE "PrintTransport";
DROP TYPE "PrinterModel";
```

Preflight ต้องตรวจ:

- row counts และ table sizes
- unexpected foreign keys/views/functions/dependencies
- pending/in-flight print job counts เพื่อบันทึกข้อมูลก่อนลบ
- schema fingerprint ก่อน migration

Disposable rehearsal:

1. fresh replay migration chain ทั้งหมด
2. seed synthetic printer/job rows
3. apply drop migration
4. ยืนยันสองตารางและห้า enum หาย
5. ยืนยัน business tables/counts/checksums ไม่เปลี่ยน
6. `prisma migrate diff` ว่าง
7. dump/restore แล้วผลเหมือนเดิม
8. generate Prisma client ใหม่และยืนยัน model names หาย

Gate G7: rehearsal ผ่านทั้งหมดและมี rollback artifact ก่อนขอ production approval

### Phase 8 — Verification

Automated:

```bash
pnpm exec prisma generate
pnpm exec prisma validate
pnpm test
pnpm exec nuxi typecheck
pnpm run build
git diff --check
```

Required focused coverage:

- direct print orchestration and resume-after-connect
- no duplicate submit/no implicit retry
- bridge origin/CORS/request limit/busy/timeout
- TCP byte accounting and unknown progress
- Hybrid Thai/QR/feed/cut decisions
- LINE QR enabled/disabled/missing image
- payment QR exact amount and eligibility
- schema absence guard and full migration replay

Physical matrix:

- Wi-Fi เป็น required path
- Ethernet, USB และ Bluetooth ทดสอบเมื่อ unit มี interface นั้น
- ASCII, ภาษาไทยพร้อมสระ/วรรณยุกต์, mixed text และรายการยาว
- payment QR และ LINE QR scan
- feed/partial cut เฉพาะ capability ที่พิสูจน์แล้ว
- offline, reconnect, timeout, duplicate click และ concurrent request
- ผู้ใช้ยืนยันว่ากระดาษออกจริงก่อนปิด hardware gate

Gate G8: automated checks และ required physical Wi-Fi path ผ่าน

### Phase 9 — Production cutover

ใช้ maintenance window เดียว เพราะ drop schema ทำให้ app เก่า rollback ไม่ได้ทันที:

1. หยุดรับคำสั่งพิมพ์และหยุด app เก่า
2. ทำ encrypted production backup ตาม runbook
3. เก็บ preflight counts/schema fingerprint โดยไม่แสดง PII
4. เตรียม table/type restore SQL หรือ verified restore command
5. แสดง exact target, exact migration และ evidence ให้ผู้ใช้
6. รอ explicit approval ก่อนรัน production mutation
7. รัน `prisma migrate deploy`
8. deploy app ใหม่และเริ่ม Local Bridge ใหม่
9. smoke test auth, receipt/quotation, PDF/PNG และ Wi-Fi direct print
10. ยืนยัน API เก่าตอบ 404 และไม่มี database error

Production rollback:

- ถ้า app failure ไม่เกี่ยว schema: rollback app ใหม่ที่ยังไม่อ้าง printer tables
- ถ้าต้องกลับ app เก่า: restore enums/tables/data ก่อน แล้วจึง rollback binary
- ถ้า print outcome ไม่แน่ชัด: ห้าม auto-reprint ให้ผู้ใช้ตรวจเอกสารและสั่งใหม่เอง

Gate G9: production smoke ผ่าน, backup/rollback location ถูกบันทึก และไม่มี print queue rows/tables เหลือ

## 6. File ownership map

| Surface | Expected action |
| --- | --- |
| receipt/quotation pages, `ThermalSlip`, connect modal | one-button direct flow |
| `useThermalPrinter` | unified transport orchestration |
| direct render API, print document/composer/encoder | server-owned Hybrid bytes |
| `print-bridge/` | replace polling bridge with loopback direct bridge |
| printer/job APIs and admin page/composables | delete |
| Prisma schema + new migration | drop printer/job database surface |
| Shop Setting UI/API | canonical LINE QR image + toggle |
| tests | replace queue lifecycle coverage with direct transport/render/schema coverage |
| docs | keep this file as the canonical execution plan |

Agents must not edit unrelated payment/order behavior while working in these files. If an existing dirty edit overlaps, stop that file, report conflict and let the primary agent integrate it.

## 7. Authority boundaries

This plan authorizes repository implementation, tests, disposable PostgreSQL rehearsal และ local fake-printer checks after the user asks to execute it. It does not by itself authorize:

- production migration/deployment
- deletion of production data before backup and exact-target confirmation
- sending a physical test page, cut or drawer pulse without an identified device and user confirmation
- network/firmware changes on the printer
- commit or push

Production database mutation must pause at Phase 9 step 6 for explicit approval even though the intended final schema is settled.

## 8. Final acceptance checklist

- [x] G0 baseline/ownership passed
- [ ] G1 actual XP-C260M profile confirmed
- [x] G2 direct contracts characterized
- [ ] G3 browser-to-local Bridge path passed
- [x] G4 direct Hybrid render passed (automated; physical output remains in G8)
- [x] G5 one-button UI passed (static/automated; real browser resume remains in G3)
- [x] G6 queue runtime surface removed
- [x] G7 schema drop rehearsed and rollback prepared on disposable PostgreSQL
- [ ] G8 automated + physical matrix passed
- [ ] G9 production cutover explicitly approved and verified
- [x] no unrelated file/data change from this plan (pre-existing audit changes remain preserved)
- [x] no commit unless explicitly requested

## 9. Execution evidence — 2026-09-03

- G0: `pnpm test` 443 passed / 1 skipped, `nuxi typecheck`, `prisma validate` and `pnpm run build` passed before implementation.
- G2–G6: direct result/mutex contracts, loopback Bridge, server-owned Hybrid renderer, one-button connect-and-resume UI, LINE QR toggle, and removal of queue routes/composables/page are present in the working tree.
- G7: full 51-migration replay/dump/restore passed at `/var/folders/f5/18ygctb55cncd7h4pchbp6hm0000gn/T/saijai-rehearsal.NuDJkB`; focused pre-drop/restore rehearsal passed at `/var/folders/f5/18ygctb55cncd7h4pchbp6hm0000gn/T/saijai-print-drop.d4I5fh`.
- Final repository checks after outsider review: `pnpm test` 370 passed / 1 skipped, `pnpm exec nuxi typecheck`, `pnpm exec prisma validate`, `pnpm run build`, Node/shell syntax checks and `git diff --check` passed. The review also made every failure after TCP `write()` begins report `UNKNOWN_PROGRESS` and makes a failed Wi-Fi path reconnect on the next click.
- G3 remains open until the real store browser proves HTTPS app → `127.0.0.1:17321` CORS/Local Network Access.
- G1/G8 remain open until the actual XP-C260M label/self-test and physical Wi-Fi print matrix are supplied and explicitly authorized.
- G9 remains blocked on explicit production approval; no production database, deploy, printer or network configuration was touched in this implementation run.
