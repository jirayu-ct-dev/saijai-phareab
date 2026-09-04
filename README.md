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
| Payment QR | `PAYMENT_QR_RECEIVER_KEYS` | เข้ารหัสหมายเลข PromptPay สำหรับ QR ผูกยอดบนใบแจ้งราคา |
| Email | `RESEND_API_KEY`, `RESEND_FROM` | ส่งอีเมล |
| App | `NUXT_PUBLIC_HOSTNAME`, `NUXT_PUBLIC_BASE_URL`, `INTERNAL_BASE_URL` | host และ base URL ของระบบ |
| Scheduled task | `CRON_SECRET`, `PACKAGE_EXPIRY_NOTIFY_DAYS` | ป้องกัน cron endpoints และกำหนดช่วงแจ้งเตือนแพ็กเกจ |
| Printing (app) | `NUXT_PUBLIC_PRINT_GATEWAY_ENABLED`, `NUXT_PUBLIC_PRINT_GATEWAY_URL`, `NUXT_PUBLIC_PRINT_LEGACY_DIRECT` | เปิด Gateway และคง USB/Bluetooth fallback |
| Printing (Gateway) | `PRINT_GATEWAY_*` | bind/publish address, discovery scope, pairing, state และ TLS ของ Gateway |

กำหนดเฉพาะ integration ที่ใช้งานจริง และห้าม commit secret ลง repository

สร้าง `BETTER_AUTH_SECRET` สำหรับเครื่อง local ได้ด้วยคำสั่ง เช่น

```bash
openssl rand -base64 48
```

สร้างกุญแจ AES 32 bytes สำหรับ PromptPay ด้วย `openssl rand -base64 32` แล้วใส่
ผลลัพธ์ใน `.env` เป็น JSON keyring เช่น `{"1":"<ผลลัพธ์ base64>"}` ภายใต้ตัวแปร
`PAYMENT_QR_RECEIVER_KEYS` ห้ามใช้ค่าตัวอย่าง ห้ามใส่หมายเลข PromptPay ใน `.env`
และห้าม commit กุญแจจริง จากนั้นผู้ดูแลระบบกำหนดหมายเลขโทรศัพท์และเปิดใช้งานที่
`/admin/settings/shop` หมายเลขเต็มจะถูกเข้ารหัสในฐานข้อมูลและ QR จะปรากฏเฉพาะ
ใบแจ้งราคาสถานะ `UNPAID` ที่มียอดมากกว่า 0 บาท

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

Compose แยกเป็นสาม project เพื่อไม่ให้ container ของแต่ละงานทับหรือกลายเป็น
orphan ของกันและกัน:

| ไฟล์ | Project | หน้าที่ |
| --- | --- | --- |
| `docker-compose.local.yml` | `saijai-phareab` | เว็บ + PostgreSQL + demo seed ในเครื่อง |
| `docker-compose.yml` | `saijai-phareab-production` | migration job + เว็บ production |
| `docker-compose.print-gateway.yml` | `saijai-print-gateway` | Gateway ที่อยู่ในร้าน |

ทุกคำสั่งควรระบุ `-f` ให้ตรง stack เสมอ อย่าใช้ `docker compose down` เปล่า ๆ
เพราะอาจเลือกไฟล์ production โดยไม่ตั้งใจ

### Production

`docker-compose.yml` เป็น production workflow โดยรับ PostgreSQL จากบริการภายนอก รัน `prisma migrate deploy` ให้สำเร็จก่อนเปิดแอป และไม่สร้างบัญชีหรือข้อมูล demo

กำหนด `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_SECRET`, URL และ provider credentials ที่ใช้งานจริงใน `.env` หรือ secret manager ของ deployment platform แล้วตรวจ rendered config ก่อนรัน การรันคำสั่งนี้จะใช้ `DIRECT_URL` ทำ migration กับฐานข้อมูลที่กำหนดจริง จึงควรมี backup และผ่าน migration gate ก่อนเสมอ

```bash
docker compose -f docker-compose.yml config --quiet
docker compose -f docker-compose.yml up --build -d
```

`DIRECT_URL` ใช้โดย migration job และควรเป็น direct PostgreSQL connection ส่วน `DATABASE_URL` ใช้ตอนแอปทำงานและอาจเป็น pooled connection แอปจะไม่เริ่มหาก migration ล้มเหลว ตรวจสอบได้ด้วย

```bash
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml logs migrate
docker compose -f docker-compose.yml logs app
```

Compose ไม่ได้สร้าง PostgreSQL, ไม่เปิด database port และไม่จัดการ TLS, reverse proxy หรือ certificate ให้ ควรให้ deployment platform หรือ infrastructure ภายนอกรับผิดชอบส่วนเหล่านี้

### Local/demo พร้อมข้อมูลทดสอบ

ใช้ Compose override แยกเมื่อต้องการ PostgreSQL local และบัญชีทดสอบพร้อมใช้งาน

