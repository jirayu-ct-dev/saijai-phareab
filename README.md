# Saijai Phareab

ระบบจัดการร้านซักรีด Saijai Phareab สำหรับลูกค้า พนักงาน และผู้ดูแลระบบ พัฒนาด้วย Nuxt แบบ full-stack โดยเน้นหน้าจอภาษาไทยและการใช้งานบนมือถือ

ฟังก์ชันหลักประกอบด้วยการจัดการลูกค้าและสมาชิก แพ็กเกจและเครดิตงานบริการ ออเดอร์ซักรีด การชำระเงิน รายงาน หน้าจอผู้ดูแลระบบ การเข้าสู่ระบบด้วยบัญชีปกติหรือ LINE LIFF และการแจ้งเตือนแพ็กเกจที่ใกล้หมดอายุ

## เทคโนโลยีหลัก

- Nuxt 4, Vue 3 และ TypeScript
- Nuxt UI 4 และ Tailwind CSS 4
- Nitro server routes ใน `server/api/`
- PostgreSQL, Prisma 7 และ `@prisma/adapter-pg`
- Better Auth พร้อมบทบาท `USER`, `EMPLOYEE` และ `ADMIN`
- Zod สำหรับตรวจสอบข้อมูลเข้า
- Vitest สำหรับ unit tests
- LINE LIFF / Messaging API, Cloudinary และ Resend

โปรเจกต์นี้ใช้ `pnpm` เท่านั้น เวอร์ชันแพ็กเกจที่ติดตั้งจริงดูได้จาก `package.json` และ `pnpm-lock.yaml`

## เริ่มต้นใช้งาน

### สิ่งที่ต้องมี

- Node.js 24 แนะนำให้ใช้เวอร์ชันเดียวกับ `Dockerfile`
- Corepack หรือ pnpm
- PostgreSQL ที่เข้าถึงได้

### 1. ติดตั้ง dependencies

```bash
corepack enable
pnpm install
```

### 2. ตั้งค่า environment

```bash
cp .env.example .env
```

แก้ค่าใน `.env` ให้ตรงกับเครื่องและบริการที่ใช้งานจริง โดยตัวแปรสำคัญมีดังนี้

| กลุ่ม | ตัวแปร | ใช้สำหรับ |
| --- | --- | --- |
| Database | `DATABASE_URL` | การเชื่อมต่อ PostgreSQL ขณะรันแอป |
| Database | `DIRECT_URL` | Prisma CLI, migrations และ seed |
| Auth | `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` | URL และ secret ของ Better Auth |
| Auth | `BETTER_AUTH_TRUSTED_ORIGINS`, `TRUSTED_PROXIES` | origin และ proxy ที่เชื่อถือได้ |
| LINE Login | `NUXT_PUBLIC_LIFF_ID`, `LINE_LIFF_CLIENT_ID`, `LINE_LIFF_CLIENT_SECRET` | LINE LIFF และการเข้าสู่ระบบ |
| LINE Messaging | `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET` | ส่งข้อความและยืนยัน webhook/provider |
| Images | `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | แสดงและอัปโหลดรูปภาพ |
| Email | `RESEND_API_KEY`, `RESEND_FROM` | ส่งอีเมล |
| App | `NUXT_PUBLIC_HOSTNAME`, `NUXT_PUBLIC_BASE_URL`, `INTERNAL_BASE_URL` | host และ base URL ของระบบ |
| Scheduled task | `CRON_SECRET`, `PACKAGE_EXPIRY_NOTIFY_DAYS` | ป้องกัน cron endpoint และกำหนดช่วงแจ้งเตือน |

กำหนดเฉพาะ integration ที่ใช้งานจริง และห้าม commit secret ลง repository

สร้าง `BETTER_AUTH_SECRET` สำหรับเครื่อง local ได้ด้วยคำสั่ง เช่น

```bash
openssl rand -base64 48
```

### 3. เตรียมฐานข้อมูล

สร้างหรือใช้ฐานข้อมูลสำหรับ development โดยเฉพาะ แล้วรัน migrations และสร้าง Prisma Client

```bash
pnpm exec prisma migrate dev
pnpm exec prisma generate
```

หากต้องการข้อมูลตั้งต้นขั้นต่ำ

```bash
pnpm exec prisma db seed
```

ไฟล์ `prisma/seed-full.ts` มีไว้สำหรับชุดข้อมูล demo ขนาดใหญ่ ไม่ควรรันกับฐานข้อมูลร่วมกันหรือ production โดยไม่ตรวจสอบก่อน

### 4. รัน development server

```bash
pnpm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

