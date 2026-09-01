# แผนควบคุมกลาง: Database Consolidation และ Xprinter Printing

สถานะ: **พร้อมเริ่มงาน implementation ใน local/disposable environment**

อัปเดต: 2026-09-01 (Asia/Bangkok)

แผนที่ควบคุม:

- [แผนปรับฐานข้อมูล](./plan-database-consolidation.md)
- [แผนระบบพิมพ์ XP-C260M](./plan-xprinter-wifi-printing.md)

## 1. Contract ของเอกสารนี้

### Consumer

Primary/orchestrator agent และ sub-agent ที่ได้รับ work packet จาก primary agent สำหรับงานฐานข้อมูล ระบบพิมพ์ API, Local Print Bridge, renderer, UI, tests และ review

### Trigger

ต้องอ่านเอกสารนี้ก่อนเริ่มหรือกลับมาทำงานใด ๆ ที่เกี่ยวกับ:

- database consolidation/migration/backfill/contract
- AppSetting, payment/order schema หรือ notification settings
- printer registry, print queue, Local Print Bridge หรือ XP-C260M
- PromptPay/Thai QR Payment บน quotation/receipt
- การแบ่งงานหลาย agent ในโครงการนี้

### Outcome

ส่งมอบฐานข้อมูลที่ลดความซ้ำซ้อนโดยไม่เสียข้อมูลจริง ตามด้วยระบบพิมพ์ใหม่ที่ใช้ Wi-Fi เป็น default และรองรับ transport อื่นผ่าน Local Print Bridge พร้อม Hybrid ESC/POS, Thai, QR, queue, retry safety และ rollback

### Authority

เอกสารนี้อนุญาตเฉพาะการ inspect, แก้ไฟล์ใน repository, สร้าง migration สำหรับ disposable database, รัน tests/typecheck/build และทำ local simulation เมื่อผู้ใช้สั่งเริ่ม implementation แล้ว

เอกสารนี้ **ไม่อนุญาตโดยตัวมันเอง** ให้:

- apply migration, backfill, seed, reset หรือเขียนข้อมูลบน shared/staging/production database
- deploy application/bridge หรือเปลี่ยน production configuration
- ส่ง test print, ตัดกระดาษ, เปลี่ยน IP/Wi-Fi/firmware หรือเปิด cash drawer ของเครื่องจริง
- commit, push, merge หรือสร้าง PR
- เพิ่ม dependency production โดยไม่อธิบายความจำเป็นและตรวจ license/maintenance

ทุก action ข้างต้นต้องมีคำสั่งหรือ approval เฉพาะครั้งจากผู้ใช้

## 2. ลำดับอำนาจและการแก้ความขัดแย้ง

เมื่อคำสั่งขัดกัน ให้ใช้ลำดับนี้:

1. system/developer instructions และ [AGENTS.md](../AGENTS.md)
2. แผนควบคุมกลางฉบับนี้
3. แผนฐานข้อมูลหรือแผนเครื่องพิมพ์ตาม domain ที่กำลังทำ
4. comment/example ใน code

หากแผนลูกสองฉบับขัดกัน ให้แผนกลางเป็น canonical decision จนกว่าจะมีการแก้ทั้งสามเอกสารพร้อมเหตุผล

Primary agent เท่านั้นที่:

- เปลี่ยนสถานะ work packet/gate ในเอกสารนี้
- ตัดสิน integration order
- มอบ ownership ของไฟล์
- รวมผลจาก sub-agent
- ขอ approval สำหรับ production/physical action

Sub-agent ห้ามแก้เอกสารนี้ เว้นแต่ work packet ระบุให้แก้โดยตรง

## 3. Destination และขอบเขต

### Destination A — Database

- singleton settings รวมจาก 3 ตารางเป็น `AppSetting` บน physical table `business_setting`
- normalized add-on ledger และ item-photo relation เป็น source of truth
- payment source/cardinality และ package-sale presentation มี invariant ชัดเจน
- `completedAt` เป็น business timestamp สำหรับ order ใหม่
- migration ทุกระยะ backward-compatible, reconcile ได้ และ contract แยก release
- `NotificationSubscriber` คงอยู่ เพราะมี membership/lifecycle แยกจาก `User`

### Destination B — Printing

