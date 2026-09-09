# Flow การพิมพ์ผ่าน Saijai LAN Print Gateway

อัปเดต: 2026-09-09 (Asia/Bangkok)

เอกสารนี้เป็นจุดเริ่มต้นสำหรับทำความเข้าใจและไล่ปัญหาเส้นทางการพิมพ์จริง
ตั้งแต่ผู้ใช้เปิดเว็บ เชื่อมต่อเครื่องพิมพ์ ค้นหาและยืนยันเครื่อง ไปจนถึงการส่ง
ESC/POS ผ่าน Raspberry Pi ส่วนคำสั่งเปลี่ยนค่าประจำวันอยู่ใน
[`SETUP.md`](../SETUP.md)

## ภาพรวมสถาปัตยกรรม

```text
ผู้ใช้เปิดเว็บในร้าน
        |
        | HTTPS: https://saijaiphareab.shop
        v
Browser ของผู้ใช้
        |
        | HTTPS: https://print.saijaiphareab.shop:17321
        | DNS record (DNS only) -> 192.168.1.175
        v
Raspberry Pi: Print Gateway
        |
        | TCP raw print: 192.168.1.171:9100
        v
Xprinter XP-C260M
```

Nuxt server ที่อยู่บน production ไม่ได้เปิด TCP ไปหาเครื่องพิมพ์เอง การพิมพ์
ผ่าน LAN เกิดจาก browser ของผู้ใช้เรียก Gateway ในเครือข่ายร้านโดยตรง ดังนั้น
เครื่องที่เปิดเว็บต้องอยู่ใน LAN ร้านหรือเครือข่ายที่ route ถึง Gateway ด้วย

ค่าที่ตรวจสอบแล้วในร้านปัจจุบัน:

```text
เว็บหลัก:       https://saijaiphareab.shop
Gateway:        https://print.saijaiphareab.shop:17321
Gateway IP:     192.168.1.175
เครื่องพิมพ์:   192.168.1.171:9100
```

DNS record `print.saijaiphareab.shop -> 192.168.1.175` ต้องเป็น DNS only
และการเชื่อมต่อจะใช้ได้เฉพาะจากเครือข่ายร้าน เพราะ `192.168.1.175` เป็น private IP

## ช่วงที่ 1: Gateway เริ่มทำงาน

Raspberry Pi รัน Gateway ด้วย systemd service:

```text
saijai-gateway.service
```

Service อ่านค่าเฉพาะจาก:

```text
/etc/saijai-print-gateway.env
```

ค่าที่กำหนดพฤติกรรมหลักคือ:

```dotenv
PRINT_GATEWAY_BIND_HOST=0.0.0.0
PRINT_GATEWAY_PORT=17321
PRINT_GATEWAY_PUBLIC_URL=https://print.saijaiphareab.shop:17321
PRINT_GATEWAY_ALLOWED_ORIGINS=https://saijaiphareab.shop
PRINT_GATEWAY_DISCOVERY_CIDRS=192.168.1.171/32
PRINT_GATEWAY_DISCOVERY_PORTS=9100
```

เมื่อ bind แบบรับจากเครือข่ายอื่น Gateway ต้องใช้ HTTPS และ certificate/key
ที่ตรงกับ `print.saijaiphareab.shop` จากนั้น systemd จะเริ่ม Gateway อัตโนมัติ
หลังเปิด Raspberry Pi

ตรวจสถานะ:

```bash
systemctl is-enabled saijai-gateway.service
systemctl is-active saijai-gateway.service
```

ตรวจ health:

```bash
curl -fsS -H 'Origin: https://saijaiphareab.shop' \
  https://print.saijaiphareab.shop:17321/health
```

ผลปกติ:

```json
{"available":true,"version":"0.3.0"}
```

คำสั่งนี้ตรวจ DNS, TLS, CORS origin, LAN policy และ process ของ Gateway พร้อมกัน
แต่ยังไม่ได้ตรวจว่า Gateway ต่อถึงเครื่องพิมพ์หรือพิมพ์กระดาษได้

