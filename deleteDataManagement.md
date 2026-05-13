
## Prompt for Codex — Deleted Data Management

build /admin/settings/deleted-data — "ถังขยะ" จัดการข้อมูล soft-deleted ทั้งระบบ

### Current walk-in customer logic (ห้ามแก้)
- `walkin@saijai.local` — system user ห้ามลบ/แก้ไข
- `server/utils/walkInCustomer.ts` — `ensureWalkInCustomer()`, `isWalkInCustomerEmail()`
- `ServiceOrder.isWalkIn`, `walkInName`, `walkInPhone` — ข้อมูลลูกค้าหน้าร้านอยู่บน order

### UI: /admin/settings/deleted-data

```
┌─────────────────────────────────────────────────┐
│ 🗑️ จัดการข้อมูลที่ถูกลบ                          │
│ [▼ ประเภท: ทั้งหมด]  [🔍 ค้นหา]  [1-20 / 47]   │
├─────────────────────────────────────────────────┤
│ 👤 สมชาย ใจดี                    user           │
│    somchai@email.com                            │
│    ถูกลบ 14 พ.ค. 09:30 โดย Admin               │
│    [🔄 กู้คืน]              [⚠️ ลบถาวร]          │
├─────────────────────────────────────────────────┤
│ 🧺 Order #SO-20260514-001        service_order  │
│    ลูกค้าหน้าร้าน (walk-in) | ยอด 350 บาท        │
│    ถูกลบ 14 พ.ค. 08:15 โดย Employee            │
│    [🔄 กู้คืน]              [⚠️ ลบถาวร]          │
├─────────────────────────────────────────────────┤
│ « 1  2  3 ... 5 »                              │
└─────────────────────────────────────────────────┘
```

Filter types: ทั้งหมด, user, service_order, package_sale, payment_record, member_entitlement, storefront_price

### API Endpoints

*1. GET /api/admin/deleted
Query: `?type=user&search=สมชาย&page=1&limit=20`
Returns paginated list of deleted records across types.
Exclude `walkin@saijai.local` user from results.

2. POST /api/admin/deleted/:id/restore
Body: `{ type: "user"|"service_order"|... }`
Sets deletedAt=null, deletedById=null. Returns restored record.
Block restore of `walkin@saijai.local`.

3. DELETE /api/admin/deleted/:id*
Body: `{ type: "user"|"service_order"|... }`
Hard delete — permanent. BLOCK `walkin@saijai.local`.

### Cascade Hard Delete Chains

```
type: user
  cascade: sessions → accounts → serviceOrders(↓) → paymentRecords
          → memberEntitlements → packageSales(↓) → images → addresses
  (ห้าม walkin@saijai.local)

type: service_order
  cascade: serviceOrderItems → photos → payments
  (ไม่แตะ user — แม้จะเป็น walkin@saijai.local ก็ตาม)

type: package_sale
  cascade: packageSaleItems → payments → memberEntitlements

type: payment_record
  cascade: paymentAuditLogs → slipImage

type: member_entitlement
  cascade: expiryNotifications → payments → serviceOrders(update null)
```

### Hard Delete Confirmation Flow (3 จังหวะ)

```
จังหวะ 1 — กด [⚠️ ลบถาวร]
  ↓
เปิด modal:
  ┌───────────────────────────────────────────┐
  │ ⚠️ ลบ "สมชาย ใจดี" ออกจากระบบอย่างถาวร     │
  │                                           │
  │ ข้อมูลที่จะหายไปตลอดกาล:                    │
  │ • 15 คำสั่งซักรีด                          │
  │ • 8 การชำระเงิน                           │
  │ • 2 แพ็กเกจสมาชิก                          │
  │                                           │
  │ พิมพ์ "ยืนยันการลบข้อมูล" เพื่อดำเนินการ      │
  │ [_____________________________]            │
  │                                           │
  │ [ยกเลิก]         [⚠️ ลบถาวร] (disabled)    │
  └───────────────────────────────────────────┘

จังหวะ 2 — พิมพ์ "ยืนยันการลบข้อมูล" ครบ
  ↓
  ปุ่ม [⚠️ ลบถาวร] เปลี่ยนเป็นสีแดง active

จังหวะ 3 — กด [⚠️ ลบถาวร]
  ↓
  API call → success → notify.success("ลบถาวรแล้ว") → refresh list
  API call → error → notify.error(...)
```

ข้อความต้องตรงกันเป๊ะ (case-sensitive): `ยืนยันการลบข้อมูล`

### Rules
- User `walkin@saijai.local` ห้ามลบ ห้ามแก้ไข ห้ามแสดงในรายการ
- ใช้ Nuxt UI v4, Shopee-style cards (shared/config/adminUi.ts)
- snake_case DB, camelCase Prisma, Bangkok UTC+7
- pnpm, Vue 3 Composition API, useNotify()
- เพิ่มเมนูใน app/layouts/admin.vue sidebar
- ADMIN only (middleware role-admin)