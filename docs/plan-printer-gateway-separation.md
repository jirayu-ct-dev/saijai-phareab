# แผนแยก Printer Gateway ออกจากโปรเจกต์หลัก

อัปเดต: 2026-09-07 (Asia/Bangkok)

สถานะ: **วางแผนแล้ว ยังไม่เริ่มย้ายโค้ดหรือเปลี่ยน deployment**

## เป้าหมายและเกณฑ์เสร็จ

แยก LAN Print Gateway เป็น repository และ deployment ของตัวเองบนเครื่องภายในร้าน โดย Nuxt app คงหน้าจอพิมพ์และการสร้าง ESC/POS ส่วน Gateway รับ byte จาก browser แล้วส่ง TCP ไปยังเครื่องพิมพ์ที่เชื่อถือแล้ว

ถือว่างานเสร็จเมื่อ:

- Gateway repository ติดตั้ง ทดสอบ และรัน Docker ได้โดยไม่อาศัยไฟล์จาก repository หลัก
- browser ในเครือข่ายร้านเรียก HTTPS health, ค้นหา และเลือกเครื่องพิมพ์ได้
- Nuxt app ใช้เพียง URL ของ Gateway และไม่เก็บ `PRINT_GATEWAY_*` ฝั่ง service อีก
- การพิมพ์จริงผ่านครบ ASCII, ภาษาไทย, QR, feed และ partial cut ตาม verification ladder
- Gateway และ raw printer port ไม่เปิดสู่อินเทอร์เน็ตหรือ guest network

## ขอบเขตที่ต้องคงเดิม

- Nuxt server ยังคงเป็นเจ้าของข้อมูลใบเสร็จ/ใบเสนอราคาและสร้าง Hybrid ESC/POS
- browser ส่ง `application/octet-stream` ไปยัง Gateway ด้วย opaque printer ID
- Gateway ไม่มี database, queue, pairing secret หรือ automatic retry
- คงผลลัพธ์ `BUSY`, `OFFLINE`, `TIMEOUT` และ `UNKNOWN_PROGRESS`; ห้าม retry `UNKNOWN_PROGRESS` อัตโนมัติ
- USB และ Bluetooth fallback ใน Nuxt app ยังคงอยู่
- IP/port ของเครื่องพิมพ์อยู่เฉพาะ environment/state ของ Gateway ไม่ย้ายเข้าฐานข้อมูล

## โครงสร้าง repository เป้าหมาย

สร้าง repository ใหม่ เช่น `saijai-print-gateway` แล้ววาง runtime ไว้ที่ root:

```text
saijai-print-gateway/
├── bin/
├── transport/
├── test/
├── tests/
├── Dockerfile
├── compose.yml
├── compose.production.yml
├── package.json
├── pnpm-lock.yaml
├── .env.example
├── .dockerignore
├── .gitignore
└── README.md
```

ไฟล์ตั้งต้นมาจาก `print-bridge/`, `docker-compose.print-gateway.yml`, `docker-compose.print-gateway.production.yml` และ focused Gateway tests ใน repository นี้ เมื่อย้าย `print-bridge/` ขึ้นเป็น root ต้องแก้ Docker build context และ import path ของ tests ให้ตรงโครงสร้างใหม่

Runtime ปัจจุบันใช้ Node.js 24 และไม่มี runtime dependency ภายนอก ส่วน Vitest เป็น development dependency สำหรับ tests เท่านั้น

## ขั้นตอนดำเนินงาน

### 1. เตรียมข้อมูลก่อนย้าย

- ระบุ path/remote ของ repository ใหม่และเครื่องที่จะรัน Gateway
- ยืนยันว่าเครื่อง Gateway เปิดตลอด ไม่ sleep และอยู่ใน LAN ที่เข้าถึง printer ได้
- ยืนยัน IP, subnet, MAC, raw TCP protocol/port และ paper width จาก self-test ของเครื่องจริง
- ทำ DHCP reservation และกำหนด discovery เป็น `<CONFIRMED_PRINTER_IP>/32`
- ตัดสินใจว่าจะย้าย state เดิมหรือค้นหา/ยืนยัน printer ใหม่หลัง cutover
- เตรียม stable hostname, local/split DNS และ TLS certificate ที่ browser ทุกเครื่องเชื่อถือ

### 2. สร้าง Gateway repository

- ย้าย source และ Gateway tests โดยไม่เปลี่ยน API contract
- เพิ่ม `pnpm-lock.yaml`, test script, `.env.example`, `.dockerignore` และ `.gitignore`
- ปรับ Compose ให้ build จาก repository root
- คง container แบบ non-root, read-only filesystem, dropped capabilities, `no-new-privileges`, healthcheck และ persistent state volume
- ห้ามนำ `.env`, certificate/key, database, Better Auth, LINE, Cloudinary, Resend หรือ payment secrets เข้า image/repository

### 3. ตรวจ Gateway แบบไม่แตะ hardware

```bash
pnpm install --frozen-lockfile
pnpm test
docker compose -f compose.yml config --quiet
docker compose -f compose.yml up --build -d
docker compose -f compose.yml ps
```

ใช้ local-safe profile ที่ bind/publish บน loopback และค้นหา fake target เท่านั้น จนกว่าจะได้รับอนุญาตให้ตรวจ network หรือพิมพ์จริง

### 4. ตั้งค่า Gateway host

ไฟล์ `.env` ของ Gateway มีเฉพาะ `PRINT_GATEWAY_*` และตั้ง permission เป็น owner-only:

```bash
chmod 600 .env
```

ค่าหลักที่ต้องกำหนด:

```dotenv
PRINT_GATEWAY_PUBLISH_HOST=<GATEWAY_LAN_IP_OR_0.0.0.0>
PRINT_GATEWAY_PORT=17321
PRINT_GATEWAY_PUBLIC_URL=https://<GATEWAY_HOSTNAME>:17321
PRINT_GATEWAY_ALLOWED_ORIGINS=https://<APP_DOMAIN>
PRINT_GATEWAY_DISCOVERY_CIDRS=<CONFIRMED_PRINTER_IP>/32
PRINT_GATEWAY_DISCOVERY_PORTS=<CONFIRMED_RAW_TCP_PORT>
PRINT_GATEWAY_TLS_CERT_HOST_PATH=/absolute/path/to/fullchain.pem
PRINT_GATEWAY_TLS_KEY_HOST_PATH=/absolute/path/to/privkey.pem
```

Production startup:

```bash
docker compose -f compose.yml -f compose.production.yml config --quiet
docker compose -f compose.yml -f compose.production.yml up --build -d
```

ตั้ง firewall ให้ trusted shop LAN เข้า Gateway port ได้ แต่บล็อก guest network และอินเทอร์เน็ต ห้าม forward raw printer port ออกอินเทอร์เน็ต

### 5. เชื่อม Nuxt app

ฝั่ง application host คงไว้เพียง:

```dotenv
NUXT_PUBLIC_PRINT_GATEWAY_ENABLED=true
NUXT_PUBLIC_PRINT_GATEWAY_URL=https://<GATEWAY_HOSTNAME>:17321
```

จากนั้น build/deploy Nuxt ใหม่ เพราะ Gateway origin ถูกใช้ใน public runtime config และ Content Security Policy

ก่อนเปิด feature ให้ตรวจจาก browser/เครื่องในร้าน:

```bash
curl -fsS \
  -H 'Origin: https://<APP_DOMAIN>' \
  https://<GATEWAY_HOSTNAME>:17321/health
```

### 6. Cutover และตรวจเครื่องจริง

การ scan network, trust printer และส่งงานพิมพ์เป็น external/physical action ต้องได้รับอนุญาตแยกต่างหาก แล้วตรวจตามลำดับ:

1. Gateway health, TLS, exact origin และ private source address
2. ตรวจเฉพาะ IP/port ที่ยืนยันแล้ว
3. discovery และ trust printer โดยยังไม่ส่งงานพิมพ์
4. minimal ASCII แบบไม่ cut
5. ภาษาไทยและข้อความผสม
6. layout/ยอดเงินที่ความกว้างจริง
7. payment QR และ LINE QR
8. concurrent/busy, offline/reconnect และ `UNKNOWN_PROGRESS`
9. feed สี่บรรทัดและ partial cut หนึ่งครั้งท้ายเอกสาร

`SENT` หมายถึงส่ง byte ถึง transport แล้ว ไม่ได้รับรองว่ากระดาษพิมพ์หรือตัดสำเร็จ

### 7. ทำความสะอาด repository หลักหลัง cutover สำเร็จ

- ลบ `print-bridge/` และ Compose ของ Gateway ออกจาก repository หลัก
- ย้าย Gateway-only tests ออกจาก `tests/server/`
- ลบ script `print-gateway` จาก `package.json`
- ลบ service-side `PRINT_GATEWAY_*` จาก `.env.example` และ `.env` ฝั่งแอป
- คงตัวแปร public สองตัวของ Nuxt และโค้ด LAN client ใน `useThermalPrinter`
- ปรับ `README.md`, `SETUP.md`, `.gitignore`, `.dockerignore` และเอกสารอ้างอิงให้ชี้ไป repository ใหม่
- รัน tests, typecheck และ build ของ Nuxt เพื่อยืนยันว่าไม่มี import/file reference ค้าง

## State และ rollback

Gateway state เก็บ trusted printer mapping เท่านั้น ไม่มี receipt payload หรือ queue

- ถ้าต้องรักษา opaque printer ID เดิม ให้ backup/restore `saijai-print-gateway-state` อย่างระมัดระวัง
- ถ้าไม่ย้าย state ให้ discover และ trust printer ใหม่จาก browser หลัง Gateway ใหม่พร้อม
- ห้ามลบ volume เดิมก่อนจบ physical verification
- Rollback ก่อน cleanup คือปิด Gateway ใหม่ เปลี่ยน Nuxt URL กลับ แล้วเปิด Gateway เดิม
- หลัง cleanup ให้เก็บ release/tag ก่อนแยกไว้จนกว่าการใช้งานจริงจะเสถียร

## ค่าที่ยังต้องตัดสินใจก่อนเริ่ม

- ตำแหน่งและ Git remote ของ repository ใหม่
- ระบบปฏิบัติการ/เครื่องที่รัน Gateway และวิธีป้องกัน sleep
- Gateway LAN IP และ hostname จริง
- วิธีออกและต่ออายุ TLS certificate
- final printer IP/port จากหน้างาน
- จะย้าย Docker state เดิมหรือเริ่ม trust printer ใหม่

## Completion checks สุดท้าย

```bash
# Gateway repository
pnpm test
docker compose -f compose.yml -f compose.production.yml config --quiet
docker compose -f compose.yml -f compose.production.yml ps

# Nuxt repository
pnpm test
pnpm exec nuxi typecheck
pnpm run build
```

ไม่มี lint command ที่ใช้งานได้ใน Nuxt repository ปัจจุบัน จึงไม่เพิ่มหรือรายงาน lint โดยไม่มีการตั้งค่าใหม่อย่างชัดเจน
