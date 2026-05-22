# Brief: Member Portal (หน้าฝั่งสมาชิก)

> **Goal:** ออกแบบ UX/UI + API ฝั่งลูกค้าที่สมัครเข้าระบบ ให้ติดตามสถานะออเดอร์, ดูบัญชีแพ็กเกจ, และบริหารข้อมูลส่วนตัวได้ด้วยตัวเอง
>
> **Owner:** ทีม frontend + backend
> **Branch suggest:** `feature/member-portal`
> **อ้างอิง:** `user-area-brief.md` (โครงสร้างหน้า), `admin-settings-brief.md` (shared components)

---

## 1. กลุ่มผู้ใช้และสิทธิ์

| กลุ่ม | เงื่อนไข | สิ่งที่เห็น |
|-------|---------|-----------|
| **USER ทั่วไป** | ไม่มี `MemberEntitlement` ที่ ACTIVE | Dashboard, Orders, Receipts, Packages (ซื้อได้), Settings |
| **Member** | มี `MemberEntitlement` status=ACTIVE ≥ 1 | เพิ่ม: การ์ดแพ็กเกจ, `/me/membership`, `/me/membership/usage` |

> Walk-in (`walkin@saijai.local`) — ห้าม login เข้าหน้านี้

---

## 2. หน้าหลักที่ต้องสร้าง

### 2.1 `/me` — Dashboard (รูปแบบเดียวกับ Admin Dashboard)

> ✅ **Implemented** — ใช้โครงสร้าง component แยกเหมือน `app/components/admin/dashboard/`

**Layout:** `UDashboardPanel` → Navbar + Toolbar (DateRangePicker + PeriodSelect) + Body

**Components (`app/components/me/dashboard/`):**

| Component | คำอธิบาย |
|-----------|---------|
| `MeDashboardStats` | การ์ดสรุป 4 ใบ: ออเดอร์ทั้งหมด / กำลังดำเนินการ / เสร็จสิ้น / ยอดใช้จ่ายรวม + variation % |
| `MeDashboardChart` | กราฟเส้นยอดใช้จ่ายของฉัน (Line + Area chart) |
| `MeDashboardOrderStatusChart` | Grouped bar chart แยกตามสถานะ (รับผ้าแล้ว/กำลังซัก/เสร็จสิ้น) |
| `MeDashboardRecentOrders` | ตาราง UTable ออเดอร์ล่าสุด 5 รายการ + badge สถานะ |
| `MeDashboardRecentPayments` | ตาราง UTable ชำระเงินล่าสุด 8 รายการ |
| `MeDashboardMembershipCard` | การ์ดแพ็กเกจ (เฉพาะ Member) + progress bar เครดิต + warning < 7 วัน |
| `MeDashboardDateRangePicker` | เลือกช่วงวันที่ (copy จาก admin) |
| `MeDashboardPeriodSelect` | เลือก period รายวัน/สัปดาห์/เดือน (copy จาก admin) |

**API Endpoints (`server/api/me/dashboard/`):**

| Endpoint | คำอธิบาย |
|----------|---------|
| `GET /api/me/dashboard/stats?from=&to=` | Stats + variation % (filter customerId = me) |
| `GET /api/me/dashboard/chart?from=&to=` | กราฟยอดใช้จ่าย bucketed by day (Bangkok TZ) |
| `GET /api/me/dashboard/order-statuses?from=&to=` | ออเดอร์แยกตามสถานะ bucketed by day |
| `GET /api/me/dashboard/recent-payments` | ชำระเงินล่าสุด 8 รายการ |

**Member เพิ่มด้านบน:**
- การ์ดใหญ่ "แพ็กเกจของฉัน" (`MeDashboardMembershipCard`) — ชื่อแพ็กเกจ + progress bar เครดิต + วันหมดอายุ
- Warning banner ถ้าเหลือ < 7 วัน
- CTA "ดูประวัติการใช้งาน" → `/me/membership/usage`

---

### 2.2 `/me/orders` — รายการออเดอร์

**แสดงข้อมูล:**
| คอลัมน์ | ที่มา DB |
|---------|---------|
| เลขรับผ้า (ORD-xxx) | `ServiceOrder.orderNo` |
| วันที่รับ | `ServiceOrder.receivedAt` |
| จำนวนชิ้น | count `serviceOrderItems` |
| สถานะ | `ServiceOrder.status` (badge) |
| ยอดรวม | `ServiceOrder.totalAmount` |
| ดูรายละเอียด | → `/me/orders/[id]` |

