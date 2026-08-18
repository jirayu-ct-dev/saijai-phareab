# แผนงาน: ลูกค้าหน้าร้านแบบนำกลับมาใช้ซ้ำและเปิดใช้งานบัญชีภายหลัง

## เป้าหมาย

ยกเลิกบัญชีกลางและ fields แบบ walk-in ให้ออเดอร์ใหม่ทุกใบผูกกับ `User` ของลูกค้าจริง โดยพนักงานค้นหาลูกค้าเดิมจากเบอร์หรือสร้างลูกค้าใหม่ได้ และลูกค้าสามารถเปิดใช้งานบัญชีเดิมเพื่อดูประวัติ เปลี่ยนอีเมล และผูก LINE ภายหลัง

งานนี้เป็นอิสระจากระบบรายจ่ายและ Dashboard ไม่ต้องแก้หรือรอ schema/API ของงานรายจ่าย

## เงื่อนไขที่ตกลงแล้ว

- ลูกค้าหนึ่งคนใช้เบอร์โทรหนึ่งเบอร์
- normalized phone ต้อง unique สำหรับผู้ใช้ที่ไม่ถูกลบ
- ชื่อและเบอร์โทรเป็นข้อมูลบังคับเมื่อพนักงานสร้างลูกค้าใหม่ใน POS
- ระบบสร้าง internal email ให้ลูกค้าที่ไม่มีอีเมลจริง
- ไม่สร้าง password อัตโนมัติ
- ลูกค้าต้อง claim บัญชีเดิมก่อนจึงเข้าสู่ระบบและเห็นประวัติได้
- หลัง claim ลูกค้าเปลี่ยนอีเมลและผูก LINE ได้
- ลบ `isWalkIn`, `walkInName`, `walkInPhone` และบัญชีกลาง `walkin@saijai.local` ออกจากระบบ
- เจ้าของระบบจะลบข้อมูล walk-in เดิมก่อนใช้ migration; งาน implementation ต้องไม่พยายามเดาว่าออเดอร์เก่าเป็นของใคร

## Completion check

ถือว่างานเสร็จเมื่อ:

1. POS ค้นหาลูกค้าเดิมจากชื่อหรือเบอร์ และเลือกใช้ซ้ำได้
2. POS สร้างลูกค้าใหม่จากชื่อและเบอร์ แล้วสร้างออเดอร์กับ User เดียวกันแบบ atomic
3. เบอร์ที่ normalize แล้วซ้ำไม่สร้าง User ใหม่โดยเงียบ แต่แสดงบัญชีที่พบให้พนักงานยืนยัน
4. ไม่มี `isWalkIn`, `walkInName`, `walkInPhone`, `ensureWalkInCustomer` หรือ special-case `walkin@saijai.local` เหลือใน runtime code, schema, types, exports และ tests
5. ลูกค้าที่ร้านสร้างได้รับ activation link/code แบบใช้ครั้งเดียว
6. ลูกค้า claim บัญชีด้วยอีเมลจริงและ password แล้วเห็นออเดอร์ เครดิต และการชำระเงินเดิมจาก User ID เดิม
7. ลูกค้าที่ล็อกอินแล้วเปลี่ยนอีเมลผ่าน verification flow และผูก LINE ได้
8. LINE ที่ผูกกับ User อื่นอยู่แล้วไม่ถูกย้ายหรือ merge อัตโนมัติ
9. migration ผ่านบนฐานข้อมูล disposable หลังข้อมูล walk-in เดิมถูกลบตาม precondition

## สิ่งที่อยู่นอกขอบเขต

- automatic merge ระหว่าง User สองบัญชี
- การเดาเจ้าของข้อมูลเก่าจากชื่อหรือเบอร์
- login ด้วย SMS OTP
- การอนุญาตหลาย User ใช้ normalized phone เดียวกัน
- การสร้าง password ให้ลูกค้าโดยพนักงาน
- การส่ง activation link ผ่าน LINE Messaging อัตโนมัติ

## แบบข้อมูล

### ปรับ `User`

เพิ่ม:

- `normalizedPhoneNumber String?`
- `customerAccountStatus CustomerAccountStatus @default(ACTIVE)`
- `claimedAt DateTime?`
- `createdByStaffId String?`
- self-relation ไปยังผู้สร้างบัญชี หากใช้ relation นี้

