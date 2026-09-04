# แผนปรับฐานข้อมูลโดยรักษาข้อมูล Production เดิม

สถานะเอกสาร: แผนก่อนลงมือ — เอกสารนี้ไม่อนุญาตให้รัน migration, seed, reset หรือคำสั่งเขียนข้อมูลบน production โดยอัตโนมัติ

อัปเดตหลักฐานล่าสุด: 2026-09-01 (Asia/Bangkok)

เอกสารที่เกี่ยวข้อง:

- [Prisma schema ปัจจุบัน](../prisma/schema.prisma)
- สถาปัตยกรรมพิมพ์ปัจจุบัน: [Saijai printing architecture](../.agents/skills/xprinter-xp-c260m/references/saijai-architecture.md)
- [กติกาการหัก/คืนเครดิตและ add-on](../server/utils/serviceOrderCredits.ts)
- [กติกาเปลี่ยนสถานะการชำระเงิน](../server/utils/paymentStateTransition.ts)
- [การประกอบข้อมูลเอกสารชำระเงิน](../server/utils/paymentDocument.ts)
- [migration ที่เพิ่ม add-on ledger](../prisma/migrations/20260521090000_add_service_order_addon_usage_records/migration.sql)

## 1. ผู้ใช้แผน ผลลัพธ์ และขอบเขตอำนาจ

ผู้ใช้แผนนี้คือผู้พัฒนาและผู้ดูแลระบบที่จะปรับ Prisma schema, application code และ production PostgreSQL เป็นหลาย release โดยต้องรักษาข้อมูลและพฤติกรรมเดิมระหว่างทาง

ผลลัพธ์ที่ต้องการ:

1. ลดตารางและคอลัมน์ที่เก็บข้อมูลความหมายเดียวกันหลายจุด
2. กำหนด source of truth ให้ชัด เพื่อไม่ต้อง dual-write ถาวร
3. เพิ่ม constraint ให้ฐานข้อมูลกันสถานะที่เป็นไปไม่ได้
4. เตรียม schema สำหรับระบบพิมพ์ใหม่ด้วยเพียง `Printer` และ `PrintJob`
5. deploy และ rollback ได้โดยไม่เสียข้อมูลจริง

เกณฑ์เสร็จที่สังเกตได้:

- ข้อมูลทุกแถวที่มีความหมายทางธุรกิจมีปลายทางชัดเจนและผ่าน reconciliation ก่อนลบของเดิม
- API/POS/เอกสาร/การแจ้งเตือนยังให้ผลเดิมในช่วง compatibility
- migration ใหม่ผ่านทั้งฐานข้อมูลว่างที่ replay migration history ครบ และฐานข้อมูลทดสอบที่มีโครงสร้าง/ปริมาณใกล้ production
- production ผ่าน preflight, backup/PITR gate, migration, smoke test และช่วงสังเกตการณ์
- ตารางเดิมจะถูกลบใน release หลังสุดเท่านั้น และต้องได้รับอนุมัติแยกจาก release ที่ย้ายการอ่าน

สิ่งที่เอกสารนี้ **ไม่ได้ให้อำนาจ**:

- ห้ามรัน `prisma migrate dev`, `prisma migrate deploy`, `prisma db push`, seed หรือ SQL ที่เขียนข้อมูลบน production จนกว่าจะได้รับอนุมัติเฉพาะขั้น
- ห้ามแก้ migration ที่เคยใช้แล้วทั้ง 47 ชุด; ทุกการเปลี่ยน schema ต้องเป็น migration ใหม่
- ห้ามลบรูป orphan, audit log, soft-deleted records หรือข้อมูลประวัติ เพียงเพราะดูว่าไม่ได้ถูกใช้งาน
- ห้ามทำ database reset หรือ restore ทับ production เพื่อทดลอง

## 2. ข้อเท็จจริงที่ตรวจพบ

### 2.1 โครงสร้างและการตรวจสอบแบบ static

- Prisma schema ปัจจุบันมี 28 models, 11 enums และ migration history 47 ชุด
- `pnpm exec prisma validate` ผ่าน ณ วันที่ตรวจ
- runtime ใช้ PostgreSQL ผ่าน Prisma singleton และ `DATABASE_URL`; Prisma CLI/migration ใช้ `DIRECT_URL`
- migration history มี index operations ซ้อนกันระหว่าง `20260519000000_db_audit_fixes` และ `20260522000000_reconcile_schema` จึงต้อง replay ทั้ง chain บนฐานข้อมูลทิ้งได้ก่อน production
- ระบบใช้ soft delete หลายตาราง จึงห้ามตัดสิน uniqueness หรือ orphan จาก `deletedAt: null` อย่างเดียวโดยไม่พิจารณาประวัติ

### 2.2 Snapshot จาก production แบบอ่านอย่างเดียว

ตรวจผ่าน connection ที่ตั้งไว้สำหรับ production โดยใช้ transaction `READ ONLY`, timeout และ aggregate queries เท่านั้น ไม่มีการแสดง secret หรือข้อมูลส่วนบุคคล และจบด้วย rollback

> ตัวเลขนี้เป็น snapshot วันที่ 2026-09-01 ไม่ใช่ค่าคงที่ ต้องรัน preflight ซ้ำก่อนแต่ละ migration

| ตาราง | จำนวนแถว |
| --- | ---: |
| `user` | 42 |
| `account` | 11 |
| `session` | 91 |
| `verification` | 6 |
| `customer_claim_token` | 2 |
| `package_product` | 4 |
| `package_sale` | 1 |
| `package_sale_item` | 2 |
| `member_entitlement` | 2 |
| `storefront_category` | 7 |
| `storefront_service` | 5 |
| `storefront_item` | 39 |
| `storefront_price` | 82 |
| `service_order` | 38 |
| `service_order_item` | 171 |
| `service_order_item_image` | 0 |
| `service_order_addon_usage` | 0 |
| `payment_record` | 39 |
| `payment_audit_log` | 66 |
| `image` | 11 |
| `user_address` | 1 |
| `shop_setting` | 1 |
| `business_setting` | 1 |
| `notification_setting` | 1 |
| `notification_subscriber` | 3 |
| `package_expiry_notification` | 0 |
| `expense_category` | 0 |
| `expense` | 0 |