**Filter:** สถานะ (ทั้งหมด / RECEIVED / PROCESSING / DELIVERING / COMPLETED / CANCELLED), ช่วงวันที่
**Pagination:** 10 รายการ/หน้า

---

### 2.3 `/me/orders/[id]` — รายละเอียดออเดอร์ ⭐ (Order Tracking)

นี่คือหน้าหลักสำหรับ **ติดตามสถานะ**

#### 2.3.1 Order Status Timeline
```
● รับผ้าแล้ว  ●─── กำลังซัก ───●─── พร้อมส่ง ───●─── เสร็จสิ้น
  (RECEIVED)      (PROCESSING)      (DELIVERING)    (COMPLETED)
```
- แสดงวันเวลาที่ step นั้นเกิดขึ้น (ถ้ามี)
- Step ปัจจุบัน: highlight สีหลัก
- Step ที่ยังไม่ถึง: สีเทา

#### 2.3.2 ข้อมูลออเดอร์
- เลขรับผ้า, วันรับ, นัดรับ/ส่ง (`dueAt`)
- พนักงานที่รับผ้า (`employee.name`) — ถ้ามี
- หมายเหตุ (`note`)
- รูปผ้า (`image`) + รูปผ้าชำรุด (`serviceOrderItems[].photos` ที่ `isDamaged=true`)

#### 2.3.3 รายการบริการ
- ชื่อบริการ + ประเภทผ้า
- ราคา/ชิ้น × จำนวน = รวม (ถ้าเป็น storefront)
- หรือ "ใช้เครดิตแพ็กเกจ" (ถ้า `isPackageIncluded=true`)
- ค่าไม้แขวน (`hangerCharge`)
- ส่วนลด + ยอดสุทธิ

#### 2.3.4 หลักฐานการส่ง
- ถ้า status=COMPLETED: แสดงรูป `deliveryImage`
- ปุ่ม "ดูใบเสร็จ" → `/me/receipts/[paymentId]`

---

### 2.4 `/me/receipts` — รายการใบเสร็จ

รวมทั้ง PackageSale payment และ ServiceOrder payment ที่ `userId = actor.id`

| คอลัมน์ | รายละเอียด |
|---------|-----------|
| เลขที่บิล | `PaymentRecord.paymentNo` |
| ประเภท | "ขายแพ็กเกจ" / "บริการซักผ้า" |
| วันที่ | `PaymentRecord.paidAt` |
| ยอด | `PaymentRecord.amount` |
| ดู | → `/me/receipts/[id]` |

---

### 2.5 `/me/receipts/[id]` — ใบเสร็จ

- ใช้ `ThermalSlip` component เดียวกับ admin
- ปุ่ม: พิมพ์ + ดาวน์โหลด PNG
- ลูกค้าแพ็กเกจ: ใบบริการฟรี ใช้ template เดิมแต่แสดง "ใช้เครดิต" แทนยอดเงิน

---

### 2.6 `/me/packages` — เลือกซื้อแพ็กเกจ

- แสดง catalog `PackageProduct` ที่ `isActive=true`
- แยก Section: **แพ็กเกจหลัก (MAIN)** / **แพ็กเกจเสริม (ADDON)**
- การ์ดแต่ละแพ็กเกจ:
  - ชื่อ + คำอธิบาย
  - ราคา (บาท)
  - เครดิต (ครั้ง) + อายุการใช้งาน (วัน)
  - ปุ่ม "ซื้อแพ็กเกจนี้"

**Flow การซื้อ:**
```
กดซื้อ → Modal เลือกวิธีชำระ → [เงินสด: แจ้งให้ไปที่ร้าน] / [โอน: อัปโหลดสลิป]
→ POST /api/me/package-purchases (status=PENDING) → แจ้ง admin ยืนยัน
```

> ลูกค้าอัปโหลดสลิป → admin verify → เครดิตเข้าอัตโนมัติ

---

### 2.7 `/me/membership` — แพ็กเกจของฉัน *(เฉพาะ Member)*

- ลิสต์ `MemberEntitlement` แยก Tab: **กำลังใช้งาน (ACTIVE)** / **หมดอายุ/ยกเลิก**
- การ์ดแต่ละใบ:
  - ชื่อแพ็กเกจ (`product.name`)
  - Progress bar: เครดิตคงเหลือ / เครดิตเริ่มต้น (`creditRemaining / creditInitial`)
  - วันเริ่ม (`startAt`) — วันหมดอายุ (`endAt`)
  - สถานะ badge (ACTIVE=เขียว / SUSPENDED=เหลือง / EXPIRED=เทา / CANCELLED=แดง)
  - ปุ่ม "ดูประวัติการใช้งาน" (เฉพาะ ACTIVE)

