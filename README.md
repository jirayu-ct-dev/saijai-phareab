# Saijai Phareab

## 🚀 วิธีตั้งค่าและรันโปรเจกต์ (เมื่อโคลนลงเครื่องใหม่)

เนื่องจากโปรเจกต์นี้ใช้งานร่วมกันระหว่าง **Nuxt**, **Prisma (v7)**, **Better Auth** และ **Supabase** ให้ทำตามขั้นตอนการติดตั้งต่อไปนี้:

### 1. ติดตั้ง Dependencies
โปรเจกต์นี้ใช้ `pnpm` ในการจัดการแพ็คเกจ ให้รันคำสั่ง:
```bash
pnpm install
```

### 2. ตั้งค่าไฟล์ Environment Variables
ก็อปปี้ไฟล์ `.env.example` และสร้างเป็นไฟล์ `.env` ใหม่ จากนั้นเติมค่าต่าง ๆ ให้ครบถ้วน โดยเฉพาะ:
*   `DATABASE_URL` (การเชื่อมต่อสำหรับรันแอป ผ่าน Pooler)
*   `DIRECT_URL` (การเชื่อมต่อตรง สำหรับ Migrate ฐานข้อมูล)
*   `BETTER_AUTH_SECRET` (สร้างได้จากการรัน `openssl rand -base64 32`)
*   `BETTER_AUTH_URL` (เช่น `http://localhost:3000` หรือลิงก์ `ngrok` หากใช้งาน LINE Login)

### 3. เตรียมฐานข้อมูลด้วย Prisma
ทำการซิงค์โครงสร้างฐานข้อมูลไปที่ Supabase และสร้างตัว Prisma Client (Typescript) ขึ้นมาเพื่อให้โค้ดสามารถเรียกใช้งานได้:

```bash
# อัปเดตตารางเข้าสู่ฐานข้อมูล (Migrate) สร้างแล้วไม่ต้องรัน
pnpm dlx prisma migrate dev

# สร้าง Prisma Client
pnpm dlx prisma generate
```

### 4. เปิดเซิร์ฟเวอร์แบบ Development
```bash
pnpm run dev
```

เปิดเว็บเบราว์เซอร์แล้วเข้าไปที่ `http://localhost:3000` ได้เลย! 🎉

## 🚀 Deploy บน Vercel

### Build command

```bash
pnpm build
```

คำสั่งนี้จะรัน `prisma generate` ก่อน `nuxt build` เพื่อให้ Vercel มี Prisma generated client สำหรับ Nitro bundle

### Environment variables สำคัญ

- `DATABASE_URL`: ใช้ Supabase pooler URL สำหรับ runtime เท่านั้น
- `DIRECT_URL`: ใช้ direct database URL สำหรับ `prisma migrate deploy`
- `PRISMA_POOL_MAX=1`: ลดการเปิด connection ต่อ serverless instance
- `BETTER_AUTH_URL=https://saijaiphareab.shop`
- `BETTER_AUTH_TRUSTED_ORIGINS=https://saijaiphareab.shop,https://www.saijaiphareab.shop`
- `INTERNAL_BASE_URL`: ไม่ต้องตั้งบน Vercel ใช้เฉพาะ server/Docker ที่มี Nuxt listener ภายใน
- `NUXT_PUBLIC_LIFF_ID`, `LINE_LIFF_CLIENT_ID`, `LINE_LIFF_CLIENT_SECRET`: ตั้งให้ตรงกับ LINE channel production

### Production checklist

```bash
pnpm exec prisma migrate deploy
NITRO_PRESET=vercel pnpm build
```

หลังต่อโดเมนผ่าน Cloudflare ให้เปิด WAF/rate limit สำหรับ request scan เช่น `../etc/passwd`, metadata URL, และ private localhost targets เพื่อลด serverless/DB connection spike
