---
name: web-ui-coding-standards
description: Build, edit, or review Nuxt web interfaces with consistent Vue Composition API, TypeScript, Tailwind CSS, data-fetching, state, interaction, accessibility, and responsive conventions. Use for Nuxt pages, components, forms, dashboards, CRUD flows, navigation, and data tables; adapt to the existing project and design system before introducing new patterns.
---

# Web UI Coding Standards

สร้างและแก้ Nuxt UI ให้สม่ำเสมอ responsive และ accessible โดยยึด architecture,
design system และ component ที่มีอยู่ก่อนสร้างของใหม่

## ลำดับการตัดสินใจ

เมื่อแนวทางขัดกัน ให้ใช้ลำดับนี้:

1. Requirement และ scope ของผู้ใช้
2. Architecture, conventions และ design system ของโปรเจกต์
3. Component, composable, token และ interaction pattern ที่มีอยู่
4. Non-negotiable conventions และค่าเริ่มต้นใน skill นี้
5. แนวทางทั่วไปเพื่อเติมเฉพาะสิ่งที่โปรเจกต์ยังไม่ได้กำหนด

อย่าเพิ่ม library, เปลี่ยน API contract, refactor นอก scope หรือสร้าง abstraction ใหม่
โดยไม่มีเหตุผลที่ตรงกับงาน

## Non-negotiable Conventions

ใช้กฎต่อไปนี้ทุกครั้ง เว้นแต่ framework API หรือ project-level configuration
บังคับเป็นอย่างอื่น

### Syntax และ TypeScript

- ใช้ `<script setup lang="ts">` และ Composition API ในโปรเจกต์ที่รองรับ
- ใช้ arrow function สำหรับ event handlers, callbacks, composables และ utilities
- ใช้ function declaration เฉพาะเมื่อ framework API, TypeScript overload หรือ hoisting
  จำเป็นจริง ห้ามยกเว้นเพียงเพราะไฟล์เดิมเขียนไม่สม่ำเสมอ
- ระบุ type ที่ public boundary เช่น props, emits, API payload, form model และ
  composable return value; หลีกเลี่ยง `any` เมื่อกำหนดชนิดที่ถูกต้องได้

### Async และ Error Handling

- Async action ที่ผู้ใช้เรียกหรือที่เปลี่ยนข้อมูลต้องมี `try/catch`
- ห้าม empty catch, กลืน error หรือแสดงข้อความสำเร็จก่อน operation สำเร็จจริง
- จัดการ expected error ใกล้ action และส่ง unexpected error ไปยัง logging/error boundary
  ตาม pattern ของโปรเจกต์
- ไม่ต้องครอบ `useFetch`/`useAsyncData` ด้วย `try/catch` เมื่อใช้ `error` state ของ
  composable เป็น source of truth
- ป้องกัน duplicate submission, stale response และผลลัพธ์จาก request เก่าทับ state ใหม่
- Optimistic update ใช้ได้เมื่อมี rollback และ error state ที่ชัดเจน

### Buttons และ Actions

- อย่า disable submit เพียงเพราะ form ยัง invalid; ให้ผู้ใช้กดแล้วแสดง validation
  ที่ field หรือ section ที่ต้องแก้
- Disable action ได้เมื่อใช้งานไม่ได้จริง, ไม่มี permission หรือ operation กำลังทำงาน
- เมื่อ disabled เพราะเงื่อนไขที่ผู้ใช้แก้ได้ ให้แสดงเหตุผลหรือ validation ใกล้ action
- Action ที่กำลังทำงานต้องมี loading state, ป้องกันการกดซ้ำ และไม่ทำให้ layout กระโดด
- Destructive action ต้องขอยืนยันเมื่อผลกระทบรุนแรง, scope กว้าง หรือย้อนกลับไม่ได้

### Feedback และ Icons

- ใช้ `useToast()` สำหรับผลลัพธ์ระดับ action และ `useConfirm()` สำหรับการยืนยัน
  โดย reuse implementation เดิมของโปรเจกต์
- อย่าสร้าง `useNotify()` หรือ notification system ซ้ำโดยไม่มี requirement ให้เปลี่ยน
- ใช้ inline error สำหรับ field/section; อย่าใช้ toast แทน validation message
- ห้ามใช้ browser `alert()` หรือ `confirm()`; ใช้ feedback component ของโปรเจกต์
- ใช้ Lucide Icons หรือ icon integration เดิมของโปรเจกต์ และอย่าผสมหลาย icon sets
- Icon-only control ต้องมี accessible name และ tooltip เมื่อช่วยการค้นพบ
- อย่าใช้ emoji แทน functional icon

## Workflow

ก่อนแก้โค้ด:

- อ่านไฟล์ที่เกี่ยวข้องและไล่ data flow จาก UI ถึง API/mutation
- ค้นหา component, composable, layout, middleware, store, validation, feedback และ test
  ที่ reuse ได้
- ระบุ happy, loading, empty, error, permission และ responsive states ที่ได้รับผลกระทบ
- เลือกการเปลี่ยนแปลงที่เล็กที่สุดซึ่งแก้ requirement ได้ครบ

ระหว่างพัฒนา ให้รักษาพฤติกรรมนอก scope, แก้ root cause และใช้ข้อความ/ข้อมูลที่ตรงกับ
domain จริง อย่าสร้าง action หรือเมนูที่ยังทำงานไม่ได้

