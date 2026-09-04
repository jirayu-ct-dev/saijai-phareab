# Saijai LAN Print Gateway

บริการ Node 24 ภายในร้านสำหรับค้นหาและพิมพ์ ESC/POS ไปยัง Xprinter ผ่าน
Wi-Fi/Ethernet แบบทันที ไม่มี database queue, pairing code หรือการเก็บ payload
ใบเสร็จ เครื่องพิมพ์ที่เชื่อถือแล้วเก็บใน state file ของ Gateway เท่านั้น

## Local setup

คัดลอก `.env.example` เป็น `.env`, ตั้งค่า `PRINT_GATEWAY_*` และจำกัด permission
เมื่อรัน Node บน host โดยตรง:

```bash
chmod 600 .env
pnpm run print-gateway
```

หากใช้ Docker:

```bash
docker compose -f docker-compose.print-gateway.yml up --build -d
```

Docker ใช้ local-safe defaults ได้แม้ `.env` ยังไม่มี `PRINT_GATEWAY_*`: process bind
`0.0.0.0` ภายใน container แต่ publish เฉพาะ `127.0.0.1:17321` บน host
และ discovery ชี้ไป fake target เท่านั้น

ค่า local ตัวอย่างค้นหาเฉพาะ fake printer ที่ `127.0.0.1:19100` จึงไม่ส่งข้อมูล
ไปยัง hardware จริง การใช้เครื่องจริงต้องเปลี่ยน CIDR/port ตาม network ร้านและ
self-test/configuration page ของเครื่อง ห้ามเดาว่าเป็น port 9100

## LAN access and printer selection

อุปกรณ์ที่เข้าถึง Gateway จาก private/loopback network และเปิดจาก exact origin ที่อนุญาตสามารถ
ค้นหา เลือก และพิมพ์ได้ทันที ควรแยก guest Wi-Fi, จำกัด firewall ไม่ให้เข้าถึง
Gateway และห้าม publish Gateway สู่อินเทอร์เน็ต เพราะผู้ใช้ใน LAN ถือเป็น trusted
users หน้าเชื่อมต่อจะไม่ถามรหัส ให้เลือก Wi-Fi/Ethernet แล้วค้นหาและยืนยัน
เครื่องครั้งแรก หากมี trusted printer ออนไลน์หนึ่งเครื่อง ระบบจะเลือกให้อัตโนมัติ;
ถ้ามีหลายเครื่องจะแสดงตัวเลือก เมื่อเปลี่ยนเครื่อง ระบบเก็บ mapping ใหม่ใน Gateway
โดยไม่ต้องแก้โค้ดหรือฐานข้อมูล

## Production

Production มี `.env` สองฝั่งซึ่งไม่ใช่ไฟล์เดียวกันเมื่อ app กับ Gateway อยู่คนละ host:

- app host: `NUXT_PUBLIC_PRINT_GATEWAY_ENABLED` และ `NUXT_PUBLIC_PRINT_GATEWAY_URL`
- Gateway host ในร้าน: `PRINT_GATEWAY_*`, private CIDR และ TLS paths

Gateway ที่รับจากอุปกรณ์อื่นต้องใช้ stable HTTPS hostname/certificate ที่ทุกอุปกรณ์
เชื่อถือ ตั้ง `PRINT_GATEWAY_PUBLISH_HOST=0.0.0.0` บน Gateway host; Docker กำหนด
`PRINT_GATEWAY_BIND_HOST=0.0.0.0` ภายใน container ให้เอง แล้วรัน:

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

Compose ส่งเข้า Gateway เฉพาะ `PRINT_GATEWAY_*`; ไม่ส่ง database, Better Auth,
LINE, Cloudinary หรือ Resend secrets ใส่ container นี้

## API and safety contract

- `GET /health` ส่งเฉพาะ availability/version
- `GET /printers` คืน opaque ID/name/online โดยไม่เปิดเผย IP หรือ port
- `POST /discover` scan เฉพาะ private `/24`–`/32` และ port จาก `.env`
- `POST /printers/trust` รับเฉพาะ candidate ID ที่ Gateway เพิ่งค้นพบ
- `POST /print/:printerId` รับ `application/octet-stream` สำหรับ trusted ID เท่านั้น

Gateway ใช้ mutex แยกต่อเครื่องและไม่ retry อัตโนมัติ หากล้มเหลวหลังเริ่มส่ง byte
จะคืน `UNKNOWN_PROGRESS`; ผู้ใช้ต้องตรวจเครื่องก่อนกดซ้ำ

Gateway ตรวจ source address ว่าเป็น private/loopback และยังบังคับ exact-origin
CORS ทุก request แต่ local command-line client สามารถปลอม `Origin` ได้ จึงต้องถือ
LAN ร้านเป็น trusted boundary และใช้ firewall/VLAN ป้องกัน guest network

## Verification without hardware

```bash
pnpm exec vitest run \
  tests/server/printBridgeDirectConfig.test.ts \
  tests/server/printGatewayDiscovery.test.ts \
  tests/server/printBridgeDirectServer.test.ts \
  tests/server/printBridgeTransport.test.ts
docker compose -f docker-compose.print-gateway.yml config --quiet
```
