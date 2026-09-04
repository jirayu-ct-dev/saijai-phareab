# แผนปรับ Direct Print เป็น LAN Print Gateway แบบค้นหาเครื่องอัตโนมัติ

สถานะ (2026-09-04): implemented ผ่านระดับ repository/fake transport แล้วสำหรับ env contracts, pairing, bounded discovery, trusted-printer state, direct Gateway API, Docker และ Nuxt selection UX; การทดสอบ LAN/เครื่องจริง/production ยังถูก block จนยืนยัน Gateway host, TLS hostname/certificate, private CIDR และ actual printer protocol

หลักฐานรอบ implementation:

- focused Gateway tests 20/20 ผ่าน; full suite 373/373 ผ่านและ 1 skipped
- Nuxt typecheck, Prisma validate และ production build ผ่าน
- base/production Compose config ผ่าน, Gateway image build ผ่าน และ cold-start เป็น `healthy` ด้วย non-root `node`
- runtime smoke ยืนยัน CSP เพิ่มเฉพาะ configured Gateway origin เมื่อ feature flag เปิด
- ไม่ scan LAN, ไม่ส่ง print bytes, ไม่แก้ `.env` จริง, ไม่แตะ production/database และไม่ commit

ผู้ใช้แผน: primary AI agent และ sub-agent ที่ได้รับมอบหมายอย่างชัดเจน

ขอบเขต: Print Gateway, environment contract, Docker deployment, printer discovery/selection และ browser printing flow เท่านั้น ไม่เปลี่ยน payment/order/auth semantics

## 1. Destination

อุปกรณ์ที่เข้าเว็บ Saijai และอยู่ในเครือข่ายร้านเดียวกับ Print Gateway ต้องสามารถกดพิมพ์ เห็นเครื่องพิมพ์ที่ Gateway อนุญาต และส่งเอกสารไปยังเครื่องที่เลือกได้ โดยกรณีมีเครื่องออนไลน์เพียงเครื่องเดียวให้เลือกอัตโนมัติ

การเปลี่ยนเครื่องพิมพ์ต้องทำได้โดยเสียบ LAN เปิดเครื่อง และยืนยันเครื่องใหม่ไม่เกินหนึ่งครั้ง ห้ามต้องแก้โค้ด, deploy เว็บ หรือเพิ่ม Printer/PrintJob กลับใน production database

```text
Browser ที่ผ่าน auth ของ Saijai
        |
        | HTTPS + paired device token
        v
LAN Print Gateway กลางในร้าน
        |
        +-- discover/allowlist --> Printer A (online)
        `-- discover/allowlist --> Printer B (เมื่อมีในอนาคต)
                                  |
                                  `-- TCP/verified protocol --> XP-C260M
```

## 2. ข้อเท็จจริงปัจจุบัน

- Browser ไม่สามารถเปิด raw TCP socket หรือค้นหา ESC/POS printer ใน LAN ได้โดยตรง
- ก่อนรอบ implementation Direct Bridge bind `127.0.0.1:17321`, รับ target เดียวจาก JSON และใช้ได้เฉพาะ browser บนเครื่องเดียวกับ Bridge
- ก่อนรอบ implementation `useThermalPrinter` hard-code `http://127.0.0.1:17321`; ปัจจุบันอ่าน URL/feature flag จาก Nuxt runtime config แล้ว
- production CSP allow เฉพาะ loopback Bridge
- Docker image ของ Nuxt ตัด `print-bridge/` ออกจาก build context โดยตั้งใจ
- `.env` และ `.env.*` ถูก ignore จาก Git และ Docker build context; `.env.example` เป็น template ที่ commit ได้
- Compose อ่าน `.env` เพื่อ interpolation และปัจจุบันใช้ `env_file` กับ app/migrate; Gateway ใหม่ต้องไม่รับ database/provider secrets ที่ไม่เกี่ยวข้อง
- target Prisma schema ไม่มี `printer`/`print_job`; Gateway state ต้องไม่ทำให้สองตารางนี้กลับมา
- actual XP-C260M revision, discovery protocol, RAW port, printable width และ native capabilities ยังต้องยืนยันจาก label/self-test/config page

