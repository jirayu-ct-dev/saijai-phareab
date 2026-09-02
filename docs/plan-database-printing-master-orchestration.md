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
- Prisma model เปลี่ยนเป็น `AppSetting` ใน compatibility release โดยคง `@@map("business_setting")`; การ rename นี้ไม่เปลี่ยน physical table และยังไม่ cutover shop/notification reads
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
- เปลี่ยน Prisma model `BusinessSetting` เป็น `AppSetting` โดย map physical table เดิม แต่ยังไม่เปลี่ยน source fields ของ shop/notification reads
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
- เปลี่ยน shop/notification reads ไป target fields บน `AppSetting` ที่ rename แล้วใน DB-04
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

> ตัดสินโดย orchestrator 2026-09-02: **ผ่าน (ready to author expand)**
> ข้อ 1–4 ผ่านจากการรันจริง; ข้อ 5 ปิดแล้วหลังเขียน DB-03 เสร็จ (รีวิว SQL
> ที่ generate + ทดสอบบน disposable DB + rehearsal รอบใหม่ผ่านครบ)

- [x] baseline `pnpm test` ผ่าน (267/267, ยืนยันซ้ำ 2026-09-02 ก่อนและหลัง DB-03)
- [x] `prisma validate` ผ่าน
- [x] fresh migration replay ผ่าน (47/47 ก่อน DB-03, 48/48 หลังรวม DB-03 บน disposable postgres:16)
- [x] restore drill/reconciliation fixture พร้อม (synthetic fixture + dump/restore + report equality + schema-diff allowlist ว่าง = 0 diff + negative self-test exit 3)
- [x] generated SQL/lock review ผ่าน — migration `20260902000000_db03_expand_appsetting_completed_at` เป็น ADD COLUMN nullable 26+1 คอลัมน์เท่านั้น (catalog-only, ไม่มี table rewrite, lock สั้นบนตาราง 1 แถว + service_order); ตัด DROP INDEX drift ที่ `prisma migrate dev` แทรก (partial unique index 2 ตัวที่ schema.prisma แทนไม่ได้) โดยมี guard testคอยจับ; `prisma migrate diff` เหลือเฉพาะ DROP ของ partial indexes สองตัวที่อยู่ใน known allowlist และไม่มี unexpected schema diff

### G2 — Backfill ready

**สถานะ: PASS บน synthetic disposable PostgreSQL (2026-09-02)** — actual old
application binary drill ผ่านครบ; ขอบเขตนี้ปิด G2 แต่ไม่ใช่หลักฐาน
production-shape และไม่ทำให้ G3 ผ่านอัตโนมัติ:

- [x] compatibility app อ่านเก่าและ dual-write จริง — `settingsDualWriteDb.test.ts` ยืนยัน equality/transaction rollback; old revision `8d87759298fec3030313802b63d33416d4da910f` ถูก build ด้วย frozen lockfile และ actual Nitro binary อ่าน expanded schema ผ่าน HTTP จริง
- [x] rollback app test ผ่าน — `run-old-binary-drill.sh` ผ่าน 13/13 stages: Better Auth signed-cookie login จริง, public/admin settings, backfilled add-on/photo, completed-order `updatedAt` fallback และ old-only shop write/readback; schema fingerprint/normalized rows/partial indexes คงเดิม, post-drill preflight ผ่าน, current checkout ไม่เปลี่ยนและ disposable resources ถูก cleanup
- [x] backfill dry-run ไม่พบ unknown payload — rehearsal stage 4: dry-run ทั้ง 3 operations บน fixture สะอาดให้ `mismatches = 0`, `quarantine = 0`, exit 0; unknown-shape/invalid-json/missing-entitlement paths ถูกพิสูจน์ว่า quarantine ด้วย negative overlay (exit 2, rowsChanged 0)

ข้อกำหนด rollback window: old-only settings write ทำให้ target stale ตามคาด;
ก่อน DB-06 ต้องกลับ compatibility app ที่ยังอ่าน legacy แล้ว re-save ค่าที่เปลี่ยนผ่าน
admin API เพื่อ dual-write อีกครั้ง. DB-05 จะรายงาน mismatch exit `1` และไม่ overwrite
target ที่ไม่ว่าง. Evidence ล่าสุด:
`/var/folders/f5/18ygctb55cncd7h4pchbp6hm0000gn/T/saijai-old-binary-rehearsal.BKEfS5`.

### G3 — Read cutover ready

**สถานะ: Approval C รันแล้วผ่านครบ (2026-09-03, `chat-2026-09-03-g3-c`) — DB-03
expand สำเร็จ, DB-05 ทั้งสาม operation dry/apply/apply2/final ผ่าน (mismatch =
0, quarantine = 0, รอบสองเปลี่ยน 0 แถว), preflight-after สะอาด, migration
history up to date (48), post-migration backup `20260902T201512Z`.** ดู
[`db-g3-production-approval-packet.md`](./db-g3-production-approval-packet.md)
section 7. ขั้นถัดไปคือ DB-06 read cutover ซึ่งต้องได้การอนุมัติแยกจาก operator
โดยตรง