- browser สร้าง print job ผ่าน authenticated API เท่านั้น
- Local Print Bridge เป็นเจ้าของ connection และ queue ต่อ printer
- Wi-Fi TCP เป็น default เมื่อ unit จริงยืนยัน; Ethernet/USB/Bluetooth ใช้ adapter ภายใต้ flow เดียวกัน
- Hybrid ESC/POS ใช้ shaped raster สำหรับ Thai/complex blocks และ native operation เฉพาะ capability ที่ physical test ผ่าน
- quotation `UNPAID` สามารถมี payment QR ตามยอด server; receipt `PAID` ไม่แสดง payment QR
- ambiguous send failure ไม่ retry เงียบและเข้าสู่ `NEEDS_REVIEW`

### Out of scope

- automatic bank reconciliation ใน release แรก
- installment/multiple payments ต่อ order/source
- หลายสาขา หลาย bridge หรือ arbitrary printer fleet ใน v1
- cleanup orphan image/Cloudinary
- auth/session redesign
- firmware update, cash drawer และ black-mark จนมี requirement/physical verification
- rewrite applied migration history

### Verified baseline at G0

- `pnpm test`: 23 files / 111 tests ผ่าน
- `pnpm exec prisma validate`: ผ่าน
- production audit ล่าสุดใช้ read-only transaction และ aggregate queries เท่านั้น; ต้องรัน preflight ใหม่ก่อน migration จริง
- Docker daemon ใช้งานไม่ได้ในรอบ audit ล่าสุด; DB-02 ต้องตรวจใหม่และใช้ disposable provider/CI database หากยังไม่พร้อม
- ไม่มี working lint command; typecheck มี baseline errors เดิม และ build มี font/network caveat
- working tree มีแผนเครื่องพิมพ์ที่แก้ค้างอยู่และแผนฐานข้อมูล/แผนกลางใหม่; agent ต้อง preserve การเปลี่ยนแปลงเหล่านี้

## 4. Canonical decisions

### C1 — Database มาก่อน printer persistence

ทำ database consolidation ให้ผ่าน compatibility, reconciliation, read cutover, soak, constraints และ contract ก่อนเพิ่ม printer models/API production

งาน printer ที่ไม่พึ่ง schema ได้แก่ hardware evidence, fixture และ pure contracts สามารถทำคู่ขนานได้ แต่ห้ามสร้าง persistence ที่ขัดกับ database target

### C2 — Correct migration order

ลำดับบังคับ:

```text
Characterize
  -> Expand nullable schema
  -> Deploy read-old + dual-write compatibility
  -> Backfill
  -> Reconcile
  -> Switch reads
  -> Soak
  -> Stop dual-write
  -> Add/validate constraints
  -> Contract/drop
```

ห้าม backfill แล้วปล่อย old-only writer ทำงานต่อก่อน dual-write เพราะจะเกิด lost update window

### C3 — AppSetting ใช้ physical `business_setting`

- เพิ่ม field ใหม่แบบ nullable ก่อน
- backfill จาก `shop_setting` และ `notification_setting`
- หลัง verify จึงตั้ง default/NOT NULL ตาม contract
- Prisma model เปลี่ยนเป็น `AppSetting` ตอน read cutover โดยคง `@@map("business_setting")`
- ไม่ rename physical table ในรอบนี้
- public API ใช้ explicit select เท่านั้น

QR fields อยู่ใน `AppSetting` ไม่สร้าง `PaymentQrSetting` แยก:

- `lineQrEnabled`
- `paymentQrEnabled`
- `paymentQrProvider`
- `paymentQrReceiverType`
- `paymentQrReceiverCiphertext`
- `paymentQrReceiverLast4`
- `paymentQrReceiverLabel`
- `paymentQrKeyVersion`
- `paymentQrConfigVersion`
- `paymentQrActivatedAt`
- `paymentQrActivatedById`
- `paymentQrUpdatedById`

ชื่อ final อาจปรับตาม Prisma conventions แต่ semantic fields ต้องครบ

### C4 — คง NotificationSubscriber

ไม่ย้าย subscriber เข้า `User` ในงานนี้ เพราะ current API แยก create, disable และ delete ซึ่งเป็น lifecycle จริง การยุบโดยไม่มี membership marker ทำให้ “ไม่เคย subscribe” กับ “ปิดชั่วคราว” สูญเสียความแตกต่าง

