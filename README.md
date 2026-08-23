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
| LINE OA Chat | `LINE_BIZ_CHAT_URL` | base URL สำหรับปุ่มเปิดแชทลูกค้าจากหน้าแอดมิน |
| Images | `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | แสดงและอัปโหลดรูปภาพ |
| Email | `RESEND_API_KEY`, `RESEND_FROM` | ส่งอีเมล |
| App | `NUXT_PUBLIC_HOSTNAME`, `NUXT_PUBLIC_BASE_URL`, `INTERNAL_BASE_URL` | host และ base URL ของระบบ |
| Scheduled task | `CRON_SECRET`, `PACKAGE_EXPIRY_NOTIFY_DAYS` | ป้องกัน cron endpoints และกำหนดช่วงแจ้งเตือนแพ็กเกจ |

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

### Migration ลูกค้าหน้าร้านแบบนำกลับมาใช้ซ้ำ

ก่อน deploy migration `20260818010000_remove_walk_in_orders` ต้องสำรองฐานข้อมูลและตรวจด้วยตนเองว่าไม่มีออเดอร์เดิมที่ใช้ `isWalkIn`, ไม่มีเอกสารหรือการชำระเงินที่ยังต้องอ้างถึง `walkin@saijai.local` และลบบัญชีกลางดังกล่าวแล้ว Migration จะหยุดโดยตั้งใจหากยังพบข้อมูลเหล่านี้ และจะไม่ลบหรือเดาเจ้าของข้อมูลแทนผู้ดูแลระบบ

ควรทดลอง migration chain กับฐานข้อมูล disposable ที่เป็นสำเนาโครงสร้าง/ข้อมูลก่อน production แล้วจึงรัน `pnpm exec prisma migrate deploy` กับฐานข้อมูลจริง ห้ามใช้ `db push` ข้าม precondition นี้

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

Local Compose เปิด PostgreSQL บน host port `5434` และเว็บบน [http://localhost:3004](http://localhost:3004) โดยอ่านค่า auth/base URL จาก `.env` และ fallback เป็น `http://localhost:3004` เมื่อไม่ได้กำหนดค่า หากทดสอบ LINE ผ่าน Cloudflare Tunnel ให้กำหนด URL HTTPS จาก Tunnel เช่น

```dotenv
BETTER_AUTH_URL=https://your-tunnel.example.com
BETTER_AUTH_TRUSTED_ORIGINS=https://your-tunnel.example.com,http://localhost:3004,http://127.0.0.1:3004
NUXT_PUBLIC_HOSTNAME=your-tunnel.example.com
NUXT_PUBLIC_BASE_URL=https://your-tunnel.example.com
INTERNAL_BASE_URL=http://127.0.0.1:3000
```

`NUXT_PUBLIC_HOSTNAME` ใส่เฉพาะ hostname โดยไม่มี `https://` จากนั้นตั้ง LINE LIFF Endpoint URL และ Messaging API Webhook URL เป็นโดเมนเดียวกัน โดย webhook ของโปรเจกต์คือ `https://your-tunnel.example.com/api/line/webhook` เมื่อใช้ public HTTPS URL เป็น `BETTER_AUTH_URL` ควรเปิดและทดสอบแอปผ่าน Tunnel URL เพื่อให้ secure session cookie ทำงานสม่ำเสมอ

#### การเปลี่ยนพอร์ต Local Compose

พอร์ตใน `docker-compose.local.yml` มีสองฝั่ง เช่น `3004:3000` หมายถึง host เปิดพอร์ต `3004` แต่แอปภายใน container ยังฟังพอร์ต `3000` การเปลี่ยนพอร์ตที่ใช้เปิดจากเครื่องให้แก้เฉพาะค่าฝั่งซ้าย

| สิ่งที่เปลี่ยน | จุดที่ต้องแก้ | ตัวอย่าง |
| --- | --- | --- |
| พอร์ต PostgreSQL บน host | `services.db.ports` ใน `docker-compose.local.yml` | `5434:5432` |
| พอร์ตเว็บบน host | `services.app.ports` ใน `docker-compose.local.yml` | `3004:3000` |
| พอร์ตเว็บของ Production Compose | `APP_PORT` ใน `.env` หรือ host port ใน `docker-compose.yml` | `APP_PORT=3004` |
| Better Auth origin | `BETTER_AUTH_URL` ใน `.env` | `http://localhost:3004` |
| Origin ที่อนุญาต | `BETTER_AUTH_TRUSTED_ORIGINS` ใน `.env` | `http://localhost:3004,http://127.0.0.1:3004` |
| Nuxt public URL | `NUXT_PUBLIC_BASE_URL` ใน `.env` | `http://localhost:3004` |
| Nuxt hostname | `NUXT_PUBLIC_HOSTNAME` ใน `.env` | `localhost` |

ตัวอย่าง `.env` สำหรับเปิดผ่าน localhost พอร์ต `3004`:

```dotenv
APP_PORT=3004
BETTER_AUTH_URL=http://localhost:3004
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3004,http://127.0.0.1:3004
NUXT_PUBLIC_HOSTNAME=localhost
NUXT_PUBLIC_BASE_URL=http://localhost:3004
INTERNAL_BASE_URL=http://127.0.0.1:3000
```

ห้ามเปลี่ยน `INTERNAL_BASE_URL`, `PORT` หรือพอร์ตด้านขวาของ mapping ตามพอร์ต host โดยอัตโนมัติ สำหรับ Docker configuration ปัจจุบันแอปภายใน container ยังใช้ `3000` และ PostgreSQL ภายใน Compose ยังใช้ `db:5432` เสมอ

`docker-compose.local.yml` override `DATABASE_URL` และ `DIRECT_URL` ภายใน container เป็น `db:5432` อยู่แล้ว หากรัน Prisma จากเครื่อง host โดยตรง ให้เปลี่ยนเฉพาะพอร์ตใน URL เป็นพอร์ต PostgreSQL ฝั่ง host เช่น `localhost:5434` ส่วน Production Compose ไม่มี PostgreSQL service และต้องใช้ database host จริง ห้ามใช้ `localhost` จาก migration/app container

หลังแก้พอร์ตหรือ origin ให้ตรวจ config และ recreate app container:

```bash
docker compose -f docker-compose.local.yml config --quiet
docker compose -f docker-compose.local.yml up -d --no-deps --force-recreate app
```

ถ้าเปลี่ยนพอร์ต PostgreSQL หรือยังไม่ได้สร้าง local stack ให้ recreate ทั้ง stack แทน:

```bash
docker compose down
docker compose -f docker-compose.local.yml up --build -d
```

Browser origin ต้องตรงกันทั้ง protocol, hostname และ port อย่าเปิดหน้าเว็บผ่าน Tunnel หรือ `127.0.0.1` แต่ให้ API ชี้ไป `localhost` เพราะ cookie, CORS และ browser access-control checks จะถือว่าเป็นคนละ origin

เข้า [http://localhost:3004](http://localhost:3004) และใช้รหัสผ่าน `password123` กับบัญชีใดบัญชีหนึ่ง

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

## ความปลอดภัย

การตั้งค่าหลักที่มีอยู่ในระบบ:

- **LINE login**: LIFF ID token ถูก verify ฝั่ง server กับ LINE (ตรวจ `aud`) ก่อนสร้าง/ผูกบัญชีเสมอ, webhook LINE ตรวจ signature แบบ HMAC + timing-safe และกัน event ซ้ำด้วย `webhookEventId`, token ที่ค้างใน URL hash หลัง LIFF redirect จะถูกล้างหลัง `liff.init()` สำเร็จ
- **Session/สิทธิ์**: `role`, `isActive`, `deletedAt` ฯลฯ ปิดการตั้งค่าผ่าน auth endpoints ด้วย `input: false` (ดู `app/utils/auth-user-fields.ts` และ regression test ใน `tests/server/authPrivilegeEscalation.test.ts`) — เปลี่ยน role ได้เฉพาะผ่าน admin API, session อายุ 7 วัน refresh วันละครั้ง, role/สถานะถูกอ่านใหม่จากฐานข้อมูลทุก request
- **HTTP headers**: ทุก response ใส่ CSP (อนุญาต iframe เฉพาะ origin ของ LINE เพื่อ LIFF), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` ผ่าน `routeRules` ใน `nuxt.config.ts`
- **Rate limiting**: claim บัญชีลูกค้า 20 ครั้ง/10 นาที/IP, แจ้งความสนใจแพ็กเกจ 5 ครั้ง/ชม./ผู้ใช้, อัปโหลด avatar 10 ครั้ง/ชม./ผู้ใช้ (in-memory — เพียงพอสำหรับการ deploy แบบ single instance)
- **Uploads**: ตรวจ declared MIME + magic bytes จริง (JPEG/PNG/WebP) + ขนาดไม่เกิน 5MB ทุกจุดอัปโหลด (`server/utils/imageUpload.ts`)
- **Dependencies**: `better-auth` ถูก pin ที่ `1.6.22` เป็นอย่างน้อย (แก้ชุด CVE กลางปี 2026) — การเลื่อนเป็น 1.7.x ต้องเพิ่มคอลัมน์ `issuer` ในตาราง account พร้อม migration ก่อน

ความเสี่ยงที่ยอมรับไว้ (accepted risks):

- ไม่บังคับยืนยันอีเมลก่อน login ด้วย email/password เพื่อให้ลูกค้า POS ที่ claim บัญชีเข้าใช้ได้ทันที (การ login ด้วย LINE ไม่ได้รับผลกระทบ)
- เบอร์โทรและ LINE user ID เก็บเป็น plaintext ในฐานข้อมูล (ควรคุมการเข้าถึงฐานข้อมูลให้เข้มแทน) และ session token เก็บตาม schema มาตรฐานของ better-auth
- rate limiter และ webhook dedupe เป็น in-memory — ถ้า scaling เป็นหลาย instance ต้องเปลี่ยนเป็น shared storage เช่น Redis

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