## ช่วงที่ 2: Browser เชื่อมต่อ Gateway

`app/composables/useThermalPrinter.ts` อ่านค่า public runtime config:

```dotenv
NUXT_PUBLIC_PRINT_GATEWAY_ENABLED=true
NUXT_PUBLIC_PRINT_GATEWAY_URL=https://print.saijaiphareab.shop:17321
```

เมื่อหน้าเว็บ mount หรือผู้ใช้กดเชื่อมต่อแบบ Wi-Fi/Ethernet browser จะ:

1. เรียก `GET /printers` เพื่ออ่าน trusted printers ที่ Gateway บันทึกไว้
2. Gateway ตรวจ `Origin` ให้ตรงกับ `https://saijaiphareab.shop`
3. Gateway ตรวจ source address ว่ามาจาก private/loopback network
4. ถ้ามี trusted printer ที่ online เพียงเครื่องเดียว ระบบเลือกให้อัตโนมัติ
5. ถ้ายังไม่มีเครื่องหรือเครื่องเดิม offline ผู้ใช้กดค้นหาเครื่องพิมพ์

ถ้า `NUXT_PUBLIC_*` เปลี่ยน ต้อง rebuild/redeploy เว็บ production เพราะค่านี้
ถูกนำไปใช้ใน public runtime configuration และนโยบาย CSP ของเว็บ

## ช่วงที่ 3: ค้นหาเครื่องพิมพ์

เมื่อผู้ใช้กดค้นหา browser เรียก:

```http
POST /discover?force=true
```

Gateway จะ scan เฉพาะค่าที่กำหนดไว้ ไม่ได้ scan ทั้งอินเทอร์เน็ตหรือทั้ง LAN:

```text
192.168.1.171:9100
```

การค้นหาเป็นการเปิด TCP connection สั้น ๆ เพื่อดูว่ามี service รับอยู่หรือไม่
ไม่ได้ส่ง receipt หรือ byte งานพิมพ์

ผลลัพธ์เป็น candidate ID แบบชั่วคราว เช่น:

```json
{
  "candidates": [
    {"id":"candidate_...","name":"เครื่องพิมพ์ที่พบ 1"}
  ]
}
```

Gateway ไม่เปิดเผย IP/port ให้ browser ในผลลัพธ์

## ช่วงที่ 4: Trust เครื่องพิมพ์

ผู้ใช้เลือก candidate และตั้งชื่อเครื่อง จากนั้น browser เรียก:

```http
POST /printers/trust
Content-Type: application/json
```

body มีเพียง candidate ID และชื่อที่ผู้ใช้ตั้ง ไม่รับ IP หรือ port จาก browser

Gateway จะ resolve candidate ID จากผลค้นหาที่เพิ่งเกิดขึ้น แล้วบันทึก mapping
ไว้ใน state file ของ Gateway เช่น:

```text
/var/lib/saijai-print-gateway/gateway-state.json
```

state file เก็บเฉพาะ trusted printer mapping ไม่เก็บ receipt, payload, queue
หรือข้อมูลธุรกิจของลูกค้า การเขียน state ทำแบบ atomic และใช้ permission owner-only

Browser เก็บเฉพาะ opaque printer ID ที่เลือกไว้ใน `localStorage` เพื่อให้หน้าเว็บ
ถัดไปลองเชื่อมต่อเครื่องเดิมได้ ส่วน IP/port จริงยังเป็นความรับผิดชอบของ Gateway

## ช่วงที่ 5: เว็บสร้างเอกสารพิมพ์

เมื่อพนักงานกดพิมพ์ เว็บไม่ได้ส่งยอดเงินหรือข้อมูลเครื่องพิมพ์ไปให้ Gateway
เอง ลำดับคือ:

1. Browser เรียก Nuxt endpoint เช่น:

   ```http
   GET /api/admin/payments/:id/document?format=escpos&type=receipt&width=576
   ```