### C5 — Payment source เป็น one-to-one ตลอดอายุในระบบปัจจุบัน

- payment มี source exactly one ระหว่าง `serviceOrderId` กับ `packageSaleId`
- แต่ละ source มี payment ได้ไม่เกินหนึ่งแถวตลอดอายุ รวม soft-deleted
- ไม่รองรับ installment/replacement payment ในงานนี้
- constraint ใช้ได้เมื่อ preflight production ยังผ่านและ tests ของ delete/restore ยืนยัน behavior
- `PaymentRecord.memberEntitlementId` ถูกถอดหลัง caller ใช้ source relation แล้ว
- `PackageSale.status` ถูกถอดหลังทุก presentation derive จาก payment mapping แล้ว

ถ้าผู้ใช้ต้องการ installments ในอนาคต ให้หยุด contract ของ uniqueness และออกแบบใหม่ ไม่ลด constraint แบบเงียบ

### C6 — completedAt ไม่สร้างประวัติปลอม

- order ใหม่ตั้ง `completedAt` ตอนเข้า `COMPLETED` ครั้งแรก
- completed order เก่าคง `null` หากไม่มีหลักฐาน event
- UI/document ใช้ labeled legacy fallback เฉพาะ display compatibility
- ห้ามใช้ `paidAt` เป็นวันส่งมอบ

### C7 — Printer v1 มี 2 tables

สำหรับ scope หนึ่งร้าน/หนึ่ง XP-C260M หลัก:

1. `Printer`
2. `PrintJob`

`Printer` เก็บ logical profile, capability, connection-profile JSON, bridge credential hash/version, heartbeat และ bridge version ส่วน `PrintJob` เก็บ bounded timeline JSON

ยังไม่สร้าง `PrintBridge`, `PrinterConnection`, `PrintJobEvent` หากภายหลังมีหลาย bridge/printer/site จึงออก migration ใหม่ตาม lifecycle จริง

### C8 — Print queue ใช้ lease และ fencing

`PrintJob` ต้องมีอย่างน้อย:

- status และ state timestamps
- `availableAt`, `attemptCount`
- `leaseToken`, `leaseExpiresAt`, `fencingToken`
- idempotency key และ unique scope
- `reprintOfId`
- snapshot/hash/render version
- source payment/order ID, revision/updatedAt และ status/amount at creation
- selected transport
- safe failure code/message
- bounded timeline JSON

ทุก bridge event ต้องมี current fencing token งานที่เริ่มส่ง byte แล้วและผลไม่แน่ชัดต้องเข้า `NEEDS_REVIEW`

### C9 — Payment QR stale guard

QR eligibility ต้องผ่านทั้ง create-job และ pre-send:

```text
kind == QUOTATION
payment.status == UNPAID
amountMinor > 0
AppSetting.paymentQrEnabled == true
receiver configuration valid and activated
payment source revision == snapshot source revision
QR config version == snapshot config version
```

หาก state เปลี่ยนก่อน claim/pre-send ให้จบเป็น `STALE_DOCUMENT` โดยไม่พิมพ์

### C10 — Money boundary ใช้ exact minor units

- ห้ามสร้าง QR จาก JavaScript floating-point amount ใน JSON payload
- อ่าน Prisma Decimal ใน consistent server transaction
- แปลงเป็น decimal string สองตำแหน่งและ integer minor units
- QR encoder, document snapshot และ stale comparison ใช้ `amountMinor` เดียวกัน

### C11 — Manual payment confirmation

การ generate/scan QR หรือ upload slip ไม่เปลี่ยน payment เป็น `PAID` รุ่นแรกใช้ payment transition และการตรวจเงินเข้าเดิมเท่านั้น

### C12 — Snapshot safety

- snapshot เก็บเฉพาะ field ที่จำเป็นต่อเอกสาร
- application-layer encrypt เมื่อมี customer/receiver data
- log/metrics ไม่เก็บ raw snapshot, full QR payload หรือ PII
- มี `snapshotExpiresAt` เพื่อรองรับ retention policy
- v1 ห้าม auto-delete จนผู้ใช้อนุมัติ retention ระยะจริง; production rollout gate ต้องบันทึก decision นี้