## Deploy บน Vercel

ใช้ build command `pnpm run build` ซึ่งจะรัน `prisma generate` ก่อน `nuxt build` อัตโนมัติ ตั้ง environment variables สำหรับ production ใน Vercel โดยอย่างน้อยต้องมี `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` และ `PRISMA_POOL_MAX=1`

รัน migration กับฐานข้อมูล production แยกจาก application build:

```bash
pnpm exec prisma migrate deploy
```

`DATABASE_URL` ควรเป็น pooled connection สำหรับ runtime ส่วน `DIRECT_URL` ใช้ direct connection สำหรับ migration และไม่ควร seed ข้อมูล demo บน production

## รันด้วย Docker Compose

### Production

`docker-compose.yml` เป็น production workflow โดยรับ PostgreSQL จากบริการภายนอก รัน `prisma migrate deploy` ให้สำเร็จก่อนเปิดแอป และไม่สร้างบัญชีหรือข้อมูล demo

กำหนด `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, URL และ provider credentials ที่ใช้งานจริงใน `.env` หรือ secret manager ของ deployment platform แล้วรัน

```bash
docker compose up --build -d
```

`DIRECT_URL` ใช้โดย migration job และควรเป็น direct PostgreSQL connection ส่วน `DATABASE_URL` ใช้ตอนแอปทำงานและอาจเป็น pooled connection แอปจะไม่เริ่มหาก migration ล้มเหลว ตรวจสอบได้ด้วย

```bash
docker compose ps
docker compose logs migrate
docker compose logs app
```

Compose ไม่ได้สร้าง PostgreSQL, ไม่เปิด database port และไม่จัดการ TLS, reverse proxy หรือ certificate ให้ ควรให้ deployment platform หรือ infrastructure ภายนอกรับผิดชอบส่วนเหล่านี้

### Local/demo พร้อมข้อมูลทดสอบ

ใช้ Compose override แยกเมื่อต้องการ PostgreSQL local และบัญชีทดสอบพร้อมใช้งาน

```bash
docker compose -f docker-compose.local.yml up --build -d
```

Local Compose override ค่า auth/base URL เป็น `http://localhost:3000` โดยตั้งใจ เพื่อให้ session cookie ทำงานบน HTTP local แม้ `.env` จะเก็บ URL ของ production ไว้ ให้เปิดผ่าน `http://localhost:3000` เป็นหลัก