2. Nuxt ตรวจสิทธิ์ `ADMIN` หรือ `EMPLOYEE`
3. Server โหลด payment, order, customer, shop settings และข้อมูล QR จากฐานข้อมูล
4. Server สร้าง `PrintDocument` จากข้อมูลที่เชื่อถือได้ฝั่ง server
5. Renderer สร้าง Hybrid ESC/POS bytes
6. Browser รับ response เป็น binary ห้าม decode เป็นข้อความ

Hybrid ESC/POS ปัจจุบันใช้แนวทางหลักดังนี้:

- ข้อความ ASCII ที่ปลอดภัยใช้ native ESC/POS ได้
- ข้อความไทยและข้อความผสมไทย/Latin ใช้ raster ด้วย font Prompt
- รายการสินค้าและ layout สำคัญถูกจำกัดให้อยู่ในความกว้างกระดาษ
- QR payment และ LINE QR ถูกสร้าง/ตรวจจากข้อมูลฝั่ง server แล้ว rasterize
- `80 mm` ใช้ 576 dots และ `58 mm` ใช้ 384 dots
- คำสั่ง feed/cut อยู่ท้าย payload ตาม contract ของเครื่องที่ตรวจแล้ว

## ช่วงที่ 6: Browser ส่ง bytes ไป Gateway

หลังได้ binary bytes แล้ว browser เรียก:

```http
POST /print/:opaquePrinterId
Content-Type: application/octet-stream
```

ก่อนส่ง Gateway จะตรวจ:

- exact-origin CORS
- source address เป็น private/loopback LAN
- rate limit
- printer ID ต้องเป็น trusted printer ที่มีอยู่ใน state
- payload ต้องไม่ว่างและไม่เกินขนาดที่กำหนด

Gateway ไม่รับ host หรือ port จาก request ของ browser จึงไม่เปิดช่องให้ browser
กำหนดปลายทาง TCP ได้เอง

## ช่วงที่ 7: Gateway ส่งไปเครื่องพิมพ์

เมื่อ request ผ่านการตรวจแล้ว Gateway จะ:

1. ล็อก mutex ของ printer ID นั้น
2. อ่าน payload binary
3. resolve host/port จาก trusted state ภายใน Gateway
4. เปิด TCP connection ไป `192.168.1.171:9100`
5. ส่ง bytes หนึ่งครั้ง
6. ปิดการเชื่อมต่อหลัง flush
7. คืนผลลัพธ์ให้ browser
8. ปลด mutex

ไม่มี queue และไม่มี automatic retry

## ผลลัพธ์และความหมาย

| ผลลัพธ์ | ความหมาย |
| --- | --- |
| `SENT` | bytes ถูกส่งถึง transport สำเร็จ ไม่ได้ยืนยันว่ากระดาษออกหรือตัดสำเร็จ |
| `BUSY` | มีงานอื่นกำลังใช้ printer mutex ไม่เข้าคิว ให้รอแล้วกดใหม่เอง |
| `NOT_CONNECTED` | browser ยังไม่ได้เลือก trusted printer |
| `OFFLINE` | Gateway ต่อ TCP ไป printer ไม่สำเร็จก่อนเริ่มส่ง |
| `TIMEOUT` | การเชื่อมต่อหรือการส่งหมดเวลา โดยยังสรุปว่าไม่มี byte ถึงไม่ได้ในทุกกรณี |
| `UNKNOWN_PROGRESS` | เริ่มส่งแล้วแต่เกิดปัญหา อาจมีบาง byte ถึงเครื่องแล้ว ห้าม retry อัตโนมัติ |
| `ORIGIN_DENIED` | Origin ของเว็บไม่ตรงกับ `PRINT_GATEWAY_ALLOWED_ORIGINS` |
| `LAN_CLIENT_DENIED` | เครื่องที่เปิดเว็บไม่ได้อยู่ใน private/loopback network ที่ Gateway อนุญาต |
| `PRINTER_NOT_FOUND` | opaque printer ID ไม่มีใน Gateway state แล้ว |