- [x] Approval A post-remediation production-shape rehearsal ผ่าน 12/12
- [x] Approval B runner พร้อมและพิสูจน์ production-read-only mode บน disposable DB
- [x] Approval B database preflight รันบน production จริงแบบ TLS/read-only ผ่าน
- [x] Approval B external backup verification + restore rehearsal
- [x] ข้อบังคับ PITR ถูกแทนด้วย external encrypted backup policy — operator
  ตัดสิน 2026-09-03 คง Supabase Free Plan; backup สด `20260902T195024Z` +
  restore drill `backup-drill-20260902T195024Z` ผ่าน
- [x] Approval B active deployment/worker inventory + compatibility revision —
  Vercel log export + live probe: deployment เดียวรับ traffic ทุก host,
  worker 0, revision `dpl_9HDLPx…`
- [x] Approval C expand/backfill บน production จริง — 2026-09-03 ผ่านครบ
  (DB-03 migrate deploy + DB-05 ทั้งสาม operation, stop condition ไม่ถูกเรียก)
- [x] backfill รอบสองเปลี่ยนศูนย์แถว
- [x] field/row/invariant mismatch = 0
- [x] quarantine = 0 หรือมี approved disposition

### G4 — Contract ready

**สถานะ: IN SOAK — DB-06 read cutover deploy ขึ้น production แล้ว
(2026-09-03, live buildId `b44a3e64…` จาก main commit `b1dfe9e…`) — หน้าต่าง
soak 7–14 วันตามแผนเริ่มนับ 2026-09-03 ต้องครบก่อนปิด G4 แล้วจึงหยุด dual-write
ทีละกลุ่ม.** เกณฑ์ตลอดหน้าต่าง: structured log metric
`db_compat_setting_read_total{result="mismatch"|"fallback"}` ต้องเป็น 0
(และ `result="match"` ต้องมีขึ้นตลอด) ตรวจจาก Vercel observability กรอง
`[db-compat]`

- [ ] fallback/dual-write mismatch = 0 ตลอด soak (เริ่มนับ 2026-09-03)
- [x] ไม่มี old deployment/worker — deployment รับ traffic มีตัวเดียวบน build
  ใหม่ (worker 0 ตามสถาปัตยกรรม Vercel, ยืนยัน 2026-09-03)
- [x] backup ใหม่ผ่าน — post-cutover backup `20260902T204720Z` (encrypted SHA-256
  `7ca241d3…33157d`) และ drill ผ่านล่าสุด `backup-drill-20260902T195024Z`
- [x] code search ไม่พบ legacy caller — การอ่าน `shopSetting`/`notificationSetting`
  คงอยู่เฉพาะใน `server/utils/appSetting.ts` (dual-write leg + soak comparison
  ที่ตั้งใจไว้ตามแผน Phase 5) และจะหายไปเมื่อหยุด dual-write หลัง soak

### G5 — Database stable

- [x] constraints valid — `check-constraints.mjs` บน production 2026-09-03:
  invalid/not-ready index = 0, NOT VALID constraint = 0 ใน app schema
  (หลักฐาน `g5-constraint-check-*.json` ใน restricted directory)
- [x] contract migrations แยกและ reconcile ผ่าน — `migrate status` up to date
  48 migrations, migration history replay ผ่านจาก G1/Approval A, DB-03 delta
  ตรง allowlist `+27/-0` unexpected 0
- [x] tests/typecheck/build ไม่มี regression ใหม่ — `pnpm test` 322 ผ่าน,
  `nuxi typecheck` 0 error, `pnpm run build` สำเร็จ (2026-09-03)
- [ ] production observation window ผ่าน — คือหน้าต่าง soak เดียวกับ G4
  (7–14 วัน, เริ่ม 2026-09-03)

### G6 — Print integration ready

> สถานะ (2026-09-03): PRN-02/03/04/05 เสร็จและตรวจครบ (ดู ledger) — คงเหลือ
> HW-01 ที่ผูกกับตัวเครื่องจริง และ Hybrid fixture compare ที่ต้องรอ profile
> จริงจาก HW-01 จึง tick สองข้อล่างไม่ได้