## 5. Agent topology

ทุก agent ใช้ filesystem เดียวกัน จึงห้ามมอบไฟล์ซ้อนกันใน wave เดียว Primary agent นับเป็นหนึ่ง slot; เปิด sub-agent พร้อมกันได้ไม่เกินสามตัว

### Orchestrator agent

รับผิดชอบ:

- อ่าน git status และ preserve unrelated changes
- เลือก work packet ที่ dependency ผ่าน
- กำหนด file ownership แบบไม่ overlap
- รวมผลและแก้ integration seam
- รัน gate verification
- อัปเดต execution ledger
- ขอ user approval เมื่อถึง production/physical gate

ห้าม delegate การตัดสินใจ destructive action หรือ production approval ให้ sub-agent

### Database schema agent

ขอบเขตหลัก:

- `prisma/schema.prisma`
- migration ใหม่
- migration rehearsal scripts/queries
- Prisma relation/index/constraint review

ไม่แก้ API/UI พร้อมกันใน wave เดียว เว้นแต่ packet ระบุไฟล์ชัดเจน

### Database application agent

ขอบเขตหลัก:

- settings utilities/APIs
- dual-write/read cutover
- payment/order/add-on/image callers
- JSON-safe/Decimal boundaries

### Printing contracts/API agent

ขอบเขตหลัก:

- `shared/types/printing.ts`
- state transition/idempotency/stale policies
- QR encoder/parser/validator
- printer/job/bridge APIs

### Bridge/renderer agent

ขอบเขตหลัก:

- Local Print Bridge package
- transport adapters
- local durable outbox
- Hybrid ESC/POS composer
- Thai raster/native QR physical fixtures

เริ่ม platform dependency หลังรู้ bridge OS และ unit interfaces เท่านั้น

### UI agent

ขอบเขตหลัก:

- printer selector/status/reprint UX
- payment QR/LINE QR settings
- receipt/quotation print action
- PDF/PNG regression

### Verification/review agent

ทำ read-only review เป็นหลัก:

- trace behavior end-to-end
- inspect migration SQL/locks
- run tests/reconciliation on disposable DB
- report blocker/regression โดยไม่แก้ไฟล์ที่ agent อื่นกำลังถือ ownership

## 6. Engineering loop ต่อหนึ่ง work packet

Primary agent ต้องทำ loop นี้ทุก packet:

1. **Inspect** — อ่าน `AGENTS.md`, master plan, relevant child plan, git status และ code path
2. **Claim** — ระบุ packet ID, outcome, allowed files, forbidden actions และ completion checks
3. **Red** — เพิ่ม characterization/regression test หรือพิสูจน์ baseline failure ก่อนเปลี่ยน behavior เมื่อทำได้
4. **Implement** — เปลี่ยนเฉพาะ vertical slice ที่เล็กที่สุด
5. **Focused verify** — รัน test/check ที่แคบที่สุด
6. **Broader verify** — รัน checks ตาม gate เมื่อ slice ผ่าน
7. **Review** — trace entry → mutation → output/error/rollback; ใช้ independent agent เมื่อความเสี่ยงสูง
8. **Integrate** — primary agent ตรวจ diff, ownership overlap, generated files และ unrelated changes
9. **Record** — อัปเดต ledger พร้อม evidence, blockers และสิ่งที่ยังไม่รัน
10. **Advance/stop** — เปิด packet ถัดไปเมื่อ gate ผ่านเท่านั้น

หาก packet ล้มเหลวสามรอบด้วย blocker เดิม ให้หยุด packet รายงานหลักฐาน และขอข้อมูล/authority แทนการวนแก้แบบเดา

## 7. Work packet contract

ทุก prompt ที่ส่ง sub-agent ต้องมีรูปแบบนี้:

```markdown
Packet: <ID — name>
Objective: <observable result>
Read first: AGENTS.md, master plan sections, relevant child plan/skill
Dependencies: <passed packet/gate IDs>
Owned files: <exact paths or non-overlapping directories>
Do not touch: <overlap/unrelated/generated/production targets>
Implementation constraints: <invariants and compatibility rules>
Checks: <exact focused commands>
Return: status, files changed, behavior, checks/output, assumptions, blockers, risks
```