`UNKNOWN_PROGRESS` ต้องตรวจสภาพกระดาษและเครื่องพิมพ์ก่อนตัดสินใจส่งซ้ำ เพื่อ
ป้องกันใบเสร็จซ้ำ

## ตรวจปัญหาตามชั้น

```text
1. Browser resolve print hostname ได้หรือไม่
2. Browser ต่อ HTTPS Gateway ได้หรือไม่
3. Origin เป็น https://saijaiphareab.shop ตรงหรือไม่
4. Gateway service active และ health ผ่านหรือไม่
5. Gateway ค้นพบ printer candidate หรือไม่
6. Candidate ถูก trust และ online หรือไม่
7. Nuxt สร้าง ESC/POS binary สำเร็จหรือไม่
8. Gateway ส่ง TCP สำเร็จหรือไม่
9. เครื่องพิมพ์รับ bytes และพิมพ์/ตัดจริงหรือไม่
```

คำสั่งตรวจจากเครื่องในร้าน:

```bash
dig +short print.saijaiphareab.shop
curl -fsS -H 'Origin: https://saijaiphareab.shop' \
  https://print.saijaiphareab.shop:17321/health
```

คำสั่งตรวจจาก Pi ถึงเครื่องพิมพ์:

```bash
ping -c 3 192.168.1.171
nc -vz 192.168.1.171 9100
```

ถ้า DNS ของ Pi ยังไม่รู้จักชื่อ สามารถใช้ `--resolve` เพื่อแยกทดสอบ Gateway
โดยไม่เปลี่ยน DNS:

```bash
curl -fsS --resolve print.saijaiphareab.shop:17321:192.168.1.175 \
  -X POST \
  -H 'Origin: https://saijaiphareab.shop' \
  https://print.saijaiphareab.shop:17321/discover
```

ผลปกติของ discovery จะมี `candidates` หรือเป็น array ว่างถ้าเครื่องที่พบถูก
trust ไว้แล้ว การเรียก `/discover` ไม่ส่งงานพิมพ์

### ตารางไล่ปัญหาแบบเร็ว

| อาการ | ตรวจจุดแรก | ถ้าผิดให้ดูต่อ |
| --- | --- | --- |
| ชื่อ Gateway หาไม่เจอ | `dig +short print.saijaiphareab.shop` จากเครื่องที่เปิดเว็บ | DNS record ต้องชี้ `192.168.1.175`; เครื่องต้องใช้ DNS ที่ตอบ private IP นี้ได้ |
| ต่อ port `17321` ไม่ได้ | `systemctl is-active` และ `ss -ltnp` บน Pi | service log, bind host, firewall และ client isolation |
| `/health` ได้ `ORIGIN_DENIED` | ค่า header `Origin` และ `PRINT_GATEWAY_ALLOWED_ORIGINS` | origin ต้องตรงทุกตัวอักษรและไม่มี `/` ปิดท้าย |
| Gateway start ไม่ได้และแจ้ง TLS paths | ค่า `PRINT_GATEWAY_TLS_CERT_PATH` และ `PRINT_GATEWAY_TLS_KEY_PATH` | ตรวจว่าไฟล์มีจริงและ user `pi` อ่าน private key ได้ |
| health ผ่านแต่ค้นหาไม่เจอ | `ping` และ `nc` จาก Pi ไป IP/port เครื่องพิมพ์ | DHCP reservation, printer IP, port `9100`, VLAN/client isolation |
| พบ candidate แต่เว็บไม่มีเครื่อง | trust candidate ในหน้าเชื่อมต่อ | ตรวจ `GET /printers` และ state file; อย่าแก้ JSON ด้วยมือ |
| ได้ `OFFLINE` | route จาก Pi ไป printer ก่อนเริ่มส่ง | IP/port เครื่องพิมพ์และสถานะเครื่อง |
| ได้ `UNKNOWN_PROGRESS` | ตรวจใบเสร็จที่เครื่องจริง | ห้าม retry อัตโนมัติ เพราะอาจพิมพ์ไปบางส่วนแล้ว |
| ได้ `SENT` แต่กระดาษไม่ออก | ตรวจ paper, cover, error light และ ESC/POS fixture | `SENT` ยืนยันเฉพาะ transport ไม่ยืนยันกลไกพิมพ์ |