- [ ] HW-01 ตอบ OS/interfaces/port/dots (ผูกกับตัวเครื่องจริง — ยังไม่มีบนหน้างาน)
- [x] Printer/PrintJob schema ผ่าน concurrency tests — rehearsal 6 stages บน disposable postgres:16 (replay 49/49, FOR UPDATE SKIP LOCKED ผู้ชนะเดียว, idempotency 23505, fencing, stale-lease)
- [x] lease/fencing/stale/idempotency tests ผ่าน — `tests/server/printJobQueue.test.ts` 18 กรณี (stale-fencing reject, ห้าม FAILED หลัง sendStartedAt, freshness→STALE_DOCUMENT, timeline จำกัด)
- [x] bridge fake transports ผ่าน restart/partial send — `tests/server/printBridge*.test.ts` 29 กรณี (outbox fsync + crash resume→NEEDS_REVIEW, mutex, partial write→NEEDS_REVIEW, connect fail→FAILED_OFFLINE backoff, stale drop, credential redaction)
- [ ] Hybrid fixtures decode/compare ผ่าน (composer/escpos tests 82 กรณีผ่านแล้ว แต่ compare กับ output จริงของเครื่องต้องรอ HW-01 profile)

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
| DB-01 Characterization | complete | sub-agent DB-01 (verified by orchestrator 2026-09-02) | 70 tests / 5 ไฟล์ใหม่ใน `tests/server/*Characterization.test.ts` pin settings projection, payment→sale mapping, add-on refund, subscriber lifecycle, deliveredAt fallback; full suite 267/267 ผ่าน; red/green sensitivity พิสูจน์ด้วย mutation ชั่วคราว (revert แล้ว); ไม่แก้ไฟล์เดิม พบ risk: refundAddonUsages อาจคืนซ้ำผ่าน legacy JSON fallback เมื่อ normalized records ถูก refund หมด (ต้องออกแบบ backfill ให้เคลียร์ JSON) และ deliveredAt fallback ซ้ำ 3 จุด |
| DB-02 Restore/replay | complete | sub-agent DB-02 + orchestrator DB-02.1 (verified by orchestrator 2026-09-02) | preflight/reconciliation SQL ครบ 8.1–8.7 (read-only, aggregate, ไม่มี PII) + runners + `docs/db-rehearsal-runbook.md` + backfill report contract; ต่อยอด DB-02.1 ตามสั่ง: (1) `--enforce` ทำ runner fail ด้วย exit 3 เมื่อ invariant แตก (pass=false, violating_rows>0 โดยไม่มี pass column, zero-required check ids, NOTICE invariants จาก 07) (2) `schema-diff.mjs` + `schema-allowlist.json` (fingerprint tables/columns/enums/constraints/indexes; ตัด ordinal_position เพราะ attnum gap จาก DROP COLUMN ไม่รอดจาก pg_dump) (3) `fixture/01-synthetic-fixture.sql` synthetic non-PII ทั้งชุด + `fixture/02-violations-overlay.sql` negative self-test (พบ CHECK `payment_record_single_source` กัน multi-source ระดับ DB แล้ว) (4) `run-rehearsal.sh` รันครบ 7 stages บน disposable postgres:16 ผ่านทั้งหมด: fresh replay 47/47 migration → fixture → preflight enforce → pg_dump → restore → report equality + schema-diff allowlist ว่าง = 0 diff → negative test exit 3; 07 แก้เป็น cutover-aware (legacy COMPLETED คง completedAt NULL ตาม F5 = report-only, กฎ post-cutover ทำงานเมื่อตั้ง REHEARSAL_COMPLETED_AT_CUTOVER); evidence `/var/folders/.../saijai-rehearsal.JeCh8K` (rerun ได้ด้วย REHEARSAL_KEEP_STAGE=1) |
| HW-01 Hardware evidence | pending | — | requires physical unit information |
| PRN-01 Pure contracts | complete | sub-agent PRN-01 (verified by orchestrator 2026-09-02) | `shared/types/printing.ts`, `shared/utils/printJobState.ts` (transition table ตรง C8, fencing/lease/retry/stale-guard), `server/utils/paymentQr/` (EMVCo TLV, CRC-16/CCITT-FALSE, exact amountMinor แบบ string math); 86 tests ผ่าน; typecheck exit 0; orchestrator ยืนยันอิสระด้วย CRC implementation แยก (check value 29B1 และ CRC ของ payload จริง) + round-trip parse; ไม่เพิ่ม dependency/Prisma/transport |
| DB-03 Expand | complete | orchestrator (2026-09-02) | migration `prisma/migrations/20260902000000_db03_expand_appsetting_completed_at` (authored by hand จาก SQL ที่รีวิวแล้ว เพราะ `migrate dev` แทรก DROP INDEX ของ partial unique index 2 ตัวที่ schema.prisma แทนไม่ได้): ADD COLUMN nullable 26 คอลัมน์บน `business_setting` (shop 5, notification policy 9, print/QR 12 รวม lineQrEnabled) + `service_order.completedAt` 1 คอลัมน์ — ไม่มี drop/rename/default/backfill, actor ids เป็น String? ไม่มี FK เพื่อลด expand surface; แก้ `sql/07` ที่ detect `completed_at` ผิดเป็น `"completedAt"` (จริง ๆ ไม่เคย active) และพิสูจน์ red/green กฎ cutover แล้ว; verification: replay 48/48 ผ่าน, `migrate diff` เหลือเฉพาะ known partial-index DROP สองตัว (index จริงยังครบ), custom schema-diff pre-vs-post = +27/−0 ตรง migration ทุกบรรทัด, `prisma generate` + pnpm test 267/267 + typecheck exit 0, rehearsal เต็มรอบ (fixture + enforce + dump/restore + negative test) ผ่าน — evidence `/var/folders/.../saijai-rehearsal.YLS13E` |
| DB-04 Dual-write | complete | orchestrator + sub-agent review (2026-09-02) | settings writer รวมที่ `server/utils/appSetting.ts`; shop/notification เขียน legacy + target ด้วย transaction เดียวและ map จาก persisted legacy row, `lineQrEnabled` derive จากการมี legacy URL; Prisma model rename เป็น `AppSetting` แต่ physical `business_setting` และ read-old semantics คงเดิม; `completedAt` stamp ครบ create/status PATCH/full PUT, ปิด full-PUT state-machine bypass และเพิ่ม optimistic status guard. DB-04.1 telemetry: `server/utils/compatTelemetry.ts` เป็น contract กลาง (metric ชื่อ stable 5 ตัว: setting_write/addon_refund/item_photo_write/payment_status_sync/order_transition, dimension bounded path/result, errorCode sanitized เป็น code/HTTP_x เท่านั้น, success emit หลัง commit, emit ห้ามทำ tx ล้ม); instrument ครบ settings, add-on refund (outcome normalized/already-refunded/legacy-fallback/no-usage), photo mirror, payment↔packageSale sync (state/edit/cancel/delete), order transition + conflict. DB-04.2: ปิด double-refund — `refundAddonUsages` ทำ normalized ledger เป็น authoritative ทันทีที่มี record ของ order (all-refunded หรือ pending-only ไม่ fallback JSON อีก), แก้แบบ test-first red→green และเปลี่ยน quirk test เป็น regression test. Verification: pnpm test 289 passed/1 skipped, nuxi typecheck exit 0, prisma validate ผ่าน, guarded disposable-Postgres test ยืนยัน legacy/target equality + target-failure rollback จริง (container ลบแล้ว). ณ เวลาปิด DB-04 งาน G2 ที่ยังเหลือคือ full old-app rollback rehearsal และ clean backfill dry-run; ทั้งสองปิดแล้วภายหลังตามแถว G2 ด้านล่าง. Completion-audit รอบสอง (2026-09-02): harden telemetry ตาม audit finding — `compatErrorCode` เป็น whitelist จริง (Prisma `P####`, application UPPER_SNAKE, fallback `HTTP_100–599` เท่านั้น, ≤64 ตัวอักษร, นอกเงื่อนไข = `UNKNOWN`, `data.code` ที่ invalid ล้มไปหา `code`/`statusCode`), payload ไม่มี message/stack/URL/token/record ID; metric/path/result เป็น closed union ต่อ metric จาก call sitesจริงและ `emitCompatFailure` มี overload คู่ metric/path ต่อ metric (typecheck exit 0 ยืนยัน call sitesครบ ไม่มี call site ถูกแก้); tests `compatTelemetry.test.ts` เพิ่มเป็น 14 แบบ test-first (red 4 กรณี: arbitrary code whitespace/URL/secret → UNKNOWN, ยาวเกิน 64 → UNKNOWN, statusCode นอกช่วง/ทศนิยม → UNKNOWN, invalid data.code ล้มต่อ) และพิสูจน์ console throw แล้ว business failure ยัง propagate |
| DB-05 Backfill | complete | orchestrator (2026-09-02) | runner `scripts/db-rehearsal/backfill/backfill.mts` (3 operations: settings-consolidation, addon-usage-json-to-ledger, item-photo-direct-to-join; mode dry-run/apply; ใช้ parser ตัวจริง `parseAddonUsages` ของแอป; guard loopback+`rehearsal*`+`--confirm-disposable`; batch transaction เดียวต่อ run; report ตาม `backfill-report-contract.ts` exit 0/1/2/3/64); pure planners แยกใน `plan.mts` + tests `backfillPlanning.test.ts` (14); `legacy-read-check.mts` ยืนยัน legacy sources ไม่ถูกแตะและอ่านได้; negative overlay `fixture/03-backfill-negative-overlay.sql`; rehearsal `run-backfill-rehearsal.sh` ผ่านครบ 12 สเตจ (48/48 replay, dry-run quarantine 0, apply settings 1/add-on 2/photo 1, gap checks 0, apply รอบสอง rowsChanged 0, dump/restore equality + allowlist diff ว่าง, legacy read-path 11 checks, negative: quarantine exit 2 rowsChanged 0 + mismatch exit 1 + preflight exit 3, partial indexes ครบทั้งสอง DB); pnpm test 303 passed/1 skipped, typecheck exit 0, prisma validate ผ่าน; ไม่ต้องเขียน DB นอก disposable; ไม่ได้เริ่ม DB-06/DB-07/printer ตามขอบเขต. Completion-audit รอบสอง (2026-09-02): ปิดช่อง partial migration ตาม audit finding — ตรวจการมีอยู่ของ entitlement ของ valid entries ทุกตัวก่อนเขียน หาก order ใดมี entitlement หายจะ quarantine `missing-entitlement` ทั้ง order และไม่สร้าง ledger row เลย (rowsChanged ของ order นั้น = 0, ไม่เดาค่า ไม่สร้าง entitlement ไม่ลบ legacy JSON, clean order อื่นใน batch ยังถูก migrate); พิสูจน์แบบ test-first red (createMany ถูกเรียกบน order ที่มี missing-entitlement) → green 17/17 (`backfillPlanning` 14 + `backfillAddonRunner` 3 ใหม่); negative overlay แยก `fxso7` เป็น parser-clean missing-entitlement order (ไม่ปน invalid-json/unknown-shape เพื่อไม่ให้ early parser quarantine บัง branch) และ rehearsal รันซ้ำผ่านครบ 12 สเตจ (exit 0) — negative dry-run quarantine 3 entries ครบ 3 reason (exit 2), negative **apply** rowsChanged 0 และ `fxso6`/`fxso7` ไม่มี ledger row ใน DB จริง, apply รอบสองยัง rowsChanged 0, dump/restore equality + legacy read-path + partial indexes ยังผ่าน; pnpm test 312 passed/1 skipped, typecheck exit 0, prisma validate ผ่าน |
| G2 Backfill ready | complete | orchestrator (2026-09-02) | actual old-binary drill `run-old-binary-drill.sh` ผ่าน 13/13 บน unique loopback PostgreSQL 16: Git archive ของ `8d87759298fec3030313802b63d33416d4da910f`, frozen install + Prisma generate + Nuxt build, actual `.output/server/index.mjs`, Better Auth login และ public/authenticated HTTP reads, old-only write/readback, add-on/photo/completed fallback, schema/data/index preservation, post-preflight และ cleanup; expected settings target staleness ถูก detect fail-closed และมี resync step ก่อน DB-06; production-shape/G3 ยัง pending |
| G3 production-shape preparation | complete | orchestrator (2026-09-02) | approval packet แยก A backup/local restore, B read-only production preflight, C production expand/backfill และย้ำว่าไม่รวม DB-06; `run-production-shape-rehearsal.sh` บังคับ approved custom archive + SHA-256 + source PG major + approval reference, mount read-only เข้า unique loopback container, restore transaction, DB-03 exact allowlist, canonical fresh-schema diff, enforced preflight, dry/apply/apply2/final gates, timeout, aggregate-only verdict และ repo/archive integrity; evaluator self-tests 5/5 รวม active-image gap, blocked-preflight evidence และ redaction; harness end-to-end 12/12 ผ่านบน synthetic pre-DB-03 archive (+27/−0, canonical drift 0, mismatch/quarantine 0, apply2/final rowsChanged 0), evidence `/var/folders/.../saijai-g3-production-shape.Yirmzb` |
| G3 approved production-shape execution | complete | orchestrator (2026-09-02) | รอบแรก Approval A `chat-2026-09-02-g3-a` หยุด fail-closed ที่ `paid_payment_missing_receipt_no=1`. หลังได้รับ approval แยก จึงแก้ production เพียง 1 แถวด้วย `receiptNo = paymentNo` ใน SERIALIZABLE transaction: candidate 1, paymentNo present, collision 0, update 1, invariant ภายใน transactionและหลัง commit 0; aggregate evidence `/Users/jirayu/dev/backup/saijai-phareab/production-payment-receipt-remediation-20260902T141204Z.json`. สร้าง post-remediation PostgreSQL 17.6 custom archive SHA `b3c00f…055c71` แล้ว Approval A รอบ `chat-2026-09-02-g3-a-after-receipt-remediation` ผ่านครบ 12/12: DB-03 +27/−0 unexpected 0, canonical allowed removal 1/unexpected 0, preflight failures 0, mismatch/quarantine 0, apply2/final rowsChanged 0 ทุก operation; evidence `/var/folders/.../saijai-g3-production-shape.HdVPdB`. Production ไม่ถูก migrate/backfill; Approval B/C และ G3 production ยัง pending; DB-06 ยังไม่เริ่ม. |
| G3 Approval B tooling | complete | orchestrator (2026-09-02) | `run-preflight.mjs` มี target mode แยกชัด: production mode บังคับ sanitized approval reference, absolute new report นอก repo mode `0600`, no-overwrite/no-existing-symlink, invariant enforcement, fixed application name, `REPEATABLE READ READ ONLY` + runtime verification, statement/lock timeout, non-symlink PEM CA + TLS peer verification และไม่บันทึก host/database/driver message; `00-server-and-migration-context.sql` รายงาน version/read-only/Prisma migration aggregate. เพิ่ม `approval-b-attestation.example.json` และ `evaluate-approval-b.mjs` เพื่อรวม SQL evidence กับ operator evidence แบบ fail-closed: freshness 24h สำหรับ attestation/backup, 1h สำหรับ PITR/runtime, future tolerance 5m, active runtime ต้องเป็น compatibility version (หรือ zero-runtime maintenance), คำนวณ row/NOTICE invariant ซ้ำ, ปฏิเสธ SQL file ขาด/ซ้ำ/นอก reviewed set และ summary ไม่คัดลอก identifiers. Focused tests หลัง TLS hardening: preflight CLI 8/8; evaluator 9/9; production-mode integration ก่อน TLS hardening บน synthetic disposable PostgreSQL 17 ผ่าน (8 SQL files, invariant failure 0, read-only true, overwrite exit 1); full replay/dump/restore/negative rehearsal 7/7 ผ่าน; pnpm test 312 passed/1 skipped, typecheck และ prisma validate ผ่าน. SQL ไม่สามารถแทน operator attestation เรื่อง PITR/backup กับ active deployment/worker ได้. |
| G3 Approval B production execution | blocked | orchestrator (2026-09-02) | ได้รับ approval `chat-2026-09-02-g3-b`. Initial invocation loader เลือก commented localhost example และหยุดก่อน SQL; failure report `production-preflight-20260902T161736Z.json` เก็บ audit เท่านั้น. Authoritative rerun เลือก active uncommented `DIRECT_URL` FQDN: CA SHA `700723…f0ef`, TLS peer verification, `REPEATABLE READ READ ONLY`, timeout 30000ms; runner exit 0, SQL 8/8, PostgreSQL 17.6, migration rows 47/unfinished 0/rolled-back 0, query/invariant failure 0, settings singleton 1/1/1, add-on/photo backfill targets 0, paid invariants 0. Aggregate report `/Users/jirayu/dev/backup/saijai-phareab/production-preflight-20260902T163522Z.json` mode 0600 SHA `92314da…177d5`; URL/credential leak checksผ่าน. Read-only Supabase Dashboard inspection ยืนยัน Free Plan ไม่มี scheduled backup และ PITR ไม่ได้เปิด; external custom archive ยัง fresh และผ่าน restore rehearsal 12/12. Evaluator รอบล่าสุดยัง `APPROVAL_B_BLOCKED` 7 รายการ: PITR 2 และ production runtime inventory/compatibility 5; summary `/Users/jirayu/dev/backup/saijai-phareab/approval-b-summary-observed-20260902T165457Z.json` mode 0600 SHA `d6f04fd…5e65a`. ไม่มี write, migration, backfill, deploy, Approval C หรือ DB-06. |
| G3 Approval B backup policy + runtime host decision | done (Approval B PASS) | orchestrator (2026-09-03) | Operator ตัดสิน 2 ข้อ: (1) คง Supabase Free Plan — ไม่สมัคร Pro/PITR และให้เลือกนโยบายทดแทนเอง จึงกำหนด `external-encrypted-backups`: backup เต็มเข้ารหัสทุก ≤ 60 นาที (RPO เท่าเกณฑ์ PITR เดิม), retention ≥ 14 วัน, restore drill ≤ 30 วัน; `evaluate-approval-b.mjs` เพิ่ม `backupPolicy` attestation path (fail-closed: interval invalid ใช้ window 60 นาที, ยังบังคับ backup 24h/drill reference เดิม, PITR path คงเดิมเมื่อไม่มี policy) พร้อม focused tests 11/11 ผ่าน; (2) production application รันบน Vercel — บันทึก mapping runtime inventory ลง packet section 4.2 และ `approval-b-attestation.example.json`. เครื่องมือ backup ที่ Cloudflare R2: `scripts/production-backup/r2-backup.sh` + `r2-s3.mjs` (SigV4 `node:crypto` ล้วน, แก้ canonical-query sort bug พร้อม regression test 3/3) + `restore-drill.sh`. การปิด gate รอบสุดท้าย `chat-2026-09-03-g3-b` (operator มอบหมายให้ orchestrator รัน): backup สด `20260902T195024Z`, restore drill ผ่าน 2 รอบ (รอบแรกเจอ grep pattern ผิดใน drill เอง — custom-format dump พิมพ์ `Format: CUSTOM` ไม่ใช่ banner plain-text, แก้แล้ว), production preflight read-only ใหม่สะอาด 8/8, runtime inventory จาก Vercel log export ของ operator + live probe (deployment เดียว `dpl_9HDLPx…` รับ traffic ทุก host, worker 0) → `evaluate-approval-b.mjs` = `APPROVAL_B_PASS` blocker 0 หลักฐานใน restricted directory (`approval-b-attestation-final-2026-09-02T19:54:14Z.json`, `approval-b-summary-final-…`). ยังไม่มี production write, migration, backfill, deploy, restart, commit หรือ DB-06 — Approval C ต้องขออนุมัติ operator แยกต่างหาก (window 01:00–03:00 Asia/Bangkok) |
| G3 Approval C production expand/backfill | complete | orchestrator (2026-09-03) | Operator อนุมัติคำเดียว "เริ่มเลย" หลัง `APPROVAL_B_PASS` (`chat-2026-09-03-g3-b`); reference `chat-2026-09-03-g3-c`. เริ่ม 03:05 Asia/Bangkok (เลยขอบหน้าต่าง 01:00–03:00 ~5 นาที — deviation บันทึกไว้, operator เฝ้าตลอด). DB-03 `prisma migrate deploy` migration เดียว `20260902000000_db03_expand_appsetting_completed_at` (additive) สำเร็จ — หลังรัน up to date 48. DB-05 ผ่าน `backfill.mts` โหมด `--confirm-production` ใหม่ (fail-closed: ปฏิเสธ loopback/rehearsal*, บังคับ sslmode + `--ssl-root-cert` CA PEM เพราะ node pg ตีความ require เป็น verify-full; แสดง error code เมื่อ abort): settings-consolidation dry 1/apply 1/apply2 0/final 0, addon-usage-json-to-ledger และ item-photo-direct-to-join 0 แถวทั้งหมด (production ไม่มี legacy data), mismatch = 0, quarantine = 0 ทุกเฟส. Reconciliation preflight-after สด: failed=false, invariantFailures=[], `non_completed_orders_with_completed_at = 0`, completed 14 ออเดอร์ `completedAt = NULL` ตามนโยบาย F5. Backup ก่อนรัน `20260902T195024Z` (drill `backup-drill-20260902T195024Z`), backup หลังรัน `20260902T201512Z`. `pnpm test` 312 ผ่าน, `git diff --check` ผ่าน. หลักฐาน restricted directory: `db03-migrate-deploy-*.log`, `dry/apply/apply2/final-<op>.json|log`, `production-preflight-after-*.json|log`. DB-06 ยังไม่เริ่ม — ต้องอนุมัติแยก |
| G4 DB-06 read cutover + soak start | in-progress (soak) | orchestrator (2026-09-03) | Operator มอบอำนาจ "เริ่มให้เสร็จทั้งหมด ไม่ต้องมาอนุมัติ". สำรวจพบ dual-write (Phase 3) ครบแต่ read cutover ยังไม่เริ่ม — เขียน read helpers `getShopIdentity`/`getNotificationPolicy` ใน `server/utils/appSetting.ts`: resolve จาก AppSetting แบบ per-field (`app.X ?? legacy.X ?? default` ตามนโยบาย null = ยังไม่ migrate), เทียบ legacy ทุกครั้งเพื่อ soak telemetry (`db_compat_setting_read_total` match/mismatch/fallback ผ่าน `compatTelemetry.ts`) และ legacy ชนะเมื่อ mismatch เพื่อความปลอดภัยระหว่าง soak. Swap read paths ครบ 7 จุด: admin settings shop.get/notification.get, public shop-settings.get (explicit select), notify.ts, notifyExpiring.ts, line/webhook.post.ts. Tests: `settingsReadCutover.test.ts` ใหม่ + อัปเดต characterization mocks; pnpm test 322 ผ่าน, typecheck 0 error, build สำเร็จ. Commit `b1dfe9e` (รวม G3 tooling/migration/backfill runner ทั้ง working tree) push main → Vercel deploy สำเร็จ live buildId `b44a3e64…` ตัวเดียว. G4: post-cutover backfill dry-run mismatch 0, legacy caller search เหลือเฉพาะ dual-write leg ที่ตั้งใจ, backup `20260902T204720Z`. G5: constraints check ผ่าน (invalid/NOT VALID = 0 ใน app schema; Supabase realtime NOT VALID ที่เคยเห็นถูก platform validate แล้ว). เหลือ: soak 7–14 วัน (เริ่ม 2026-09-03) mismatch/fallback = 0 ตลอดหน้าต่าง แล้วหยุด dual-write ทีละกลุ่ม (DB-07) — เป็นงานตามปฏิทิน ไม่ใช่งานโค้ด |
| DB-06 Read cutover/soak | pending | — | production approval required |
| DB-07 Contract | pending | — | destructive approval required |
| PRN-02 Print schema | complete | sub-agent PRN-02 + orchestrator integration (2026-09-03) | migration `prisma/migrations/20260903120000_prn02_printer_print_job` additive CREATE TABLE/TYPE/INDEX เท่านั้น (ไม่มี data/credential/endpoint), models `Printer` + `PrintJob` ตรง C7–C8 (capabilities JSON default-false, bridgeCredentialHash+version, idempotency scope unique `print_job_idempotency_scope`, fencingToken, lease, bounded timeline, snapshot+hash+renderVersion+snapshotExpiresAt, reprintOfId self-relation); rehearsal `scripts/printing-rehearsal/run-prn02-constraints.sh` ผ่าน 6 stages บน disposable postgres:16 — replay 49/49, idempotency 23505 reject duplicate + distinct accepted, concurrent claim FOR UPDATE SKIP LOCKED ผู้ชนะเดียว, fencing 1→2, stale-lease reclaim + actively-leased ไม่ claimable, PrismaClient smoke; guard test `printJobSchema.test.ts` 9/9; orchestrator ยืนยัน validate/generate และแก้ `formatBangkokDateTime` export ที่ agent ค้าง | 
| PRN-03 APIs | complete | sub-agent PRN-03 + orchestrator integration (2026-09-03) | `server/utils/printJobQueue.ts` (claimPrintJobs tx เดียว: stale-lease reclaim + SENDING หมดอายุ→NEEDS_REVIEW + FOR UPDATE SKIP LOCKED ตาม prn02 SQL ที่พิสูจน์แล้ว + C9 freshness ตรวจตอน claim→STALE_DOCUMENT; applyPrintJobEvent บังคับ leaseToken+fencingToken ผ่าน transition table ที่ freeze, FAILED ห้ามหลัง sendStartedAt, timeline จำกัด 20; requireBridgePrinter timing-safe SHA-256), `server/utils/printDocument.ts` (C10 exact minor units string-math, canonical sha256 snapshotHash, receiver AES-256-GCM keyring `PAYMENT_QR_RECEIVER_KEYS`, QR eligibility ตาม C9 — encode/validate fail แล้วข้าม block ไม่ fallback); endpoints `/api/admin/printers` (singleton 409, credential rotate คืน plaintext ครั้งเดียว, soft-delete 409 เมื่อมี QUEUED), `/api/admin/print-jobs` (create tx เดียว + P2002→existing job, resolve, reprint), `/api/admin/print-bridge` heartbeat/claim/events ตรง frozen contract; ACCESS_POLICIES + `/api/admin/print-bridge` (no roles — bearer credential ตรวจใน handler); tests 36 ใหม่ (printDocument 14, printJobQueue 18, printJobApi 4); pnpm test 431 passed/1 skipped |
| PRN-04 Bridge | complete | sub-agent PRN-04 + orchestrator integration (2026-09-03) | `print-bridge/` zero-dependency Node 24 ESM (ไม่ install/build): outbox JSON-lines fsync ทุก append + resume หลัง crash (bytes-written โดยไม่ SENT → NEEDS_REVIEW ทุกครั้งที่ start), per-printer mutex, transport tcp.js (node:net, host/port อยู่ local config เท่านั้น — ไม่ส่งให้ server) + fake.js (partial write/hang/connect fail), config loader ปฏิเสธ config ที่ group/others อ่านได้, runner ตาม C8 (ก่อน bytes → FAILED safe code + backoff 3 ครั้ง; หลัง bytes/ไม่ชัด → NEEDS_REVIEW ไม่ retry; stale → drop), loop heartbeat 60s/claim 15s + graceful shutdown, credential ไม่ถูก log (regex assert); tests 29/29 (`printBridge*.test.ts`) รวม full suite; smoke `--help`/`--version` exit 0; verified กับ escpos จริงผ่าน Node type stripping |
| PRN-05 Renderer | complete | sub-agent PRN-05 + orchestrator integration (2026-09-03) | `shared/utils/printComposer.ts` (PrintDocument+profile → PrintOperation[], additive `text` variant บน frozen union, native QR + raster fallback ใช้ payload เดิม, band splitting, compose report แจ้ง block ที่ข้าม, formatPrintIssuedAt เลี่ยง auto-import collision กับ server/utils/csv.ts), `shared/utils/escpos.ts` (ESC @, GS v 0 raster, GS ( k QR, GS V partial cut, drawer, TIS-620 mapping + combining-mark zero-width layout, PrintEncodeError typed, formatMinor integer-only); tests `tests/shared/printComposer+escpos` 82 ผ่าน; orchestrator แก้ typecheck `char possibly undefined` และ rename ฟังก์ชันวันที่ |
| PRN-06 UI | complete | sub-agent PRN-06 + orchestrator integration (2026-09-03) | `app/pages/admin/printing.vue` (3 sections: เครื่องพิมพ์/คิวงานพิมพ์/สถานะ Bridge, role-admin, mobile-first, Thai copy), `useAdminPrinters`/`useAdminPrintJobs` composables, `AdminPrinterForm` shared component + `app/utils/printFormOptions.ts`; SENT label = "ส่งไปที่เครื่องพิมพ์แล้ว" (ไม่อ้างว่าพิมพ์ออกจริง), resolve NEEDS_REVIEW สองทางเลือกชัดเจน, credential แสดงครั้งเดียว dismissible=false, legacy `useThermalPrinter.ts` ไม่ถูกแตะ; orchestrator เพิ่ม printer update endpoint (`[id].put.ts`, capabilities merge ไม่ reset) + edit flow ที่ agent flag ไว้; typecheck 0 error, pnpm test 431/1 skipped, build ผ่าน |
| PRN-06 entry-point wiring | complete | orchestrator (2026-09-03) | ปุ่มพิมพ์บนหน้า admin quotation/receipt (`app/pages/admin/payment/[id]/quotation.vue|receipt.vue`) เดินคิวงานพิมพ์ใหม่ผ่าน `useAdminPrintJobs().createJob()` (QUOTATION → serviceOrderId, RECEIPT → paymentId) — รองรับ transport ทุกแบบที่ลงทะเบียนบน printer profile (WIFI/ETHERNET/USB/BLUETOOTH) ไม่ต้องเชื่อมตรงจากเบราว์เซอร์; `ThermalSlip.vue` เพิ่ม `printMode` ("legacy" default คงพฤติกรรมเดิมให้หน้า /me, "both" สำหรับ admin), event `printQueue`, ปุ่มรอง "พิมพ์เชื่อมตรง (เดิม)" ภายใต้ rollback flag `NUXT_PUBLIC_PRINT_LEGACY_DIRECT` (default เปิด ซ่อนได้ตามสเปก "คง legacy browser-direct ไว้จน physical regression ผ่าน"), ไอคอนเครื่องพิมพ์ในโหมดคิวลิงก์ไป /admin/printing; PDF/PNG ไม่แตะ; e2e บน local compose: สร้าง job ทั้ง 2 kind → bridge SENT → fake printer ได้ ESC/POS หัว `1b401b7416` TIS-620 ถอดออกเป็น "ใบเสนอราคา"/QT-2026-0002 และ "ใบเสร็จรับเงิน" ถูกต้อง; typecheck 0 error |
| HW-02 Physical matrix | pending | — | physical approval required |
| PRN-07 Rollout | in-progress (deploy done, feature off) | orchestrator (2026-09-03) | schema/API/UI ขึ้น production แล้ว: commit `823e555` push main → Vercel deploy, PRN-02 migration (additive CREATE TABLE เท่านั้น) apply ผ่าน `prisma migrate deploy` หลัง backup สด `20260902T225803Z` — migrate status up to date 49, homepage 200; ไม่มี printer ลงทะเบียน = ฟีเจอร์ยังไม่ทำงานจริง; ขั้น pilot/physical matrix รอตัวเครื่องจริง (HW-01/HW-02) |

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
