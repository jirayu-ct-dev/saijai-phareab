# Saijai Phareab

ระบบจัดการร้านซักรีดแบบ Thai-first และ mobile-first สำหรับลูกค้า สมาชิก พนักงาน
และผู้ดูแลระบบ ครอบคลุมออเดอร์ แพ็กเกจ/เครดิต การชำระเงิน ใบแจ้งราคา ใบเสร็จ
รายงาน LINE LIFF การแจ้งเตือน และการพิมพ์เครื่องความร้อนผ่าน Wi-Fi/Ethernet,
USB หรือ Bluetooth

โปรเจกต์เป็น Nuxt 4 full-stack application เดียว ใช้ Vue 3, TypeScript, Nuxt UI,
Tailwind CSS, Nitro API, PostgreSQL, Prisma, Better Auth และ Vitest โดยใช้ `pnpm`
กับ `pnpm-lock.yaml` เท่านั้น

## เลือกวิธีรัน

มี 2 วิธีหลัก:

1. **รันบนเครื่อง** — เหมาะกับพัฒนา แก้โค้ด และดูผลทันทีด้วย `pnpm dev`
2. **รันด้วย Docker** — เหมาะกับ local/demo ที่ต้องการฐานข้อมูลพร้อมใช้ หรือ production host

ทั้งสองวิธีอ่านค่าจาก `.env` ที่ root ของโปรเจกต์ ห้าม commit `.env`, database URL,
token, certificate private key หรือ secret จริง

## ลงรายการรับผ้าย้อนหลัง

ที่หน้า POS รับผ้า เปิด **ลงรายการย้อนหลัง** แล้วระบุวันและเวลารับผ้าจริง
(เวลาไทย), สถานะปัจจุบัน และวันเสร็จจริงหากงานเสร็จแล้ว หากรับเงินแล้วให้ระบุ
วันที่รับเงินจริงและวิธีชำระเงิน จากนั้นบันทึกครั้งเดียว ไม่ต้องเปลี่ยนสถานะย้อนหลังทีละขั้น
ระบบไม่ส่ง LINE แจ้งเตือนตอนสร้างรายการย้อนหลัง และไม่เปลี่ยนสถานะที่เลือกอัตโนมัติ

วันรับผ้าและวันรับเงินจริงใช้ในรายงานงานและรายรับ ส่วนเวลาคีย์ ผู้บันทึก และเลขเอกสาร
อิงการบันทึกปัจจุบัน หน้ารายละเอียดแสดงเครื่องหมายลงรายการย้อนหลังพร้อมเวลาบันทึก
ห้ามระบุวันอนาคต วันเสร็จ/วันรับเงิน/วันนัดรับต้องไม่ก่อนวันรับผ้า

แพ็กเกจย้อนหลังต้องครอบคลุมวันรับผ้าจริงและไม่ถูกพัก ยกเลิก หรือลบ ใช้แพ็กเกจที่
ปัจจุบันหมดอายุได้หากตรงเงื่อนไข โดยหักจากเครดิตคงเหลือปัจจุบันและไม่เปิดใช้แพ็กเกจใหม่
เครดิตหลักไม่พอจะคิดเงินส่วนเกินตาม POS เดิม ราคาบริการ ภาษี และค่าบริการอิงค่าที่แสดง
ปัจจุบัน จึงต้องตรวจยอดให้ตรงกับที่รับจริงก่อนบันทึก และใช้เฉพาะรายการที่ยังไม่เคยคีย์

## Environment

สร้างไฟล์ตั้งค่าก่อน:

```bash
cp .env.example .env
chmod 600 .env
```

ตัวแปรขั้นต่ำของแอป:

| กลุ่ม | ตัวแปร | ที่มา/หน้าที่ |
| --- | --- | --- |
| Database | `DATABASE_URL` | PostgreSQL URL สำหรับ runtime; production ควรใช้ pooled URL |
| Database | `DIRECT_URL` | PostgreSQL direct URL สำหรับ Prisma migration |
| Auth | `BETTER_AUTH_URL` | URL ที่ผู้ใช้เปิดเว็บ เช่น `http://localhost:3000` |
| Auth | `BETTER_AUTH_SECRET` | สร้างด้วย `openssl rand -base64 48` |
| Auth | `BETTER_AUTH_TRUSTED_ORIGINS` | origin ที่อนุญาตแบบตรง protocol/host/port |
| App | `NUXT_PUBLIC_HOSTNAME` | hostname อย่างเดียว ไม่มี protocol |
| App | `NUXT_PUBLIC_BASE_URL` | public URL ของเว็บ |
| App | `INTERNAL_BASE_URL` | URL ที่ server ใช้เรียกตัวเอง |