ผลตรวจ invariant ที่สำคัญ:

- `ServiceOrder.addonUsages` และ `usedBonuses` ไม่มีค่า non-empty ใน production
- `service_order_addon_usage` ไม่มีแถว และไม่พบความขัดแย้งระหว่าง JSON กับ normalized ledger
- `ServiceOrderItem.imageId` ไม่มีค่า และ `service_order_item_image` ไม่มีแถว
- payment ที่ active 33 แถว: `PAID` 25, `UNPAID` 8; ทั้งหมดผูกกับ service order
- payment ที่ soft-deleted 6 แถว: `PAID` 3, `UNPAID` 3; 5 แถวผูก service order และ 1 แถวผูก package sale
- active service order 33 แถว: `COMPLETED` 10, อยู่ระหว่างดำเนินการ 23; soft-deleted 5
- active service order ทุกแถวมี active payment พอดีหนึ่งแถว ไม่พบศูนย์แถวหรือมากกว่าหนึ่งแถว
- package sale หนึ่งแถวเป็น soft-deleted และ payment ของ sale นั้นเป็น soft-deleted เช่นกัน
- ไม่พบ payment ที่ไม่มี source, มีหลาย source, customer ไม่ตรง source หรือ amount ไม่ตรง source ใน snapshot
- ไม่พบ `PackageSale.status` ที่ขัดกับ mapping จาก `PaymentRecord.status`
- setting ทั้งสามตารางมี singleton อย่างละหนึ่งแถว
- มี staff 8 คน: admin 5 และ employee 3; subscriber 3 แถว และทั้งหมดเป็น admin ที่ active
- มี Image ที่ active แต่ไม่มี relation อ้างอิง 5 แถว ทั้งหมดมี owner; ยังไม่ใช่หลักฐานเพียงพอให้ลบ
- ไม่พบ package sale item ที่ `itemType` ขัดกับประเภท product

### 2.3 ความซ้ำซ้อนที่ยืนยันจาก schema และ code path

| จุดปัจจุบัน | ความซ้ำซ้อน | พฤติกรรมจริงที่ต้องรักษา |
| --- | --- | --- |
| `ShopSetting`, `BusinessSetting`, `NotificationSetting` | singleton สามตาราง | API และงาน notification อ่านคนละ model |
| `NotificationSubscriber` กับ `User` | relation one-to-one แต่มี membership lifecycle แยก | คงตารางไว้ เพราะ create, disable และ delete มีความหมายต่างกัน |
| `ServiceOrder.addonUsages` กับ `ServiceOrderAddonUsage` | JSON legacy + normalized ledger | normalized records เป็น authoritative เมื่อมี; JSON เป็น fallback ตอน refund |
| `ServiceOrder.usedBonuses` | JSON legacy | ไม่พบการใช้งานทางธุรกิจที่ยัง active และ production ว่าง
| `ServiceOrderItem.imageId` กับ `ServiceOrderItemImage` | รูปเดี่ยว + รูปหลายรูป | create/update ปัจจุบันยังเขียนรูปแรกทั้งสองทาง
| `PackageSale.status` กับ `PaymentRecord.status` | สถานะ sale ถูก sync ตาม payment | mapping อยู่ใน `paymentStateTransition.ts`
| `PaymentRecord.memberEntitlementId` กับ source relation | entitlement หาได้จาก service order หรือ package sale items | code บางจุดยังอ่าน legacy field โดยตรง
| `ServiceOrder.updatedAt` ใช้แทนวันส่งมอบ | timestamp ทางเทคนิคถูกใช้เป็น business event | เอกสารตั้ง `deliveredAt` จาก `updatedAt` เมื่อ status เป็น `COMPLETED`

## 3. ข้อสันนิษฐานและประเด็นที่ยังไม่แน่ชัด

ข้อสันนิษฐานเดิมที่ถูกล็อกเป็น canonical decisions โดยแผนควบคุมกลาง; หาก requirement ธุรกิจเปลี่ยนต้องหยุด packet ที่เกี่ยวข้องและทบทวนใหม่:

1. หนึ่ง service order และหนึ่ง package sale มี payment record ตลอดอายุได้พอดีหนึ่งแถว ไม่ใช่หลายงวดหรือหลายความพยายาม
2. สถานะ package sale ไม่มี business state อิสระจาก payment; `DRAFT/PENDING/PAID/CANCELLED` แสดงผลผ่าน mapping ได้ทั้งหมด
3. `COMPLETED` หมายถึงงานถูกส่งมอบ/จบจริง และเวลาที่เปลี่ยนเป็นสถานะนี้ควรเป็น `completedAt`
4. `NotificationSubscriber` มี lifecycle ของตัวเองและจะไม่ถูกยุบเข้า `User` ในรอบนี้
5. การรวม setting เป็นหนึ่ง singleton row ไม่สร้าง contention ที่มีนัยสำคัญ เพราะแก้ไขผ่านหน้า admin ไม่บ่อย
6. ระบบพิมพ์หนึ่ง job เลือก printer หนึ่งตัว แต่ printer หนึ่งตัวเก็บ connection profiles ได้หลายแบบใน JSON โดยไม่ต้องมีตาราง connection แยก

ผลตัดสินสำหรับ implementation รอบนี้:

| รหัส | ผลตัดสิน | เหตุผล/เงื่อนไขหยุด |
| --- | --- | --- |
| F1 | payment one-to-one ตลอดอายุ | ตรงกับข้อมูลและ caller ปัจจุบัน; หยุดก่อน constraint หากต้องรองรับ installment/replacement |
| F2 | ใช้ `completedAt` | ตรง state machine; หากต้องแยกซักเสร็จกับส่งมอบให้เพิ่ม event/state แยก |
| F3 | ไม่ rename physical `business_setting` | ใช้ Prisma model `AppSetting` ที่ `@@map("business_setting")` ลด lock/rollback surface |
| F4 | ยังไม่ลบ orphan image | retention/Cloudinary cleanup เป็นงานแยก |
| F5 | completed order เก่าคง `completedAt = null` | ไม่สร้าง timestamp ปลอม; display ใช้ labeled fallback |
| F6 | v1 เก็บ bounded timeline JSONB ใน `PrintJob` | แยก event table เมื่อมี query/retention lifecycle จริงเท่านั้น |

