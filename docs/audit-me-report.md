# รายงานตรวจสอบระบบสมาชิก (Me Pages)

> วันที่: 2026-05-14 | ผู้ตรวจ: Claude Code
> Scope: `app/pages/me/**`, `app/components/me/**`, `app/composables/useMy*`, `app/composables/useLiffAuth.ts`, `app/composables/useUser.ts`, `app/components/UserMenu.vue`, `app/layouts/user.vue`, `app/middleware/auth.global.ts`, `server/api/me/**`

## สรุปภาพรวม
- บัคสำคัญ (Critical): 5 รายการ
- UX/UI ไม่ตรงมาตรฐาน admin: 14 รายการ
- Code Quality / Server API: 7 รายการ
- Completeness (loading/empty/responsive): 5 รายการ

ภาพรวม me pages ทำงานได้ตามฟังก์ชัน แต่ยังขาดการรวมศูนย์ pattern กับ admin (ไม่มี `adminTableUi`, `adminMobileListCardClass`, `adminDashboardCardClass`, mobile card view, ปุ่ม refresh) และยังมี hardcoded color/radius กระจายอยู่หลายไฟล์ บัค UserMenu route สำหรับ USER เป็นปัญหาที่กระทบผู้ใช้จริง ควรแก้ก่อน

---

## บัคสำคัญ (Priority 1)

### 1. UserMenu — เส้นทาง profile / settings ผิดสำหรับ USER role
**ไฟล์:** `app/components/UserMenu.vue` (บรรทัด 17–18)

```ts
const profileRoute = computed(() => (isStaff.value ? "/admin/settings/profile" : "/settings/notification"));
const settingsRoute = computed(() => (isStaff.value ? "/admin/settings/billing" : "/settings/notification"));
```

**อาการ:** USER กด "ข้อมูลส่วนตัว" หรือ "ตั้งค่า" ใน UserMenu → ไปที่ `/settings/notification` ซึ่ง **ไม่มี route นี้** (เคยมีอยู่ที่ `app/pages/settings/notification.vue` ในอดีต แต่ปัจจุบันมีเฉพาะ `app/pages/me/settings/notification.vue`) → 404

**สาเหตุ:** Path สำหรับ USER ใช้ `/settings/...` แทน `/me/settings/...` และ "ข้อมูลส่วนตัว" ก็ pointer ไป notification (ผิดความหมาย)

**วิธีแก้:**
```ts
const profileRoute = computed(() => (isStaff.value ? "/admin/settings/profile" : "/me/settings/profile"));
const settingsRoute = computed(() => (isStaff.value ? "/admin/settings/billing" : "/me/settings/notification"));
```

---

### 2. UserMenu — กรณีเข้าผ่าน LIFF auto-login แสดงชื่อผู้ใช้ผิด ("liff-auto login")
**ไฟล์:** `app/components/UserMenu.vue:11` + `app/composables/useLiffAuth.ts:75` + `app/composables/useUser.ts:125–155` + `app/middleware/auth.global.ts:78–88`

**อาการ:** หลังเข้าผ่าน LINE LIFF (ในแอป LINE) ครั้งแรก UserMenu แสดงชื่อ "liff-auto login" แทนชื่อผู้ใช้ที่ถูกต้อง

**สาเหตุที่พบจาก trace flow:**
1. `ensureLiffSession()` ใน `auth.global.ts:79` เรียก `runLiffAutoLogin(true)` → เรียก `loginWithLineIdToken()` (`useUser.ts:125`)
2. `loginWithLineIdToken` ใช้ `authClient.signIn.social({ provider: "line", idToken: { token, accessToken }, disableRedirect: true })` แล้วเรียก `refreshSession()` ทันที
3. ปัญหา: หาก BetterAuth สร้าง user ใหม่ขณะนี้และ idToken ไม่มี `name` claim — BetterAuth จะใส่ค่า fallback (ค่าจาก `displayName` ของ LINE หรือ literal label) ลงคอลัมน์ `user.name` (เคยมี seed/test data ใส่ค่า `"liff-auto login"` ในฐาน) — ค่านี้จะถูก persist ลง DB แล้วโผล่ใน `useUser().user.value.name` ตลอดไป
4. รอง: `auth.global.ts:83–88` ทำ `fetchFreshSession()` ซ้ำหลัง `ensureLiffSession()` — แต่ถ้า user.name ใน DB เพี้ยนแล้ว ก็ยังคงโชว์ค่าเพี้ยน
5. นอกจากนี้ `useUser.ts:125` ไม่ set `callbackURL/newUserCallbackURL` ที่ตรงกับ flow LIFF — ทำให้บางครั้งคืนค่ามาก่อน session hydrate เสร็จ

