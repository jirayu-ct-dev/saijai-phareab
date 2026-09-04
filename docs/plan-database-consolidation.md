# Database consolidation — implementation and production record

อัปเดต: 2026-09-05 (Asia/Bangkok)

สถานะ: **migration ถูก apply บน production แล้วเมื่อ 2026-09-05 (Asia/Bangkok)** เอกสารนี้เป็นบันทึก architecture และ rollback boundary ไม่ใช่คำสั่งให้นำ migration ไปรันซ้ำ และไม่อนุญาตให้ restore, seed หรือ reset production โดยอัตโนมัติ

## เป้าหมายและ source of truth ปัจจุบัน

Schema เป้าหมายมี 26 Prisma models และ 10 enums โดยลดเฉพาะข้อมูลที่ซ้ำกับ flow ปัจจุบัน:

| ข้อมูลธุรกิจ | Source of truth หลัง migration | สิ่งเดิมที่ยกเลิก |
| --- | --- | --- |
| ข้อมูลร้าน/นโยบายแจ้งเตือน/QR | `AppSetting` บนตาราง `business_setting` | `shop_setting`, `notification_setting` |
| การใช้เครดิต add-on | `service_order_addon_usage` | `service_order.addonUsages`, `usedBonuses` |
| รูปของรายการบริการ | `service_order_item_image` | `service_order_item.imageId` |
| แหล่งที่มาของ payment | `serviceOrderId` XOR `packageSaleId` | `payment_record.memberEntitlementId` |
| สถานะการขาย package | derive จาก `payment_record.status` | `package_sale.status`, enum `PackageSaleStatus` |
| เวลาปิดงาน | `service_order.completedAt` สำหรับงานใหม่ | ไม่ backfill เวลาเก่าจาก `paidAt` |

ยังคง `NotificationSubscriber`, `Image`, `PaymentAuditLog`, soft-deleted rows และตาราง domain อื่น เพราะแต่ละส่วนมี lifecycle หรือประวัติของตนเอง ไม่ใช่ข้อมูลซ้ำ

ระบบพิมพ์ปัจจุบันเป็น direct print ผ่าน Print Gateway และ **ไม่มี** `Printer`/`PrintJob` ในฐานข้อมูล การตั้งค่า network/printer ไม่อยู่ใน scope ของ migration นี้

## Artifact ที่เตรียมแล้ว

- Target schema: [`prisma/schema.prisma`](../prisma/schema.prisma)
- Contract migration: [`20260905000000_consolidate_current_database_flow`](../prisma/migrations/20260905000000_consolidate_current_database_flow/migration.sql)
- Canonical settings boundary: [`server/utils/appSetting.ts`](../server/utils/appSetting.ts)
- Payment status mapping: [`server/utils/paymentStateTransition.ts`](../server/utils/paymentStateTransition.ts)
- Add-on ledger operations: [`server/utils/serviceOrderCredits.ts`](../server/utils/serviceOrderCredits.ts)

Migration เป็น transaction เดียว ตั้ง `lock_timeout = 5s` และ `statement_timeout = 30s` และ fail-closed ก่อน drop เมื่อพบว่า:

- legacy settings ยังไม่ตรงกับ AppSetting หรือ canonical fields ยังเป็น null
- add-on JSON ที่มีข้อมูลยังไม่มี ledger row
- direct item image ยังไม่มี active normalized photo
- payment ไม่มี source, มีสอง source หรือ source เดียวมีหลาย payment
- owner/ยอดที่ตรวจเปรียบเทียบได้ไม่ตรง source
- entitlement เดิมของ payment หาไม่ได้จาก source relation
- package sale status เดิมไม่ตรง mapping จาก payment

สำหรับ service order เก่าที่ `totalAmount IS NULL` migration จะตรวจ owner และการมี payment แต่ไม่แต่งยอดขึ้นมาเพื่อบังคับ comparison

## หลักฐานที่มีแล้ว