## 4. โครงสร้างเป้าหมาย

### 4.1 จำนวนตาราง

| ขั้น | การเปลี่ยนแปลง | จำนวน models โดยประมาณ |
| --- | --- | ---: |
| ปัจจุบัน | schema เดิม | 28 |
| รวม setting 3 → 1 | ลด 2 | 26 |
| คง `NotificationSubscriber` | ไม่เปลี่ยน | 26 |
| เพิ่มระบบพิมพ์ `Printer` + `PrintJob` | เพิ่ม 2 | 28 |

เป้าหมายไม่ใช่ลดจำนวนตารางให้ต่ำที่สุด แต่ลดเฉพาะตารางที่ไม่มี lifecycle หรือ cardinality เป็นของตัวเอง ตาราง auth, entitlement, ledger, audit, price matrix, address, image relation และ expense ยังควรแยกตามหน้าที่

### 4.2 `AppSetting` บน physical table เดิม

ใช้ `business_setting` เป็น physical base เพื่อหลีกเลี่ยงการย้าย field ธุรกิจเดิมทั้งก้อน แล้วเปลี่ยนชื่อ Prisma model เป็น `AppSetting` พร้อม `@@map("business_setting")`

กลุ่ม field เป้าหมาย:

- ร้าน: `name`, `phone`, `address`, `logoUrl`, `lineQrImageUrl`
- ราคา/ภาษี: field เดิมทั้งหมดจาก `BusinessSetting`
- running number: `paymentNoPrefix`, `orderNoPrefix`, `quotationNoPrefix`, `receiptNoPrefix`
- notification policy: boolean ทั้งหมดจาก `NotificationSetting`
- print/QR: `lineQrEnabled`, `paymentQrEnabled`, provider/receiver type, encrypted receiver + last4/label, key/config version, activation timestamps/actor และ updated-by actor ตาม canonical fields ในแผนควบคุมกลาง

ข้อกำหนด:

- singleton ID ต้องคงเป็น `singleton`
- API public ต้อง select เฉพาะ field ที่เปิดเผยได้ ห้าม serialize ทั้ง row
- ค่า PromptPay target ไม่ควรส่งกลับ browser แบบ raw; endpoint สำหรับ preview/print ให้ส่งเฉพาะ payload ที่จำเป็นและมี authorization
- QR image/base64 ที่ generate ต่อยอดชำระเงินไม่เก็บใน setting และไม่เก็บซ้ำทุก job ถ้าสร้างใหม่จาก semantic payload ได้

### 4.3 คง `NotificationSubscriber` เป็นตารางแยก

แม้ relation กับ `User` เป็น one-to-one แต่ตารางนี้แยกความหมายได้สามแบบ: ไม่เคย subscribe, subscribe แต่ `isActive = false` และถูกลบออกจาก subscriber list การยุบเป็น boolean บน `User` จะทำให้ความหมายบางส่วนหายหรือเพิ่ม marker/timestamp หลาย fieldจนไม่ได้เรียบง่ายกว่าเดิม

รอบนี้จึง:

- คง `NotificationSubscriber` และ API create/update/delete เดิม
- คง `User.lineNotifyEnabled` แยกสำหรับ customer notification
- เพิ่ม regression tests เพื่อยืนยัน subscriber lifecycle ระหว่าง settings consolidation
- ไม่รวมตารางนี้ใน contract/drop list

### 4.4 Source of truth ของ order/add-on/photo

- `ServiceOrderAddonUsage` เป็น source of truth ของ add-on credits เพราะเก็บ entitlement, credits, deduct/refund timestamps และ policy `DeductOn` ได้ตรวจสอบย้อนหลัง
- ลบ `ServiceOrder.addonUsages` หลัง normalized backfill และ compatibility window เท่านั้น
- ลบ `ServiceOrder.usedBonuses` หลังยืนยัน preflight ซ้ำว่าไม่มี payload และไม่มี code consumer
- `ServiceOrderItemImage` เป็น source of truth ของรูป item เพราะรองรับหลายรูป, `isDamaged`, `sortOrder` และ soft delete
- ลบ `ServiceOrderItem.imageId` หลัง backfill รูป legacy และ UI/API ไม่อ่านหรือเขียน field นี้แล้ว
- `Image` ยังเป็น asset registry และไม่ควรถูกยุบเข้าตาราง item

### 4.5 Payment และ package sale

โครงสร้างเป้าหมาย:

- `PaymentRecord` ต้องมี source **exactly one** ระหว่าง `serviceOrderId` และ `packageSaleId`
- หลังยืนยัน F1 ให้ source แต่ละชนิด unique ตาม lifetime policy ที่เลือก
- ลบ `memberEntitlementId` จาก `PaymentRecord`; entitlement context อ่านจาก `ServiceOrder.memberEntitlementId` หรือ `PackageSaleItem → MemberEntitlement`
- `PaymentRecord.status` เป็น source of truth ของ payment state
- ลบ `PackageSale.status`; API แปลงสถานะ sale จาก payment ด้วย mapping เดียวที่ shared ทั้ง server/UI
- `PaymentAuditLog` ต้องอยู่ต่อ เพราะเป็นประวัติการเปลี่ยน state ไม่ใช่ข้อมูลซ้ำ
- amount/customer consistency ต้องตรวจใน transaction ของ application และมี reconciliation query; PostgreSQL check constraint ข้ามตารางทำไม่ได้โดยตรง

mapping แสดงผล package sale:

| Payment status | Sale presentation status |
| --- | --- |
| `UNPAID` | `PENDING` |
| `PENDING_VERIFICATION` | `PENDING` |
| `PAID` | `PAID` |
| `CANCELLED` | `CANCELLED` |

`DRAFT` จะหายไปหากยืนยันว่า sale ถูกสร้างพร้อม payment เสมอ ถ้ายังมี flow บันทึกร่างจริง ต้องคง field sale state แยกและไม่ทำการ consolidation ข้อนี้

### 4.6 Business event timestamp

เพิ่ม `ServiceOrder.completedAt DateTime?`

กติกา:

- transition เข้า `COMPLETED` ครั้งแรก: ตั้ง `completedAt = now`
- transition ออกจาก `COMPLETED` หากระบบอนุญาตในอนาคต: ต้องตัดสินว่าจะคงประวัติหรือ reset; state machine ปัจจุบันควรเป็น source of truth
- order เก่าที่เป็น `COMPLETED` แต่ไม่มีหลักฐาน event: คง `completedAt = null`
- เอกสารช่วง compatibility ใช้ `completedAt ?? legacyFallback` และต้องถือ fallback เป็นค่าประมาณ ไม่ใช้แก้รายงานเชิงบัญชี
- ห้าม backfill ด้วย `payment.paidAt` เพราะวันชำระเงินไม่เท่ากับวันส่งมอบ

### 4.7 ระบบพิมพ์: สองตารางพอสำหรับ v1

ระบบพิมพ์เป็น additive track หลัง schema หลักผ่าน reconciliation แล้ว:

1. `Printer`
   - identity/model/capabilities
   - paper/encoding/render profile
   - connection profiles สำหรับ Wi-Fi/Ethernet/USB/Bluetooth เป็น JSON ที่ validate ด้วย Zod
   - default/enabled flags
   - bridge credential hash, heartbeat และ last seen
2. `PrintJob`
   - document type, immutable semantic snapshot และ render version
   - printer, selected transport และ fallback history
   - status, attempt, available time, lease token/expiry และ fencing token
   - idempotency key, payload hash, failure code และ compact timeline JSON
   - source payment/order version เพื่อ reject QR/job ที่ stale ก่อน claim และก่อนพิมพ์

ข้อสรุปส่วนนี้ถูกแทนที่แล้วสำหรับระบบพิมพ์: ระบบปัจจุบันเลิกใช้ durable print queue และลบ `Printer`/`PrintJob` ตาม [Saijai printing architecture](../.agents/skills/xprinter-xp-c260m/references/saijai-architecture.md)

## 5. หลักความปลอดภัยของ migration

ทุกหัวข้อต้องทำตามกฎต่อไปนี้:

1. **Expand ก่อน Contract** — เพิ่มของใหม่โดยไม่ลบ/rename ของเดิมที่ application รุ่นก่อนยังใช้
2. **Backward-compatible release** — app รุ่นใหม่ต้องทำงานกับ schema ที่ยังมีทั้งเก่าและใหม่
3. **Backfill แบบ idempotent** — รันซ้ำได้, แบ่ง batch ได้, มี cursor/checkpoint และไม่ overwrite ค่าปลายทางที่ผ่านการยืนยันแล้ว
4. **Compare ก่อน switch read** — เทียบ row count, key coverage และ semantic value ไม่ใช่ดูแค่ว่า migration exit 0
5. **Dual-write ชั่วคราวเมื่อ rollback code ต้องอ่านของเก่า** — แต่กำหนดวันเลิก dual-write ไว้ชัด ไม่ปล่อยเป็น architecture ถาวร
6. **Contract แยก release** — drop table/column หลัง soak และ backup gate เท่านั้น
7. **ไม่มี irreversible step โดยไม่มี restore path** — ก่อน drop ต้องยืนยัน backup/PITR และทดลอง restore จริง
8. **ไม่แก้ applied migration** — เพิ่ม migration ใหม่เสมอ
9. **ไม่ใช้ production เป็นที่ทดลอง replay** — replay/repair ทำบน disposable database ก่อน
10. **ไม่ใช้ `db push` กับ production** — production ใช้ reviewed migration และ `migrate deploy` หลังอนุมัติ

## 6. ลำดับดำเนินงานแบบหลาย release

### Phase 0 — Freeze ข้อเท็จจริงและเตรียม recovery

ประเภท: อ่านอย่างเดียว ยกเว้นการสร้าง backup โดยผู้ดูแล platform

งาน:

1. บันทึก commit SHA, Prisma version, PostgreSQL version และ migration table state
2. ยืนยันว่า `DATABASE_URL` กับ `DIRECT_URL` ชี้ database/cluster ที่ตั้งใจ โดยแสดงเฉพาะ host fingerprint/database name ที่ mask แล้ว
3. ตรวจ backup policy, PITR retention, replication lag และพื้นที่ว่าง
4. สร้าง backup/snapshot ใหม่ตามกลไกของ provider
5. restore backup ไปฐานข้อมูลทดสอบแยก แล้วรัน row counts/invariants เพื่อพิสูจน์ว่า restore ใช้ได้จริง
6. export schema-only dump และ migration status สำหรับแนบ change record; ห้าม export PII มาไว้ใน repository
7. รัน aggregate preflight ชุดเดียวกับ section 8 และเก็บผลแบบไม่มีข้อมูลบุคคล
8. วัด lock/statement duration ของ migration บน restore copy

Gate ผ่าน Phase 0:

- รู้ Recovery Point Objective และ Recovery Time Objective
- มี backup ใหม่และ restore drill ผ่าน
- migration history ใน production ตรงกับ repository หรือมี reconciliation plan ที่ review แล้ว
- ไม่มี invariant failure ที่ยังไม่มี disposition

หาก Docker local daemon ยังใช้ไม่ได้ ให้ใช้ disposable database ของ provider/CI หรือ local PostgreSQL ที่แยกขาดแทน ห้ามข้าม restore/replay test แล้วทดลองบน production

### Phase 1 — สร้าง characterization tests ก่อนเปลี่ยน schema

ประเภท: เปลี่ยนเฉพาะ test/code fixture ยังไม่แตะ production data

เพิ่ม focused tests ที่ behavioral seam ต่อไปนี้:

- payment state → package sale presentation mapping
- create/update/cancel/delete/restore service order และ payment ต้องยัง atomic
- add-on deduction/refund ใช้ normalized records ก่อน legacy JSON และไม่คืนเครดิตซ้ำ
- item photo ordering/damage flags และรูปแรกที่ UI ใช้ preview
- settings public projection ไม่เปิด field server-only
- staff subscriber: มี row/ไม่มี row/disabled/category disabled
- receipt/quotation ใช้ `completedAt` อย่างถูกต้องและไม่ใช้ `paidAt` แทน delivery
- Decimal ทุกค่าออก API เป็น JSON-safe shape แบบเดิม

Completion check:

- tests จับพฤติกรรมเดิมได้ก่อน refactor
- มี fixture สำหรับ active และ soft-deleted records
- failure message บอก invariant ที่พัง ไม่ผูกกับรายละเอียด implementation เกินจำเป็น