## 3. Canonical decisions

### Alternatives considered

- OS print dialog ให้ระบบปฏิบัติการค้นหา printer ได้ง่ายกว่า แต่ไม่รักษา canonical Hybrid ESC/POS bytes, predictable Thai/QR, direct result contract และ verified cut/feed จึงไม่ใช่ primary path
- ให้ browser scan LAN เองทำไม่ได้กับ raw TCP และเปิดช่อง arbitrary-network access
- ให้ cloud server ต่อ printer โดยตรงใช้ไม่ได้เมื่อ printer อยู่ private LAN
- LAN Gateway กลางจึงเป็น surface ที่เล็กที่สุดซึ่งรองรับหลายอุปกรณ์, replacement และ ESC/POS contract เดิมได้พร้อมกัน

### D1 — Gateway กลางหนึ่งตัวต่อร้าน

- Gateway รันบนเครื่องที่เปิดระหว่างเวลาร้านและอยู่ใน LAN เดียวกับ printer
- Browser ทุกเครื่องเรียก Gateway ผ่าน stable HTTPS URL เช่น `https://saijai-print.<shop-domain>`
- ห้ามใช้ public cloud app server ต่อ raw printer port เพราะ server ไม่ได้อยู่ใน LAN ร้าน
- local development บนเครื่องเดียวอนุญาต `http://127.0.0.1` ได้; cross-device และ production ต้อง HTTPS

### D2 — `.env` เป็น deployment config ไม่ใช่ source code

- ทุก environment ใช้ชื่อตัวแปรชุดเดียวกัน แต่ `.env` ของแต่ละ host มีค่าของ environment นั้น
- ห้ามเก็บ local และ production value สองชุดใน key เดียว หรือ commit `.env`
- `.env.example` แสดงชื่อ, format และ safe placeholder เท่านั้น
- Docker Compose อ่าน `.env` ด้วย `${NAME}` และส่งเข้า Gateway เฉพาะ key ที่ allowlist ใน `environment:` ห้ามใช้ `env_file: .env` กับ Gateway
- printer IP ที่ค้นพบและ paired-device token เป็น runtime state ใน volume ไม่ใช่ `.env`; `.env` เก็บเพียง discovery boundary และ Gateway configuration

### D3 — Discovery แบบ bounded และ fail-closed

ลำดับค้นหา:

1. ตรวจ printer ที่เคยยืนยันไว้ใน local Gateway state
2. ใช้ mDNS/Bonjour/OS discovery เฉพาะเมื่อ actual unit พิสูจน์ว่ารองรับ
3. ใช้ bounded TCP probe เฉพาะ CIDR และ port ที่ระบุใน `.env`
4. ห้าม scan นอก CIDR, ห้ามรับ arbitrary host/port จาก browser และห้ามส่ง ESC/POS bytes ระหว่าง discovery
5. candidate ที่ fingerprint ไม่ได้ต้องให้ผู้ใช้ยืนยันครั้งแรกก่อนบันทึกเป็น trusted printer

ผลลัพธ์:

- online trusted printer 1 เครื่อง: auto-select
- มากกว่า 1 เครื่อง: แสดง chooser และจำ last selected printer ใน browser
- เครื่องเดิม offline แต่พบ candidate ใหม่ 1 เครื่อง: แสดง replace confirmation หนึ่งครั้ง
- ไม่พบหรือผลกำกวม: ไม่พิมพ์และแสดง troubleshooting ที่ไม่เผย topology

### D4 — Local state เท่านั้น ไม่มี durable print queue

Gateway ใช้ volume สำหรับ:

- trusted printer registry และ last-known address/fingerprint
- paired browser/device token hashes
- schema/version ของ state เพื่อ upgrade ได้

Gateway ห้ามเก็บ receipt bytes, customer data หรือ durable print job. งานพิมพ์มีเพียง in-memory lifecycle และ fail-fast mutex ต่อ printer; งานชนกันตอบ `BUSY` โดยไม่ enqueue

### D5 — Pairing และ authentication

