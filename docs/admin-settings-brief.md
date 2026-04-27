# Brief: หน้า Admin Settings ที่เหลือ

> **Goal:** เก็บหน้า settings ของ admin ให้ครบ + เพิ่มหน้า Backup/Export และ Billing
>
> **Owner:** ทีม fullstack
> **Branch suggest:** `feature/admin-settings-complete`
> **Audit log:** ยังไม่ทำในเฟสนี้ (เก็บไว้ทำตอน scale ขึ้นมีหลาย admin)

---

## 1. สถานะปัจจุบัน

| หน้า | Route | สถานะ |
|------|-------|------|
| ข้อมูลร้าน | `/admin/settings/shop` | ✅ มีแล้ว |
| การแจ้งเตือน | `/admin/settings/notification` | ✅ มีแล้ว |
| ข้อมูลส่วนตัว | `/admin/settings/profile` | ❌ |
| ความปลอดภัย | `/admin/settings/security` | ❌ |
| จัดการพนักงาน | `/admin/settings/employee` | ❌ |
| จัดการสมาชิก | `/admin/settings/member` | ❌ |
| คู่มือ | `/admin/settings/handbook` | ❌ |
| **ตั้งค่าธุรกิจ** | `/admin/settings/billing` | ❌ ใหม่ |
| **Export ข้อมูล** | `/admin/settings/backup` | ❌ ใหม่ |

---

## 2. กลยุทธ์การ Reuse

หน้า `profile`, `security`, `notification` เป็น "ข้อมูลตัวเอง" — share ได้ระหว่าง admin / employee / customer

**สร้าง shared components ที่ `app/components/account/`:**
```
ProfileForm.vue                 # ชื่อ, เบอร์, รูป profile
LineLinkSection.vue             # ผูก/ยกเลิก LINE
PasswordChangeForm.vue          # เปลี่ยนรหัส
ActiveSessionsList.vue          # session + logout-everywhere
NotificationPreferenceForm.vue  # toggle lineNotifyEnabled
```

หน้า admin/user แค่ wrap ด้วย layout ของตัวเอง:
```vue
<!-- admin/settings/profile.vue -->
<AdminLayout> <ProfileForm /> </AdminLayout>

<!-- me/settings/profile.vue (อนาคต) -->
<UserLayout> <ProfileForm /> </UserLayout>
```

**API ใช้ร่วม** — `/api/me/*` สำหรับทุก role ไม่แยก `admin/me`

---

## 3. Phase 1 — Foundation (sprint 1)

### 3.1 Shared components + API
- `ProfileForm.vue` + `GET/PUT /api/me/profile`
- `LineLinkSection.vue` + ใช้ BetterAuth `linkSocial` / `unlinkAccount`
- `PasswordChangeForm.vue` + `PUT /api/me/password`
- `ActiveSessionsList.vue` + `GET /api/me/sessions`, `DELETE /api/me/sessions/[id]`, `POST /api/me/sessions/revoke-all`
- `NotificationPreferenceForm.vue` (refactor จากของเดิม)

### 3.2 หน้า admin
- `/admin/settings/profile` — wrap `ProfileForm` + `LineLinkSection`
- `/admin/settings/security` — wrap `PasswordChangeForm` + `ActiveSessionsList`

### 3.3 Acceptance
- [ ] เปลี่ยนชื่อ/เบอร์/รูป profile ได้
- [ ] ผูก/ยกเลิก LINE ได้
- [ ] เปลี่ยนรหัสผ่านได้ (ขอรหัสเดิมก่อน)
- [ ] เห็นรายการ session + ปุ่มออกจากระบบทุกเครื่อง
- [ ] Components reusable — render ได้ทั้ง admin/user layout

---

## 4. Phase 2 — Employee & Member Management (sprint 2)

### 4.1 `/admin/settings/employee` — จัดการพนักงาน
- ตาราง `User` ที่ `role IN [EMPLOYEE, ADMIN]`
- คอลัมน์: avatar, ชื่อ, อีเมล, role, สถานะ LINE link, วันที่สร้าง, action
- Action: เปลี่ยน role, soft delete, invite ใหม่
- Modal "เพิ่มพนักงาน" — กรอกอีเมล + role → ส่งลิงก์ invite (ส่ง email ผ่าน BetterAuth) หรือสร้างบัญชี + รหัสชั่วคราว
- Filter: role, สถานะ, ค้นหาชื่อ/อีเมล

