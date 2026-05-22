# Prompt Guide: สร้างหน้าแรกเว็บ "ใส่ใจผ้าเรียบ" (SaiJai Phareab) - Nuxt 4

---

## ขั้นตอนที่ 1 — อ่านและวิเคราะห์โปรเจคเดิมก่อนเขียนโค้ด

```text
อ่านไฟล์ต่อไปนี้และสรุปโครงสร้างโปรเจคให้ฉันก่อน อย่าเพิ่งเขียนโค้ดใดๆ:

- package.json
- nuxt.config.ts
- app/app.vue
- app/pages/index.vue (หน้าแรกปัจจุบันที่มีการรองรับ LINE LIFF)
- โครงสร้างใน app/components/ (เช่น HomeHero, HomeHowItWorks, ฯลฯ)

สรุปให้ครบ:
1. Nuxt version (โปรเจคนี้ใช้ Nuxt 4 และโครงสร้างอยู่ภายใต้โฟลเดอร์ app/)
2. CSS framework ที่ใช้ (Tailwind CSS v4 และ Nuxt UI v4)
3. ระบบการ Login ที่ใช้ (Better Auth + LINE LIFF)
4. Component ไหนบ้างที่หน้าแรกใช้อยู่
5. โครงสร้าง section ของหน้าแรกปัจจุบัน
```

---

## ขั้นตอนที่ 2 — กำหนด Design Direction ใหม่

```text
จากที่อ่านโปรเจคมาแล้ว ช่วยเสนอ design direction ใหม่สำหรับหน้าแรกเว็บ "ใส่ใจผ้าเรียบ" (บริการซักรีดที่เน้นความสะดวกและใส่ใจ)
โดยต้องดีกว่าเดิมในด้านต่อไปนี้:

เป้าหมายของหน้าแรก:
- สร้างความน่าเชื่อถือให้ร้าน
- แสดงบริการหลักอย่างชัดเจน (เน้นซักและรีดผ้าให้เรียบเนี้ยบ)
- กระตุ้นให้ลูกค้าล็อกอินผ่าน LINE หรือสั่งซักได้ทันที

เสนอมา 2 แนวทาง พร้อมอธิบาย:
1. ชื่อ concept
2. โทนสี (พร้อม hex code) (ควรเข้ากับ Nuxt UI v4)
3. Font หลักและ font รอง
4. Layout โดยรวม
5. อะไรที่จะทำให้จำได้ / แตกต่างจากเว็บร้านซักรีดทั่วไป

รอให้ฉันเลือก direction ก่อนค่อยเขียนโค้ด
```

---

## ขั้นตอนที่ 3 — วางโครงสร้าง Section

```text
ตาม direction ที่เลือก ช่วยวางโครงสร้าง section ของหน้าแรกให้ครบ
แสดงเป็น outline พร้อมอธิบายแต่ละ section สั้นๆ ว่ามีอะไรบ้าง 
(สามารถอิงจากไฟล์เดิมที่มีเช่น HomeHero, HomeHowItWorks, HomePricing แต่จัดเรียงและปรับปรุงใหม่ได้)
ยังไม่ต้องเขียนโค้ด

ตัวอย่าง section ที่ควรมี:
- Hero Section (พร้อมปุ่ม Login ด้วย LINE หรือ CTA อื่นๆ)
- ทำไมต้องเลือกเรา (Why Choose Us)
- ขั้นตอนการใช้บริการ (How It Works)
- ราคา / แพ็กเกจ (Pricing & Packages)
- คำถามที่พบบ่อย (FAQ)
- ช่องทางติดต่อ (Contact)

รอให้ฉัน approve โครงสร้างก่อน
```

---

## ขั้นตอนที่ 4 — เขียนโค้ด app/pages/index.vue และ Components

```text
เขียนโค้ด app/pages/index.vue และแยก Components ต่างๆ ใหม่ทั้งหมด โดย:

ข้อกำหนด:
- ใช้โครงสร้างและ direction ที่ตกลงกันไว้
- ใช้ Nuxt 4 structure (อยู่ที่โฟลเดอร์ `app/`)
- ใช้ Tailwind CSS v4 และ **Nuxt UI v4 components** เป็นหลัก (เช่น `UButton`, `UCard`, `UContainer` ฯลฯ) อย่าเพิ่ม library ใหม่ถ้าไม่จำเป็น
- รักษา Logic เดิมของ LINE LIFF ใน `app/pages/index.vue` เอาไว้ (ส่วนการเช็ค `showLiffLoading` และสคริปต์ที่เกี่ยวข้อง)
- แยก component ย่อยที่ซับซ้อนออกเป็นไฟล์ใน `app/components/` และตั้งชื่อให้ชัดเจน
- Responsive รองรับ mobile, tablet, desktop
- ใช้ `<script setup>` (Composition API) และ TypeScript (`lang="ts"`)
- ข้อมูล placeholder ให้ใส่ไว้ก่อน เพื่อให้แก้ได้ง่ายภายหลัง

ลำดับการส่งโค้ด:
1. app/pages/index.vue
2. component ย่อยแต่ละไฟล์ (เช่น app/components/HomeHero.vue ทีละไฟล์)
3. สรุปว่าต้องแก้ไขไฟล์อื่นอีกไหม
```

---

## ขั้นตอนที่ 5 — ปรับแต่งและ polish

```text
ตรวจสอบและปรับปรุงโค้ดที่เขียนไป โดยเช็คสิ่งต่อไปนี้:

[ ] Animation และ transition ทำงานถูกต้อง
[ ] สีและ font ตรงกับ direction ที่กำหนด
[ ] Responsive ไม่แตก ทุก breakpoint
[ ] ไม่มี hardcode ค่าที่ควรเป็น variable
[ ] ใช้ Nuxt UI v4 อย่างถูกต้อง
[ ] SEO meta tag ครบ (ใช้ `useSeoMeta` ใน Nuxt)
[ ] Image มี alt text ครบ
[ ] ไม่มี console error
[ ] Logic การโหลดของ LINE LIFF ไม่ได้รับผลกระทบ

ถ้าพบปัญหาให้แก้และส่งไฟล์ที่แก้แล้วทันที
```

---

## หมายเหตุสำหรับการใช้ Prompt นี้

- **ทำตามลำดับขั้นตอน** อย่าข้ามขั้น โดยเฉพาะขั้นที่ 1 และ 2
- **รอ approve** ในขั้นที่ 2 และ 3 ก่อนให้ AI เขียนโค้ด
- ถ้า AI เขียนโค้ดแล้วมีข้อผิดพลาด ให้วาง error message มาใน prompt แล้วขอให้แก้