## Nuxt Data, State และ Hydration

- Initial SSR/API data ใน page หรือ component → `useFetch`
- Custom async logic, หลายแหล่งข้อมูล หรือ service/SDK → `useAsyncData`
- User-triggered mutation เช่น create/update/delete/submit → `$fetch` หรือ API client เดิม
- หลัง mutation สำเร็จ ให้ refresh/invalidate source ที่แสดงผลและ reconcile local state
- `useAsyncData` handler ต้องไม่มี side effect; side effect ใช้ lifecycle/action ที่เหมาะสม
- ใช้ stable key และรักษา options ของ `useFetch`/`useAsyncData` ที่ใช้ key เดียวกันให้ตรงกัน
- ส่ง abort signal หรือใช้ dedupe/cancellation เมื่อ query เปลี่ยนหรือ request ถูกแทนที่
- ใช้ `useState` หรือ store เดิมสำหรับ shared SSR state; ห้ามประกาศ shared `ref()`
  นอก setup เพราะอาจแชร์ข้อมูลข้าม server requests
- State ที่ส่งผ่าน SSR payload ต้อง serialize ได้และไม่มี function, class instance หรือ symbol
- Browser API/library ใช้หลัง mount หรือผ่าน `ClientOnly`; server และ client ต้องสร้าง
  initial markup จากข้อมูลที่ deterministic เพื่อป้องกัน hydration mismatch
- Runtime config ฝั่ง client ต้องไม่มี server secret

## Components และ State Ownership

- ใช้ typed props/emits และ stable unique key สำหรับ list
- ใช้ computed สำหรับ derived state ก่อน watcher
- อย่า copy prop เข้า local state หากไม่มี ownership, sync และ reset rule ที่ชัดเจน
- ใช้ composable สำหรับ stateful logic ที่ reuse จริง และ utility สำหรับ pure logic
- Cleanup timer, listener, observer และ subscription เมื่อ component ถูกถอด
- ตรวจ permission และ validation ที่ backend ด้วย; การซ่อน UI ไม่ใช่มาตรการความปลอดภัย

## Visual System และ Tailwind

- ใช้ Tailwind utilities และ design tokens/pattern เดิมก่อน inline style หรือ custom CSS
- เมื่อสร้าง token ใหม่ ให้ใช้ semantic name สำหรับ brand/status และกำหนดจากศูนย์กลาง
  ตาม Tailwind/design-system version ของโปรเจกต์ ไม่ hard-code palette ซ้ำใน template
- ใช้ flex/grid constraints แก้ overflow ที่ต้นเหตุ และหลีกเลี่ยง fixed height กับ content
  ที่เปลี่ยนได้โดยไม่มี overflow behavior
- รักษา hierarchy: page context → primary action → controls → content → metadata
- ใช้สีเพื่อเสริมความหมาย ไม่ใช้สีเพียงอย่างเดียวสื่อ status หรือ error
- รองรับ dark mode เมื่อโปรเจกต์รองรับ โดยใช้ semantic tokens
- รวม class เป็น component/helper เมื่อเป็น pattern ที่ reuse จริง ไม่ใช่เพียงลด class string

## Forms, States และ Accessibility

- ใช้ label ที่มองเห็นได้; placeholder ไม่แทน label
- เชื่อม label, help text และ validation error กับ form control
- Map server validation error กลับ field/section ที่เกี่ยวข้องและรักษาค่าที่กรอกเมื่อ submit ล้ม
- ใช้ skeleton เมื่อโครงสร้างคงที่, spinner/progress สำหรับ action และแยก empty state
  ออกจาก no-results state
- ทุก interactive element ต้องใช้ keyboard ได้และมี focus-visible ชัดเจน
- ใช้ semantic HTML ก่อน ARIA, รักษา heading/landmark order และประกาศ async result
  ให้ assistive technology เมื่อจำเป็น
- รองรับ reduced motion, contrast และ target size ที่เหมาะสม
- ทดสอบ long text, localization, null/empty values, zoom และ narrow viewport

## Conditional Guides

- งาน header, navbar, sidebar, user menu หรือ mobile navigation:
  อ่าน [references/app-shells.md](references/app-shells.md)
- งาน data table, search, filter, sort, pagination, selection หรือ bulk action:
  อ่าน [references/data-tables.md](references/data-tables.md)

อ่านเฉพาะ reference ที่เกี่ยวข้องกับงานปัจจุบัน

## Verification

- รัน formatter, type check, lint และ test ที่เกี่ยวข้องตามคำสั่งของโปรเจกต์
- ตรวจ flow สำคัญครบ happy, loading, empty, validation, error และ retry
- ตรวจ mutation ซ้ำ, stale response, refreshed data, pagination และ selection ที่ได้รับผลกระทบ
- ตรวจ keyboard, focus, screen-reader name และ narrow/wide viewport
- ตรวจ SSR/hydration path และ browser console เมื่อหน้าเกี่ยวข้องกับ server rendering
- สรุปสิ่งที่เปลี่ยน, หลักฐานการตรวจ และข้อจำกัดที่ยังเหลือ

อย่าเปลี่ยนงานเฉพาะจุดให้กลายเป็น redesign ทั้งระบบ แต่ให้รายงานความเสี่ยงสูงนอก scope
อย่างกระชับ