Enum:

```prisma
enum CustomerAccountStatus {
  OFFLINE
  ACTIVE
}
```

กติกา:

- ผู้ใช้เดิมทั้งหมดเป็น `ACTIVE`
- ลูกค้าที่ POS สร้างเป็น `OFFLINE`
- เมื่อ claim สำเร็จเปลี่ยนเป็น `ACTIVE` และตั้ง `claimedAt`
- `email` ยัง required เพื่อเข้ากับ Better Auth และ schema ปัจจุบัน
- internal email รูปแบบ `customer-<random-id>@saijai.local`
- UI ต้องแสดง “ยังไม่ได้ระบุอีเมล” แทน internal email

### Unique normalized phone

PostgreSQL ต้องบังคับความเป็นเอกลักษณ์ของ `normalizedPhoneNumber` สำหรับ User ที่ `deletedAt IS NULL` ด้วย partial unique index ใน migration เพราะ Prisma schema ไม่สามารถอธิบาย partial unique constraint ได้ครบถ้วน

ก่อนสร้าง index ต้องมี preflight query ตรวจข้อมูลซ้ำและ fail migration พร้อมคำแนะนำที่ชัดเจน ห้ามเลือกหรือลบข้อมูลซ้ำอัตโนมัติ

Normalization ขั้นต่ำ:

- trim
- ตัดช่องว่าง ขีด วงเล็บ และเครื่องหมายที่ใช้จัดรูปแบบ
- แปลง `+66` เป็นรูปแบบ `0` เดียวกัน
- ยอมรับเฉพาะเลขไทยที่ระบบรองรับตามกติกาที่กำหนด
- เก็บ `phoneNumber` สำหรับแสดงผล และใช้ `normalizedPhoneNumber` สำหรับค้นหา/unique เท่านั้น

Normalization ต้องอยู่ใน shared/server utility เดียวและมี unit tests ไม่ทำซ้ำในแต่ละ handler

### `CustomerClaimToken`

- `id String @id @default(cuid())`
- `userId String`
- relation ไปยัง User
- `tokenHash String @unique`
- `expiresAt DateTime`
- `usedAt DateTime?`
- `revokedAt DateTime?`
- `createdById String`
- `createdAt DateTime @default(now())`

เก็บเฉพาะ hash ของ token และคืน token ดิบให้ผู้สร้างเพียงครั้งเดียว อายุเริ่มต้น 7 วัน และ token ใหม่ต้อง revoke token เก่าที่ยังไม่ถูกใช้

## การสร้าง/เลือกลูกค้าใน POS

แทน radio “ลูกค้าในระบบ/ลูกค้าหน้าร้าน” ด้วย:

- “เลือกลูกค้าเดิม” เป็นค่าเริ่มต้น
- “เพิ่มลูกค้าใหม่”

### เลือกลูกค้าเดิม

- searchable select ค้นจากชื่อ เบอร์ และอีเมลจริง
- ไม่แสดง internal email
- แสดงสถานะ “ยังไม่เปิดใช้งานบัญชี” สำหรับ `OFFLINE`
- หลังเลือกแล้วใช้ entitlement/add-on/payment flow เดิมตาม `customerId`

### เพิ่มลูกค้าใหม่

ฟอร์มขั้นต่ำ:

- ชื่อ required
- เบอร์โทร required
- อีเมลจริง optional

Flow ฝั่ง server:

1. validate และ normalize เบอร์
2. ค้นหา User ที่ไม่ถูกลบด้วย normalized phone
3. ถ้าพบ คืน 409 พร้อม customer summary ที่ปลอดภัยให้ UI ขอการยืนยันเลือกบัญชีเดิม
4. ถ้าไม่พบ สร้าง User สถานะ `OFFLINE` พร้อม internal email
5. สร้าง claim token
6. สร้าง ServiceOrder, PaymentRecord และ credit mutations ใน transaction เดียวกันกับ User เมื่อ practical
7. ถ้า unique constraint ชนจาก concurrent request ให้คืน 409 และโหลดบัญชีที่มีอยู่ ไม่คืน 500

หากกรอกอีเมลจริงตั้งแต่ POS ยังไม่ถือว่ายืนยันแล้ว ต้องส่งผ่าน activation/verification flow เช่นเดียวกัน