Sub-agent final report ต้องไม่ใช้คำว่า “ผ่าน” หากไม่ได้รัน check จริง และต้องแยก baseline failure จาก failure ใหม่

## 8. Dependency graph และ execution waves

```text
G0 Plan aligned
 |
 +-- DB-01 Characterization tests --+
 +-- DB-02 Restore/replay rehearsal +--> G1 Database expand ready
 |                                         |
 |                                   DB-03 Expand migration
 |                                         |
 |                                   DB-04 Read-old dual-write --> G2 Backfill ready
 |                                         |
 |                                   DB-05 Backfill/reconcile --> G3 Read cutover ready
 |                                         |
 |                                   DB-06 Read cutover/soak --> G4 Contract ready
 |                                         |
 |                                   DB-07 Constraints/contract --> G5 Database stable
 |
 +-- HW-01 Hardware evidence -------------------------------+
 +-- PRN-01 Pure print/QR contracts ------------------------+--> PRN-02 Printer/PrintJob schema
                                                               |
                                 G5 Database stable ------------+
                                                               |
                                  +-- PRN-03 APIs/state/claim ---+
                                  +-- PRN-04 Bridge MVP ---------+--> G6 Print integration ready
                                  +-- PRN-05 Hybrid renderer ----+
                                                               |
                                  PRN-06 Admin UI ---------------> G7 Physical validation ready
                                  HW-02 Physical matrix ---------> G8 Rollout ready
                                  PRN-07 Feature-flag rollout ---> DONE
```

### Wave 0 — G0: Plan alignment

Owner: orchestrator

- master/child plans ไม่มี schema หรือ sequencing conflict
- canonical decisions C1–C12 ถูกอ้างจากทั้งสอง child plans
- git status และ baseline tests ถูกบันทึก

### Wave 1 — Independent evidence

ทำคู่ขนานได้สูงสุดสาม sub-agent:

#### DB-01 — Characterization tests

- เพิ่ม tests ของ setting projection, subscriber lifecycle, payment mapping, add-on refund, photos, completedAt fallback และ Decimal boundary
- ไม่แก้ schema
- completion: focused tests red/green sensitivity ถูกพิสูจน์และ `pnpm test` ผ่าน

#### DB-02 — Restore/replay rehearsal

- เตรียม disposable PostgreSQL
- replay migration chain ครบ
- ใช้ schema-only/sanitized fixture หรือ approved restore copy
- สร้าง read-only preflight/reconciliation scripts
- ไม่เชื่อม production ด้วย write credential
- completion: fresh replay, restored-shape rehearsal และ restore evidence ผ่าน

#### HW-01 — Hardware evidence

- เก็บ unit label/self-test, interfaces, firmware, dots, protocol/port และ bridge host OS
- ห้ามเปลี่ยน network/ส่ง test print หากยังไม่ได้รับ approval
- completion: configuration record ที่ redact secret และตอบ D7–D10/D12

#### PRN-01 — Pure contracts

เริ่มได้หลัง orchestrator freeze C7–C12:

- print document/operation/state/error contracts
- Thai QR encoder/parser จาก official vectors
- exact amountMinor และ eligibility tests
- ไม่เพิ่ม Prisma model หรือ transport dependency

### Wave 2 — Database expand

#### DB-03 — Expand migration

- เพิ่ม AppSetting target fields แบบ nullable
- เพิ่ม `ServiceOrder.completedAt` nullable
- ยังไม่ drop/rename model/table/column
- review generated SQL และ lock behavior บน disposable DB
- completion: old app ใช้ expanded schema ได้, row count เท่าเดิม, fresh replay ผ่าน

### Wave 3 — Compatibility writers

#### DB-04 — Read-old + dual-write

- current reads ยังใช้ source เดิม
- settings writes เขียน legacy + target ใน transaction เดียว
- order/add-on/photo/payment compatibility metrics พร้อม
- no fire-and-forget dual-write
- completion: rollback เป็น app เก่าแล้วยังเห็นค่าที่เขียนระหว่าง window

### Wave 4 — Backfill and reconcile

#### DB-05 — Idempotent backfill