- CORS exact-origin เป็นชั้นแรก แต่ไม่ถือว่าเป็น authentication เพราะ non-browser client ปลอม Origin ได้
- Gateway สร้าง one-time pairing code อายุสั้นจาก secret ใน `.env`
- ผู้ใช้กรอกรหัสครั้งเดียวต่อ browser; Gateway คืน opaque device token และเก็บเฉพาะ hash
- endpoint discover/list/print ต้องใช้ paired token; health endpoint คืนข้อมูลขั้นต่ำ
- token revoke/rotate ได้จาก local Gateway admin command โดยไม่แตะ production DB
- ไม่มี shared token ฝังใน `NUXT_PUBLIC_*` หรือ frontend bundle

### D6 — Printer selection contract

Browser ใช้ opaque `printerId` เท่านั้น:

- `GET /v1/printers` คืน `id`, display name, online/busy, verified profile summary
- `POST /v1/discovery` สั่ง bounded rescan
- `POST /v1/printers/:id/print` รับ ESC/POS binary ที่ server Saijai render แล้ว
- request ห้ามมี host, port, CIDR, QR receiver หรือ customer metadata
- Gateway resolve `printerId` ไปยัง trusted local target

### D7 — Render และ business boundary เดิม

- Nuxt server ยังเป็นผู้โหลด payment/order/settings และสร้าง canonical Hybrid ESC/POS bytes
- Payment QR ใช้ exact amount จาก server; LINE QR ใช้ toggle ที่ `/admin/settings/shop`
- Gateway ไม่คำนวณราคา ไม่สร้าง QR และไม่แก้ document
- USB/WebUSB และ Bluetooth ยังคงเป็น fallback เมื่อ browser/hardware รองรับ

## 4. Environment contract

เพิ่ม placeholder ต่อไปนี้ใน `.env.example` และกำหนดค่าจริงใน `.env` ของแต่ละ host:

```dotenv
# Browser-visible URL; URL เท่านั้น ไม่ใช่ secret
NUXT_PUBLIC_PRINT_GATEWAY_URL=http://127.0.0.1:17321
NUXT_PUBLIC_PRINT_GATEWAY_ENABLED=true

# Gateway listener
PRINT_GATEWAY_BIND_HOST=0.0.0.0
PRINT_GATEWAY_PORT=17321
PRINT_GATEWAY_PUBLIC_URL=https://saijai-print.example.com:17321
PRINT_GATEWAY_ALLOWED_ORIGINS=https://app.example.com,http://localhost:3004

# จำกัดพื้นที่ค้นหา; production ต้องเป็น private CIDR ของร้าน
PRINT_GATEWAY_DISCOVERY_CIDRS=192.168.1.0/24
# ห้ามใช้ 9100 เป็น default จน self-test/config page ยืนยัน
PRINT_GATEWAY_DISCOVERY_PORTS=
PRINT_GATEWAY_DISCOVERY_TIMEOUT_MS=500
PRINT_GATEWAY_DISCOVERY_CONCURRENCY=16
PRINT_GATEWAY_RESCAN_TTL_MS=30000

# Pairing/security — secret จริงอยู่ใน .env ของ Gateway host เท่านั้น
PRINT_GATEWAY_PAIRING_SECRET=replace-with-random-secret-at-least-32-bytes
PRINT_GATEWAY_PAIRING_CODE_TTL_SECONDS=300
PRINT_GATEWAY_TOKEN_TTL_DAYS=90
PRINT_GATEWAY_MAX_PAYLOAD_BYTES=2000000
PRINT_GATEWAY_TCP_TIMEOUT_MS=10000

# Persistent local state and TLS files mounted read-only where applicable
PRINT_GATEWAY_STATE_PATH=/data/gateway-state.json
PRINT_GATEWAY_TLS_CERT_PATH=/run/secrets/tls.crt
PRINT_GATEWAY_TLS_KEY_PATH=/run/secrets/tls.key
# Host paths ใช้เฉพาะ Compose interpolation และไม่ถูกส่งเป็น env ใน container
PRINT_GATEWAY_TLS_CERT_HOST_PATH=/absolute/host/path/tls.crt
PRINT_GATEWAY_TLS_KEY_HOST_PATH=/absolute/host/path/tls.key
```