- production aggregate preflight เดิมไม่พบ payment source/cardinality mismatch, settings mismatch, add-on/photo backfill gap หรือ package status mismatch
- DB-03 expand, DB-04 compatibility changes และ DB-05 idempotent backfill ผ่าน disposable rehearsal ตามหลักฐานรอบก่อน
- backup ล่าสุดที่ผู้ใช้ระบุอยู่ใน `/Users/jirayu/dev/backup/saijai-phareab/`; ต้องตรวจ timestamp/checksum/restore drill ใหม่ก่อน production contract ทุกครั้ง
- 2026-09-05: fresh PostgreSQL 16 replay ผ่านครบ 52 migrations
- 2026-09-05: current-schema rehearsal ผ่านครบ 7 stages รวม fixture, enforced preflight, dump/restore equality, schema fingerprint diff และ negative fail-closed test (evidence: `/var/folders/f5/18ygctb55cncd7h4pchbp6hm0000gn/T/saijai-rehearsal.FXUdtZ`)
- 2026-09-05: contract SQL ผ่าน production-shape synthetic fixture หลัง backfill; row counts คงเดิม (`user` 4, sales 2, orders 5, payments 7, add-on rows 3, photo rows 2, settings 1)
- 2026-09-05: exact-one-source check, unique payment-per-source indexes และ AppSetting defaults ถูกทดสอบจริงใน transaction ที่ rollback บน disposable PostgreSQL
- `pnpm test`: 407 passed, 1 skipped
- `pnpm exec nuxi typecheck`: ผ่าน
- `pnpm exec prisma validate`: ผ่าน

ข้อจำกัดของ `prisma migrate diff`: ยังรายงาน partial unique indexes เดิมสองตัว (`user.normalizedPhoneNumber` และ `customer_claim_token.userId`) เพราะ Prisma schema แทน partial indexes ไม่ได้ ไม่ใช่ drift ที่ migration รอบนี้สร้าง และ migration ใหม่นี้ไม่ลบ indexes ดังกล่าว

## ผล production rollout

- สร้าง custom-format backup ก่อน migration และตรวจว่า `pg_restore` อ่าน archive ได้
- restore backup ลง PostgreSQL 17 แบบ disposable แล้ว apply migration ทั้ง chain สำเร็จ
- apply `20260903220000_direct_print_remove_queue` และ `20260905000000_consolidate_current_database_flow` บน production สำเร็จ
- ตารางธุรกิจที่คงไว้ 26 ตารางมี row count ก่อนและหลังเท่ากันทุกตาราง
- `printer` และ `print_job` มี 0 แถวก่อนลบ; legacy setting อย่างละหนึ่งแถวผ่าน reconciliation กับ `business_setting` ก่อนลบ
- post-migration current-schema preflight ผ่านโดยไม่มี invariant failure และ Prisma migration status เป็น up to date
- หลักฐานและ backup อยู่นอก Git ที่ `/Users/jirayu/dev/backup/saijai-phareab/`

หลัง rollout ต้อง deploy เฉพาะ application version ที่ใช้ schema ปัจจุบัน ห้าม rollback application เป็นรุ่นที่ยังอ่าน legacy columns โดยไม่ restore database snapshot คู่กัน

## Rollback boundary

- ก่อน apply: rollback คือหยุด deployment และแก้ invariant ที่ migration รายงาน ไม่มี schema เปลี่ยนเพราะ migration เป็น transaction เดียว
- ระหว่าง apply: error หรือ lock timeout ทำให้ transaction rollback ทั้งชุด
- หลัง apply แต่ก่อนเปิด traffic: rollback application อย่างเดียวไม่ได้ เพราะ old binary อ้างตาราง/คอลัมน์ที่ถูกลบ ต้อง restore database snapshot พร้อม rollback application เป็น release คู่กัน
- หลังเปิด traffic: ห้าม restore ทับ production โดยอัตโนมัติ ให้หยุด write traffic, ประเมินข้อมูลใหม่หลัง migration และใช้ incident runbook ที่ผู้ดูแลอนุมัติ

## คำสั่งตรวจใน repository

```bash
pnpm test
pnpm exec nuxi typecheck
pnpm exec prisma validate
pnpm exec prisma generate
pnpm run build
```

ไม่มี lint script ที่ใช้งานได้ใน package ปัจจุบัน จึงห้ามรายงานว่า lint ผ่าน และห้ามคิดคำสั่ง lint ขึ้นเอง

การ migration production ในอนาคตต้องใช้ `DIRECT_URL` จาก secret store และมี backup/preflight/approval ใหม่ทุกครั้ง; ห้ามทดลองด้วย `prisma migrate dev`, `db push` หรือ seed บน production