---

### 2.8 `/me/membership/usage` — ประวัติการใช้เครดิต *(เฉพาะ Member)*

- Dropdown เลือก entitlement (ถ้ามีหลายใบ)
- ตารางการใช้บริการ:

| ครั้งที่ | วันที่ | เลขรับผ้า | จำนวนชิ้น | เครดิตที่ใช้ |
|--------|------|---------|---------|-----------|
| 1 | 1 พ.ค. 68 | ORD-0001 | 5 ชิ้น | 1 ครั้ง |

- สรุปด้านล่าง: ใช้ไปแล้ว / คงเหลือ / หมดอายุ

---

### 2.9 `/me/settings/*` — ตั้งค่า

| Sub-page | เส้นทาง | รายละเอียด |
|---------|--------|-----------|
| ข้อมูลส่วนตัว | `/me/settings/profile` | ชื่อ, เบอร์, รูป profile, LINE status |
| การแจ้งเตือน | `/me/settings/notification` | Toggle LINE notify (`lineNotifyEnabled`) |
| ความปลอดภัย | `/me/settings/security` | เปลี่ยนรหัส, ผูก LINE, Active sessions |
| ที่อยู่ | `/me/settings/addresses` | CRUD `UserAddress` สำหรับรับ-ส่งผ้าในอนาคต |

---

## 3. ฟีเจอร์เพิ่มเติมที่แนะนำ

### 3.1 🔔 การแจ้งเตือน Push / LINE

ระบบมี `NotificationSubscriber` + `lineNotifyEnabled` แล้ว ควรเพิ่ม:
- แจ้งเตือนผ่าน LINE เมื่อสถานะออเดอร์เปลี่ยน (RECEIVED → PROCESSING → DELIVERING → COMPLETED)
- แจ้งเตือนเมื่อแพ็กเกจ **เหลือ < 3 ครั้ง** หรือ **ใกล้หมดอายุ < 7 วัน**
- แจ้งเตือนเมื่อ admin **ยืนยันการซื้อแพ็กเกจ** (PENDING → ACTIVE)

> ✅ Infrastructure มีอยู่แล้ว เพิ่มแค่ trigger ที่เหมาะสม

---

### 3.2 ⭐ รีวิว/ประเมินความพึงพอใจ

หลังออเดอร์ status=COMPLETED ให้แสดง:
- popup ง่าย ๆ: "พอใจบริการวันนี้ไหม? ⭐⭐⭐⭐⭐"
- Rating 1-5 ดาว + ช่องข้อความ (optional)
- เก็บใน `ServiceOrderReview` (schema ใหม่)
- Admin ดูได้ใน dashboard summary

**Schema เพิ่ม:**
```prisma
model ServiceOrderReview {
  id             String       @id @default(cuid())
  serviceOrderId String       @unique
  serviceOrder   ServiceOrder @relation(...)
  customerId     String
  rating         Int          // 1-5
  comment        String?
  createdAt      DateTime     @default(now())

  @@map("service_order_review")
}
```

---

### 3.3 📦 การนัดรับ-ส่งผ้า (Delivery Request)

ใช้ `UserAddress` ที่มีอยู่แล้ว + เพิ่ม:
- ลูกค้าส่งคำขอนัดรับผ้าล่วงหน้าได้
- เลือกวันเวลา + ที่อยู่จาก address book
- Admin/Employee เห็น request ใน dashboard และยืนยัน

**Schema เพิ่ม:**
```prisma
enum PickupRequestStatus {
  PENDING
  CONFIRMED
  COMPLETED
  CANCELLED
}

model PickupRequest {
  id          String              @id @default(cuid())
  customerId  String
  customer    User                @relation(...)
  addressId   String?
  address     UserAddress?        @relation(...)
  requestedAt DateTime
  note        String?
  status      PickupRequestStatus @default(PENDING)
  confirmedById String?
  createdAt   DateTime            @default(now())
  updatedAt   DateTime            @updatedAt

  @@map("pickup_request")
}
```

---

### 3.4 💬 แจ้งปัญหา / ติดต่อร้าน (Support)

- ปุ่ม "แจ้งปัญหา" ในหน้า order detail
- แบบฟอร์มง่าย ๆ: เลือกประเภทปัญหา + ข้อความ
- ส่งแจ้งเตือน LINE ให้ admin
- ประเภทปัญหา: ผ้าสูญหาย / ผ้าชำรุด / ยังไม่ได้รับผ้า / อื่น ๆ