Rules:

- Nuxt runtime config expose เฉพาะ `NUXT_PUBLIC_PRINT_GATEWAY_URL` และ enabled flag
- Gateway process อ่านเฉพาะ `PRINT_GATEWAY_*`
- `.env.example` ห้ามมี real domain, CIDR, secret, printer address หรือ certificate
- production secret ควรมาจาก host secret store เมื่อมี; `.env` ต้อง mode `0600`
- CSP `connect-src` ต้องสร้างจาก parsed Gateway origin ที่ runtime middleware ไม่ freeze ค่าไว้ใน build artifact และห้ามต่อ raw env string เข้า header
- startup ต้อง reject public CIDR, wildcard origin, invalid URL, missing production TLS และ unsafe file permission

### 4.1 Local `.env`

ไฟล์ `.env` ที่ repository root เป็น active local profile และถูก Git ignore:

```dotenv
NUXT_PUBLIC_PRINT_GATEWAY_URL=http://127.0.0.1:17321
NUXT_PUBLIC_PRINT_GATEWAY_ENABLED=true
PRINT_GATEWAY_BIND_HOST=127.0.0.1
PRINT_GATEWAY_PORT=17321
PRINT_GATEWAY_PUBLIC_URL=http://127.0.0.1:17321
PRINT_GATEWAY_ALLOWED_ORIGINS=http://localhost:3004,http://127.0.0.1:3004
PRINT_GATEWAY_DISCOVERY_CIDRS=127.0.0.0/8
PRINT_GATEWAY_DISCOVERY_PORTS=19100
```

ค่า loopback/port นี้ใช้กับ fake printer เท่านั้น เมื่อทดสอบเครื่องจริงใน LAN ให้เปลี่ยน CIDR และ port ตาม evidence ของร้านโดยไม่ commit

### 4.2 Production environment

มี environment สองฝั่งที่ใช้ชื่อ contract เดียวกันแต่ไม่ใช่ไฟล์เดียวกันทางกายภาพ:

1. Nuxt/Vercel หรือ app host ตั้งเฉพาะ `NUXT_PUBLIC_PRINT_GATEWAY_URL` และ `NUXT_PUBLIC_PRINT_GATEWAY_ENABLED`
2. Gateway host ภายในร้านมี `.env` ของตัวเองสำหรับ `PRINT_GATEWAY_*`, TLS paths, private CIDR และ secret

ตัวอย่าง Gateway-host `.env`:

```dotenv
PRINT_GATEWAY_BIND_HOST=0.0.0.0
PRINT_GATEWAY_PORT=17321
PRINT_GATEWAY_PUBLIC_URL=https://saijai-print.example.com:17321
PRINT_GATEWAY_ALLOWED_ORIGINS=https://saijai.example.com
PRINT_GATEWAY_DISCOVERY_CIDRS=192.168.1.0/24
PRINT_GATEWAY_DISCOVERY_PORTS=PORT_FROM_ACTUAL_PRINTER_SELF_TEST
PRINT_GATEWAY_PAIRING_SECRET=RANDOM_SECRET_FROM_SECRET_MANAGER
PRINT_GATEWAY_STATE_PATH=/data/gateway-state.json
PRINT_GATEWAY_TLS_CERT_PATH=/run/secrets/tls.crt
PRINT_GATEWAY_TLS_KEY_PATH=/run/secrets/tls.key
PRINT_GATEWAY_TLS_CERT_HOST_PATH=/absolute/host/path/tls.crt
PRINT_GATEWAY_TLS_KEY_HOST_PATH=/absolute/host/path/tls.key
```

หาก app และ Gateway อยู่คนละ host การแก้ `.env` ที่ repository/app server จะไม่ส่งค่าไปยังเครื่องร้านโดยอัตโนมัติ ต้อง provision `.env` ของ Gateway host ผ่าน deployment/runbook ด้วย

## 5. Docker topology

### 5.1 Gateway image

