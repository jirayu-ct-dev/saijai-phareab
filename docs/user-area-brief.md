# Brief: หน้าฝั่งลูกค้า (User Area)

> **Goal:** สร้างหน้าฝั่งลูกค้าให้ครบถ้วน รองรับทั้งลูกค้าทั่วไป (USER) และลูกค้าแพ็กเกจรายเดือน (USER + active MemberEntitlement) โดยใช้ layout แบบ sidebar คล้าย admin
>
> **Owner:** ทีม frontend
> **Branch suggest:** `feature/user-area`
> **Reference:** หน้า admin มีอยู่แล้วเป็นต้นแบบ (`app/pages/admin/**`, `app/layouts/admin.vue`)

---

## 1. กลุ่มลูกค้า

### 1.1 USER ทั่วไป (Storefront customer)
- เข้าใช้บริการแบบ "ราคาหน้าร้าน" — จ่ายต่อครั้ง
- ไม่มี `MemberEntitlement` ที่ active
- เห็นหน้าตามปกติ ไม่มี section "แพ็กเกจของฉัน"

### 1.2 Member ลูกค้าแพ็กเกจรายเดือน
- มี `MemberEntitlement` ที่ `status = ACTIVE` อย่างน้อย 1 ใบ
- เห็น section เพิ่ม: "แพ็กเกจของฉัน", "ประวัติการใช้เครดิต", สรุปเครดิตคงเหลือ/หมดอายุบน Dashboard

### 1.3 การตรวจสอบสถานะ
- ใช้ `hasActiveMemberPackage(userId)` จาก `server/utils/auth.ts` ฝั่ง server
- ฝั่ง client: ดึงจาก composable `useMemberStatus()` (ต้องสร้างใหม่ — ดูข้อ 7)

---

## 2. Layout & Sidebar

### 2.1 Layout ใหม่
- ไฟล์: `app/layouts/user.vue`
- โครงสร้างคล้าย `app/layouts/admin.vue` — sidebar ซ้าย + content ขวา + topbar
- Responsive: mobile → sidebar เป็น drawer (slide-in)
- ใช้ Nuxt UI v4 (UButton, UNavigationMenu, UAvatar, USlideover)

### 2.2 Sidebar Menu (ลูกค้าทั่วไป)
| ลำดับ | เมนู | Icon | Route |
|------|------|------|-------|
| 1 | หน้าหลัก | `i-lucide-home` | `/me` |
| 2 | ออเดอร์ของฉัน | `i-lucide-shirt` | `/me/orders` |
| 3 | ใบเสร็จ | `i-lucide-receipt` | `/me/receipts` |
| 4 | ซื้อแพ็กเกจ | `i-lucide-package-plus` | `/me/packages` |
| 5 | ตั้งค่า | `i-lucide-settings` | `/me/settings` |

### 2.3 Sidebar Menu (ลูกค้าแพ็กเกจ — เพิ่ม)
| ลำดับ | เมนู | Icon | Route |
|------|------|------|-------|
| - | แพ็กเกจของฉัน | `i-lucide-crown` | `/me/membership` |
| - | ประวัติการใช้เครดิต | `i-lucide-history` | `/me/membership/usage` |

> **Note:** เมนู "แพ็กเกจของฉัน" ปรากฏเฉพาะลูกค้า Member เท่านั้น (เช็ค `useMemberStatus()`)

### 2.4 Topbar
- โลโก้ร้าน + ชื่อร้าน (ดึงจาก `useShopSettings()`)
- ขวาบน: avatar + dropdown (ข้อมูลส่วนตัว, ตั้งค่า, ออกจากระบบ)
- บน mobile: ปุ่ม hamburger เปิด sidebar drawer

---

## 3. หน้า (Pages)

### 3.1 `/me` — Dashboard
**ลูกค้าทั่วไป:**
- การ์ดสรุป: จำนวนออเดอร์รวม, ยอดที่ใช้รวม, ออเดอร์ที่กำลังดำเนินการ
- รายการออเดอร์ล่าสุด 5 รายการ (พร้อม badge สถานะ)
- ปุ่ม CTA "ดูออเดอร์ทั้งหมด" → `/me/orders`
- ปุ่ม CTA "ซื้อแพ็กเกจรายเดือน" (ถ้ายังไม่เคยมี) → `/me/packages`