---

### 3.5 🎁 Loyalty / ประวัติคะแนน (เฟสถัดไป)

- สะสมคะแนนจากยอดใช้จ่าย (1 บาท = 1 แต้ม)
- แลกส่วนลด หรือแลก addon
- แสดงใน Dashboard เป็นการ์ด "แต้มสะสม"

> ⚠️ Schema ต้องเพิ่ม `LoyaltyPoint` — เก็บเป็น future roadmap

---

## 4. API ที่ต้องสร้าง

### 4.1 GET — ดึงข้อมูล

| Endpoint | รายละเอียด |
|---------|-----------|
| `GET /api/me` | ข้อมูลตัวเอง + active entitlements + stats สรุป |
| `GET /api/me/orders` | list ServiceOrder (filter: status, page, pageSize) |
| `GET /api/me/orders/[id]` | รายละเอียด order + items + images + timeline |
| `GET /api/me/receipts` | list PaymentRecord ทั้ง package + service |
| `GET /api/me/receipts/[id]` | ข้อมูลใบเสร็จ (ownership check) |
| `GET /api/me/membership` | list MemberEntitlement ทั้งหมด |
| `GET /api/me/membership/[id]/usage` | ServiceOrder ที่ใช้ entitlement นั้น |
| `GET /api/me/addresses` | list UserAddress |
| `GET /api/public/packages` | catalog PackageProduct (มีอยู่แล้ว) |
| `GET /api/public/shop-settings` | ชื่อร้าน, โลโก้, เบอร์ (สร้างใหม่) |

### 4.2 POST/PUT/DELETE

| Endpoint | รายละเอียด |
|---------|-----------|
| `POST /api/me/package-purchases` | สร้างคำสั่งซื้อ (status=PENDING + slip upload) |
| `PUT /api/me/profile` | แก้ชื่อ, เบอร์, รูป |
| `PUT /api/me/notification-preferences` | ✅ มีแล้ว |
| `POST /api/me/addresses` | เพิ่มที่อยู่ |
| `PUT /api/me/addresses/[id]` | แก้ที่อยู่ |
| `DELETE /api/me/addresses/[id]` | ลบที่อยู่ |
| `POST /api/me/orders/[id]/review` | ส่งรีวิว (ถ้าทำ 3.2) |
| `POST /api/me/pickup-requests` | นัดรับผ้า (ถ้าทำ 3.3) |

### 4.3 Authorization Rules

```ts
// ทุก endpoint ใน /api/me/**
const actor = await requireUser(event)            // ต้อง login แล้วเท่านั้น
where: { customerId: actor.id }                   // กัน cross-user data leak
if (record.customerId !== actor.id) throw403()    // ownership check ทุกครั้ง
```

---

## 5. Order Status Timeline — Logic

สถานะใน `ServiceOrderStatus`:

| Status | ภาษาไทย | Badge สี | Icon |
|--------|--------|---------|------|
| `RECEIVED` | รับผ้าแล้ว | น้ำเงิน | `i-lucide-package` |
| `PROCESSING` | กำลังซัก/รีด | เหลือง | `i-lucide-loader` |
| `DELIVERING` | พร้อมส่ง/กำลังส่ง | ม่วง | `i-lucide-truck` |
| `COMPLETED` | เสร็จสิ้น | เขียว | `i-lucide-check-circle` |
| `CANCELLED` | ยกเลิก | แดง | `i-lucide-x-circle` |

**Timeline logic:**
```ts
const STEPS = ['RECEIVED', 'PROCESSING', 'DELIVERING', 'COMPLETED']
const currentIdx = STEPS.indexOf(order.status)
// step < currentIdx = completed (✅)
// step = currentIdx = active (🔵 pulse)
// step > currentIdx = pending (⚪)
// CANCELLED = แสดง X ที่ step ที่หยุด
```

---

## 6. Composables ที่ต้องสร้าง

| Composable | หน้าที่ |
|-----------|--------|
| `useMemberStatus()` | เช็ค active entitlement + cache |
| `useMyOrders(filter)` | fetch + filter + pagination |
| `useMyOrderDetail(id)` | รายละเอียด order + items |
| `useMyReceipts()` | fetch receipts ทั้ง type |
| `useMyMembership()` | fetch entitlements |
| `useMyMembershipUsage(entitlementId)` | usage history |
| `useMyPackagePurchase()` | flow ซื้อแพ็กเกจ + slip upload |
| `useUserAddresses()` | CRUD addresses |
| `useShopSettings()` | ข้อมูลร้านแบบ public (topbar/footer) |

