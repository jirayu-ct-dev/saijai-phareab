# แผนงาน: ระบบรายจ่ายร้านและสรุปรายรับ–รายจ่ายบน Dashboard

## เป้าหมาย

ให้ ADMIN บันทึกและจัดหมวดหมู่รายจ่ายของร้านได้ พร้อมดูรายรับแยกตามที่มา รายจ่าย และยอดสุทธิตามช่วงวันที่เดียวกันบนหน้ารายรับ–รายจ่ายและ Dashboard หลัก

งานนี้เป็นอิสระจากงานปรับลูกค้าหน้าร้าน ไม่ต้องรอหรือแก้โค้ดจากงานนั้น

## เงื่อนไขที่ตกลงแล้ว

- เฉพาะผู้ใช้บทบาท `ADMIN` เท่านั้นที่ดูและจัดการรายจ่ายได้
- รายรับนับจาก `PaymentRecord` ที่มีสถานะ `PAID` เท่านั้น
- วันที่รับรายได้ใช้ `paidAt` เป็นหลัก ไม่ใช้วันที่สร้างรายการ
- รายจ่ายนับตาม `expenseAt`
- ขอบเขตวันและช่วงรายงานใช้เวลา Asia/Bangkok
- ยอดสุทธิ = รายรับ - รายจ่าย
- ตัวเลขนี้เรียกว่า “สรุปรายรับ–รายจ่าย” หรือ “ยอดสุทธิ” ไม่อ้างว่าเป็นกำไรทางบัญชีเต็มรูปแบบ

## Completion check

ถือว่างานเสร็จเมื่อ:

1. ADMIN สร้าง แก้ไข ค้นหา กรอง รีเฟรช และ soft-delete รายจ่ายได้
2. ADMIN สร้าง แก้ไข เปิด/ปิด และจัดการหมวดหมู่รายจ่ายได้
3. EMPLOYEE และ USER เรียก API หรือเปิดหน้ารายจ่ายไม่ได้
4. Dashboard แสดงรายรับ รายจ่าย และยอดสุทธิถูกต้องตาม date range
5. หน้ารายรับ–รายจ่ายแสดงที่มารายรับ ได้แก่ ยอดซื้อแพ็กเกจ ยอดออเดอร์ผ้ารายชิ้น ยอดซัก–พับชั่งกิโล และรายรับอื่น โดยผลรวมตรงกับรายรับรวม
6. รายรับไม่รวมรายการที่ยังไม่ชำระ รอตรวจสอบ หรือยกเลิก
7. รายจ่ายที่ถูก soft-delete ไม่ถูกนำไปคำนวณ
8. ตารางและ Dashboard มี loading, empty, error และ mobile states
9. migration, Prisma Client generation, focused tests และ applicable project checks ผ่าน หรือมี baseline failure ระบุชัดเจน

## สิ่งที่อยู่นอกขอบเขต

- รายจ่ายประจำอัตโนมัติ
- approval workflow
- supplier/vendor management
- ภาษีซื้อและระบบบัญชีคู่
- เจ้าหนี้ค้างจ่าย
- การแนบใบเสร็จ
- รายงานกำไรขาดทุนตามมาตรฐานบัญชี

## แบบข้อมูล

### `ExpenseCategory`

- `id String @id @default(cuid())`
- `name String`
- `normalizedName String @unique`
- `isActive Boolean @default(true)`
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- `deletedAt DateTime?`
- `deletedById String?`
- relation ไปยัง `deletedBy` และ `expenses`

`normalizedName` ใช้ป้องกันชื่อซ้ำหลัง trim และ normalize ตัวพิมพ์ โดย API ต้องเป็นผู้สร้างค่า ไม่รับค่าจาก client โดยตรง

### `Expense`

- `id String @id @default(cuid())`
- `categoryId String`
- relation ไปยัง `ExpenseCategory`
- `amount Decimal`
- `expenseAt DateTime`
- `description String?`
- `createdById String`
- `updatedById String?`
- relations ไปยังผู้สร้างและผู้แก้ล่าสุด
- `createdAt DateTime @default(now())`
- `updatedAt DateTime @updatedAt`
- `deletedAt DateTime?`
- `deletedById String?`

Indexes ที่ควรมี:

- `Expense(expenseAt, deletedAt)`
- `Expense(categoryId, expenseAt)`
- `Expense(createdById)`
- `ExpenseCategory(isActive, deletedAt)`

จำนวนเงินต้องมากกว่า 0 และ convert Prisma `Decimal` เป็น `number` ที่ API boundary ตาม pattern ของระบบ

## API และ authorization

เพิ่ม centralized policy ใน `server/middleware/auth-session.ts` สำหรับ `/api/admin/expenses` เป็น `ADMIN` และทุก handler ต้องเรียก `requireRole(event, ["ADMIN"])` ซ้ำเป็น defense in depth

Endpoints ที่แนะนำ:

- `GET /api/admin/expenses`
  - query: `search`, `categoryId`, `from`, `to`, `page`, `pageSize`
  - filter และ pagination ทำฝั่ง server
  - คืน `items`, `total`, `page`, `pageSize`, `summary.expenseTotal`
- `POST /api/admin/expenses`
- `PUT /api/admin/expenses/:id`
- `DELETE /api/admin/expenses/:id` เป็น soft delete
- `GET /api/admin/expenses/categories`
- `POST /api/admin/expenses/categories`
- `PUT /api/admin/expenses/categories/:id`
- `DELETE /api/admin/expenses/categories/:id`

กติกาหมวดหมู่:

- หมวดที่มีรายจ่ายอ้างอิงอยู่ห้าม hard delete
- การ delete หมวดให้ soft delete เมื่อไม่มีรายการ หรือปิด `isActive` เมื่อเคยถูกใช้งาน
- รายจ่ายเก่ายังต้องอ่านชื่อหมวดที่ปิดใช้งานได้
- สร้าง/แก้ไขรายจ่ายใหม่เลือกได้เฉพาะหมวด active และไม่ถูกลบ

Validation ใช้ Zod และ `readValidatedBody`/`getValidatedQuery` ไม่รับ ID ผู้สร้างจาก client

## หน้า `/admin/finance`

ใช้ชื่อเมนูและชื่อหน้าว่า “รายรับ–รายจ่าย” เพราะหน้านี้ไม่ได้มีเฉพาะตารางรายจ่าย ส่วน expense CRUD APIs ยังคงอยู่ใต้ `/api/admin/expenses`

เพิ่ม composable และ shared types สำหรับ contract ที่ใช้ร่วมกัน โดยแบ่งหน้าเป็นสองส่วน

### ส่วนสรุป

- date range ที่ควบคุมการ์ด กราฟ และตารางทั้งหมด
- การ์ดรายรับรวม
- การ์ดรายจ่ายรวม
- การ์ดยอดสุทธิ
- กลุ่มการ์ด “ที่มารายรับ”
  - ยอดซื้อแพ็กเกจ
  - ยอดออเดอร์ผ้ารายชิ้น
  - ยอดซัก–พับชั่งกิโล
  - รายรับอื่น
- กราฟรายรับ รายจ่าย และยอดสุทธิ

### ส่วนจัดการรายจ่าย

- navbar ชื่อ “รายรับ–รายจ่าย”
- ปุ่มเพิ่มรายจ่าย
- ปุ่มจัดการหมวดหมู่
- ปุ่มรีเฟรช
- date range filter
- search จากรายละเอียดและชื่อหมวด
- category dropdown
- ตาราง desktop และ card list บนมือถือ
- server pagination
- modal เพิ่ม/แก้ไขรายจ่าย
- confirm ก่อนลบ
- loading skeleton, empty state และ error state ภาษาไทย

คอลัมน์ขั้นต่ำ:

- วันที่รายจ่าย
- หมวดหมู่
- รายละเอียด
- จำนวนเงิน
- ผู้บันทึก
- วันที่แก้ไขล่าสุด
- actions

เพิ่มเมนู “รายรับ–รายจ่าย” ที่ชี้ไป `/admin/finance` เฉพาะ `adminMenu` ใน `app/layouts/admin.vue` และไม่เพิ่มใน `employeeMenu`

## การจำแนกที่มารายรับ

ใช้ `PaymentRecord` ที่ชำระแล้วเป็น source of truth ไม่ใช้ยอดจาก ServiceOrder หรือ PackageSale โดยตรง เพื่อไม่ให้นับรายรับที่ยังไม่ได้รับเงินจริง

