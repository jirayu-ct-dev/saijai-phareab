# XP-C260M Thai raster physical test

สถานะปัจจุบัน: firmware `7.022PROY` พิมพ์ ASCII ได้ แต่การทดสอบจริงด้วย Page 70 / CP874 แสดงภาษาไทยเป็นอักษรผิด ดังนั้น production default คือ Hybrid แบบต่อ block:

- ASCII/ตัวเลขล้วน: native ESC/POS text
- block ที่มีภาษาไทยหรือข้อความผสมไทย: Prompt font -> monochrome bitmap -> `GS v 0`
- feed, cut, QR, barcode, cash drawer และ beeper: คงเป็น operation เดิม ไม่ถูกแปลงเป็นภาพ
- Page 70 และ Page 255: diagnostic opt-in เท่านั้น

Raster ใช้หน้ากว้างสูงสุด 576 dots สำหรับพื้นที่พิมพ์ 72 mm ที่ 203 DPI และแบ่งภาพเป็น band สูงไม่เกิน 64 dots ไม่สร้างภาพยาวทั้งใบ

## สร้าง minimal raster test โดยยังไม่ส่งเข้าเครื่อง

ระบุ output เป็น absolute path ที่เขียนได้:

```bash
pnpm print:test-receipt -- /tmp/xp-c260m-minimal-raster.bin
```

ไฟล์นี้มีเฉพาะ `ESC @`, raster กว้าง 288 dots ของ `TEST 123`, raster ของ
`ทดสอบไทย` และ feed 2 บรรทัด ไม่มี QR และไม่สั่งตัดกระดาษ แต่ละ band ใช้
`GS v 0` โดย `xL/xH` เป็นจำนวน **bytes ต่อแถว** (288 dots = 36 bytes)
ไม่ใช่จำนวน dots

ตรวจไฟล์ก่อนส่งได้จาก JSON ที่คำสั่งแสดง: `byteLength`, `sha256`,
`rasterWidthDots=288`, `rasterWidthBytes=36` และ `cut=false`

## เกณฑ์ตรวจบนเครื่องจริง

การส่งไฟล์ไปยัง raw TCP port เป็น physical side effect ต้องยืนยัน endpoint ปัจจุบันและได้รับอนุญาตก่อนทุกครั้ง จากนั้นตรวจว่า:

1. minimal test ต้องพิมพ์ `TEST 123` และ `ทดสอบไทย` เป็นภาพอ่านได้ ไม่มี binary garbage
2. ถ้า minimal test ผ่าน จึงกดพิมพ์ใบเสร็จจริงจากเว็บ เพื่อตรวจ `น้ำ`, `กุ้ง`, `ไข่`, `ข้าว`
3. `RC-2026-0003`, เบอร์โทร และยอดเงินต้องชัดเจน
4. หัวเรื่อง center และยอดเงินฝั่งขวาไม่ถูกตัดที่ 576 dots
5. รายการยาว wrap โดยไม่ตัดพยางค์/เครื่องหมายลอย
6. ไม่มีอักษรจีนหรือ byte UTF-8 ภาษาไทยถูกพิมพ์เป็น native text

## เปรียบเทียบ byte fingerprint ระหว่างทาง

- Nuxt server: ตั้ง `PRINT_DEBUG_BYTES=true` เฉพาะ development เพื่อดู stage A/B
- Browser development console: แสดง stage C/D อัตโนมัติ
- Print Gateway: ตั้ง `PRINT_GATEWAY_DEBUG_BYTES=true` เฉพาะ development เพื่อดู stage E/F

ค่า `byteLength`, `sha256`, `first32Hex` ของ A-F ต้องตรงกัน หากต่างกันให้หยุด
ที่ boundary แรกที่ hash เปลี่ยน ห้ามเปิด debug นี้ใน production เพราะ short hex
preview อาจมีส่วนของข้อความใบเสร็จ

บันทึกผลพร้อม firmware, interface ที่ใช้, printable width และเวลา test โดยไม่บันทึกรหัส Wi-Fi, pairing token หรือข้อมูลลูกค้าจริง