เพิ่ม `print-bridge/Dockerfile` แยกจาก Nuxt image:

- Node 24 version-pinned
- copy เฉพาะ Gateway package/source
- production-only install แบบ frozen lockfile หรือ zero-dependency runtime ตาม package จริง
- non-root user
- healthcheck เรียก local `/health`
- state volume writable เฉพาะ runtime user
- certificate/key mount read-only
- graceful SIGTERM และ restart `unless-stopped`
- ใช้ `print-bridge/` เป็น build context เพื่อไม่รับ app source, `.env` หรือ database config และไม่ชน root `.dockerignore` ที่จงใจ exclude `print-bridge/`

### 5.2 Base Compose

เพิ่ม `docker-compose.print-gateway.yml` เป็น base ที่ใช้ได้กับ local loopback โดย Compose อ่าน `.env` อัตโนมัติและ map environment ทีละ key:

```yaml
services:
  print-gateway:
    build:
      context: ./print-bridge
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "${PRINT_GATEWAY_PORT:-17321}:${PRINT_GATEWAY_PORT:-17321}"
    environment:
      PRINT_GATEWAY_BIND_HOST: ${PRINT_GATEWAY_BIND_HOST:?required}
      PRINT_GATEWAY_PORT: ${PRINT_GATEWAY_PORT:?required}
      PRINT_GATEWAY_PUBLIC_URL: ${PRINT_GATEWAY_PUBLIC_URL:?required}
      PRINT_GATEWAY_ALLOWED_ORIGINS: ${PRINT_GATEWAY_ALLOWED_ORIGINS:?required}
      PRINT_GATEWAY_DISCOVERY_CIDRS: ${PRINT_GATEWAY_DISCOVERY_CIDRS:?required}
      PRINT_GATEWAY_DISCOVERY_PORTS: ${PRINT_GATEWAY_DISCOVERY_PORTS:?required}
      PRINT_GATEWAY_DISCOVERY_TIMEOUT_MS: ${PRINT_GATEWAY_DISCOVERY_TIMEOUT_MS:-500}
      PRINT_GATEWAY_DISCOVERY_CONCURRENCY: ${PRINT_GATEWAY_DISCOVERY_CONCURRENCY:-16}
      PRINT_GATEWAY_RESCAN_TTL_MS: ${PRINT_GATEWAY_RESCAN_TTL_MS:-30000}
      PRINT_GATEWAY_PAIRING_SECRET: ${PRINT_GATEWAY_PAIRING_SECRET:?required}
      PRINT_GATEWAY_PAIRING_CODE_TTL_SECONDS: ${PRINT_GATEWAY_PAIRING_CODE_TTL_SECONDS:-300}
      PRINT_GATEWAY_TOKEN_TTL_DAYS: ${PRINT_GATEWAY_TOKEN_TTL_DAYS:-90}
      PRINT_GATEWAY_MAX_PAYLOAD_BYTES: ${PRINT_GATEWAY_MAX_PAYLOAD_BYTES:-2000000}
      PRINT_GATEWAY_TCP_TIMEOUT_MS: ${PRINT_GATEWAY_TCP_TIMEOUT_MS:-10000}
      PRINT_GATEWAY_STATE_PATH: /data/gateway-state.json
    volumes:
      - print-gateway-state:/data
```

ห้ามส่ง `DATABASE_URL`, Better Auth, LINE, Cloudinary หรือ Resend secrets เข้า container นี้

เพิ่ม `docker-compose.print-gateway.production.yml` เป็น TLS override เท่านั้น:

```yaml
services:
  print-gateway:
    environment:
      PRINT_GATEWAY_TLS_CERT_PATH: /run/secrets/tls.crt
      PRINT_GATEWAY_TLS_KEY_PATH: /run/secrets/tls.key
    volumes:
      - ${PRINT_GATEWAY_TLS_CERT_HOST_PATH:?required}:/run/secrets/tls.crt:ro
      - ${PRINT_GATEWAY_TLS_KEY_HOST_PATH:?required}:/run/secrets/tls.key:ro
```

### 5.3 Local and production use

Local same-machine development:

```bash
docker compose -f docker-compose.print-gateway.yml up --build -d
pnpm run dev
```

Local full stack:

```bash
docker compose -f docker-compose.local.yml -f docker-compose.print-gateway.yml up --build -d
```

Production:

- Nuxt deployment รับ `NUXT_PUBLIC_PRINT_GATEWAY_URL` ตอน build/runtime ตามกลไก Nuxt ที่ทดสอบแล้ว
- รัน `docker compose -f docker-compose.print-gateway.yml -f docker-compose.print-gateway.production.yml up --build -d` บน Gateway host ภายในร้าน ไม่ใช่บน Vercel/public cloud
- Gateway host ต้องมี stable hostname/address และ valid TLS certificate ที่ client devices trust
- Linux สามารถประเมิน host networking สำหรับ mDNS; Docker Desktop/macOS ใช้ bounded CIDR TCP discovery เป็น required fallback เพราะ multicast ผ่าน container อาจไม่เสถียร

## 6. Target user flow

### Normal case — printer เดียว

1. ผู้ใช้กดพิมพ์
2. app ตรวจ pairing และ Gateway health
3. app ขอ printer list
4. พบ trusted online printer หนึ่งเครื่อง จึงเลือกอัตโนมัติ
5. app ขอ bytes จาก authenticated Nuxt endpoint
6. appส่ง bytes พร้อม opaque printer ID ไป Gateway ครั้งเดียว
7. UI แสดง “ส่งข้อมูลไปยังเครื่องพิมพ์แล้ว”

### First setup

1. Operator ขอ pairing code ผ่าน one-shot local CLI/`docker exec`; daemon logs และ remote health endpoint ห้ามแสดง code
2. browser ขอ pairing code ครั้งเดียว
3. Gateway discovery ทำงานเฉพาะ CIDR/port จาก `.env`
4. ผู้ใช้ยืนยัน candidate และตั้งชื่อ เช่น “เครื่องหน้าเคาน์เตอร์”
5. Gateway เก็บ trusted registry ใน local state

### Replacement printer

1. เครื่องเดิม offline
2. ผู้ใช้เสียบ LAN และเปิดเครื่องใหม่
3. กดพิมพ์แล้ว Gateway rescan
4. ถ้าพบ candidate ใหม่หนึ่งเครื่อง ให้ยืนยัน “ใช้แทนเครื่องเดิม”
5. เปลี่ยน trusted mapping แบบ atomic และพิมพ์หลังยืนยัน
6. ไม่ต้องแก้ `.env` หาก subnet/verified protocol port ไม่เปลี่ยน

ถ้าเครื่องใหม่ใช้ port/protocol ต่างจากค่าที่ hardware ยืนยันไว้ ต้องแก้ `.env` และ restart Gateway; ห้ามเดาหรือ scan ทุก port

## 7. Implementation phases and gates

### Phase 0 — Freeze contracts

- เพิ่ม env parser แบบ pure และ typed configuration
- กำหนด printer descriptor, discovery result, pairing session และ direct result contracts
- เพิ่ม red tests สำหรับ wildcard/public CIDR, arbitrary target, missing TLS และ secret exposure

Gate L0: contract tests แดงก่อน implementation และชื่อ env/UI/API ถูก freeze

### Phase 1 — Discovery prototype

- อ่าน actual XP-C260M label/self-test/config page
- ยืนยัน DHCP, protocol/port และ discovery capability โดยไม่ส่ง print bytes
- ทำ bounded prototype เปรียบเทียบ mDNS กับ TCP probe จาก host และจาก container
- บันทึกเฉพาะผลสรุปโดย redact MAC/IP/serial

Gate L1: พบ actual unit จาก Gateway host ได้อย่างปลอดภัย หรือกำหนด one-time manual confirmation fallback ชัดเจน

### Phase 2 — Gateway core

- เปลี่ยน config loader จาก JSON target เดียวเป็น env parser
- เพิ่ม local state store แบบ atomic write, mode owner-only และ versioned schema
- เพิ่ม pairing/token hash/revoke
- เพิ่ม discovery service และ trusted printer registry
- เปลี่ยน mutex จาก resource เดียวเป็นต่อ opaque printer ID
- เพิ่ม list/discover/print endpoints และ safe logs