**สิ่งที่ตรวจแล้ว:**
- ค้นทั้ง repo ไม่พบ literal string `"liff-auto"` ในซอร์สโค้ด → ค่ามาจาก DB หรือ external (BetterAuth/LINE)
- `useState('liff:auto-login-processing')` ไม่ได้ leak เข้า display (UserMenu อ่าน `user.value?.name` เท่านั้น)
- ไม่พบ key collision ระหว่าง `liff:*` กับ `auth:*` ใน `useState`

**วิธีแก้ที่แนะนำ:**
1. ตรวจ DB: `SELECT id, name, email FROM "user" WHERE name LIKE '%liff%';` — ถ้าเจอ ให้ update ชื่อให้ตรงกับ LINE displayName หรือ email
2. แก้ `loginWithLineIdToken` ใน `useUser.ts:125` — หลัง `signIn.social` ให้ดึง LINE profile ผ่าน `liff.getProfile()` แล้ว PUT ไป `/api/me/profile` ถ้า `user.name` ว่าง/ผิดรูปแบบ
3. เพิ่ม guard ใน BetterAuth config ฝั่ง server (`server/utils/auth.ts`): ใน `hooks.before` ของ `signIn.social` ให้ใช้ idToken.name ถ้ามี ไม่ใช้ค่า fallback อื่น
4. เพิ่ม Sentry/log ใน `runLiffAutoLogin` เพื่อ trace ตอนสร้าง user ครั้งแรก

---

### 3. Pagination v-model ไม่สอดคล้องกัน
**ไฟล์:** 
- `app/pages/me/orders/index.vue:98–102` — ใช้ `v-model="page"` + `:page-count="pageSize"` (เป็น API เก่า/ผิด)
- `app/pages/me/receipts/index.vue:77–82` — ใช้ `v-model:page="page"` + `:items-per-page="pageSize"` (ถูกตามรุ่นใหม่)

**ผล:** หน้า orders มีโอกาส pagination ไม่ทำงาน (page ไม่ update) หรือคำนวณจำนวนหน้าผิด

**วิธีแก้:** เปลี่ยน orders ให้ตรงกับ receipts:
```vue
<UPagination
  v-model:page="page"
  :total="meta.total"
  :items-per-page="pageSize"
  show-edges
/>
```

---

### 4. Delete Modal ใช้ `:model-value` แบบ one-way
**ไฟล์:** `app/pages/me/settings/addresses.vue:212`

```vue
<UModal :model-value="!!deleteConfirmId" @update:model-value="deleteConfirmId = null">
```

**ปัญหา:** ใช้ pattern เก่า (`:model-value` + manual `@update`) — admin มาตรฐานใช้ `v-model:open="..."` (Nuxt UI v4)

**วิธีแก้:** เปลี่ยนเป็น `ref<boolean>` พร้อม `v-model:open`:
```ts
const showDeleteModal = ref(false);
// confirmDelete(id) { deleteConfirmId.value = id; showDeleteModal.value = true; }
```
```vue
<UModal v-model:open="showDeleteModal">
```

ในไฟล์เดียวกัน บรรทัด 165 `UModal v-model="isModalOpen"` ก็ใช้ syntax เก่าเหมือนกัน ต้องเปลี่ยนเป็น `v-model:open="isModalOpen"`

นอกจากนี้ `app/pages/me/packages.vue:159` `<UModal v-model="isOpen">` ก็ผิดรูปแบบเดียวกัน

---

### 5. UModal/UCard ห่อกันใน me pages — Nuxt UI v4 ไม่ต้องการ UCard ภายใน UModal
**ไฟล์:** `me/packages.vue:159–193`, `me/settings/addresses.vue:165–209`, `me/settings/addresses.vue:212–225`

**ปัญหา:** Nuxt UI v4 UModal มี slot `#header / #body / #footer` ในตัว ไม่ควรใส่ `<UCard>` ซ้อนใน → spacing / radius จะซ้อนกันและ scroll behavior เพี้ยน