**ลูกค้าแพ็กเกจ — เพิ่มด้านบน:**
- การ์ดเด่น "แพ็กเกจของฉัน" — ชื่อแพ็กเกจ, เครดิตคงเหลือ/รวม (progress bar), หมดอายุ, ปุ่ม "ใช้บริการ"
- ถ้าใกล้หมดอายุ (< 7 วัน) — แสดง warning banner

### 3.2 `/me/orders` — รายการออเดอร์
- ตาราง/list ของ ServiceOrder ที่ `customerId = me.id`
- Filter: สถานะ (ทั้งหมด/รับผ้าแล้ว/กำลังซัก/พร้อมส่ง/เสร็จสิ้น/ยกเลิก), ช่วงเวลา
- คอลัมน์: เลขรับผ้า, วันที่รับ, จำนวนชิ้น, สถานะ (badge), ยอดรวม, ปุ่มดูรายละเอียด
- รองรับ pagination (10/หน้า)

### 3.3 `/me/orders/[id]` — รายละเอียดออเดอร์
- ข้อมูลออเดอร์: เลขรับผ้า, วันที่รับ, นัดรับ/วันที่ส่ง, สถานะ
- รายการผ้า + รูปผ้า + รูปผ้าชำรุด (ถ้ามี)
- รายการบริการ + ราคา (ถ้าเป็น storefront pricing) หรือ "ใช้แพ็กเกจ" (ถ้าใช้เครดิต)
- ค่าไม้แขวน, ส่วนลด, ยอดสุทธิ
- ถ้าสถานะ `COMPLETED` — แสดงรูปหลักฐานการส่ง
- ปุ่ม "ดูใบเสร็จ" → `/me/receipts/{paymentId}`

### 3.4 `/me/receipts` — รายการใบเสร็จ
- รวมทั้ง package sale + service order payment ที่ user เป็นเจ้าของ
- คอลัมน์: เลขที่บิล, ประเภท (ขายแพ็กเกจ/บริการซักผ้า), วันที่, ยอด, ปุ่มดู

### 3.5 `/me/receipts/[id]` — ใบเสร็จ
- ใช้ component `ThermalSlip` เหมือน `/admin/payment/[id]/receipt` (อ่าน skill `/thermal`)
- มีปุ่มพิมพ์ + ดาวน์โหลด PNG
- ใบเสร็จสำหรับ "ใบแจ้งการใช้บริการ" (ลูกค้าแพ็กเกจ-ฟรี) ใช้ template เดียวกัน

### 3.6 `/me/packages` — เลือกซื้อแพ็กเกจ (ทุก user)
- แสดง catalog ของ `PackageProduct` ที่ `isActive = true`
- แยก section: แพ็กเกจหลัก (MAIN) / แพ็กเกจเสริม (ADDON)
- การ์ดแต่ละแพ็กเกจ: ชื่อ, ราคา, จำนวนเครดิต, อายุการใช้งาน, ปุ่ม "ซื้อแพ็กเกจนี้"
- ปุ่ม "ซื้อ" → modal/page ให้เลือกช่องทางชำระ (เงินสด → ไปร้าน, โอน → อัปโหลดสลิป) แล้ว POST `/api/me/package-purchases` (API ต้องสร้างใหม่)

### 3.7 `/me/membership` — แพ็กเกจของฉัน (เฉพาะ Member)
- ลิสต์ของ `MemberEntitlement` ทั้งหมด แยก ACTIVE / EXPIRED / SUSPENDED / CANCELLED
- การ์ดแต่ละใบ: ชื่อแพ็กเกจ, เครดิตคงเหลือ/รวม (progress bar), วันเริ่ม, วันหมดอายุ, ที่มา (sale id link)
- ถ้า ACTIVE: ปุ่ม "ดูประวัติการใช้เครดิต"

### 3.8 `/me/membership/usage` — ประวัติการใช้เครดิต (เฉพาะ Member)
- ตารางเหมือน "สรุปการใช้บริการ" บนใบเสร็จ
- เลือก entitlement ที่ต้องการดู (dropdown ถ้ามีหลายใบ)
- คอลัมน์: ครั้งที่, วันที่ใช้บริการ, เลขรับผ้า, จำนวน(ชิ้น)
- สรุปด้านล่าง: ใช้ไปแล้ว / คงเหลือ / หมดอายุ