### Phase 2 — Expand schema แบบไม่ทำลายของเดิม

ประเภท: migration เพิ่ม column/index เท่านั้น ต้อง review SQL และทดสอบ lock ก่อน production

Migration A แนะนำให้ทำเฉพาะ:

1. เพิ่ม field ร้าน, notification และ QR target ลง physical table `business_setting` แบบ nullable และยังไม่มี default
2. เพิ่ม `service_order.completed_at` แบบ nullable และไม่มี default
3. เตรียม index/constraint แบบ `NOT VALID` ได้เฉพาะรายการที่ PostgreSQL รองรับและ review แล้ว
4. ยังไม่ drop/rename table หรือ column เดิม

วิธีลด lock:

- แยก DDL ที่อาจ rewrite table ออกจาก metadata-only DDL
- บน PostgreSQL รุ่นที่ใช้งานจริง ให้ตรวจ `EXPLAIN`/catalog และเวลาจริงบน restore copy ไม่เดาจาก version ทั่วไป
- กำหนด `lock_timeout` สั้น; หากได้ lock ไม่ทันให้ migration fail อย่างปลอดภัยแทนการค้าง production
- index ที่ต้องสร้าง concurrently ต้องเป็น operational step ที่ review แยก เพราะ `CREATE INDEX CONCURRENTLY` ใช้ใน transaction block ไม่ได้; อย่าใส่แบบสุ่มใน Prisma migration

Completion check:

- app รุ่นเดิมยัง start และทำงานได้บน expanded schema
- column ใหม่ nullable/default ถูกต้อง
- row count ทุกตารางเดิมไม่เปลี่ยน
- no table/column ถูกลบ

### Phase 3 — Compatibility writer release

ประเภท: deploy code ที่ยังอ่าน source เดิม แต่เริ่ม dual-write target ก่อน backfill เพื่อปิด lost-update window

งาน:

1. centralize settings write ใน `server/utils/appSetting.ts`; เปลี่ยนชื่อ Prisma model เป็น `AppSetting` โดยคง `@@map("business_setting")` ตาม sequencing ล่าสุด แต่ current shop/notification reads ยังใช้ legacy `ShopSetting`/`NotificationSetting` และ business reads ยังใช้ field เดิมบน physical row เดิม
2. ทุก settings update เขียน legacy row และ target fields ใน `business_setting` ภายใน transaction เดียว
3. คง normalized add-on ledger + legacy JSON dual-write/fallback ชั่วคราว
4. คง `ServiceOrderItemImage` + first-photo mirror ลง `imageId` ชั่วคราว
5. คง `PackageSale.status` sync กับ payment และคง `PaymentRecord.memberEntitlementId`
6. transition เข้า `COMPLETED` เริ่มบันทึก `completedAt`
7. เพิ่ม metrics/log แบบไม่เก็บ PII สำหรับ mismatch, fallback usage และ dual-write failure

กติกา dual-write:

- ต้องอยู่ใน Prisma transaction เดียวกัน
- write failure ฝั่งใดฝั่งหนึ่งทำให้ transaction ล้มทั้งหมด
- ห้าม fire-and-forget สำหรับข้อมูลธุรกิจ
- มี counter ต่อ code path เพื่อรู้ว่ายังมี caller เก่าอยู่หรือไม่

Completion check:

- แก้ setting ระหว่าง compatibility window แล้วทั้ง legacy/target เท่ากัน
- rollback application เป็นรุ่นก่อนหน้าแล้วยังอ่านค่าที่เพิ่งแก้ได้
- nullable additive columns ไม่ทำให้ old app fail

### Phase 4 — Backfill แบบ idempotent

ประเภท: เขียนข้อมูล ต้องได้รับอนุมัติ production แยกจาก DDL และทำหลัง compatibility writer ทำงานแล้ว

#### 4.1 Settings

- ensure `business_setting.id = 'singleton'` มีเพียงหนึ่งแถว
- copy field จาก `shop_setting.singleton` และ `notification_setting.singleton` ไป field ใหม่ เฉพาะ destination ที่ยัง null
- บันทึก source `updatedAt` ทั้งสามชุดไว้ใน migration log ภายนอกหรือ comparison output เพื่อใช้ตัดสินกรณีชนกัน
- compare field-by-field ด้วย null-safe equality
- หลัง backfill/verify จึงเพิ่ม default/NOT NULL ใน migration แยก

#### 4.2 Add-on JSON → ledger

แม้ production snapshot ปัจจุบันว่าง ต้องเขียน backfill ให้ generic เผื่อมี order ใหม่ก่อน deploy:

- parse JSON ด้วย validator เดียวกับ application
- สำหรับแต่ละ usage สร้าง normalized record เฉพาะเมื่อยังไม่มี semantic match
- เก็บ `productName`, entitlement, credits, deduct policy และ timestamps เท่าที่พิสูจน์ได้
- payload ที่ parse ไม่ได้หรือ entitlement หายให้ quarantine/report; ห้ามเดาค่าและห้ามลบ JSON
- refund reconciliation ต้องพิสูจน์ว่า credits ไม่เพิ่มซ้ำ

#### 4.3 รูป item เดี่ยว → รูปหลายรูป

- สำหรับ `service_order_item.image_id IS NOT NULL` สร้าง `service_order_item_image` เฉพาะเมื่อ pair เดิมยังไม่มี
- ใช้ `sortOrder = 0`, `isDamaged = false` สำหรับ legacy row เพราะไม่มี metadata อื่น
- คง `imageId` เดิมตลอด compatibility window
- ตรวจว่า image FK มีอยู่และ soft-delete semantics ไม่ถูกเปลี่ยน

#### 4.4 Completion timestamp

- ไม่ backfill `completedAt` อัตโนมัติจาก `updatedAt` หรือ `paidAt`
- หากภายหลังพบ audit/event source ที่เชื่อถือได้ ให้ทำ backfill เฉพาะ record ที่พิสูจน์ได้ พร้อม provenance report
- completed order เก่าที่ null ต้องยังเปิด/พิมพ์ได้ด้วย legacy display fallback

Completion check ของ Phase 4:

- backfill รันซ้ำรอบที่สองแล้วเปลี่ยนศูนย์แถว
- comparison queries ได้ mismatch = 0 สำหรับข้อมูลที่ map ได้
- quarantine count = 0 หรือทุกรายการมี manual disposition ที่บันทึกไว้
- source tables/columns ยังอยู่ครบ

### Phase 5 — Read cutover และช่วงสังเกตการณ์

ประเภท: เปลี่ยน source of truth ใน application แต่ยังไม่ลบข้อมูลเดิม

งาน:

1. เปลี่ยน settings reads ไป target fields บน `AppSetting` ที่ rename แล้วใน compatibility release และให้ public endpoint ใช้ explicit select
2. normalized add-on ledger เป็น read source; คง legacy JSON write/fallback ระหว่าง soak
3. `ServiceOrderItemImage` เป็น read source; คง first-photo mirror ลง `imageId` ระหว่าง soak
4. package sale presentation derive จาก payment แต่ยัง sync `PackageSale.status`
5. payment context อ่านจาก source relation แต่ยังคง `PaymentRecord.memberEntitlementId`
6. document ใช้ `completedAt` และ labeled legacy fallback สำหรับ record เก่า

ช่วงแนะนำขั้นต่ำ: 7–14 วัน หรือครบหนึ่งรอบงานธุรกิจที่มี order, payment, notification, delete/restore และปิดงานจริง แล้วแต่ว่าอย่างใดยาวกว่า

สิ่งที่ต้องติดตาม:

- legacy fallback hit ของ add-on JSON ต้องเป็นศูนย์
- read mismatch ของ setting/photo/status ต้องเป็นศูนย์
- payment source zero/multiple ต้องเป็นศูนย์
- one-source-to-multiple-payments ต้องเป็นศูนย์ตาม policy F1
- order completed ใหม่ต้องมี `completedAt`
- error rate/latency ของ POS, payment detail, receipt, notification และ cron ไม่เพิ่มผิดปกติ
- ไม่มี deployment รุ่นเก่าหรือ worker เก่าที่ยังเขียน schema เดิมอยู่

เมื่อ metrics เป็นศูนย์ตามเกณฑ์ ให้หยุด dual-write **ทีละกลุ่ม** ไม่หยุดพร้อมกันทั้งหมด และสังเกตต่ออีกหนึ่งช่วงก่อน contract

### Phase 6 — เพิ่ม database constraints

ประเภท: DDL ที่อาจ lock ต้องมี maintenance/traffic plan และอนุมัติ production

ลำดับ:

1. รัน duplicate/source audit ซ้ำ
2. เพิ่ม check constraint ว่า payment มี source exactly one ระหว่าง package sale กับ service order
3. เพิ่ม full unique constraint ให้แต่ละ service order/package sale มี payment ตลอดอายุไม่เกินหนึ่งแถว ตาม canonical decision ในแผนกลาง
4. validate constraint ภายหลังเมื่อเหมาะสม เพื่อลดช่วง lock
5. ปรับ Prisma relation จาก list เป็น singular เฉพาะเมื่อ full uniqueness ถูกบังคับจริงแล้ว
6. รัน API/test suite หลัง generate client ใหม่

ตัวอย่าง invariant เชิงตรรกะ ไม่ใช่ SQL พร้อมรัน production:

```text
(packageSaleId is not null) XOR (serviceOrderId is not null)
count(payment by serviceOrderId) <= 1
count(payment by packageSaleId) <= 1
payment.userId = source.customerId
payment.amount = source.totalAmount
```

หาก requirement เปลี่ยนเป็น installment/replacement payment ให้หยุดก่อนเพิ่ม full uniqueness และออกแบบ payment lifecycle ใหม่ ห้ามลดเป็น partial uniqueness โดยไม่ทบทวน API/delete/restore ทั้ง flow

### Phase 7 — Contract release

ประเภท: irreversible โดยไม่ restore; ต้องอนุมัติแยกและทำหลัง backup ใหม่

Pre-contract gates:

- backup/PITR ใหม่และ restore drill ล่าสุดผ่าน
- ไม่มี app/worker รุ่นเก่ารันอยู่
- fallback/dual-write metrics เป็นศูนย์ครบช่วง
- read-only reconciliation ก่อน deploy ได้ mismatch = 0
- code search ไม่พบ read/write field ที่จะลบ รวม raw SQL, tests, scripts และ exports
- generated Prisma client และ API shared types อัปเดตแล้ว

แบ่ง drop เป็น migration ย่อยเพื่อลด blast radius:

1. ลบ `shop_setting` และ `notification_setting` หลัง AppSetting cutover
2. ลบ `service_order.addon_usages` และ `used_bonuses`
3. ลบ `service_order_item.image_id` และ relation เดิม
4. ลบ `payment_record.member_entitlement_id`
5. ลบ `package_sale.status` และ `PackageSaleStatus` enum เมื่อ code/type ทุกจุดเลิกใช้

ไม่รวมใน contract นี้:

- ไม่ลบ `Image` หรือ orphan image
- ไม่ลบ `PaymentAuditLog`
- ไม่ลบ `NotificationSubscriber`
- ไม่ลบ soft-deleted business records
- ไม่รวม auth/session tables
- ไม่ rewrite migration history เพื่อให้จำนวน migration ดูน้อยลง

Rollback หลัง drop:

- application rollback อย่างเดียวไม่พอ เพราะ schema เก่าหายแล้ว
- recovery ต้องใช้ point-in-time restore หรือ forward-fix migration
- ด้วยเหตุนี้ contract ต้อง deploy หลัง compatibility release เสถียรแล้วเท่านั้น และไม่ควรทำวันเดียวกับ major print rollout

### Phase 8 — เพิ่ม schema ระบบพิมพ์

ประเภท: additive migration แยกจาก consolidation เพื่อ isolate risk

ลำดับ:

1. เพิ่ม `Printer` และ `PrintJob` โดยไม่มี FK ไปตาราง legacy ที่กำลังจะถูกลบ
2. seed/config printer ผ่าน admin flow หรือ reviewed operational command ไม่ฝัง production IP/credential ใน migration
3. เปิด Local Print Bridge แบบ feature flag
4. เริ่ม enqueue เฉพาะ test printer แล้วจึงเปิดร้านจริง
5. ใช้ idempotency + lease/fencing + stale payment QR validation ก่อนพิมพ์