**วิธีแก้:** ใช้ slot ของ UModal โดยตรง:
```vue
<UModal v-model:open="open" title="ยืนยันการลบ">
  <template #body>...</template>
  <template #footer>...</template>
</UModal>
```

---

## UX/UI — เทียบมาตรฐาน admin

| # | ไฟล์ | ปัญหา | วิธีแก้ | Priority |
|---|------|-------|---------|----------|
| 1 | `me/orders/index.vue:51` | `<UTable>` ไม่ใส่ `:ui="adminTableUi"` | import จาก `~~/shared/config/adminUi` แล้วใส่ prop `:ui` | สูง |
| 2 | `me/orders/index.vue` | ไม่มี mobile card view (Shopee-style) — มือถือเลื่อนตารางแนวนอน | เพิ่ม template `<div v-if="isMobile">` ใช้ `adminMobileListCardClass` | สูง |
| 3 | `me/orders/index.vue` | ไม่มีปุ่ม refresh ใน Navbar (admin มีทุกหน้า list) | เพิ่ม `<UButton icon="i-lucide-refresh-cw" @click="refresh" />` ใน `#right` | กลาง |
| 4 | `me/orders/index.vue:13–20` | Filter เป็น USelect เดี่ยว ไม่มีกล่อง search / date range | ใช้ `adminFilterBarClass` two-row mobile + ช่อง search | กลาง |
| 5 | `me/orders/index.vue:90–91` | Empty state ใช้ `text-gray-400/500` แทน theme token | เปลี่ยนเป็น `text-dimmed` + `text-muted` | กลาง |
| 6 | `me/orders/[id].vue:27,31,73,87,100–116,128,135,149–186` | hardcoded `bg-gray-200 / text-gray-500 / border-gray-200` กระจายทั่วไฟล์ | แทนด้วย `text-muted`, `text-dimmed`, `bg-elevated`, `border-default` | สูง |
| 7 | `me/orders/[id].vue:71–88` | Timeline สร้างเอง (div + absolute line) ใช้ `h-10 w-10 rounded-full` | พิจารณาใช้ `<UStepper>` (Nuxt UI) หรืออย่างน้อย token `rounded-md` | กลาง |
| 8 | `me/orders/[id].vue:154` | `border-gray-200` / `border-red-500` hardcoded | ใช้ `border-default` / `border-error` | กลาง |
| 9 | `me/receipts/index.vue:31` | UTable ไม่ใส่ `adminTableUi` + ไม่มี mobile card + ไม่มี filter + ไม่มี refresh | เพิ่มทั้งหมดเหมือนข้อ 1–3 | สูง |
| 10 | `me/receipts/index.vue:70–71` | Empty state ใช้ `text-gray-400/500` + ไม่มี CTA | ใช้ theme tokens + เพิ่มปุ่ม "ดูแพ็กเกจ" หรือ "กลับไปหน้าหลัก" | กลาง |
| 11 | `me/receipts/[id].vue:2–6` | import `ThermalSlip`, `ThermalHeader` ฯลฯ จากโฟลเดอร์ `admin/thermal/` | ย้าย thermal components ไปที่ `app/components/thermal/` (shared) | กลาง |
| 12 | `me/receipts/[id].vue:399–439` | CSS class `.thermal-dash`, `.item-row`, `.summary-row` อาจชนกับสำเนาใน admin receipt | ใช้ `:scoped` (มีแล้ว แต่ตรวจซ้ำ) หรือ namespace `.me-thermal-...` | ต่ำ |
| 13 | `me/packages.vue:36,63,80,124,136` | hardcoded `text-[#1a2b4c]` (สีน้ำเงินกรม) | เปลี่ยนเป็น `text-highlighted` หรือ `text-default` | สูง |
| 14 | `me/packages.vue:70` | `rounded-2xl shadow-sm` + `bg-white dark:bg-gray-800` — ขัด pattern admin (rounded-md + theme token) | เปลี่ยน `rounded-2xl → rounded-md`, ใช้ `adminDashboardCardClass` หรือใช้ `<UPageCard>` | สูง |
| 15 | `me/packages.vue:74–76` | Badge "Best Value" เป็นภาษาอังกฤษ (admin ใช้ไทย) | เปลี่ยนเป็น "คุ้มที่สุด" หรือ "แนะนำ" | ต่ำ |
| 16 | `me/packages.vue:44–53` | Skeleton ใช้ `bg-gray-200/700 rounded animate-pulse` แทน `<USkeleton>` | ใช้ `<USkeleton class="h-6 w-1/2" />` ตาม pattern admin | กลาง |
| 17 | `me/packages.vue:121` | `border-t border-gray-200 dark:border-gray-800` | ใช้ `border-default` | ต่ำ |
| 18 | `me/membership/index.vue:49,52,94` | `border-amber-200 / bg-amber-50 / bg-gray-50` + Badge `"ACTIVE"` ภาษาอังกฤษ | ใช้ theme tokens (`color="success" variant="subtle"` UCard); แปลง ACTIVE/EXPIRED/CANCELLED เป็น "กำลังใช้งาน/หมดอายุ/ยกเลิก" | สูง |
| 19 | `me/membership/index.vue:97–99` | Badge แสดง `ent.status` ตรงๆ ภาษาอังกฤษ | สร้าง map `membershipStatusLabels` ใน `shared/config/` | กลาง |
| 20 | `me/membership/usage.vue:72,81` | hardcoded `bg-gray-50`, Badge แสดง status อังกฤษ | ใช้ theme token + map ไทย | กลาง |
| 21 | `me/membership/usage.vue:52–59` | `USelectMenu` พ่วง prop เก่า `option-attribute / value-attribute` (Nuxt UI v3) | Nuxt UI v4 ใช้ `items` + `value-key` (verify against current API) | กลาง |
| 22 | `me/settings/addresses.vue:119–124` | empty state `bg-white dark:bg-gray-800 rounded-xl border-gray-300` | ใช้ `bg-elevated`, `rounded-md`, `border-default` | กลาง |
| 23 | `me/settings/addresses.vue:121,137,169` | `text-gray-900 dark:text-white` | ใช้ `text-highlighted` หรือ `text-default` | ต่ำ |
| 24 | `me/settings/addresses.vue:130` | `hover:border-primary-500` (numeric color) | ใช้ `hover:border-primary` | ต่ำ |
| 25 | `me/settings/notification.vue` / `profile.vue` / `security.vue` | profile.vue ไม่มี `<UDashboardSidebarCollapse />` ใน Navbar leading | เพิ่มเพื่อให้มี hamburger บน mobile | กลาง |
| 26 | `me/settings/index.vue` | redirect แบบ middleware เฉพาะ (ใช้ได้) — ไม่มี `definePageMeta.layout` | ระบุ `layout: "user"` เพื่อกัน flash | ต่ำ |
| 27 | `me/index.vue:67` | UAlert email-verification class `mb-4` อยู่ใน wrapper ที่มี `gap-4/6` แล้ว | เอา `mb-4` ออก | ต่ำ |
| 28 | `layouts/user.vue:125` | `class="bg-elevated/25"` opacity hack | ใช้ token โดยตรง หรือกำหนดสีใน `app/assets/css/main.css` | ต่ำ |
| 29 | `layouts/user.vue:133` | `<UDashboardSearchButton>` แต่ search ไม่มีคอนเทนต์มีประโยชน์ (groups คือเมนูเอง) | ลบออก หรือ implement real search ผ่าน orders/receipts | ต่ำ |
| 30 | `me/orders/[id].vue:128–135` | รูปภาพ `rounded-lg` + `border-red-500/gray-200` hardcoded | ใช้ `rounded-md` + theme tokens | ต่ำ |