## Claim บัญชี

เพิ่มหน้า public เช่น `/auth/claim-customer` และ endpoints ที่ไม่อยู่ใต้ `/api/admin` แต่ต้องมี rate limit และ validation

Flow MVP:

1. ลูกค้าเปิด activation URL หรือกรอก code
2. server ตรวจ hash, expiry, usedAt, revokedAt และสถานะ User
3. ลูกค้ากรอกอีเมลจริงและ password
4. ตรวจว่าอีเมลและ normalized phone ไม่ชน User อื่น
5. transaction เปลี่ยน internal email เป็นอีเมลจริง สร้าง credential Account ตั้งสถานะ `ACTIVE`, `claimedAt` และ mark token used
6. ส่ง email verification
7. ให้ลูกค้าล็อกอินตาม flow ปกติ
8. หลังล็อกอิน ลูกค้าเห็นข้อมูล `/me/**` เดิมทันทีเพราะ ownership ไม่ได้เปลี่ยน User ID

อย่าสร้าง session ให้ User จาก claim token เพียงอย่างเดียวก่อนตั้ง credential เพราะ token ที่หลุดจะกลายเป็น session takeover

## เปลี่ยนอีเมลและผูก LINE

### เปลี่ยนอีเมล

เปิด Better Auth `user.changeEmail` และเพิ่ม UI ในหน้า profile:

- ต้อง verify อีเมลใหม่ก่อนเปลี่ยน
- แสดงสถานะ pending
- ป้องกันอีเมลซ้ำและ internal domain
- revoke sessions อื่นหลังสำเร็จ
- ไม่แก้ `User.email` ตรงจาก self-service API

ADMIN ยังแก้อีเมลผู้ใช้ได้ตาม API เดิม แต่ควรแสดง warning และไม่ตั้ง `emailVerified: true` โดยอัตโนมัติ

### ผูก LINE

ใช้ `authClient.linkSocial({ provider: "line" })` และหน้า `LineLinkSection` ที่มีอยู่หลังลูกค้าล็อกอินแล้ว

- LINE account ที่ผูกกับ User อื่นต้องคืน conflict
- ห้าม automatic merge ด้วยเบอร์โทรหรือชื่อ
- หน้า login เพิ่มทางเข้า “มีรหัสเปิดใช้งานจากหน้าร้าน” ให้เห็นก่อนปุ่ม LINE
- ถ้าลูกค้าเข้าสู่ระบบ LINE และสร้างบัญชีใหม่ก่อน claim ให้ ADMIN แก้ข้อมูลด้วยมือในรอบนี้; user merge เป็นงานแยกในอนาคต

## การลบ walk-in model เดิม

### Precondition ก่อน migration

เจ้าของระบบต้องยืนยันว่า:

- ไม่มี ServiceOrder ที่ `isWalkIn = true` เหลืออยู่
- ไม่มี PaymentRecord/เอกสารที่ต้องรักษา ownership ผ่าน `walkin@saijai.local`
- บัญชีกลางไม่มี relations ที่ยังต้องเก็บ
- มี backup ที่กู้คืนได้

Migration ต้องตรวจ precondition และหยุดด้วย error หากยังมีข้อมูล ไม่ลบออเดอร์หรือบัญชีกลางแทนผู้ใช้โดยอัตโนมัติ

### จุดที่ต้องลบ/ปรับ

- `ServiceOrder.isWalkIn`
- `ServiceOrder.walkInName`
- `ServiceOrder.walkInPhone`
- `server/utils/walkInCustomer.ts`
- walk-in validation และ `ensureWalkInCustomer` ใน create/update service-order APIs
- POS props/state/emits และ edit modal
- service-order list/detail APIs และ pages
- payment list/detail APIs และ pages
- dashboard recent/pending order mapping
- receipt/quotation/document rendering
- LINE notification customer resolution
- pickup confirmation
- CSV exports
- deleted-data utility
- shared order/payment/receipt types
- composables
- account deletion/edit/promote guards ของ system user
- seeds และ tests

หลังปรับแล้ว customer display ทุกจุดต้องอ่านจาก `order.customer` โดยตรง

## API ที่ต้องเพิ่มหรือปรับ

