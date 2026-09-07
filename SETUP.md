# คู่มือ Setup และคำสั่งรัน

รันจาก root โปรเจกต์ ใช้ Node.js 24, pnpm และ Docker

```bash
corepack enable
pnpm install
cp .env.example .env
chmod 600 .env
```

ห้าม commit `.env` หรือ secret จริง

## 1. Database Docker + `pnpm dev`

แก้ `.env` ให้เว็บบน Mac ต่อ PostgreSQL ใน Docker:

```dotenv
DIRECT_URL=postgresql://postgres:123@localhost:5434/saijai
DATABASE_URL=postgresql://postgres:123@localhost:5434/saijai
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
NUXT_PUBLIC_HOSTNAME=localhost
NUXT_PUBLIC_BASE_URL=http://localhost:3000
INTERNAL_BASE_URL=http://127.0.0.1:3000
```

เริ่มเฉพาะ Database:

```bash
docker compose -f docker-compose.local.yml up -d db
docker compose -f docker-compose.local.yml ps
```

ครั้งแรกให้เตรียม schema/ข้อมูลตั้งต้น แล้วรันเว็บ:

```bash
pnpm exec prisma migrate dev
pnpm exec prisma db seed
pnpm dev
```

- เว็บ: `http://localhost:3000`
- Database: `localhost:5434`
- หยุด Database: `docker compose -f docker-compose.local.yml stop db`

## 2. รันโปรเจกต์ด้วย Docker

### Local/demo: Database + demo seed + เว็บ

```bash
docker compose -f docker-compose.local.yml config --quiet
docker compose -f docker-compose.local.yml up --build -d
docker compose -f docker-compose.local.yml ps
```

เปิด `http://localhost:3004`

### Production: migration + เว็บ (ใช้ Database ภายนอก)

```bash
docker compose -f docker-compose.yml config --quiet
docker compose -f docker-compose.yml up --build -d
docker compose -f docker-compose.yml ps
```

ดู log ด้วย `docker compose -f <ไฟล์-compose> logs -f` และหยุดโดยเก็บ volume ด้วย:

```bash
docker compose -f docker-compose.local.yml down --remove-orphans
docker compose -f docker-compose.yml down --remove-orphans
```

## 3. Printer Gateway

ใช้เฉพาะการพิมพ์ผ่าน Wi-Fi/Ethernet เครื่องที่รัน Gateway ต้องเข้าถึงเครื่องพิมพ์
ใน LAN ได้ หา IP จาก self-test หรือ DHCP list และควรทำ DHCP reservation

### รันบน Mac สำหรับ development

ตั้งค่า `.env`:

```dotenv
NUXT_PUBLIC_PRINT_GATEWAY_ENABLED=true
NUXT_PUBLIC_PRINT_GATEWAY_URL=http://127.0.0.1:17321
PRINT_GATEWAY_BIND_HOST=127.0.0.1
PRINT_GATEWAY_PORT=17321
PRINT_GATEWAY_PUBLIC_URL=http://127.0.0.1:17321
PRINT_GATEWAY_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
PRINT_GATEWAY_DISCOVERY_CIDRS=<IP_เครื่องพิมพ์>/32
PRINT_GATEWAY_DISCOVERY_PORTS=9100
PRINT_GATEWAY_STATE_PATH=./print-bridge/gateway-state.json
```

รันและตรวจ health โดยยังไม่สั่งพิมพ์:

```bash
pnpm print-gateway
curl -fsS -H 'Origin: http://localhost:3000' http://127.0.0.1:17321/health
```

### รัน Gateway ด้วย Docker

Local (ค่าเริ่มต้นค้นหา fake printer เท่านั้น):

```bash
docker compose -f docker-compose.print-gateway.yml config --quiet
docker compose -f docker-compose.print-gateway.yml up --build -d
docker compose -f docker-compose.print-gateway.yml ps
```

Production ต้องตั้ง `PRINT_GATEWAY_PUBLISH_HOST=0.0.0.0`, HTTPS domain,
`PRINT_GATEWAY_ALLOWED_ORIGINS`, IP เครื่องพิมพ์ `/32`, และ certificate paths ใน
`.env` แล้วรัน:

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

## ค่าแก้เมื่อเปลี่ยน Wi-Fi / IP

เมื่อ IP เครื่องพิมพ์เปลี่ยน แก้ `.env` ที่เครื่อง Gateway เท่านั้น:

```dotenv
PRINT_GATEWAY_DISCOVERY_CIDRS=<IP_ใหม่ของเครื่องพิมพ์>/32
PRINT_GATEWAY_DISCOVERY_PORTS=9100
```

จากนั้น restart `pnpm print-gateway` หรือ recreate Docker Gateway:

```bash
docker compose -f docker-compose.print-gateway.yml up --build -d --force-recreate
```

Production ให้ใช้คำสั่ง base + production overlay ด้านบน ค่า hotspot ที่เคยยืนยันคือ
`172.20.10.2/32` แต่เป็น DHCP ชั่วคราว ต้องตรวจใหม่ทุกครั้งที่เปลี่ยน Wi-Fi

ถ้า IP ของเครื่องที่รัน Gateway เปลี่ยน ให้แก้ DNS ของ Gateway ให้ชี้ IP ใหม่ หรือทำ
DHCP reservation ไม่ต้องแก้ source code หรือฐานข้อมูล

## ค่าแก้เมื่อเปลี่ยน Domain

`.env` ฝั่งแอป (origin ต้องไม่มี `/` ปิดท้าย):

```dotenv
BETTER_AUTH_URL=https://<DOMAIN_ใหม่>
BETTER_AUTH_TRUSTED_ORIGINS=https://<DOMAIN_ใหม่>
NUXT_PUBLIC_HOSTNAME=<DOMAIN_ใหม่>
NUXT_PUBLIC_BASE_URL=https://<DOMAIN_ใหม่>
```

`.env` ฝั่ง Gateway:

```dotenv
PRINT_GATEWAY_ALLOWED_ORIGINS=https://<DOMAIN_ใหม่>
```

ถ้าโดเมน Gateway เปลี่ยนด้วย:

```dotenv
NUXT_PUBLIC_PRINT_GATEWAY_URL=https://<DOMAIN_GATEWAY_ใหม่>:17321
PRINT_GATEWAY_PUBLIC_URL=https://<DOMAIN_GATEWAY_ใหม่>:17321
PRINT_GATEWAY_TLS_CERT_HOST_PATH=/absolute/path/to/fullchain.pem
PRINT_GATEWAY_TLS_KEY_HOST_PATH=/absolute/path/to/privkey.pem
```

สุดท้ายแก้ DNS/certificate, อัปเดต LIFF Endpoint URL ใน LINE Developers (ถ้าใช้),
rebuild/redeploy เว็บ และ recreate Gateway ค่า Gateway URL เป็น build input ของ CSP

> ห้ามเปิด TCP `9100` หรือ Gateway สู่ public internet และอย่าลบ volume
> `saijai-pgdata`/`saijai-print-gateway-state` หากไม่ได้ตั้งใจล้างข้อมูล