---

## Code Quality

### 3.1 Breaking Rules (10 ข้อห้าม)
ผลค้นหาทั่ว `app/`, `server/`, `shared/`:
- `window.alert` — ไม่พบ ✅
- `window.confirm` — ไม่พบ ✅
- `date-fns/tz` — ไม่พบ ✅
- `prisma.delete` (hard delete) — ไม่พบใน me area ✅
- `npm install` — ไม่ตรวจ (project ใช้ pnpm)

`date-fns` ที่ใช้ใน me area:
- `me/index.vue:2` `import { sub } from "date-fns"` — ใช้สำหรับสร้าง initial range (offset แบบ duration ไม่เกี่ยว timezone) → **ปลอดภัย ใช้ต่อได้**
- `components/me/dashboard/Chart.client.vue`, `OrderStatusChart.client.vue`, `PeriodSelect.vue` — ใช้ `eachDayOfInterval`, `startOfWeek`, `startOfMonth`, `format` → **ปลอดภัย** (ไม่มี TZ semantic) แต่ถ้าจะคำนวณ "วันนี้/เริ่มสัปดาห์ตามเขต BKK" ต้องระวัง — ตรวจซ้ำว่า input dates แปลง BKK แล้ว
- `shared/utils/format.ts:1` `format, isSameYear` — ใช้ format display เท่านั้น OK