กำหนด integration ต่อไปนี้เฉพาะเมื่อใช้งาน:

| Integration | ตัวแปร |
| --- | --- |
| LINE login | `NUXT_PUBLIC_LIFF_ID`, `LINE_LIFF_CLIENT_ID`, `LINE_LIFF_CLIENT_SECRET` |
| LINE Messaging | `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET` |
| LINE OA Chat | `LINE_BIZ_CHAT_URL` |
| Cloudinary | `CLOUDINARY_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Resend | `RESEND_API_KEY`, `RESEND_FROM` |
| Scheduled task | `CRON_SECRET`, `PACKAGE_EXPIRY_NOTIFY_DAYS` |
| Payment QR | `PAYMENT_QR_RECEIVER_KEYS` |
| LAN printing | `NUXT_PUBLIC_PRINT_GATEWAY_ENABLED`, `NUXT_PUBLIC_PRINT_GATEWAY_URL` |

### Payment QR

สร้าง AES key 32 bytes:

```bash
openssl rand -base64 32
```

เก็บผลลัพธ์ใน secret environment ของ app host เป็น JSON keyring:

```dotenv
PAYMENT_QR_RECEIVER_KEYS={"1":"<BASE64_KEY>"}
```

จากนั้นผู้ดูแลตั้งหมายเลข PromptPay ที่ `/admin/settings/shop` หมายเลขเต็มจะถูก
เข้ารหัสในฐานข้อมูล อย่าใส่หมายเลขหรือ key ในตัวแปร `NUXT_PUBLIC_*`

## วิธีที่ 1: รันบนเครื่อง

### สิ่งที่ต้องมี

- Node.js 24
- Corepack/pnpm
- PostgreSQL สำหรับ development ที่เข้าถึงได้

### ติดตั้งและเตรียมฐานข้อมูล

```bash
corepack enable
pnpm install
pnpm exec prisma migrate dev
pnpm exec prisma generate
```

หากต้องการข้อมูลตั้งต้นขั้นต่ำ:

```bash
pnpm exec prisma db seed
```

`prisma/seed-full.ts` เป็นข้อมูล demo ขนาดใหญ่และไม่ใช่ default seed ห้ามรันกับ
ฐาน shared/staging/production โดยไม่ได้ตั้งใจ

### รันเว็บ

```bash
pnpm dev
```

เปิด [http://localhost:3000](http://localhost:3000) หรือ URL ที่ Nuxt แสดงใน terminal
หากเปลี่ยน port ต้องปรับ `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS` และ
`NUXT_PUBLIC_BASE_URL` ให้เป็น origin เดียวกัน

### รัน Print Gateway บนเครื่องเดียวกัน (ถ้าต้องการ)

การพิมพ์ Wi-Fi/Ethernet ต้องมี Print Gateway ที่เปิดอยู่บนเครื่องในเครือข่ายร้าน
ส่วน USB/Bluetooth ไม่ต้องใช้ Gateway

สำหรับ browser และ Gateway บนเครื่องเดียวกัน:

```dotenv
NUXT_PUBLIC_PRINT_GATEWAY_ENABLED=true
NUXT_PUBLIC_PRINT_GATEWAY_URL=http://127.0.0.1:17321

PRINT_GATEWAY_BIND_HOST=127.0.0.1
PRINT_GATEWAY_PORT=17321
PRINT_GATEWAY_PUBLIC_URL=http://127.0.0.1:17321
PRINT_GATEWAY_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
PRINT_GATEWAY_DISCOVERY_CIDRS=<CONFIRMED_PRINTER_IP>/32
PRINT_GATEWAY_DISCOVERY_PORTS=9100
PRINT_GATEWAY_STATE_PATH=./print-bridge/gateway-state.json
```

หา `<CONFIRMED_PRINTER_IP>` จาก self-test หรือ DHCP client list ของ router แล้วทำ
DHCP reservation ให้ IP คงที่ เครื่อง XP-C260M ที่ตรวจแล้วใช้ raw TCP port `9100`
แต่ IP `172.20.10.2` เป็นเพียงค่า DHCP ชั่วคราวจาก hotspot ไม่ใช่ IP ร้าน

เริ่ม Gateway:

```bash
pnpm print-gateway
```

ตรวจโดยไม่ส่งงานพิมพ์:

```bash
curl -fsS \
  -H 'Origin: http://localhost:3000' \
  http://127.0.0.1:17321/health