---

## 7. UI/UX Guidelines

- **โทน:** เป็นมิตร, ภาษาไทย, emoji ประปราย 🧺👕✨
- **สี Member:** เพิ่ม accent ทอง/เหลือง (`amber-400`) บนการ์ดแพ็กเกจ
- **Status badge:** ใช้สีตาม `statusColors` จาก `notify.ts` เดิม
- **Loading:** `USkeleton` ทุกหน้า
- **Empty state:** ทุก list → รูป + ข้อความ + CTA (เช่น "ยังไม่มีออเดอร์ → เริ่มใช้บริการ")
- **Error:** `useNotify().serverError()` ห้ามใช้ `alert()`
- **Responsive:** Mobile-first, sidebar เป็น drawer บน mobile

---

## 8. ลำดับ Priority (Phasing)

### Phase 1 — Order Tracking (sprint 1) ⚡ Priority สูงสุด
1. Layout `user.vue` + sidebar + middleware `role-user`
2. `GET /api/me/orders`, `GET /api/me/orders/[id]`
3. หน้า `/me/orders` + `/me/orders/[id]` พร้อม Status Timeline
4. Composable `useMemberStatus`, `useMyOrders`, `useMyOrderDetail`

### Phase 2 — Dashboard & Account (sprint 2)
5. `GET /api/me` (stats)
6. หน้า `/me` Dashboard
7. `/me/settings/profile` + `/me/settings/notification` (ย้ายของเดิม)

### Phase 3 — Membership (sprint 3)
8. `GET /api/me/membership`, `GET /api/me/membership/[id]/usage`
9. หน้า `/me/membership` + `/me/membership/usage`
10. ปรับ Dashboard แสดงการ์ดแพ็กเกจสำหรับ Member

### Phase 4 — Receipts & Packages (sprint 4)
11. `GET /api/me/receipts`, `GET /api/me/receipts/[id]`
12. หน้า `/me/receipts` + `/me/receipts/[id]`
13. `POST /api/me/package-purchases` + หน้า `/me/packages`

### Phase 5 — Review & Delivery (sprint 5)
14. หน้า `/me/settings/security` + `/me/settings/addresses`
15. ระบบรีวิว (3.2) + แจ้งปัญหา (3.4)
16. Pickup Request (3.3) — ถ้าร้านต้องการรับ-ส่ง

---

## 9. Acceptance Criteria

- [ ] Login เป็น USER → เข้า `/me` ได้ (ADMIN/EMPLOYEE → redirect `/admin`)
- [ ] เห็น Order timeline พร้อม step ปัจจุบัน highlight ถูกต้อง
- [ ] Member เห็นการ์ดแพ็กเกจ + progress bar เครดิต
- [ ] USER ทั่วไปเข้า `/me/membership/**` ไม่ได้ (middleware block)
- [ ] ทุก API filter `customerId = actor.id` — ข้อมูลไม่รั่ว
- [ ] Mobile: sidebar เป็น drawer, ทุกหน้า responsive
- [ ] ทุก list มี loading state (skeleton) + empty state
- [ ] ใบเสร็จสั่งพิมพ์ได้
- [ ] Lint + typecheck ผ่าน

---

## 10. Notes & Constraints

- **Bangkok timezone:** วันที่ทุกหน้าใช้ UTC+7 (skill `/date`)
- **Soft delete:** filter `deletedAt: null` ทุก query
- **Decimal:** Prisma Decimal → `Number(value)` ก่อน return
- **Walk-in:** ห้ามให้ login (`isWalkIn=true` / email walkin@saijai.local)
- **LIFF:** ต้องใช้งานได้ทั้ง browser ปกติและ LINE LIFF
- **Shared components:** `ProfileForm`, `PasswordChangeForm`, `ActiveSessionsList` ใช้ร่วมกับ admin (ดู `admin-settings-brief.md` ข้อ 2)
- **Skills อ้างอิง:** `/api`, `/composable`, `/ui`, `/auth`, `/thermal`

---

## 11. Out of Scope (เฟสนี้)

- Loyalty/คะแนนสะสม — เฟสถัดไป (ต้องออกแบบ schema ใหม่)
- Online Payment (PromptPay QR auto-verify) — รอ integrate payment gateway
- Multi-language (EN/TH) — ใช้ภาษาไทยอย่างเดียวก่อน
- Push Notification (Web Push) — ใช้ LINE notify ก่อน
- Order cancellation by user — ให้โทรแจ้งร้านก่อน (เพิ่มเฉพาะกรณีต้องการ)
