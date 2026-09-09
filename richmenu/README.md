# LINE Rich Menu สำหรับฐานสอบ

รันจาก root ของโปรเจกต์:

```bash
node richmenu/setup.mjs
```

สคริปต์จะสร้าง/ใช้ Rich Menu 4 แบบ, อัปโหลดรูป, ตั้ง `user` เป็นเมนู default และ sync เฉพาะบัญชีที่ผูก LINE อยู่ในฐานสอบ:

- `ADMIN` → `admin`
- `EMPLOYEE` → `employee`
- `USER` ที่มีแพ็กเกจ active → `member`
- `USER` อื่น ๆ → `user`

สคริปต์อ่าน `LINE_ACCESS_TOKEN` จาก `richmenu/.env.local` และอ่าน `DATABASE_URL` จาก `.env.local` ของโปรเจกต์ ห้าม commit ไฟล์ env เหล่านี้

ตอนนี้ยังไม่มีภาพ employee แยก จึงใช้ภาพ `admin.png` เป็น artwork ชั่วคราว แต่มี Rich Menu ID และ route แยกสำหรับพนักงานแล้ว