### 3.9 `/me/settings` — ตั้งค่า (sub-pages)
หน้านี้มี nested tab/sub-sidebar:

#### 3.9.1 `/me/settings/profile` — ข้อมูลส่วนตัว
- แก้ชื่อ, เบอร์โทร, รูป profile
- แสดงอีเมล (read-only)
- ถ้า login ด้วย LINE — แสดง "ผูกบัญชี LINE แล้ว" + LINE userId (มาสก์)

#### 3.9.2 `/me/settings/notification` — การแจ้งเตือน
- **มีอยู่แล้ว** ที่ `app/pages/settings/notification.vue` → ย้ายมาที่ `/me/settings/notification`
- Toggle รับ LINE notification (`User.lineNotifyEnabled`)
- ถ้ายังไม่ผูก LINE — แสดง warning + ปุ่มเชื่อมบัญชี

#### 3.9.3 `/me/settings/security` — ความปลอดภัย
- เปลี่ยนรหัสผ่าน (เฉพาะ user ที่ login ด้วย email/password)
- ผูก/ยกเลิกบัญชี LINE
- รายการ session ที่ active (ออกจากระบบทุกอุปกรณ์)

#### 3.9.4 `/me/settings/addresses` — ที่อยู่
- จัดการ `UserAddress` (เพิ่ม/แก้/ลบ/ตั้ง default)
- ใช้สำหรับบริการรับ-ส่งผ้าในอนาคต

---

## 4. State / Composables ที่ต้องสร้าง

| Composable | หน้าที่ |
|-----------|--------|
| `useMemberStatus()` | เช็คว่า user เป็น Member หรือไม่ + คืน active entitlements |
| `useMyOrders()` | fetch + cache ServiceOrder ของ user (filter, pagination) |
| `useMyReceipts()` | fetch + cache PaymentRecord ของ user |
| `useMyMembership()` | fetch MemberEntitlement ของ user (ACTIVE/HISTORICAL) |
| `useMyPackagePurchase()` | สร้าง package purchase request (slip upload) |
| `useUserAddresses()` | CRUD ที่อยู่ |
| `useShopSettings()` (public) | ข้อมูลร้าน (ชื่อ, โลโก้, เบอร์, QR LINE) สำหรับ topbar/footer |

> ดู skill `/composable` สำหรับ pattern

---

## 5. API ที่ต้องสร้าง (server)

### 5.1 GET endpoints
- `GET /api/me` — ข้อมูล user ตัวเอง + active entitlements + stats
- `GET /api/me/orders` — list ServiceOrder (filter: status, page, pageSize)
- `GET /api/me/orders/[id]` — รายละเอียด order ตัวเอง
- `GET /api/me/receipts` — list payments ตัวเอง
- `GET /api/me/receipts/[id]` — ใบเสร็จ (re-use `/api/admin/payments/[id]/receipt` แต่บังคับให้ user เห็นเฉพาะของตัวเอง — สร้าง endpoint ใหม่)
- `GET /api/me/membership` — list MemberEntitlement
- `GET /api/me/membership/[id]/usage` — usage history ของ entitlement
- `GET /api/me/addresses` — list addresses
- `GET /api/public/packages` — catalog (มีอยู่แล้วที่ `/api/public/packages`)
- `GET /api/public/shop-settings` — ข้อมูลร้านแบบ public (ต้องสร้าง)

### 5.2 POST/PUT/DELETE
- `POST /api/me/package-purchases` — สร้างคำสั่งซื้อแพ็กเกจ (status PENDING, รอ verify)
- `PUT /api/me/profile` — แก้ชื่อ/เบอร์/รูป
- `PUT /api/me/notification-preferences` — **มีแล้ว** (ที่ `/api/me/notification-preferences.put.ts`)
- `POST/PUT/DELETE /api/me/addresses[/[id]]` — CRUD addresses

### 5.3 Authorization
- ทุก endpoint ใช้ `requireUser(event)` (ไม่ต้อง role check) แล้ว filter `where: { userId: actor.id }` หรือ customerId
- **ห้ามให้** user เห็นข้อมูล user อื่น — เช็ค ownership ทุก endpoint
- ดู skill `/api`

---