### 4.2 `/admin/settings/member` — จัดการสมาชิก
- ตาราง `User` ที่ `role = USER` + `MemberEntitlement` count
- คอลัมน์: avatar, ชื่อ, เบอร์, แพ็กเกจ active, เครดิตคงเหลือ, ยอดใช้จ่ายรวม, action
- Filter: มี/ไม่มี active package, ใกล้หมดอายุ
- Action: ดูประวัติ → `/admin/users/[id]` (มีหน้านี้แล้ว)
- Bulk: ขยายอายุแพ็กเกจ (กลุ่ม), คืนเครดิต (กลุ่ม) — เฟสถัดไป

### 4.3 API
- `GET /api/admin/employees` — list
- `POST /api/admin/employees/invite` — invite + email link
- `PUT /api/admin/employees/[id]` — update role
- `DELETE /api/admin/employees/[id]` — soft delete (ห้ามลบตัวเอง)
- `GET /api/admin/members` — list user role=USER + entitlement summary

### 4.4 Acceptance
- [ ] Admin เห็นพนักงานทั้งหมด
- [ ] เปลี่ยน role ได้ (ห้ามลด role ตัวเอง)
- [ ] Invite พนักงานใหม่ผ่านอีเมล
- [ ] เห็นรายชื่อสมาชิกแพ็กเกจ + เครดิตคงเหลือ

---

## 5. Phase 3 — Backup/Export (sprint 3) ⚡ Priority สูง

### 5.1 หน้า `/admin/settings/backup`
- Form เลือก: ประเภทรายงาน + ช่วงเวลา (from/to) + format
- ประเภทรายงาน:
  - **รายงานยอดขาย** (`PaymentRecord`) — เลขที่บิล, วันที่, ลูกค้า, ประเภท (ขายแพ็กเกจ/บริการ), ยอด, ช่องทาง, สถานะ
  - **รายงานออเดอร์** (`ServiceOrder`) — เลขรับ, วันที่รับ, นัดรับ/วันที่ส่ง, ลูกค้า, จำนวนชิ้น, สถานะ, ยอด, พนักงาน
  - **รายงานสมาชิก** (`MemberEntitlement`) — ลูกค้า, แพ็กเกจ, เครดิตเริ่ม/คงเหลือ, เริ่ม/หมดอายุ, สถานะ
  - **รายงานพนักงาน** — สรุป order ที่แต่ละคนรับ + ยอดรวมในช่วง (สำหรับคำนวณค่าคอมมิชชั่น)
- Format: CSV (เริ่ม), XLSX (เฟสถัดไป)
- ปุ่มดาวน์โหลด → ดึงจาก server เป็นไฟล์
- (เฟสถัดไป) ตั้งค่า "ส่งรายงานปลายเดือนทาง email" อัตโนมัติ

### 5.2 API
- `GET /api/admin/exports/sales?from=&to=&format=csv`
- `GET /api/admin/exports/orders?from=&to=&format=csv`
- `GET /api/admin/exports/members?from=&to=&format=csv`
- `GET /api/admin/exports/employee-performance?from=&to=&format=csv`