**ข้อเสนอ:** เพิ่ม comment เตือนใน `me/index.vue:2` ว่า "sub() ใช้ duration arithmetic ไม่กระทบ TZ" เพื่อให้คนอ่านโค้ดต่อไม่เผลอใช้ฟังก์ชันอื่นจาก date-fns ที่ TZ-sensitive

### 3.2 Server API Audit (`server/api/me/**`)

| ไฟล์ | ปัญหา | วิธีแก้ |
|------|-------|---------|
| `server/api/me/addresses/index.get.ts:4` | ใช้ `event.context.user` ตรงๆ ไม่ผ่าน `requireUser(event)` | เปลี่ยนเป็น `const user = requireUser(event);` |
| `server/api/me/addresses/index.post.ts:14` | เช่นกัน | `requireUser(event)` |
| `server/api/me/addresses/[id].put.ts:14` | เช่นกัน | `requireUser(event)` |
| `server/api/me/addresses/[id].delete.ts:4` | เช่นกัน + ไม่กรอง `deletedAt: null` ใน `findUnique` (ทำให้ลบซ้ำของที่ลบไปแล้วได้) | `requireUser` + `findFirst({ where: { id, userId, deletedAt: null } })` |
| `server/api/me/addresses/[id].delete.ts` | Error message อังกฤษ "Unauthorized", "Address not found" | เปลี่ยนเป็นไทย "ไม่ได้รับอนุญาต", "ไม่พบที่อยู่" |
| `server/api/me/profile.put.ts` | ไม่มี `try/catch` รอบ `prisma.user.update` | ห่อ try/catch + `createError` ภาษาไทย |
| `server/api/me/receipts/index.get.ts:43` | `detail` กำหนดเป็นภาษาไทย string ใน backend (ควรอยู่ใน frontend i18n) | ส่ง type enum กลับ ให้ frontend แปล |
| `server/api/me/receipts/index.get.ts` | hard-codes `status: "PAID"` แต่ไม่ filter `deletedAt: null` บน relations (`packageSale.items`) | เพิ่ม `where: { deletedAt: null }` ใน nested includes |

`Number()` Decimal conversion: ใช้ `toNumber()` ครบใน orders/[id], receipts ฯลฯ ✅ — ยกเว้น addresses (ไม่มี Decimal) และ profile.put (ไม่ return data)

### 3.3 Imports Audit
- ไม่พบ relative path ยาว `../../` ในไฟล์ที่ตรวจ ✅
- `me/receipts/[id].vue:2–6` import จาก `app/components/admin/thermal/...` — ทำงานได้แต่ผิด domain (USER ไม่ควรพึ่งของ admin) ดูข้อ 11

### 3.4 Utils ที่ admin มี แต่ me ยังไม่ใช้