ไม่ควรเพิ่ม printer tables พร้อม Phase 7 เพราะเมื่อเกิดปัญหาจะวิเคราะห์ไม่ได้ว่าเกิดจาก contract schema หรือ print rollout

## 7. Mapping ข้อมูลปัจจุบันไปเป้าหมาย

| Source | Target | วิธีรักษาข้อมูล | เวลาลบ source |
| --- | --- | --- | --- |
| `shop_setting.*` | `business_setting`/`AppSetting` shop fields | copy singleton field-by-field + compare | หลัง dual-read/write และ soak |
| `notification_setting.*` | `AppSetting` notification fields | copy singleton field-by-field + compare | หลัง notification paths ใช้ใหม่ทั้งหมด |
| `service_order.addon_usages` | `service_order_addon_usage` | validated, idempotent semantic upsert | หลัง fallback hit เป็นศูนย์ |
| `service_order.used_bonuses` | ไม่มี หากยืนยันว่า deprecated | preflight/report เท่านั้น | เมื่อ non-empty = 0 และไม่มี consumer |
| `service_order_item.image_id` | `service_order_item_image` | insert missing pair as sort 0 | หลัง UI/API ใช้ photos เท่านั้น |
| `payment_record.member_entitlement_id` | relation ผ่าน source | refactor query/API; ไม่ copy | หลัง code search และ runtime metric เป็นศูนย์ |
| `package_sale.status` | derived จาก payment status | compare mapping ทุก row | หลัง F1/`DRAFT` decision |
| completed order `updated_at` | `completed_at` | ไม่ copy โดยอัตโนมัติ | ไม่ลบ `updatedAt`; เลิกใช้เป็น event |

## 8. Reconciliation checklist

ทุก query ที่ใช้กับ production ต้องผ่าน review ว่าเป็น aggregate/read-only, ใช้ timeout และไม่คืน PII ออก log

### 8.1 Table/row preservation

- row count ก่อน/หลังของทุก source/target
- active/deleted count แยกกัน
- min/max `createdAt` และ checksum ของ stable business keys ใน environment ที่ปลอดภัย
- foreign key orphan count ทุก relation ที่แก้

### 8.2 Settings

- singleton count ของแต่ละ source = 1
- singleton target = 1
- null-safe field mismatch = 0
- public response ไม่มี server-only/QR target/credential

### 8.3 Subscriber

- ไม่มี schema/backfill สำหรับ subscriber ในรอบนี้
- subscriber ที่หา user ไม่เจอ = 0
- create, disable, re-enable และ delete API behavior ต้องไม่เปลี่ยนจาก settings consolidation
- subscriber ที่ active ต้องเป็น ADMIN/EMPLOYEE ที่ยังไม่ถูกลบตาม policy ปัจจุบัน

### 8.4 Add-on ledger

- JSON non-empty count
- normalized row count และ order coverage
- invalid JSON/quarantine count
- credits รวมต่อ order/entitlement เท่ากัน
- deducted/refunded state ไม่ทำให้ credit balance เปลี่ยนซ้ำ

### 8.5 Images

- direct image IDs ที่ไม่มี Image row = 0
- direct image IDs ที่ไม่มี matching join row = 0 หลัง backfill
- duplicate active item/image pair count
- orphan image report แยกจากการลบ

### 8.6 Payment

- source count ต่อ payment = 1
- payment count ต่อ source ตาม F1
- payment user เท่ากับ source customer
- payment amount เท่ากับ source total ด้วย Decimal exact comparison ไม่ผ่าน JavaScript floating point
- sale status เท่ากับ payment mapping
- paid record มี `paidAt`, `confirmedAt`, receipt number ตาม invariant ปัจจุบัน
- active source ไม่มีแต่ payment ถูก soft-delete และกลับกัน

### 8.7 Completion timestamp

- order ใหม่ที่ `COMPLETED` มี `completedAt`
- order ที่ไม่ `COMPLETED` ไม่มี timestamp ที่เกิดจาก transition ผิด
- เอกสารข้อมูลเก่าไม่ crash เมื่อ `completedAt` เป็น null

## 9. Test matrix และคำสั่งตรวจ

### 9.1 ระหว่างพัฒนา

```bash
pnpm exec prisma validate
pnpm exec prisma generate
pnpm test
pnpm exec nuxi typecheck
git diff --check
```

หมายเหตุ:

- ไม่มี lint script ที่ใช้งานได้ใน package ปัจจุบัน จึงไม่เพิ่มคำสั่ง lint ที่ไม่มีจริง
- typecheck มี baseline errors เดิม ต้องเก็บ output ก่อนเปลี่ยนและแยก error ใหม่ออกจาก baseline
- ห้ามแก้ `app/generated/prisma/` ด้วยมือ

### 9.2 Migration tests

ต้องทดสอบอย่างน้อยสามเส้นทาง:

1. **Fresh replay** — สร้าง PostgreSQL ทิ้งได้, apply migration 47 ชุดเดิมทั้งหมด, apply migration ใหม่, validate schema
2. **Production-shape restore** — restore backup/sanitized snapshot ที่แยกออกมา, รัน preflight/backfill/reconciliation และวัดเวลา/lock
3. **Rollback compatibility** — expand + compatibility dual-write + backfill แล้ว rollback app เก่า โดยข้อมูลที่แก้ระหว่างช่วง dual-write ต้องยังอ่านได้

กรณีทดสอบข้อมูล:

- active และ soft-deleted order/payment/package sale
- subscriber active/disabled/absent
- legacy JSON valid/invalid/duplicate/already normalized
- direct image only/join only/both/soft-deleted image
- payment ไม่มี source/สอง source/duplicate source เพื่อยืนยันว่า constraint ปฏิเสธ
- Decimal ที่มีทศนิยมและส่วนลด/VAT
- completed order เก่าไม่มี timestamp และ order ใหม่มี timestamp

### 9.3 Final application checks

```bash
pnpm test
pnpm exec nuxi typecheck
pnpm run build
```

`pnpm run build` อาจติดการดาวน์โหลด font ใน environment ที่จำกัด network ต้องแยก network failure ออกจาก compilation failure

## 10. Production runbook ต่อหนึ่ง migration window