```bash
docker compose -f docker-compose.local.yml up --build -d
docker compose -f docker-compose.print-gateway.yml up --build -d
```

Local Compose เปิด PostgreSQL บน host port `5434`, เว็บบน [http://localhost:3004](http://localhost:3004) และ Gateway บน `http://127.0.0.1:17321` ค่า default ของ Gateway ค้นหาเพียง fake target `127.0.0.1:19100` จึงไม่สแกน LAN หรือแตะเครื่องพิมพ์จริง การใช้ local profile ไม่บังคับเพิ่ม `PRINT_GATEWAY_*` ลง `.env`; Compose มี fallback ที่ปลอดภัยสำหรับ profile นี้

การพิมพ์ภาษาไทยของ XP-C260M ใช้ Hybrid raster เป็นค่าเริ่มต้น: ASCII/ตัวเลขล้วนยังเป็น native ESC/POS เพื่อความเร็ว แต่ทุก text block ที่มีภาษาไทยจะ render ด้วย Prompt font ที่ bundle ใน `public/fonts/` แล้วส่งเป็น `GS v 0` raster bands ไม่เกิน 576 dots ดูขั้นตอนสร้างและตรวจ physical fixture ที่ [`docs/xprinter-thai-raster-physical-test.md`](docs/xprinter-thai-raster-physical-test.md)

ตรวจสถานะหลังเริ่มระบบ:

```bash
docker compose -f docker-compose.local.yml ps
docker compose -f docker-compose.local.yml logs setup
docker compose -f docker-compose.print-gateway.yml ps
curl -fsS http://127.0.0.1:3004/ >/dev/null
curl -fsS -H 'Origin: http://localhost:3004' http://127.0.0.1:17321/health
```

`setup` ใช้ `prisma db push --accept-data-loss` เฉพาะฐาน local/demo แล้ว seed ข้อมูลทดสอบ เพื่อให้ schema ที่ตั้งใจลบตารางเก่าปรับได้อัตโนมัติ ห้ามนำคำสั่งนี้ไปใช้กับ shared, staging หรือ production database

หากทดสอบ LINE ผ่าน Cloudflare Tunnel ให้กำหนด URL HTTPS จาก Tunnel เช่น

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
docker compose -f docker-compose.local.yml down --remove-orphans
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

#### ระบบพิมพ์โดยตรง

Wi-Fi/Ethernet ใช้ LAN Print Gateway ภายในร้านซึ่งอ่านค่าจาก `.env`, ค้นหาเฉพาะ CIDR/port ที่อนุญาต และให้ browser จับคู่ก่อนเลือก trusted printer โดยไม่มี database queue ส่วน USB และ Bluetooth ยังเชื่อมจาก browser โดยตรง

ค่าที่ต้องกำหนดใน `.env` เมื่อใช้เครื่องจริงมีดังนี้:

| ตัวแปร | Local เครื่องเดียว | เครื่อง Gateway ในร้าน / production |
| --- | --- | --- |
| `NUXT_PUBLIC_PRINT_GATEWAY_ENABLED` | `true` | `true` หลัง Gateway และ HTTPS พร้อม |
| `NUXT_PUBLIC_PRINT_GATEWAY_URL` | `http://127.0.0.1:17321` | URL HTTPS ของ Gateway ที่อุปกรณ์ร้านเข้าถึงได้ |
| `NUXT_PUBLIC_PRINT_LEGACY_DIRECT` | `true` | `true` เพื่อคง USB/Bluetooth |
| `PRINT_GATEWAY_BIND_HOST` | `127.0.0.1` สำหรับรัน Node ตรง | Docker บังคับ `0.0.0.0` ภายใน container |
| `PRINT_GATEWAY_PUBLISH_HOST` | `127.0.0.1` | `0.0.0.0` เพื่อรับจาก LAN หรือ IP interface ที่ต้องการ |
| `PRINT_GATEWAY_PORT` | `17321` | พอร์ต HTTPS ของ Gateway เช่น `17321` |
| `PRINT_GATEWAY_PUBLIC_URL` | `http://127.0.0.1:17321` | URL เดียวกับ public Gateway และต้องเป็น HTTPS |
| `PRINT_GATEWAY_ALLOWED_ORIGINS` | `http://localhost:3004,http://127.0.0.1:3004` | origin ของเว็บ production แบบ exact match |
| `PRINT_GATEWAY_DISCOVERY_CIDRS` | `127.0.0.1/32` สำหรับ fake profile | CIDR ส่วนตัวของร้าน เช่น `192.168.1.0/24` |
| `PRINT_GATEWAY_DISCOVERY_PORTS` | `19100` สำหรับ fake profile | `9100` สำหรับ XP-C260M ตัวจริงตาม self-test ล่าสุด |
| `PRINT_GATEWAY_PAIRING_SECRET` | fallback local ใช้ทดสอบได้ | random secret อย่างน้อย 32 bytes ห้าม commit |
| `PRINT_GATEWAY_STATE_PATH` | ใช้ `/data/gateway-state.json` ใน Docker | Compose กำหนด path นี้และเก็บใน named volume |
| `PRINT_GATEWAY_TLS_CERT_HOST_PATH`, `PRINT_GATEWAY_TLS_KEY_HOST_PATH` | ไม่ต้องใช้บน loopback | absolute paths ของ cert/key ที่อุปกรณ์ร้านเชื่อถือ |

สร้าง pairing secret สำหรับ production แล้วนำผลไปใส่ secret manager หรือ `.env`
บน Gateway host โดยไม่ส่งค่าผ่านแชตหรือ commit:

```bash
openssl rand -base64 48
chmod 600 .env
```

XP-C260M ตัวจริงยืนยัน `TCP Server` port `9100` จาก self-test ล่าสุดแล้ว ส่วน `172.20.10.2` เป็น DHCP address ชั่วคราวจาก mobile hotspot ใช้ได้เฉพาะการทดสอบที่บ้าน Production ต้องแทน CIDR ด้วย IP ของเครื่องพิมพ์หลังเชื่อมเครือข่ายร้าน เมื่อค่าจริงพร้อม ให้รัน Gateway production ด้วย:

```bash
docker compose \
  -f docker-compose.print-gateway.yml \
  -f docker-compose.print-gateway.production.yml \
  config --quiet

docker compose \
  -f docker-compose.print-gateway.yml \
  -f docker-compose.print-gateway.production.yml \
  up --build -d
```

สร้างรหัส pairing หกหลักจาก environment เดียวกับ container:

```bash
docker compose -f docker-compose.print-gateway.yml \
  run --rm print-gateway node bin/bridge.mjs --pairing-code
```

รายละเอียด API, trust model และข้อจำกัดด้านความปลอดภัยอยู่ที่ [`print-bridge/README.md`](print-bridge/README.md)

ทดสอบเส้นทาง Bridge ด้วย fake transport โดยไม่แตะเครื่องจริง:

```bash
pnpm exec vitest run tests/server/printBridgeDirectServer.test.ts tests/server/printBridgeTransport.test.ts
```

### หยุดและล้าง Docker อย่างปลอดภัย

คำสั่งต่อไปนี้ลบ container/network ของแต่ละ stack แต่เก็บ database และ Gateway state volumes:

```bash
docker compose -f docker-compose.local.yml down --remove-orphans
docker compose -f docker-compose.print-gateway.yml down --remove-orphans
docker compose -f docker-compose.yml down --remove-orphans
```

ตรวจสิ่งที่เป็นของโปรเจกต์ก่อนลบ image หรือ volume เพิ่ม:

```bash
docker ps -a --filter label=com.docker.compose.project=saijai-phareab
docker ps -a --filter label=com.docker.compose.project=saijai-phareab-production
docker ps -a --filter label=com.docker.compose.project=saijai-print-gateway
docker volume ls --filter label=com.docker.compose.project=saijai-phareab
docker volume ls --filter label=com.docker.compose.project=saijai-print-gateway
```

`saijai-pgdata` คือข้อมูล PostgreSQL local และ `saijai-print-gateway-state` คือ
trusted printers/token hashes การลบสอง volume นี้จะลบข้อมูลดังกล่าวจริง จึงต้องหยุด stack
และตั้งใจ reset เท่านั้น:

```bash
docker volume rm saijai-pgdata
docker volume rm saijai-print-gateway-state
```

อย่าใช้ `docker system prune --volumes` บนเครื่องที่มีหลายโปรเจกต์ เพราะคำสั่งนั้นอาจลบ
volume/image/cache ของงานอื่นซึ่ง Compose labels ไม่ได้จำกัดให้โปรเจกต์นี้

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
docker compose -f docker-compose.yml config --quiet
docker compose -f docker-compose.local.yml config --quiet
docker compose -f docker-compose.print-gateway.yml config --quiet
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
- **การพักงาน (`isActive=false`)**: session ของผู้ถูกพักจะถูกเพิกถอนทันที และถูกกันออกจากทุกหน้า/API ของ `/admin` (ทั้ง middleware และ `requireRole`) แต่ยังใช้งานฝั่งลูกค้า `/me` ได้ตามปกติเหมือนผู้ใช้ทั่วไป เพราะ `requireUser` ไม่บล็อกผู้ที่ถูกพัก (regression test ใน `tests/server/authSuspensionAccess.test.ts`)
- **HTTP headers**: ทุก response ใส่ CSP (อนุญาต iframe เฉพาะ origin ของ LINE เพื่อ LIFF), HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` ผ่าน `routeRules` ใน `nuxt.config.ts` — inline script ที่ Nuxt ฉีดเอง (color-mode และ `window.__NUXT__` ที่มี buildId เปลี่ยนทุก build) ได้รับอนุญาตผ่าน sha256 hash ที่คำนวณต่อ response โดย `server/plugins/csp-inline-script-hash.ts` โดยไม่ต้องเปิด `'unsafe-inline'`
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