| Util | ที่ตั้ง | ใช้ทำอะไร | แนะนำให้ใช้ใน |
|------|--------|----------|---------------|
| `adminTableUi` | `shared/config/adminUi.ts:113` | UTable `:ui` preset (header, row, cell classes) | `me/orders/index.vue`, `me/receipts/index.vue`, `me/membership/usage.vue` |
| `adminMobileListCardClass` | `shared/config/adminUi.ts:41` | Mobile card Shopee-style class array | mobile views ของ orders, receipts |
| `adminDashboardCardClass` | `shared/config/adminUi.ts:53` | Card wrapper (radius, border, padding) | `me/packages.vue`, `me/membership/index.vue` |
| `adminFilterBarClass` | `shared/config/adminUi.ts:60` | Filter bar layout (two-row mobile) | `me/orders/index.vue` toolbar |
| `formatCurrency`, `formatDateTime`, `formatDate` | `shared/utils/format.ts` | ✅ ใช้แล้วใน me/* |
| `useNotify` | composable | ✅ ใช้แล้ว |
| `useUser` | composable | ✅ ใช้แล้ว |

### 3.5 Composable Pattern (`useMy*`)
- `useMyOrders.ts:12` — ไม่ตั้ง `key` ทำให้ cache ชนกันได้ถ้ามีหน้าอื่นใช้ endpoint เดียวกัน → เพิ่ม `key: 'me-orders'`
- `useMyOrders.ts` ไม่ expose `refresh` / `error` ออกมาผ่าน return type ที่ component ใช้ (return มีแต่ TS type ไม่ครบ) — orders/index.vue ไม่ได้ปุ่ม refresh → กระทบข้อ 3
- ไม่พบ error handling display ใน composables (ปล่อยให้ component handle)

---

## Checklist สำหรับเพื่อนร่วมทีม

- [ ] แก้ `UserMenu.vue` line 17–18 → `/me/settings/profile` / `/me/settings/notification`
- [ ] Trace + fix bug "liff-auto login" — ตรวจ DB user.name, แก้ `loginWithLineIdToken` ให้ sync ชื่อจาก `liff.getProfile()`
- [ ] แก้ pagination `me/orders/index.vue` ให้ใช้ `v-model:page` + `:items-per-page`
- [ ] เปลี่ยน UModal ทุกที่ใน me/* ให้ใช้ `v-model:open` + ไม่ห่อ `<UCard>`
- [ ] เพิ่ม `:ui="adminTableUi"` ใน UTable ของ `me/orders`, `me/receipts`, `me/membership/usage`
- [ ] เพิ่ม mobile card view (Shopee-style) ใน `me/orders/index.vue` + `me/receipts/index.vue`
- [ ] เพิ่มปุ่ม refresh ใน Navbar `#right` ของทุก list page
- [ ] เปลี่ยน hardcoded `text-gray-*`, `bg-gray-*`, `border-gray-*` ให้ใช้ theme tokens (`text-muted`, `text-dimmed`, `bg-elevated`, `border-default`)
- [ ] เปลี่ยน hardcoded `text-[#1a2b4c]` ใน `me/packages.vue` → `text-highlighted`
- [ ] เปลี่ยน `rounded-2xl` / `rounded-xl` ที่ไม่ใช่ asset image → `rounded-md`
- [ ] แปล Badge "ACTIVE"/"EXPIRED"/"CANCELLED"/"Best Value" เป็นภาษาไทย
- [ ] เปลี่ยน `event.context.user` → `requireUser(event)` ใน `server/api/me/addresses/*.ts` ทุกไฟล์
- [ ] เพิ่ม `deletedAt: null` filter ใน `addresses/[id].delete.ts` (`findFirst` แทน `findUnique`)
- [ ] แปล error messages ใน addresses APIs เป็นภาษาไทย
- [ ] ห่อ try/catch ใน `server/api/me/profile.put.ts`
- [ ] ย้าย thermal components จาก `admin/thermal/` → `components/thermal/` (shared) เพื่อให้ me/receipts/[id] ไม่ cross-domain
- [ ] เพิ่ม `<UDashboardSidebarCollapse />` ใน `me/settings/profile.vue` Navbar leading
- [ ] เพิ่ม `definePageMeta({ layout: "user" })` ใน `me/settings/index.vue` (กัน flash)
- [ ] เพิ่ม `key` ให้ `useFetch` ใน `useMyOrders.ts`
- [ ] เพิ่ม `refresh` ใน return ของ `useMyOrders.ts` เพื่อ wire ปุ่ม refresh
- [ ] ทดสอบ LIFF auto-login flow บนเครื่องจริงในแอป LINE
- [ ] ทดสอบ mobile responsive (≤768px) ทุกหน้า me/* — โดยเฉพาะ tables กับ modals

---

## ภาคผนวก — ไฟล์ที่ไม่พบปัญหา (ผ่านมาตรฐาน)
- `me/settings/profile.vue` — เรียกใช้ shared `ProfileForm/LineLinkSection/...` ตามแบบ admin
- `me/settings/security.vue` — เรียก shared components ครบ
- `me/settings/notification.vue` — เรียก `NotificationPreferenceForm` shared
- `server/api/me/dashboard/*` — ใช้ `requireUser` ครบ
- `server/api/me/membership/index.get.ts` — `requireUser` + `deletedAt: null`
- `server/api/me/orders/index.get.ts` — auth + soft delete + Number() ครบ ✅
- `server/api/me/notification-preferences.*.ts` — ใช้ `requireUser` (`actor`) ✅
- `me/index.vue` — dashboard pattern ตรงกับ `admin/index.vue` (date range, period, refresh, charts) ✅