### ก่อน deploy

- ระบุ migration ID, app version, owner, rollback owner และ maintenance window
- ยืนยัน backup/PITR/restore drill
- รัน read-only preflight และบันทึก aggregate result
- ตรวจ active deployment/worker ทุกตัวว่า compatibility พร้อม
- ตรวจ connection pool และปิด long-running transaction ที่ขวาง DDL ผ่านกระบวนการปกติของผู้ดูแล
- ทบทวน generated SQL ทีละ statement รวม estimated lock

### ระหว่าง deploy

- เปิด maintenance/read-only mode เฉพาะเมื่อ migration ต้องการ
- apply migration หนึ่งกลุ่มต่อครั้ง
- หยุดทันทีเมื่อ lock timeout, row-count mismatch หรือ invariant failure
- ห้ามแก้ข้อมูลสดแบบ ad hoc เพื่อให้ migration ผ่าน; บันทึก exception แล้ว rollback/forward-fix ตาม runbook
- deploy application compatibility version หลัง schema gate ผ่าน

### หลัง deploy ทันที

- รัน migration status และ schema validation
- รัน reconciliation แบบ read-only
- smoke test login, POS, order detail, payment detail, receipt/quotation, notification settings และ admin settings
- ตรวจ error/latency/database locks
- เก็บ deployment evidence โดยไม่มี secret/PII

### ระหว่าง soak

- monitor fallback/dual-write mismatch counters
- rerun aggregate reconciliation ตามรอบ
- ห้ามเริ่ม contract หากมี deployment รุ่นเก่าหรือ counter ไม่เป็นศูนย์
- บันทึกการตัดสินใจ go/no-go ก่อนแต่ละกลุ่ม drop

## 11. Rollback matrix

| Phase | สิ่งที่ย้อนกลับได้ | วิธี | ข้อจำกัด |
| --- | --- | --- | --- |
| 0–1 | ทั้งหมด | ไม่มี production mutation | ไม่มี |
| 2 Expand | app | deploy app เดิม; คง column ใหม่ไว้ | ไม่จำเป็นต้อง drop additive schema |
| 3 Compatibility | app | rollback app; dual-write ทำให้ source เดิมทันสมัย | ต้องไม่มี write path ที่หลุด dual-write |
| 4 Backfill | app + read source | app เดิมยังอ่าน source เดิม | backfill ไม่ควร delete/overwrite source |
| 5 Cutover | app | switch read กลับ source เดิม | source เดิมต้องยังคง sync จนจบ rollback window |
| 6 Constraints | constraint บางชนิด | migration ใหม่เพื่อ drop/disable constraint | review ผลของ writes ที่เกิดระหว่างนั้น |
| 7 Contract | ไม่ย้อนกลับด้วย app อย่างเดียว | PITR restore หรือ forward-fix | ต้องมี outage/data merge plan |
| 8 Print additive | feature | ปิด feature flag/หยุด bridge | อย่าลบ job history ระหว่าง rollback |

## 12. งานที่ไม่ควรรวมในรอบนี้

- cleanup orphan Cloudinary images
- เปลี่ยน auth/session schema ของ Better Auth
- ยุบ storefront category/service/item/price ซึ่งเป็น price matrix ที่มี cardinality จริง
- ยุบ package sale/item/entitlement ซึ่งมี lifecycle และ audit ต่างกัน
- ลบ PaymentAuditLog หรือ PackageExpiryNotification เพราะจำนวนแถวปัจจุบันน้อย/ศูนย์
- เปลี่ยน soft delete เป็น hard delete
- partitioning, sharding หรือ event sourcing ซึ่งยังไม่มีหลักฐานว่าจำเป็น
- rewrite migration history ให้สั้นลง
- deploy Xprinter พร้อม contract migration ใน maintenance window เดียวกัน

## 13. ลำดับ implementation ที่แนะนำ

1. ยืนยัน canonical decisions F1–F6 จากแผนควบคุมกลางและอนุมัติ target schema
2. สร้าง characterization tests
3. ทำ Migration A แบบ expand-only และทดสอบ fresh replay + restored snapshot
4. deploy expand หลัง backup gate
5. deploy compatibility app ที่ยัง read-old แต่ dual-write target พร้อม metrics
6. เพิ่มและรัน idempotent backfill scripts พร้อม dry-run/report mode
7. รัน reconciliation และยืนยัน second run เปลี่ยนศูนย์แถว
8. cut read ไป source ใหม่ทีละกลุ่ม
9. soak 7–14 วันและหยุด dual-write ทีละกลุ่ม
10. เพิ่ม/validate constraints
11. ขออนุมัติ contract แยกต่างหาก
12. drop ของเดิมเป็น migration ย่อย พร้อม reconciliation ทุกครั้ง
13. เริ่ม `Printer` + `PrintJob` เป็น additive track หลัง database consolidation เสถียร

## 14. Definition of Done

งาน database consolidation ถือว่าเสร็จเมื่อ:

- production data reconciliation ทุกกลุ่มผ่านและมี evidence
- source of truth ใหม่ถูกใช้ทุก read/write path
- ไม่มี legacy fallback หรือ dual-write เหลือ
- constraints ป้องกัน payment source/cardinality ตามกติกาที่อนุมัติ
- completed order ใหม่มี business timestamp จริง
- table/model count ลดจาก 28 เป็นประมาณ 26 โดยไม่รวม printer schema และคง `NotificationSubscriber`
- tests/typecheck/build ถูกประเมินและไม่มี regression ใหม่จากงานนี้
- backup/restore runbook ผ่านการทดลอง
- contract migrations ถูกอนุมัติและ deploy แยกจาก expand/cutover
- เอกสาร setup/operation และ schema map อัปเดตตรงกับของจริง

เมื่อเพิ่มระบบพิมพ์ภายหลัง เป้าหมายรวมจะเป็นประมาณ 28 models ด้วย `Printer` และ `PrintJob` โดยไม่สร้างตาราง bridge/connection/event เพิ่มจนกว่าจะมีความจำเป็นที่พิสูจน์ได้ แม้จำนวนรวมเท่าปัจจุบัน แต่ singleton ที่ซ้ำถูกลดลงและตารางใหม่สองตัวมี lifecycle ที่จำเป็นจริง