เข้า [http://localhost:3000](http://localhost:3000) และใช้รหัสผ่าน `password123` กับบัญชีใดบัญชีหนึ่ง

| บทบาท | Email |
| --- | --- |
| Admin | `admin@saijai.local` |
| Employee | `employee@saijai.local` |
| Customer | `customer@saijai.local` |
| Member | `customer2@saijai.local` |

ข้อมูล PostgreSQL เก็บใน Docker volume ชื่อ `saijai-pgdata` การลบ volume จะลบข้อมูลฐานข้อมูลด้วย

## คำสั่งที่ใช้บ่อย

```bash
pnpm run dev                       # development server
pnpm test                          # รัน Vitest ทั้งหมด
pnpm exec nuxi typecheck           # ตรวจ TypeScript และ Vue
pnpm run build                     # production build
pnpm run preview                   # preview build ในเครื่อง
pnpm exec prisma generate          # สร้าง Prisma Client
pnpm exec prisma migrate dev       # ใช้/สร้าง migration สำหรับ development
pnpm exec prisma db seed           # seed ข้อมูลตั้งต้น
docker compose config --quiet      # ตรวจ syntax ของ Compose
docker compose -f docker-compose.local.yml config --quiet
```

ขณะนี้ repository ยังไม่มี lint script ที่พร้อมใช้งาน แม้จะมี `eslint.config.mjs` และโมดูล `@nuxt/eslint` จึงไม่ควรสมมติว่า `pnpm exec eslint .` ใช้งานได้

## โครงสร้างโปรเจกต์

```text
app/                         Vue pages, layouts, components และ client composables
  pages/                     หน้าสาธารณะ, auth, member และ admin
  plugins/liff-init.client.ts ตรวจบริบทและเริ่มต้น LINE LIFF SDK
  middleware/                session, LIFF auto login และ route guards ฝั่ง client
  generated/prisma/          Prisma Client ที่ generate แล้ว ห้ามแก้ด้วยมือ
server/
  api/                       Nitro API แบ่งเป็น public, auth, me, line และ admin
  middleware/auth-session.ts session hydration และนโยบายสิทธิ์ส่วนกลาง
  utils/                     business rules, auth helpers และ integrations
shared/                      types, config และ utilities ที่ใช้ร่วมกัน
prisma/
  schema.prisma              schema หลักของ PostgreSQL
  migrations/                ประวัติ migrations
  seed.ts                    seed เริ่มต้น
tests/                       Vitest tests ของ domain logic และ shared utilities
```

เส้นทาง `/api/me/**` ต้องอ้างอิงผู้ใช้จาก session และตรวจ ownership ส่วนเส้นทาง admin ใช้นโยบายใน `server/middleware/auth-session.ts` ร่วมกับ role checks ใน handler สถานะสมาชิกไม่ได้มาจาก role โดยตรง แต่คำนวณจาก entitlement ที่ยัง active

รายละเอียดแนวทางสำหรับ AI coding agents และข้อควรระวังในการแก้โค้ดอยู่ใน [`AGENTS.md`](./AGENTS.md)

## การทดสอบและข้อควรรู้

ก่อนส่งการเปลี่ยนแปลง ควรรันอย่างน้อยคำสั่งที่ตรงกับส่วนที่แก้ เช่น `pnpm test`, `pnpm exec nuxi typecheck` และ `pnpm run build`

- typecheck ปัจจุบันมี baseline errors บางจุดในหน้า member/admin และ server utilities ควรแยก error เดิมออกจาก regression ที่เกิดจากงานใหม่
- build อาจต้องเชื่อมต่อภายนอกเพื่อดาวน์โหลด Google, Bunny หรือ Fontsource fonts
- cron แจ้งเตือนแพ็กเกจรันเวลา `02:00 UTC` หรือ `09:00 Asia/Bangkok`
- migration `20260522000000_reconcile_schema` เป็น no-op โดยตั้งใจ เพราะเนื้อหาเดิมซ้ำกับ migrations ก่อนหน้า; `20260807000000_sync_current_schema` เติม schema changes ที่เคยขาดจาก migration history
- repository ยังไม่มี Nginx, TLS หรือ platform-specific infrastructure configuration; production Compose ดูแลเฉพาะ migration และ Node application

## ข้อมูลอ้างอิง

- [`AGENTS.md`](./AGENTS.md) — โครงสร้าง สถาปัตยกรรม แนวทางการแก้ไข และข้อควรระวังสำหรับ coding agents
- [`IDEA.md`](./IDEA.md) — แนวคิดและภาพรวมผลิตภัณฑ์เดิม ซึ่งอาจไม่ตรงกับ implementation ล่าสุดทุกจุด