Gate L2: fake printers หลายตัวพิสูจน์ auto-select, chooser, replacement, BUSY และ unknown-progress โดยไม่มี payload persistence

### Phase 3 — TLS/CORS/security

- HTTPS listener สำหรับ LAN mode; HTTP อนุญาตเฉพาะ loopback development
- ย้าย Gateway `connect-src` จาก build-time route rule ไปเป็น validated runtime CSP header เพื่อให้ `.env` ของ local/production มีผลจริง
- exact-origin allowlist, PNA headers เมื่อ browser ต้องใช้ และ authorization ทุก privileged endpoint
- rate limit pairing/discovery/print, payload bound และ request timeout
- reject public/non-allowlisted targets และ DNS rebinding-sensitive resolution

Gate L3: อุปกรณ์ที่ไม่ pair, origin ผิด, token หมดอายุ และ arbitrary target ถูกปฏิเสธ; security logs ไม่มี PII/secret/topology

### Phase 4 — Docker

- เพิ่ม Gateway Dockerfile/Compose overlay/healthcheck/state volume/TLS mounts
- เพิ่ม `.env.example` placeholders และ `.gitignore` guard สำหรับ Gateway state/cert/config
- ทดสอบ `docker compose config` โดยไม่แสดง resolved secrets
- ทดสอบ cold start, health, restart, state persistence และ graceful shutdown

Gate L4: local same-machine และ second-device topology ผ่าน; image ไม่มี `.env`, app source หรือ database credentials

### Phase 5 — Nuxt integration

- อ่าน Gateway URL จาก public runtime config แทน hard-code loopback
- เพิ่ม pairing modal เฉพาะ first use
- เพิ่ม printer chooser ที่ซ่อนเมื่อมีเครื่องเดียว
- จำ selected opaque ID ใน browser และ invalidate เมื่อ offline/replaced
- connect-on-demand เดิมยังทำงาน; USB/Bluetooth fallback ไม่ regression
- CSP allow เฉพาะ parsed configured Gateway origin

Gate L5: UI tests ครบ 0/1/many/offline/replacement และ real Chrome/Edge ต่อ Gateway ผ่าน HTTPS

### Phase 6 — Physical verification

- minimal ASCII
- ภาษาไทยพร้อมสระ/วรรณยุกต์และ mixed text
- payment QR และ LINE QR scan
- long receipt, repeated/concurrent requests, offline/reconnect
- feed/cut เฉพาะ capability ที่ actual unit ยืนยัน

Gate L6: ผู้ใช้ยืนยันกระดาษจริงและ QR scan ผ่าน; ไม่มี implicit retry/duplicate

### Phase 7 — Rollout

- backup `.env`/Gateway state แบบเข้ารหัสและบันทึก restore procedure
- deploy Gateway ก่อน แล้วตั้ง Nuxt Gateway URL/CSP
- pilot browser หนึ่งเครื่อง จากนั้นอุปกรณ์อื่นใน LAN
- migration ลบ printer tables ใน production เป็น approval แยกตาม master plan; Gateway rollout ไม่ต้องรอหาก app ใหม่ไม่อ้างตารางแล้ว

Gate L7: production devices พิมพ์ผ่าน printer เดียวแบบ auto-select, replacement drill ผ่าน และ rollback USB/Bluetooth พร้อม

## 8. Work packets for AI agents

| Packet | Owner | Scope | Must not touch |
| --- | --- | --- | --- |
| LG-01 contracts/tests | contract agent | env/API/state types and red tests | runtime implementation |
| LG-02 discovery | hardware/network agent | bounded discovery prototype and actual-unit evidence | print bytes/network mutation |
| LG-03 gateway security | gateway agent | pairing, registry, endpoints, mutex | Nuxt pages/database |
| LG-04 Docker | deployment agent | Dockerfile, Compose, health/readiness | application business services |
| LG-05 Nuxt UX | UI agent | runtime URL, pairing, selection, replacement UX | Gateway internals/database |
| LG-06 integration | primary agent | merge seams, physical matrix, docs | unrelated audit changes |