```

ถ้าจะให้โทรศัพท์หรือเครื่องอื่นในร้านเรียก Gateway ต้องใช้ HTTPS hostname ที่ certificate
ถูกเชื่อถือ ตั้ง `PRINT_GATEWAY_BIND_HOST` เป็น LAN interface/`0.0.0.0` และใช้
`PRINT_GATEWAY_TLS_CERT_PATH` กับ `PRINT_GATEWAY_TLS_KEY_PATH` ห้ามเปิด raw port
`9100` หรือ Gateway สู่ public internet

## วิธีที่ 2: รันด้วย Docker

Compose แยกเป็น 3 stack เพื่อไม่ให้ container และ lifecycle ปะปนกัน:

| ไฟล์ | หน้าที่ |
| --- | --- |
| `docker-compose.local.yml` | เว็บ + PostgreSQL 16 + demo seed สำหรับ local |
| `docker-compose.yml` | migration job + production app โดยใช้ PostgreSQL ภายนอก |
| `docker-compose.print-gateway.yml` | Print Gateway แยกสำหรับเครื่องในร้าน |

ระบุ `-f` ทุกครั้ง อย่าใช้ `docker compose down` โดยไม่ระบุไฟล์

### Local/demo

```bash
docker compose -f docker-compose.local.yml config --quiet
docker compose -f docker-compose.local.yml up --build -d
```

บริการที่ได้:

- เว็บ: [http://localhost:3004](http://localhost:3004)
- PostgreSQL จาก host: `localhost:5434`
- PostgreSQL ภายใน Compose: `db:5432`

Compose จะใช้ `prisma db push --accept-data-loss` และ `seed-full.ts` เฉพาะฐาน local/demo
ใน stack นี้ ห้ามนำ workflow ดังกล่าวไปใช้กับฐาน production

ตรวจสถานะ:

```bash
docker compose -f docker-compose.local.yml ps
docker compose -f docker-compose.local.yml logs setup
docker compose -f docker-compose.local.yml logs app
curl -fsS http://127.0.0.1:3004/ >/dev/null
```

บัญชี demo ใช้รหัสผ่าน `password123`:

| บทบาท | Email |
| --- | --- |
| Admin | `admin@saijai.local` |
| Employee | `employee@saijai.local` |
| Customer | `customer@saijai.local` |
| Member | `customer2@saijai.local` |

ฐาน local อยู่ใน volume `saijai-pgdata` และไม่หายเมื่อ recreate container

### Print Gateway ด้วย Docker

ค่าเริ่มต้นของ Compose เป็น loopback และค้นหา fake target `127.0.0.1:19100` จึงไม่
สแกน LAN หรือแตะเครื่องจริง:

```bash
docker compose -f docker-compose.print-gateway.yml config --quiet
docker compose -f docker-compose.print-gateway.yml up --build -d
docker compose -f docker-compose.print-gateway.yml ps
curl -fsS \
  -H 'Origin: http://localhost:3004' \
  http://127.0.0.1:17321/health