คำสั่งบน Pi สำหรับตรวจ service, port และ log โดยไม่สั่งพิมพ์:

```bash
systemctl is-enabled saijai-gateway.service
systemctl is-active saijai-gateway.service
sudo ss -ltnp | grep 17321
sudo journalctl -u saijai-gateway.service -b -n 50 --no-pager
```

ตรวจรายการ trusted printer โดยไม่สั่งพิมพ์:

```bash
curl -fsS -H 'Origin: https://saijaiphareab.shop' \
  https://print.saijaiphareab.shop:17321/printers
```

ใช้ `journalctl` เมื่อสถานะไม่เป็น `active` หรือ Gateway restart วน ไม่จำเป็นต้อง
รันทุกครั้งที่เปิดเครื่อง

## TLS และการต่ออายุ certificate

Gateway ที่ bind นอก loopback ต้องใช้ HTTPS certificate สำหรับ
`print.saijaiphareab.shop` การติดตั้งร้านปัจจุบันใช้ Let's Encrypt และยืนยัน DNS
ผ่าน Cloudflare API token ที่จำกัดสิทธิ์เฉพาะ `Zone DNS Edit` ของ
`saijaiphareab.shop`

```text
Certbot live certificate
  /etc/letsencrypt/live/print.saijaiphareab.shop/fullchain.pem
  /etc/letsencrypt/live/print.saijaiphareab.shop/privkey.pem
        |
        | deploy hook หลังต่ออายุสำเร็จ
        v
Gateway runtime certificate
  /etc/saijai-print-gateway/tls/fullchain.pem
  /etc/saijai-print-gateway/tls/privkey.pem
        |
        v
restart saijai-gateway.service
```

Cloudflare token อยู่ใน `/root/.secrets/certbot/cloudflare.ini` ต้องเป็น mode
`600` และห้ามแสดงใน log, chat หรือ commit ส่วน deploy hook อยู่ที่
`/etc/letsencrypt/renewal-hooks/deploy/saijai-gateway.sh`

ตรวจระบบต่ออายุโดยไม่ออก certificate จริง:

```bash
systemctl is-active certbot.timer
sudo certbot renew --dry-run
```

ค่าที่ตรวจแล้วเมื่อ 2026-09-09 คือ timer เป็น `active` และ simulated renewal
สำเร็จ คำเตือน `PendingDeprecationWarning` จาก Python Cloudflare package ไม่ใช่
renewal failure; ให้ตัดสินผลจากบรรทัด `all simulated renewals succeeded`

การ dry-run ที่รันแล้วพิสูจน์ว่า Certbot และ DNS challenge ต่ออายุได้ แต่ยังไม่ใช่
หลักฐานว่า deploy hook คัดลอกไฟล์และ Gateway อ่าน certificate ชุดใหม่แล้ว หลังมี
การต่ออายุจริง ให้ตรวจ deploy hook, สถานะ service และ `/health` อีกครั้ง

## ข้อมูลที่ควรเก็บเมื่อแจ้งบั๊ก

เพื่อให้คนถัดไปไล่ปัญหาได้โดยไม่ต้องเริ่มใหม่ ให้บันทึกเวลาเกิดเหตุและแนบข้อมูล
เท่าที่เกี่ยวข้องดังนี้:

- หน้าเว็บ/ปุ่มที่กด, browser และอุปกรณ์ที่ใช้ รวมถึง error code ที่หน้าเว็บแสดง
- ผล `dig`, `/health`, `/printers`, `systemctl is-active` และ `nc` แยกตามชั้น
- log จาก `journalctl -u saijai-gateway.service -b` ในช่วงเวลาเดียวกับเหตุการณ์
- Gateway version จาก `/health`, IP ของ Pi และ endpoint เครื่องพิมพ์ที่ตั้งอยู่
- เครื่องพิมพ์มีกระดาษออกบางส่วนหรือไม่ โดยเฉพาะกรณี `UNKNOWN_PROGRESS`

ห้ามแนบ Cloudflare API token, private key, `.env` ทั้งไฟล์, session cookie,
ข้อมูลลูกค้าหรือ binary ใบเสร็จจริง หากต้องแสดง config ให้ใช้ `grep` เฉพาะชื่อ
ตัวแปรที่ไม่ใช่ secret ตามคำสั่งใน `SETUP.md`

## เมื่อ IP หรือ port เปลี่ยน

### เปลี่ยน IP/port เครื่องพิมพ์

แก้เฉพาะ Gateway env:

```dotenv
PRINT_GATEWAY_DISCOVERY_CIDRS=<IP_ใหม่>/32
PRINT_GATEWAY_DISCOVERY_PORTS=<port_ใหม่>
```

จากนั้น:

1. ทำ DHCP reservation ให้เครื่องพิมพ์
2. `sudo systemctl restart saijai-gateway.service`
3. เปิดเว็บ กดค้นหา
4. Trust candidate ใหม่และแทนที่ mapping เดิมถ้าจำเป็น

ไม่ต้องแก้ database, source code, `NUXT_PUBLIC_PRINT_GATEWAY_URL`, TLS หรือ
state JSON ด้วยมือเมื่อเปลี่ยนเฉพาะ printer endpoint

### เปลี่ยน IP Gateway

ถ้า hostname เดิมยังชี้ IP ใหม่ได้ ให้คง app URL เดิมแล้วแก้ DNS/DHCP reservation
ให้ถูกต้อง ถ้าเปลี่ยน hostname ต้องแก้ DNS, certificate, `PRINT_GATEWAY_PUBLIC_URL`
และ `NUXT_PUBLIC_PRINT_GATEWAY_URL` แล้ว rebuild/redeploy เว็บ

## ไฟล์ต้นทางสำคัญ

| หน้าที่ | ไฟล์ |
| --- | --- |
| Browser connect/discover/trust/send | `app/composables/useThermalPrinter.ts` |
| หน้าต่างเชื่อมต่อและเลือกเครื่อง | `app/components/thermal/PrinterConnectModal.vue` |
| สร้าง document และ ESC/POS endpoint | `server/api/admin/payments/[id]/document.get.ts` |
| โหลดข้อมูล payment/settings | `server/utils/directPrintDocument.ts` |
| render Thai/QR/ESC/POS | `server/utils/directPrintRenderer.ts` |
| no-queue/no-retry contract | `shared/utils/directPrint.ts` |
| Gateway routes/CORS/LAN checks | `print-bridge/server.mjs` |
| discovery scan | `print-bridge/discovery.mjs` |
| trusted state | `print-bridge/state.mjs` |
| TCP printer transport | `print-bridge/transport/tcp.js` |

## สิ่งที่ flow นี้ตั้งใจไม่ทำ

- ไม่ให้ public Nuxt server ต่อเข้า private printer
- ไม่รับ IP/port จาก browser โดยตรง
- ไม่เก็บ printer registry ใน PostgreSQL
- ไม่สร้าง print queue หรือ background worker
- ไม่ retry อัตโนมัติหลัง `UNKNOWN_PROGRESS`
- ไม่ถือว่า TCP success เป็นหลักฐานว่ากระดาษพิมพ์ครบและตัดเรียบร้อย
- ไม่เปิด Gateway หรือ raw printer port สู่อินเทอร์เน็ต