**Implementation notes:**
- ใช้ Prisma `findMany` + cursor pagination (stream) ถ้า > 5,000 rows
- Generate CSV เอง (escape comma/quote/newline) — ไม่ต้องเพิ่ม dependency
- Header: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="..."`
- BOM UTF-8 (`﻿`) ที่ต้นไฟล์ให้ Excel เปิดภาษาไทยถูก
- Decimal → Number (locale Thai), date → ISO + Bangkok timezone
- Authorization: `requireRole(['ADMIN'])` เฉพาะ — กัน employee export

### 5.3 Acceptance
- [ ] เลือกช่วงเวลา + ประเภทรายงาน + กดดาวน์โหลดได้ไฟล์ CSV
- [ ] เปิดด้วย Excel แล้วภาษาไทยอ่านออก
- [ ] Filter จับช่วงเวลาถูก (timezone Bangkok)
- [ ] Soft-deleted records ไม่ถูก export (filter `deletedAt: null`)

---

## 6. Phase 4 — Billing (sprint 4)

### 6.1 Schema ใหม่
```prisma
model BusinessSetting {
  id                       String   @id @default("singleton")
  hangerPricePerUnit       Decimal  @default(0)
  vatRate                  Decimal  @default(0)        // 0-100, 0 = ไม่ใช้
  vatIncluded              Boolean  @default(false)    // ราคารวม VAT แล้วหรือยัง
  paymentNoPrefix          String   @default("PAY-")
  orderNoPrefix            String   @default("ORD-")
  minimumOrderAmount       Decimal  @default(0)
  packageRefundDays        Int      @default(7)        // คืนสิทธิ์ภายใน N วัน
  updatedAt                DateTime @updatedAt
  updatedById              String?
  updatedBy                User?    @relation(...)

  @@map("business_setting")
}
```

### 6.2 หน้า `/admin/settings/billing`
- Form แบ่ง section:
  - **ค่าบริการเสริม** — ค่าไม้แขวน/ชิ้น
  - **ภาษี** — toggle VAT, อัตรา, ราคารวม VAT แล้วหรือยัง
  - **เลขเอกสาร** — prefix payment, prefix order
  - **เงื่อนไข** — ขั้นต่ำการสั่ง, จำนวนวันคืนสิทธิ์
- ปุ่มบันทึก + แสดง warning "การเปลี่ยนแปลงส่งผลกับธุรกรรมใหม่เท่านั้น"

### 6.3 API
- `GET /api/admin/settings/business` (singleton upsert)
- `PUT /api/admin/settings/business`

### 6.4 Server-side caching
- Helper `getBusinessSetting()` ที่ cache 5 นาที (in-memory) — ไม่ hit DB ทุก request
- ทำ invalidate ตอน PUT
- ฟังก์ชันที่ใช้ — `pos/serviceOrders/index.post.ts`, `paymentNo.ts`, `serviceOrderNo.ts` อ่านจาก cache แทน constant

### 6.5 Migration เก่า → ใหม่
- ค่า default ของ schema = ค่าเดิมที่ hardcode ไว้
- หลัง migrate ค่าใน DB = ค่าเดิม → behavior ไม่เปลี่ยน
- โค้ดที่ import constant เดิมต้อง refactor เป็น call helper

### 6.6 Acceptance
- [ ] เปลี่ยนค่าไม้แขวน/ชิ้น ได้ → ออเดอร์ใหม่ใช้ค่าใหม่
- [ ] เปลี่ยน VAT rate ได้ → ใบเสร็จใหม่แสดงถูก
- [ ] เปลี่ยน prefix → เลขรันใหม่ใช้ prefix ใหม่
- [ ] ค่าเก่าใน existing record ไม่เปลี่ยน

---

## 7. Phase 5 — Handbook (sprint 5)

### 7.1 หน้า `/admin/settings/handbook`
- Static markdown viewer — แสดงคู่มือใช้งาน admin/employee
- ใช้ `vue-markdown` หรือ render markdown เอง
- Source: ไฟล์ `.md` ใน `app/content/handbook/` (Nuxt Content) หรือ hardcode ใน component
- Sections:
  - การรับผ้า (storefront pos)
  - การขายแพ็กเกจ
  - การอัปเดตสถานะออเดอร์
  - การจัดการลูกค้า
  - FAQ

### 7.2 Acceptance
- [ ] อ่านได้ในหน้า admin
- [ ] มี table of contents
- [ ] ปริ้นได้

---

## 8. ลำดับ Priority

1. **Phase 3 — Backup/Export** ⚡ — value สูง ใช้ทุกเดือน
2. **Phase 1 — Foundation** — เป็น blocker ของ user area เฟสถัดไป
3. **Phase 2 — Employee & Member** — admin ต้องใช้บ่อย
4. **Phase 4 — Billing** — ทำเมื่อค่าจริงเปลี่ยน (เช่นขึ้นราคา)
5. **Phase 5 — Handbook** — nice to have

> ถ้าทำพร้อมกันไม่ได้ แนะนำเริ่ม Phase 3 ก่อน เพราะ standalone และ value สูงสุด

---

## 9. Notes & Constraints

- **ทุก mutation:** `requireRole(['ADMIN'])` ห้ามใช้ EMPLOYEE
- **Walk-in:** ห้ามแสดง/แก้ไขใน member/employee list
- **Self-protection:** Admin ห้ามลด role ตัวเอง / ลบบัญชีตัวเอง
- **Decimal:** Prisma Decimal → Number ก่อน return
- **Soft delete:** filter `deletedAt: null` เสมอ
- **Bangkok timezone:** ใช้ skill `/date` (manual UTC+7)
- **Skills อ้างอิง:** `/api`, `/composable`, `/ui`, `/auth`
- **Components shared** ห้ามอ้างอิง layout/route ของ admin หรือ user เด็ดขาด — ต้อง prop-driven

---

## 10. Out of Scope (ในเฟสนี้)

- Audit log — รอเฟสถัดไปตอนมี admin หลายคน
- PDF export — เริ่มจาก CSV ก่อน
- XLSX export — เริ่มจาก CSV ก่อน
- Scheduled email export — เพิ่มหลัง CSV ใช้งานจริงได้ดี
- Bulk operations (ขยายอายุกลุ่ม) — รอเฟสถัดไป
- Integration settings (slip2go key) — ตอนนี้ผ่าน env เพียงพอ