- ปรับ `GET /api/admin/customer-options` ให้รองรับ server search และไม่โหลดลูกค้าทั้งหมดพร้อม entitlements โดยไม่จำกัด
- เพิ่ม `POST /api/admin/customers` สำหรับสร้าง offline customer หากแยกจาก order transaction
- เพิ่ม endpoint ตรวจ normalized phone/คืน existing match
- เพิ่ม `POST /api/admin/customers/:id/claim-token` สำหรับออก token ใหม่
- เพิ่ม endpoint public สำหรับ validate และ consume claim token
- ปรับ `POST /api/admin/service-orders` ให้รับ `customerId` เท่านั้น
- ปรับ `PUT /api/admin/service-orders/:id` ให้รับ `customerId` เท่านั้น
- เปิด Better Auth change-email configuration และ client flow

ทุก `/api/admin/customers` route ให้ EMPLOYEE และ ADMIN สร้าง/ค้นหาลูกค้าได้ตาม POS แต่การดู activation token เดิม ออก token ใหม่ หรือแก้ identity-sensitive fields ควรจำกัด ADMIN หากไม่มีเหตุผลทางปฏิบัติให้พนักงานทำ

## ลำดับ implementation

1. ตรวจ `git status`, baseline typecheck/tests และค้น reference ของ walk-in ทั้งหมด
2. เพิ่ม phone normalization utility พร้อม tests
3. เพิ่ม User account-status fields, claim-token model และ partial unique phone migration
4. รัน Prisma generate
5. backfill normalized phone ของ User เดิมและตรวจ duplicate โดยไม่แก้ข้อมูลเงียบ
6. ทำ customer search/create APIs และ concurrency handling
7. ปรับ POS เป็น “เลือกเดิม/เพิ่มใหม่” และสร้าง order ด้วย customerId
8. ปรับ edit service-order flow
9. ทำ claim-token issue/validate/consume flow
10. เพิ่ม claim page, activation UI และทางเข้าจากหน้า login
11. เปิดและทำ change-email flow
12. ทดสอบการผูก LINE หลัง claim
13. เจ้าของระบบลบข้อมูล walk-in เดิมและยืนยัน precondition
14. เพิ่ม migration ลบสาม columns และลบบัญชีกลางหลังไม่มี relation
15. ลบ walk-in branches/utilities/types จากทุก code path
16. ปรับ exports, documents, notification, dashboard และ deleted-data
17. เพิ่ม focused tests และ regression tests
18. รัน full verification และ migration replay บน disposable database

## ชุดทดสอบขั้นต่ำ

- normalize รูปแบบ `08x`, ขีด/ช่องว่าง และ `+66`
- normalized phone ซ้ำถูกปฏิเสธทั้ง sequential และ concurrent requests
- soft-deleted user ไม่ขวางเบอร์ใหม่ตามกติกา partial index
- สร้าง offline User ได้ internal email ที่ unique
- internal email ไม่ถูกแสดงเป็นอีเมลจริง
- customer/order/payment ถูกสร้าง atomic
- entitlement ที่เป็นของ User อื่นใช้ไม่ได้
- claim token ผิด หมดอายุ ถูก revoke และใช้ซ้ำถูกปฏิเสธ
- claim สำเร็จเปลี่ยน User เดิม ไม่สร้าง User ใหม่
- credential account ถูกสร้างและล็อกอินได้
- อีเมลใหม่ต้อง verify และห้ามใช้ internal domain
- ลูกค้าเห็น order/payment/membership เดิมหลัง claim
- ผูก LINE สำเร็จเมื่อ LINE ยังว่าง
- LINE ที่ผูกกับ User อื่นแล้วถูกปฏิเสธ
- schema migration หยุดเมื่อยังมี walk-in rows
- `rg` ไม่พบ runtime reference ของ fields และ system email ที่ลบแล้ว

## Verification commands

```bash
rg -n "isWalkIn|walkInName|walkInPhone|walkin@saijai.local|ensureWalkInCustomer" app server shared prisma tests
pnpm exec prisma generate
pnpm test
pnpm exec nuxi typecheck
```

รัน `pnpm run build` สำหรับการเปลี่ยน auth/config และทดสอบ migration chain บนฐานข้อมูล disposable ห้าม apply migration, reset หรือ seed ฐานข้อมูล shared/staging/production โดยไม่ได้รับอนุญาต