Primary agent freeze shared contracts before parallel packets, re-check dirty ownership, inspect every sub-agent diff and run independent verification before marking a gate complete

## 9. Verification commands

```bash
pnpm exec vitest run tests/shared/directPrint.test.ts
pnpm exec vitest run tests/server/printGateway*.test.ts tests/server/printBridgeTransport.test.ts
pnpm test
pnpm exec nuxi typecheck
pnpm exec prisma validate
pnpm run build
docker compose -f docker-compose.print-gateway.yml config --quiet
docker compose -f docker-compose.print-gateway.yml up --build -d
docker compose -f docker-compose.print-gateway.yml ps
git diff --check
```

ไม่มี lint command ที่ใช้งานได้ใน repository จึงห้ามรายงานว่า lint ผ่าน

## 10. Stop conditions

หยุดและขอข้อมูล/อนุมัติก่อนเมื่อ:

- actual port/protocol/discovery behavior ยังไม่ยืนยันแต่ implementation จะส่ง bytes
- ต้องเปิด Gateway สู่ public internet หรือใช้ wildcard origin
- production HTTPS certificate/hostname ยังไม่พร้อม
- discovery ต้อง scan นอก private CIDR ที่ operator ระบุ
- ต้องส่ง test page, cut, drawer pulse หรือเปลี่ยน network/firmware ของเครื่องจริง
- ต้องแก้ production DB, deploy, restart production Gateway หรือ commit โดยยังไม่มีคำสั่ง
- dirty user changes overlap และ merge อย่างปลอดภัยไม่ได้

## 11. Open decisions and evidence required

- [F1] Gateway host: ต้องยืนยันว่าเป็น macOS, Windows หรือ Linux และเปิดตลอดเวลาหรือไม่ เพื่อเลือก Docker networking/startup ที่พิสูจน์ได้
- [F2] Production TLS: ต้องมี stable hostname และ certificate chain ที่โทรศัพท์/แท็บเล็ตทุกเครื่อง trust; preferred คือ private DNS/host mapping ที่ใช้ certificate จาก CA ผ่าน DNS validation ห้ามใช้ self-signed แบบกดข้าม warning
- [F3] Printer profile: ต้องอ่าน label และ self-test/config page เพื่อยืนยัน Ethernet/Wi-Fi interface, DHCP, port/protocol, paper width และ discovery mechanism
- [F4] Network boundary: operator ต้องระบุ private CIDR ของร้านสำหรับ `.env`; agent ห้ามอนุมานจาก production database หรือ commit ค่า topology จริง

F1–F4 ไม่ block pure env parser/contracts/tests แต่ block real LAN exposure, physical probe และ production rollout

## 12. Rollback

- ตั้ง `NUXT_PUBLIC_PRINT_GATEWAY_ENABLED=false` และ deploy เพื่อซ่อน LAN path โดย USB/Bluetooth ยังอยู่
- rollback Gateway container image โดยคง versioned state backup
- หาก state เสีย ให้ restore state file; ห้าม restore receipt payload เพราะ Gateway ไม่เก็บงาน
- หาก LAN discovery ผิด ให้ปิด discovery และใช้ trusted printer ที่ยืนยันไว้
- ambiguous send ให้ตรวจเครื่องก่อนกดใหม่เสมอ

## 13. Completion checklist

- [x] L0 contracts/env names frozen
- [ ] L1 actual printer discovery/protocol verified
- [ ] L2 multi-printer/replacement Gateway tests passed
- [ ] L3 HTTPS/pairing/security passed
- [ ] L4 Docker local/production topology passed
- [ ] L5 Nuxt one/many/replacement UX passed
- [ ] L6 physical XP-C260M matrix passed
- [ ] L7 production rollout and replacement drill passed
- [ ] no Printer/PrintJob database dependency reintroduced
- [ ] `.env`, TLS keys, paired tokens, IP/MAC/serial and customer data absent from Git/logs
- [ ] no unrelated changes, commit, deploy or production mutation without explicit authority