PaymentRecord แต่ละรายการต้องถูกจัดลงเพียงหนึ่งหมวดตามลำดับนี้:

1. `packageSaleId` มีค่าและ `serviceOrderId` ไม่มีค่า → `PACKAGE_SALE`
2. `serviceOrderId` มีค่า, `packageSaleId` ไม่มีค่า และ `serviceOrder.weightKg` มีค่า → `WASH_FOLD`
3. `serviceOrderId` มีค่า, `packageSaleId` ไม่มีค่า และ `serviceOrder.weightKg` ไม่มีค่า → `LAUNDRY_ORDER`
4. ไม่มีทั้งสองค่า หรือมีทั้งสองค่าซึ่งถือเป็นข้อมูลผิด invariant → `OTHER`

กติกาการคำนวณ:

- `PACKAGE_SALE` แสดงเป็น “ยอดซื้อแพ็กเกจ”
- `LAUNDRY_ORDER` แสดงเป็น “ยอดออเดอร์ผ้ารายชิ้น”
- `WASH_FOLD` แสดงเป็น “ยอดซัก–พับชั่งกิโล”
- `OTHER` แสดงเป็น “รายรับอื่น” และควรมี log/diagnostic count สำหรับรายการที่มีทั้ง `packageSaleId` และ `serviceOrderId`
- การใช้งานเครดิตแพ็กเกจใน ServiceOrder ไม่สร้างรายรับซ้ำ เพราะรายรับถูกนับตอน PaymentRecord ของการซื้อแพ็กเกจเป็น `PAID` แล้ว
- ถ้าออเดอร์ใช้เครดิตบางส่วนและมีเงินจ่ายเพิ่ม ให้นับเฉพาะ `PaymentRecord.amount` ที่ชำระจริงตามประเภท `LAUNDRY_ORDER` หรือ `WASH_FOLD`
- ผลรวมทั้งสี่หมวดต้องเท่ากับรายรับรวมทุกช่วงวันที่เสมอ

เพิ่ม endpoint สรุปสำหรับหน้า finance เช่น `GET /api/admin/finance/summary` ซึ่งคืน:

```ts
type FinanceSummary = {
  income: number
  expense: number
  net: number
  incomeBreakdown: {
    packageSale: number
    laundryOrder: number
    washFold: number
    other: number
  }
}
```

Endpoint นี้และ `/api/admin/finance/**` ต้องเป็น ADMIN-only ทั้ง centralized policy และ handler

## Dashboard

### แก้ความหมายรายรับเดิม

`server/api/admin/dashboard/stats.get.ts` และ `chart.get.ts` ปัจจุบันรวม PaymentRecord โดยไม่ได้กรอง `status: "PAID"` และใช้ `createdAt` งานนี้ต้องแก้ให้ใช้เงื่อนไขเดียวกันทุก endpoint:

- `deletedAt: null`
- `status: "PAID"`
- `paidAt: { gte: from, lte: to }`

ถ้าพบข้อมูล legacy ที่ `PAID` แต่ `paidAt` เป็น null ให้สำรวจจำนวนข้อมูลก่อนตัดสินใจ ห้าม fallback ไป `createdAt` โดยเงียบ เพราะจะทำให้ความหมายรายงานไม่แน่นอน

### การ์ดสรุป

ปรับการ์ดเป็น:

1. ลูกค้าใหม่
2. รายรับรวม
3. รายจ่าย
4. ยอดสุทธิ

รายรับรวม PaymentRecord ที่ชำระแล้วทั้งแพ็กเกจและออเดอร์ โดยไม่รวมยอดเครดิตที่ไม่มีเงินรับในรอบนั้น

Dashboard หลักแสดงเพียงการ์ดยอดรวมสี่ใบเพื่อรักษาความกระชับ ส่วนรายละเอียดที่มารายรับสี่ใบแสดงเต็มในหน้า `/admin/finance` การ์ดรายรับรวมบน Dashboard กดแล้วไปหน้าดังกล่าว

แต่ละยอดเปรียบเทียบช่วงก่อนหน้าที่มีระยะเวลาเท่ากัน:

- รายรับเพิ่มเป็นผลบวก
- รายจ่ายเพิ่มแสดงเป็น warning/error ไม่ใช้ความหมายสีเดียวกับรายรับ
- ยอดสุทธิแสดงสีตามเครื่องหมาย

### กราฟ

เปลี่ยน response ของ dashboard chart เป็น:

```ts
type DashboardCashflowPoint = {
  date: string
  income: number
  expense: number
  net: number
}
```

Bucket รายรับด้วย `paidAt` และรายจ่ายด้วย `expenseAt` ตาม Asia/Bangkok เติมวันที่ไม่มีรายการเป็น 0 และรองรับ daily/weekly/monthly aggregation ที่ UI ใช้อยู่

เพิ่ม quick action “บันทึกรายจ่าย” ในหน้า Dashboard

## ลำดับ implementation

1. ตรวจ `git status` และ baseline ของ dashboard tests/typecheck ก่อนแก้
2. เพิ่ม Prisma models, relations และ indexes
3. สร้าง migration ใหม่ ห้ามแก้ migration เดิม
4. รัน Prisma generate
5. เพิ่ม shared types และ normalization utility ที่จำเป็น
6. ทำ category APIs พร้อม authorization และ validation
7. ทำ expense APIs พร้อม filter, pagination และ soft delete
8. ทำ income-classification utility ให้ PaymentRecord ทุกแถวอยู่เพียงหนึ่งหมวด
9. ทำ finance summary/chart APIs พร้อม breakdown และ reconciliation check
10. ทำ composable และหน้า `/admin/finance`
11. เพิ่ม admin navigation และ centralized access policies
12. แก้ dashboard stats ให้ใช้รายรับที่ชำระจริง
13. เพิ่ม expense aggregation และ net calculation
14. ปรับ dashboard cards, graph และ quick action
15. เพิ่ม focused tests
16. ตรวจ UI ทั้ง mobile/desktop และช่วงวันที่ข้ามเที่ยงคืน Bangkok
17. รัน final verification

## ชุดทดสอบขั้นต่ำ

- ADMIN CRUD รายจ่ายสำเร็จ
- EMPLOYEE/USER ได้ 403
- amount เป็น 0, ติดลบ, NaN หรือเกินขอบเขตถูกปฏิเสธ
- หมวดซ้ำหลัง normalize ถูกปฏิเสธ
- หมวด inactive ใช้สร้างรายจ่ายใหม่ไม่ได้
- search/category/date filters ทำงานร่วมกัน
- soft-deleted expense ไม่อยู่ใน list และ summary
- `UNPAID`, `PENDING_VERIFICATION`, `CANCELLED` ไม่ถูกนับเป็นรายรับ
- `PAID` ถูก bucket ตาม `paidAt`
- package payment ถูกจัดเป็นยอดซื้อแพ็กเกจเพียงหมวดเดียว
- service-order payment ที่ `weightKg` มีค่าถูกจัดเป็นซัก–พับชั่งกิโล
- service-order payment ที่ `weightKg` ไม่มีค่าถูกจัดเป็นออเดอร์ผ้ารายชิ้น
- payment ที่ไม่มี source หรือมี source ซ้ำถูกจัดเป็นรายรับอื่นและไม่ถูกนับซ้ำ
- การใช้เครดิตแพ็กเกจไม่สร้างรายรับเพิ่ม
- เงินส่วนเพิ่มของออเดอร์ที่ใช้เครดิตนับเฉพาะจำนวนที่จ่ายจริง
- ผลรวม income breakdown เท่ากับรายรับรวมทุกกรณี
- ขอบเขตวัน Asia/Bangkok ถูกต้อง
- income - expense = net ทั้งค่าบวก ศูนย์ และติดลบ
- previous-period variation ถูกต้องเมื่อยอดเดิมเป็นศูนย์

## Verification commands

```bash
pnpm exec prisma generate
pnpm test
pnpm exec nuxi typecheck
```

รัน `pnpm run build` หากมีการเปลี่ยน config หรือพบความเสี่ยงด้าน compilation และแยก baseline failures ออกจาก failure ที่เกิดจากงานนี้ ห้าม apply migration กับฐานข้อมูล shared/staging/production โดยไม่ได้รับอนุญาต
