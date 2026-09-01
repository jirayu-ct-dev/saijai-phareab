# Data Tables

อ่านไฟล์นี้เมื่องานแตะ table, search, filter, sort, pagination, row selection หรือ bulk action

เริ่มจากงานที่ผู้ใช้ต้องทำและจำนวนข้อมูลจริง อย่าเพิ่มทุก feature โดยอัตโนมัติ

## โครงสร้างและการอ่านข้อมูล

- ใช้ column เฉพาะข้อมูลที่ช่วยตัดสินใจหรือทำงาน; ย้ายรายละเอียดรองไป detail view,
  popover หรือ expandable content
- จัด text ชิดซ้ายและตัวเลข/จำนวนเงินชิดขวาตาม locale
- แยก primary/secondary text และใช้ status label พร้อมข้อความ ไม่พึ่งสีอย่างเดียว
- ใช้ date, number, currency และ identifier format ให้สม่ำเสมอ
- วาง row actions ด้านท้ายและรวม action รองใน menu เมื่อพื้นที่แน่น

## Search, Filter, Sort และ Pagination

- วาง search เป็น control หลักเมื่อผู้ใช้ค้นหาบ่อย และจัด filter/action เป็นกลุ่ม
- แสดง active filters และวิธี clear
- Sortable header ต้องมี label, direction และ keyboard semantics
- ใช้ single-column sort เป็นค่าเริ่มต้น เว้นแต่ requirement ต้องใช้หลาย column
- Client-side pipeline ใช้ลำดับ `source → search/filter → sort → paginate → display`
- ใช้ server-side query เมื่อข้อมูลมากหรือ backend เป็นผู้กำหนดผล และส่ง query state
  ผ่าน contract เดียวกัน
- Reset ไปหน้าแรกเมื่อ search/filter เปลี่ยน และปรับหน้าปัจจุบันเมื่อ deletion ทำ page ว่าง
- เก็บ state ใน URL เมื่อมุมมองควร share, bookmark หรือ restore ได้
- ป้องกัน stale response เมื่อ search/filter เปลี่ยนเร็ว

## Selection และ Bulk Actions

- ใช้ selection เฉพาะเมื่อมี bulk workflow จริง
- เก็บ selection ด้วย stable unique ID ไม่ใช้ index หรือตำแหน่งหน้า
- ระบุว่า “เลือกทั้งหมด” หมายถึงหน้าปัจจุบันหรือผลลัพธ์ทั้งหมด
- Header checkbox ต้องรองรับ checked, unchecked และ indeterminate
- แสดงจำนวนและ bulk actions เมื่อมี selection เท่านั้น
- หลัง mutation ให้ reconcile selection, pagination และ refreshed data; รักษา selection
  เมื่อ error หากผู้ใช้ควร retry ได้

## Responsive Tables

- ใช้ horizontal scroll เมื่อผู้ใช้ต้องเปรียบเทียบหลาย column
- ซ่อนหรือย้าย column รองเมื่อ mobile task ใช้ข้อมูลหลักเพียงบางส่วน
- เปลี่ยนเป็น list/card เมื่อความสัมพันธ์ของ row สำคัญกว่า column comparison
- รักษา action, selection และข้อมูลระบุตัวรายการให้เข้าถึงได้เสมอ
- ทดสอบ long content, localization, empty/null values, จำนวนข้อมูลมาก และ viewport แคบ