- dry-run/report mode ก่อน apply
- settings copy field-by-field
- normalized add-on/photo backfill แบบ rerunnable
- ไม่มี subscriber migration
- run รอบสองเปลี่ยนศูนย์แถว
- completion: mismatch/quarantine เป็นศูนย์หรือมี approved disposition

### Wave 5 — Database cutover

#### DB-06 — Read cutover + soak

- เปลี่ยน model/utility read source ทีละกลุ่ม
- เปลี่ยน `BusinessSetting` Prisma model เป็น `AppSetting` โดย map physical table เดิม
- payment presentation/source relations และ completedAt ใช้ canonical path
- dual-write ต่อจน metrics/fallback เป็นศูนย์ 7–14 วัน
- production steps ต้องได้รับ approval

### Wave 6 — Database contract

#### DB-07 — Constraints and drops

- exact-one payment source และ full one-to-one uniqueness
- หยุด dual-writeก่อน drop
- drop `shop_setting`, `notification_setting` และ approved legacy columns เป็น migration ย่อย
- คง `notification_subscriber`
- backup/PITR + restore gate ใหม่ก่อน contract
- completion: model countประมาณ 26 ก่อน printer models และ full tests/build ผ่าน

### Wave 7 — Printing persistence

#### PRN-02 — Printer/PrintJob schema

- additive migration แยกจาก DB contract
- models สองตัวตาม C7–C9
- no endpoint/IP/Wi-Fi credential ใน migration
- completion: lease/fencing/idempotency/stale constraints ทดสอบบน disposable DB

### Wave 8 — Printing core

ทำคู่ขนานได้เมื่อ shared contracts freeze และ ownership ไม่ overlap:

#### PRN-03 — APIs

- admin printer/job/settings endpoints
- bridge claim/event/heartbeat
- handler + centralized authorization
- exact snapshot transaction และ pre-send stale validation

#### PRN-04 — Bridge MVP

- runtime/packaging ตาม HW-01
- local config/secret storage, durable outbox, per-printer mutex
- verified TCP ก่อน แล้วเพิ่ม USB/Bluetooth adapter เฉพาะ interface จริง
- restart recovery และ fencing token

#### PRN-05 — Hybrid renderer

- operation composer, bundled Thai shaping/raster, band splitting
- native QR + raster fallback ใช้ payload เดียวกัน
- feed/partial cut ตาม verified profile

### Wave 9 — UI integration

#### PRN-06 — Admin UI

- printer/transport selector
- queue status, needs-review, resolve และ explicit reprint
- LINE/payment QR settings แยกกัน
- PDF/PNG ยังใช้งานได้
- คง legacy browser-direct printing ไว้ใต้ rollback flag จน physical regression ผ่าน

### Wave 10 — Physical validation and rollout

#### HW-02 — Physical matrix

- ต้องมี approval ระบุ printer target
- minimal ASCII, Thai, long receipt, logo, LINE/payment QR, feed/cut
- Wi-Fi required; transport อื่นเฉพาะ unit รองรับ
- offline, reconnect, concurrent jobs, bridge restart
- บันทึก firmware/dots/port/render mode โดย redact network/credential

#### PRN-07 — Rollout

- deploy schema/API/bridge โดย feature ปิด
- pilot ADMIN
- dry scan QR อย่างน้อยสอง banking apps โดยไม่โอน เว้นแต่อนุมัติ
- soak แล้วเปิด EMPLOYEE
- Wi-Fi เป็น default หลัง duplicate/error metrics ผ่าน
- ถอด browser-direct WebUSB/BLE หลัง rollback window

## 9. Gate checklist

### G0 — Plan aligned

- [x] child plans อ้าง master plan
- [x] printer models/QR settings ตรงกันทุกเอกสาร
- [x] DB sequence เป็น dual-write ก่อน backfill
- [x] ไม่มี unresolved architecture conflict; hardware facts ที่ยังขาดถูกแยกเป็น HW-01 gate

### G1 — Database expand ready

- [ ] baseline `pnpm test` ผ่าน
- [ ] `prisma validate` ผ่าน
- [ ] fresh migration replay ผ่าน
- [ ] restore drill/reconciliation fixture พร้อม
- [ ] generated SQL/lock review ผ่าน

### G2 — Backfill ready