## 6. Middleware

- `app/middleware/role-user.ts` (ใหม่): ถ้าเป็น ADMIN/EMPLOYEE → redirect `/admin`
- `app/middleware/role-member.ts` (มีแล้ว): ใช้กับหน้า `/me/membership/**` เพื่อกัน user ทั่วไป

```ts
// pages/me/membership/index.vue
definePageMeta({
  layout: "user",
  middleware: ["role-member"],
});
```

---

## 7. UI/UX Guidelines

- **โทน:** เป็นมิตร, ใช้ภาษาไทย, มี emoji ประปราย (อิงจาก flex message style)
- **สี:**
  - ลูกค้าทั่วไป: primary (น้ำเงิน/เขียวตาม theme)
  - Member: เพิ่ม accent เหลือง/ทอง สำหรับการ์ดแพ็กเกจ
  - Status badges: ใช้สีเดียวกับใน `notify.ts` (`statusColors`)
- **Loading:** ใช้ `USkeleton` ขณะ fetch
- **Empty state:** ทุก list ต้องมี empty state พร้อมรูป + ข้อความ + CTA
- **Error:** ใช้ `useNotify().serverError()` เสมอ ห้ามใช้ alert
- ดู skill `/ui` สำหรับ pattern

---

## 8. ลำดับงาน (Recommended Phasing)

### Phase 1 — Foundation (sprint 1)
1. Layout `user.vue` + sidebar + topbar + middleware `role-user`
2. Composable `useMemberStatus`, `useShopSettings` (public)
3. หน้า `/me` (Dashboard) — version แรก แสดงเฉพาะการ์ดสรุปง่าย ๆ
4. หน้า `/me/settings/profile` + `/me/settings/notification` (ย้ายของเดิมมา)

### Phase 2 — Orders & Receipts (sprint 2)
5. API `GET /api/me/orders`, `GET /api/me/orders/[id]`, `GET /api/me/receipts`, `GET /api/me/receipts/[id]`
6. หน้า `/me/orders`, `/me/orders/[id]`, `/me/receipts`, `/me/receipts/[id]`

### Phase 3 — Membership (sprint 3)
7. Composable `useMyMembership`
8. API + หน้า `/me/membership`, `/me/membership/usage`
9. ปรับ Dashboard `/me` ให้แสดงการ์ดแพ็กเกจสำหรับ Member

### Phase 4 — Package Purchase (sprint 4)
10. API `POST /api/me/package-purchases` (status PENDING + slip upload)
11. หน้า `/me/packages` + flow ซื้อ + รอ verify

### Phase 5 — Addresses & Security (sprint 5)
12. CRUD `/me/settings/addresses`
13. `/me/settings/security` (เปลี่ยนรหัส, ผูก LINE, sessions)

---

## 9. Notes & Constraints

- **Walk-in customer:** ห้ามให้ login จากบัญชี `walkin@saijai.local` เข้าหน้านี้
- **LIFF:** หน้านี้ต้องใช้งานได้ทั้งใน browser ปกติและ LINE LIFF (เช็ค skill `/auth`)
- **Bangkok timezone:** ทุกการแสดงวันที่ใช้ skill `/date` (manual UTC+7)
- **Soft delete:** filter `deletedAt: null` ทุก query
- **Decimal:** แปลง Prisma Decimal → Number ก่อน return (`Number(value)`)
- **No window.alert/confirm:** ใช้ `useNotify()` หรือ `UModal` แทนเสมอ

---

## 10. Acceptance Criteria

- [ ] Login เป็น USER แล้วเข้า `/` → redirect เข้า `/me` อัตโนมัติ (หรือใช้ middleware)
- [ ] Sidebar แสดงเมนูต่างกันระหว่างลูกค้าทั่วไป vs Member
- [ ] ลูกค้าทั่วไปเห็นหน้า `/me/membership/**` ไม่ได้ (redirect)
- [ ] ทุกหน้ามี loading state + empty state
- [ ] Mobile: sidebar เป็น drawer, layout responsive
- [ ] ทุก API filter ด้วย `userId/customerId = actor.id` (ห้ามรั่วข้อมูล user อื่น)
- [ ] หน้า notification settings ย้ายไป `/me/settings/notification` แล้ว
- [ ] Lint + typecheck ผ่าน
