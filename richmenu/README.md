# LINE Rich Menu แบบแยกช่องทาง

รันจาก root ของโปรเจกต์:

```bash
node richmenu/setup.mjs
```

สคริปต์จะสร้าง/ใช้ Rich Menu 4 แบบสำหรับ LINE channel และ LIFF app ที่ระบุใน environment, อัปโหลดรูป, ตั้ง `user` เป็นเมนู default และ sync เฉพาะบัญชีที่ผูก LINE อยู่ในฐานข้อมูลเป้าหมาย:

- `ADMIN` → `admin`
- `EMPLOYEE` → `employee`
- `USER` ที่มีแพ็กเกจ active → `member`
- `USER` อื่น ๆ → `user`

ก่อนรันต้องระบุค่าของ target ให้ตรงกันใน `richmenu/.env.local` หรือ shell environment:

```dotenv
RICHMENU_LINE_ACCESS_TOKEN=...
RICHMENU_LIFF_ID=2011430155-SqmA5vMF
RICHMENU_NAME_PREFIX=saijai-exam
RICHMENU_DATABASE_URL=...
```

สำหรับ branch `exam-v1` ต้องใช้ token และ LIFF ของ exam channel เดียวกันเท่านั้น ห้ามใช้ LIFF ของ main (`2008353043-Z6ED4BLd`) หรือฐานข้อมูล main; ห้าม commit ไฟล์ env เหล่านี้

สคริปต์จะไม่ reuse เมนูเดิมถ้า action/LIFF ID เปลี่ยน เพราะ LINE Messaging API ไม่มี endpoint สำหรับแก้ metadata ของ Rich Menu เดิม แต่จะสร้างเมนูชุดใหม่แล้วตั้ง default/link ใหม่ให้แทน

ตอนนี้ยังไม่มีภาพ employee แยก จึงใช้ภาพ `admin.png` เป็น artwork ชั่วคราว แต่มี Rich Menu ID และ route แยกสำหรับพนักงานแล้ว