```

สำหรับ Gateway production ในร้าน ให้กำหนดใน `.env` ของ Gateway host:

```dotenv
PRINT_GATEWAY_PUBLISH_HOST=0.0.0.0
PRINT_GATEWAY_PORT=17321
PRINT_GATEWAY_PUBLIC_URL=https://print.saijaiphareab.shop:17321
PRINT_GATEWAY_ALLOWED_ORIGINS=https://saijaiphareab.shop
PRINT_GATEWAY_DISCOVERY_CIDRS=<CONFIRMED_SHOP_PRINTER_IP>/32
PRINT_GATEWAY_DISCOVERY_PORTS=9100
PRINT_GATEWAY_TLS_CERT_HOST_PATH=/absolute/path/to/fullchain.pem
PRINT_GATEWAY_TLS_KEY_HOST_PATH=/absolute/path/to/privkey.pem
```

จากนั้นรัน base Compose คู่กับ production overlay:

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

ฝั่ง app/Vercel ต้องตั้งและ redeploy:

```dotenv
NUXT_PUBLIC_PRINT_GATEWAY_ENABLED=true
NUXT_PUBLIC_PRINT_GATEWAY_URL=https://print.saijaiphareab.shop:17321
```

สองค่านี้เป็น browser-visible และเป็น build input ของ CSP เมื่อเปลี่ยน URL ต้อง rebuild
เว็บ ไม่ใช่เพียง restart server เท่านั้น Gateway ไม่มี pairing code; ความปลอดภัยอาศัย
private LAN, exact-origin CORS, HTTPS และ discovery allowlist

Gateway state อยู่ใน volume `saijai-print-gateway-state` และเก็บเฉพาะ trusted printer
mapping ไม่เก็บ print queue หรือ database credentials

### Production app ด้วย Docker

`docker-compose.yml` ไม่สร้าง PostgreSQL และไม่ seed ข้อมูล มันใช้ `DIRECT_URL` รัน
`prisma migrate deploy` หนึ่งครั้งก่อนเริ่ม app ดังนั้นต้องตรวจ URL, backup และ migration
ก่อนทุก deployment:

```bash
docker compose -f docker-compose.yml config --quiet
docker compose -f docker-compose.yml up --build -d
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml logs migrate
docker compose -f docker-compose.yml logs app
```

Compose นี้ไม่ได้จัดการ reverse proxy, public TLS หรือ DNS ให้

### หยุดและทำความสะอาดอย่างปลอดภัย

หยุดเฉพาะ stack โดยรักษาข้อมูลใน volumes:

```bash
docker compose -f docker-compose.local.yml down --remove-orphans
docker compose -f docker-compose.print-gateway.yml down --remove-orphans
docker compose -f docker-compose.yml down --remove-orphans
```

ตรวจ resource ของโปรเจกต์ก่อนลบเพิ่ม:

```bash
docker ps -a --filter label=com.docker.compose.project=saijai-phareab
docker ps -a --filter label=com.docker.compose.project=saijai-phareab-production
docker ps -a --filter label=com.docker.compose.project=saijai-print-gateway
docker volume ls --filter label=com.docker.compose.project=saijai-phareab
docker volume ls --filter label=com.docker.compose.project=saijai-print-gateway
```

อย่าลบ `saijai-pgdata` หรือ `saijai-print-gateway-state` เว้นแต่ตั้งใจล้างข้อมูลจริง
และอย่าใช้ `docker system prune --volumes` บนเครื่องที่มีหลายโปรเจกต์

## Deploy บน Vercel

ตั้ง production environment variables ใน Vercel แล้วใช้ build command `pnpm build`
อย่างน้อยต้องมี `DATABASE_URL`, `DIRECT_URL`, `BETTER_AUTH_URL`,
`BETTER_AUTH_SECRET` และ `PRISMA_POOL_MAX=1` รวมถึง integration ที่เปิดใช้จริง

Migration ต้องรันแยกจาก application build:

```bash
pnpm exec prisma migrate deploy
```

Vercel ไม่ใช่ Print Gateway และไม่สามารถเปิด raw TCP connection ไปยัง private IP
ของเครื่องพิมพ์ในร้าน ต้องมีเครื่อง/mini PC ในร้านที่รัน Gateway อยู่เสมอสำหรับ
Wi-Fi/Ethernet printing

## ระบบพิมพ์

เส้นทางพิมพ์ปัจจุบัน:

```text
เว็บ -> สร้างเอกสาร/ESC-POS ฝั่ง server
    -> Wi-Fi/Ethernet: HTTPS Print Gateway ในร้าน -> TCP 9100 -> XP-C260M
    -> USB: WebUSB -> เครื่องพิมพ์
    -> Bluetooth: Web Bluetooth -> เครื่องพิมพ์
```

- ไม่มี database print queue และไม่ retry อัตโนมัติ
- ASCII/ตัวเลขใช้ native ESC/POS
- ข้อความไทยหรือข้อความผสมใช้ Prompt-font raster เพื่อให้สระ/วรรณยุกต์ถูกต้อง
- ใบพิมพ์หนึ่งฉบับส่ง partial-cut เพียงครั้งเดียวหลังข้อมูลและ feed ครบ
- การเลือกเครื่อง Wi-Fi/Ethernet เก็บใน browser; trusted endpoint เก็บบน Gateway

วิธีติดตั้ง ตรวจเครื่องจริง และแก้ปัญหาอยู่ใน
[XP-C260M setup](.agents/skills/xprinter-xp-c260m/references/saijai-setup.md) และ
[printing operations](.agents/skills/xprinter-xp-c260m/references/saijai-operations.md)

## คำสั่งตรวจสอบ

```bash
pnpm test
pnpm exec nuxi typecheck
pnpm build
pnpm exec prisma validate
```

โปรเจกต์ยังไม่มี lint command ที่พร้อมใช้งาน ห้ามสมมติว่า `pnpm exec eslint .` ใช้แทนได้
Build อาจต้องเชื่อมต่อภายนอกเพื่อดาวน์โหลด fonts

## โครงสร้างหลัก

```text
app/             pages, layouts, components, composables และ client middleware
server/api/      Nitro API routes
server/utils/    domain rules, auth, documents และ integrations
shared/          types, config และ utilities ที่ใช้ร่วมกัน
prisma/          schema, migrations และ seed
print-bridge/    LAN Print Gateway
tests/           Vitest tests
```

แนวทางสำหรับ coding agents และข้อควรระวังในการแก้ระบบอยู่ใน [AGENTS.md](./AGENTS.md)