- [ ] compatibility app อ่านเก่าและ dual-write จริง
- [ ] rollback app test ผ่าน
- [ ] backfill dry-run ไม่พบ unknown payload

### G3 — Read cutover ready

- [ ] backfill รอบสองเปลี่ยนศูนย์แถว
- [ ] field/row/invariant mismatch = 0
- [ ] quarantine = 0 หรือมี approved disposition

### G4 — Contract ready

- [ ] fallback/dual-write mismatch = 0 ตลอด soak
- [ ] ไม่มี old deployment/worker
- [ ] backup/PITR และ restore drill ใหม่ผ่าน
- [ ] code search ไม่พบ legacy caller

### G5 — Database stable

- [ ] constraints valid
- [ ] contract migrations แยกและ reconcile ผ่าน
- [ ] tests/typecheck/build ไม่มี regression ใหม่
- [ ] production observation window ผ่าน

### G6 — Print integration ready

- [ ] HW-01 ตอบ OS/interfaces/port/dots
- [ ] Printer/PrintJob schema ผ่าน concurrency tests
- [ ] lease/fencing/stale/idempotency tests ผ่าน
- [ ] bridge fake transports ผ่าน restart/partial send
- [ ] Hybrid fixtures decode/compare ผ่าน

### G7 — Physical validation ready

- [ ] target printer และ authority ระบุชัด
- [ ] payment receiver masked config/activation พร้อม
- [ ] fixture ไม่มีข้อมูลลูกค้าจริง
- [ ] rollback flag และ PDF/PNG fallback พร้อม

### G8 — Rollout ready

- [ ] physical matrix ผ่าน
- [ ] no silent duplicate/retry
- [ ] Thai/QR/feed/cut ผ่าน
- [ ] runbook install/update/troubleshoot/rollback พร้อม
- [ ] snapshot retention decision บันทึกแล้ว

## 10. File ownership map

| Area | Primary owner | ห้ามแก้พร้อมกัน |
| --- | --- | --- |
| `prisma/schema.prisma`, `prisma/migrations/**` | DB schema agent | print persistence agent |
| settings/payment/order APIs/utilities | DB application agent | print API agent เมื่อ contract ยังไม่ freeze |
| `shared/types/printing.ts`, printing state | print contracts agent | bridge/UI agents |
| `server/api/admin/print-*`, `server/api/print-bridge/**` | print API agent | DB application agent เฉพาะ shared auth policy |
| bridge package/directory | bridge agent | renderer agent หาก composer อยู่ directory เดียวกัน |
| ESC/POS/Thai renderer | renderer agent | bridge transport agent |
| admin print/settings UI | UI agent | DB setting UI agent |
| master/child plans | orchestrator | sub-agents ทุกตัว |

เมื่อไฟล์ seam ต้องใช้ร่วมกัน ให้ primary agent freeze contract ก่อน แล้วมอบ integration edit ให้ agent เดียวหลัง parallel wave จบ

## 11. Verification policy

ระหว่าง packet ใช้ smallest relevant check ก่อน แล้วใช้ gate checks:

```bash
pnpm test
pnpm exec prisma validate
pnpm exec prisma generate
pnpm exec nuxi typecheck
pnpm run build
git diff --check
```

ข้อจำกัดที่ต้องรายงาน:

- ไม่มี working lint command ใน package ปัจจุบัน
- typecheck มี baseline errors เดิม ต้องเก็บ baseline และแยก error ใหม่
- build อาจ fail จาก font download/network หลัง compilation
- bridge commands ตัดสินหลังเลือก runtime/package boundary; ห้าม invent

Migration verification ต้องมี:

- fresh replay migration chain
- restored/sanitized production-shape rehearsal
- rollback compatibility
- idempotent backfill second run = zero changes
- exact Decimal comparisons
- active/soft-deleted invariants

## 12. Stop conditions

หยุด packet และส่งกลับ primary agentทันทีเมื่อ:

- พบ working-tree change ของผู้ใช้ทับกับ owned files และแยกไม่ได้
- migration ต้องแก้ applied migration
- ต้องใช้ production write/migration/seed/reset โดยยังไม่มี approval
- preflight หรือ reconciliation mismatch
- restore/PITR ใช้ไม่ได้ก่อน destructive contract
- hardware revision/port/transport ยังไม่ยืนยันแต่ code จะส่งจริง
- QR receiver/amount/config version ไม่ตรวจได้แบบ exact
- job อาจถูกส่งซ้ำหลัง ambiguous failure
- dependency ใหม่ต้องใช้ native/OS capability ที่ HW-01 ยังไม่ยืนยัน
- task ต้องเปลี่ยน business payment/order semantics นอก scope

## 13. Handoff format

ทุก agent ส่งผลกลับด้วยรูปแบบนี้:

```markdown
Packet: <ID>
Status: complete | blocked | partial
Outcome: <what now works>
Files changed: <paths>
Checks run: <command + pass/fail>
Baseline failures: <none or exact list>
Assumptions: <only material assumptions>
Blockers/risks: <actionable>
Next packet recommendation: <ID/reason>
```

Primary agent ต้องตรวจ evidence เองก่อน mark packet/gate complete

## 14. Execution ledger

Primary agent เป็นผู้แก้ section นี้เท่านั้น

| Packet | Status | Owner | Evidence/notes |
| --- | --- | --- | --- |
| G0 Plan alignment | complete | orchestrator | child plans linked; AppSetting/2-table printer schema/dual-write sequence aligned |
| DB-01 Characterization | pending | — | — |
| DB-02 Restore/replay | pending | — | — |
| HW-01 Hardware evidence | pending | — | requires physical unit information |
| PRN-01 Pure contracts | pending | — | after C7–C12 freeze |
| DB-03 Expand | pending | — | after G1 |
| DB-04 Dual-write | pending | — | after DB-03 |
| DB-05 Backfill | pending | — | after DB-04 |
| DB-06 Read cutover/soak | pending | — | production approval required |
| DB-07 Contract | pending | — | destructive approval required |
| PRN-02 Print schema | pending | — | after G5 |
| PRN-03 APIs | pending | — | after PRN-02/contracts |
| PRN-04 Bridge | pending | — | after HW-01/contracts |
| PRN-05 Renderer | pending | — | after HW-01/contracts |
| PRN-06 UI | pending | — | after API contract freeze |
| HW-02 Physical matrix | pending | — | physical approval required |
| PRN-07 Rollout | pending | — | deploy approval required |

## 15. First executable loop

เมื่อผู้ใช้สั่งเริ่ม implementation ให้ primary agentทำตามนี้:

1. ตรวจ `git status` และ baseline `pnpm test`/`prisma validate`
2. mark G0 complete เมื่อ child plans align แล้ว
3. เปิด work packet พร้อมกันไม่เกินสามตัว:
   - DB-01 characterization tests
   - DB-02 disposable restore/replay preparation
   - HW-01 hardware evidence หรือ PRN-01 pure contracts ถ้า hardware ยังรอผู้ใช้
4. primary agentตรวจ current code paths และเตรียม integration seams โดยไม่แก้ไฟล์ที่ sub-agent ถือ
5. รอผล, verify และ integrate ทีละ packet
6. ขอ approval ก่อนเชื่อม production เพื่อ backup/restore/preflight หรือก่อน physical print
7. ไม่ข้าม G1–G8 แม้ local tests ผ่าน

## 16. Final completion

งานรวมถือว่าเสร็จเมื่อ:

- database source of truth และ constraints ตรงตาม C2–C6 โดย production reconciliation ผ่าน
- settings ลดจากสาม singleton tables เหลือหนึ่ง และ `NotificationSubscriber` คง semantics เดิม
- printer ใช้เพียง `Printer`/`PrintJob` ใน v1 พร้อม lease/fencing/stale guard
- Wi-Fi XP-C260M ใช้งานจริงผ่าน Local Print Bridge และ transport อื่นที่ unit รองรับใช้ contract เดียวกัน
- Hybrid Thai, payment QR, LINE QR, feed/cut และ failure recovery ผ่าน physical matrix
- PDF/PNG และ payment/order/auth flows เดิมไม่ regression
- ไม่มี secret/PII ใน repository/log และไม่มี arbitrary LAN target จาก client
- runbook, tests, baseline limitations, rollout และ rollback evidence ครบ
- ไม่มี commit/deploy/production mutation ที่เกิดโดยไม่มีคำสั่งผู้ใช้
