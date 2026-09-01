# App Shells, Navigation และ Sidebar

อ่านไฟล์นี้เมื่องานแตะ header, navbar, sidebar, user menu, breadcrumb หรือ mobile navigation

## เลือกโครงสร้าง

- ออกแบบตามชนิดผลิตภัณฑ์ ไม่บังคับ sidebar กับเว็บไซต์ที่ top navigation เหมาะกว่า
- ใช้ sidebar เมื่อมี navigation หลายหมวดหรือผู้ใช้สลับส่วนงานบ่อย
- วาง page title, context/breadcrumb และ primary action ให้ค้นพบง่ายและ alignment
  สม่ำเสมอข้ามหน้า
- จัดกลุ่ม submenu ตาม mental model ของผู้ใช้และใช้ nesting เท่าที่จำเป็น
- ซ่อนเมนูที่ไม่มี permission และอย่าแสดง dead menu

## Header และ User Menu

- หน้า public แบ่ง navbar เป็น logo/ชื่อเว็บ, navigation หลัก และ auth/user area
  เมื่อโครงสร้างนี้เหมาะกับ content จริง
- แสดง auth state จาก session จริง ไม่ hard-code เมนูหรือสถานะผู้ใช้
- ใช้ user-menu component เดียวกันข้าม layout เมื่อ interaction เหมือนกัน
- Trigger ต้องมี `aria-expanded`; ปิดด้วย click-outside และ Escape, คืน focus ให้ trigger
  เมื่อปิด และปิดเมื่อเปลี่ยน route
- เลือกทิศทางเปิดเมนูตามพื้นที่จริง ไม่ผูกว่าต้องเปิดขึ้นหรือลงเสมอ

## Sidebar

- แสดง active, hover, focus, expanded และ collapsed states ให้ต่างกันชัดเจน
- เมื่อ collapse เป็น icon-only ให้รักษา accessible name และเพิ่ม tooltip เมื่อช่วยค้นพบ
- เก็บ collapse state ผ่าน source of truth กลางที่ layout, header และ sidebar ใช้ร่วมกัน
- ใช้ sidebar search เฉพาะเมื่อจำนวนเมนูทำให้ค้นหายากจริง

## Responsive Navigation

- บน mobile ให้ navigation หลักเป็น drawer/sheet เมื่อเหมาะสม โดยมี trigger, close control,
  overlay, focus management และ scroll lock
- รักษา auth access, page title และ primary action ให้เข้าถึงได้บนจอแคบ
- ย่อ label เป็น icon เฉพาะเมื่อความหมายยังชัดและมี accessible name
- ตรวจ long labels, localization, permission variants และ viewport ที่ layout เริ่มเสียจริง
