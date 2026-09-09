# คู่มือ Setup และคำสั่งรัน

แอปหลักรันจาก root โปรเจกต์ด้วย Node.js 24, pnpm และ Docker ส่วนขั้นตอนติดตั้ง
Raspberry Pi 2 เป็น Gateway อยู่ใน skill `raspberry-pi-print-gateway` เอกสารนี้
เน้นเฉพาะการเปลี่ยนค่า `.env` หลังติดตั้งแล้ว

อ่านภาพรวมเส้นทางพิมพ์และลำดับไล่ปัญหาที่
[`docs/print-gateway-flow.md`](docs/print-gateway-flow.md)

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

### รัน `print-gateway` บนเครื่องเดียวกับเว็บ development

เพิ่มค่าต่อไปนี้ใน `.env` ของ root โปรเจกต์ โดยแทนค่า IP และ port เครื่องพิมพ์
ด้วยค่าที่ตรวจพบจริง:

```dotenv
NUXT_PUBLIC_PRINT_GATEWAY_ENABLED=true
NUXT_PUBLIC_PRINT_GATEWAY_URL=http://127.0.0.1:17321

PRINT_GATEWAY_ENV_FILE=./.env
PRINT_GATEWAY_BIND_HOST=127.0.0.1
PRINT_GATEWAY_PORT=17321
PRINT_GATEWAY_PUBLIC_URL=http://127.0.0.1:17321
PRINT_GATEWAY_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
PRINT_GATEWAY_DISCOVERY_CIDRS=<IP_เครื่องพิมพ์>/32
PRINT_GATEWAY_DISCOVERY_PORTS=<port_เครื่องพิมพ์>
PRINT_GATEWAY_STATE_PATH=./print-bridge/gateway-state.json
```

เปิดสอง terminal:

```bash
# Terminal 1: เว็บ
pnpm dev
```

```bash
# Terminal 2: Gateway
pnpm print-gateway
```

ตรวจ health โดยยังไม่สั่งพิมพ์:

```bash
curl -fsS -H 'Origin: http://localhost:3000' \
  http://127.0.0.1:17321/health
```

ควรได้ JSON ที่มี `available: true` และ version ของ Gateway

### เมื่อ IP หรือ port เครื่องพิมพ์เปลี่ยนใน development

1. ยืนยัน IP และ TCP port ใหม่จาก self-test, network page หรือ DHCP list
2. แก้เฉพาะค่าใน `.env`:

   ```dotenv
   PRINT_GATEWAY_DISCOVERY_CIDRS=<IP_ใหม่ของเครื่องพิมพ์>/32
   PRINT_GATEWAY_DISCOVERY_PORTS=<port_ใหม่ของเครื่องพิมพ์>
   ```

3. หยุด Gateway ด้วย `Ctrl+C` ใน Terminal 2 แล้วรันใหม่:

   ```bash
   pnpm print-gateway
   ```

4. เปิดหน้าเชื่อมต่อเครื่องพิมพ์ กดค้นหา และ trust candidate ใหม่ ถ้าเป็นเครื่อง
   เดิมให้แทนที่ mapping เดิม

ไม่ต้องแก้ `NUXT_PUBLIC_PRINT_GATEWAY_URL`, source code, database หรือ state JSON
ด้วยมือเมื่อเปลี่ยนเฉพาะ IP/port เครื่องพิมพ์

### เมื่อ port ของ Gateway หรือ port ของเว็บเปลี่ยน

ถ้าเปลี่ยน Gateway จาก `17321` เป็น `17421` ต้องเปลี่ยนให้ตรงกันทั้งสองฝั่ง:

```dotenv
# Gateway
PRINT_GATEWAY_PORT=17421
PRINT_GATEWAY_PUBLIC_URL=http://127.0.0.1:17421

# Browser app
NUXT_PUBLIC_PRINT_GATEWAY_URL=http://127.0.0.1:17421
```

หยุดแล้วเปิดทั้ง `pnpm dev` และ `pnpm print-gateway` ใหม่

ถ้า port ของเว็บเปลี่ยน เช่นจาก `3000` เป็น `3004` ให้แก้ origin ที่ Gateway
ด้วย:

```dotenv
PRINT_GATEWAY_ALLOWED_ORIGINS=http://localhost:3004,http://127.0.0.1:3004
```

และแก้ `NUXT_PUBLIC_PRINT_GATEWAY_URL` ให้ตรงกับ Gateway ที่ใช้งานจริง

## 2. Printer Gateway: เปลี่ยนค่า `.env` เท่านั้น

ขั้นตอนติดตั้งและรัน Raspberry Pi 2 อยู่ใน skill
`raspberry-pi-print-gateway` แล้ว ส่วน `SETUP.md` นี้ใช้เป็นแผนผังแก้ค่าเมื่อ
เปลี่ยน IP/port หรือเชื่อมกับเว็บ production

### 2.1 แยกค่าให้ถูกว่าอะไรเปลี่ยนที่ไหน

| สิ่งที่เปลี่ยน | แก้ที่ | ตัวแปรหลัก |
| --- | --- | --- |
| IP เครื่องพิมพ์ | Gateway host `.env` | `PRINT_GATEWAY_DISCOVERY_CIDRS` |
| TCP port เครื่องพิมพ์ | Gateway host `.env` | `PRINT_GATEWAY_DISCOVERY_PORTS` |
| IP/hostname ของ Gateway | App `.env`, DNS/TLS และอาจ Gateway `.env` | `NUXT_PUBLIC_PRINT_GATEWAY_URL`, `PRINT_GATEWAY_PUBLIC_URL` |
| HTTP/HTTPS port ของ Gateway | App และ Gateway `.env` | `NUXT_PUBLIC_PRINT_GATEWAY_URL`, `PRINT_GATEWAY_PORT`, `PRINT_GATEWAY_PUBLIC_URL` |
| Origin ของเว็บที่เรียก Gateway | Gateway host `.env` | `PRINT_GATEWAY_ALLOWED_ORIGINS` |

จำง่าย ๆ: `DISCOVERY_*` คือที่อยู่เครื่องพิมพ์, `PRINT_GATEWAY_*` คือที่อยู่
Gateway, `NUXT_PUBLIC_PRINT_GATEWAY_URL` คือ URL ที่ browser ใช้เรียก Gateway

### 2.2 เมื่อ IP หรือ port เครื่องพิมพ์เปลี่ยน

1. ยืนยัน IP, MAC/interface และ TCP port ใหม่จาก self-test, network page หรือ
   DHCP list อย่าเดา port `9100` และอย่าใช้ IP hotspot ชั่วคราวเป็น production
2. ที่ Gateway host แก้ไฟล์ `.env` เช่น native Pi คือ
   `/etc/saijai-print-gateway.env`:

   ```dotenv
   PRINT_GATEWAY_DISCOVERY_CIDRS=<IP_ใหม่ของเครื่องพิมพ์>/32
   PRINT_GATEWAY_DISCOVERY_PORTS=<port_ใหม่ของเครื่องพิมพ์>
   ```

3. Restart Gateway ตาม deployment ที่ติดตั้งไว้ เช่น native systemd:

   ```bash
   sudo systemctl restart saijai-gateway.service
   ```

4. เปิดหน้าเชื่อมต่อเครื่องพิมพ์ในเว็บ กด **ค้นหาเครื่องพิมพ์ในร้าน** และ trust
   candidate ใหม่ ถ้าเป็นเครื่องเดิมให้เลือกแทนที่ mapping เดิม
5. ไม่ต้องแก้ `NUXT_PUBLIC_PRINT_GATEWAY_URL`, source code, database, DNS หรือ
   TLS เมื่อเปลี่ยนเฉพาะ IP/port เครื่องพิมพ์

Gateway จะเก็บ mapping เดิมใน `gateway-state.json` จนกว่าจะ trust candidate ใหม่
อย่าแก้ state JSON ด้วยมือและอย่าลบทิ้งเพื่อแก้ IP

### 2.3 เมื่อ IP/hostname ของ print-gateway เปลี่ยน

ถ้าใช้ hostname เดิมและ DNS เปลี่ยนตาม IP ใหม่ ให้แก้เฉพาะ DNS และตรวจว่า
certificate ยังตรง ไม่ต้องเปลี่ยน app URL

ถ้า app เรียก Gateway ด้วย IP ตรง ๆ ให้แก้ `.env` ฝั่งแอป:

```dotenv
NUXT_PUBLIC_PRINT_GATEWAY_ENABLED=true
NUXT_PUBLIC_PRINT_GATEWAY_URL=https://<IP-or-hostname>:17321
```

ถ้า hostname หรือ public URL ของ Gateway เปลี่ยน ให้แก้ฝั่ง Gateway ด้วย:

```dotenv
PRINT_GATEWAY_PUBLIC_URL=https://<gateway-hostname>:17321
PRINT_GATEWAY_ALLOWED_ORIGINS=https://saijaiphareab.shop
```

จากนั้นตรวจ DNS/TLS, restart Gateway และ rebuild/redeploy เว็บ เพราะ
`NUXT_PUBLIC_*` เป็นค่าที่ถูกใช้ตอน build

### 2.4 เมื่อ port ของ print-gateway เปลี่ยน

ตัวอย่างเปลี่ยนจาก `17321` เป็น `17421`:

ฝั่ง Gateway:

```dotenv
PRINT_GATEWAY_PORT=17421
PRINT_GATEWAY_PUBLIC_URL=https://<gateway-hostname>:17421
```

ฝั่งแอป:

```dotenv
NUXT_PUBLIC_PRINT_GATEWAY_URL=https://<gateway-hostname>:17421
```

ต้องให้ firewall/reverse proxy/certificate รองรับ port ใหม่ แล้ว restart Gateway
และ rebuild/redeploy เว็บ ค่า `PRINT_GATEWAY_ALLOWED_ORIGINS` ไม่ต้องเปลี่ยนถ้า
origin ของเว็บยังเดิม

### 2.5 เมื่อเอา Gateway ไปใช้กับเว็บ production

ฝั่งแอป:

```dotenv
NUXT_PUBLIC_PRINT_GATEWAY_ENABLED=true
NUXT_PUBLIC_PRINT_GATEWAY_URL=https://<gateway-hostname>:17321
```

ฝั่ง Gateway:

```dotenv
PRINT_GATEWAY_BIND_HOST=0.0.0.0
PRINT_GATEWAY_PORT=17321
PRINT_GATEWAY_PUBLIC_URL=https://<gateway-hostname>:17321
PRINT_GATEWAY_ALLOWED_ORIGINS=https://saijaiphareab.shop
PRINT_GATEWAY_DISCOVERY_CIDRS=<IP_เครื่องพิมพ์ที่ยืนยันแล้ว>/32
PRINT_GATEWAY_DISCOVERY_PORTS=<port_เครื่องพิมพ์ที่ยืนยันแล้ว>
PRINT_GATEWAY_TLS_CERT_PATH=/absolute/path/to/fullchain.pem
PRINT_GATEWAY_TLS_KEY_PATH=/absolute/path/to/privkey.pem
```

ก่อนสั่งพิมพ์จริงต้องตรวจ `/health`, discovery, trust candidate และ firewall
จากเครือข่ายร้าน ห้ามเปิด Gateway หรือ TCP port เครื่องพิมพ์สู่ public internet

### 2.6 สรุปสิ่งที่ไม่ต้องเปลี่ยน

เมื่อเปลี่ยนเฉพาะ IP/port เครื่องพิมพ์:

- ไม่ต้องแก้ `NUXT_PUBLIC_PRINT_GATEWAY_URL`
- ไม่ต้องแก้ `PRINT_GATEWAY_PUBLIC_URL`
- ไม่ต้องแก้ source code หรือ database
- ไม่ต้องเปลี่ยน TLS certificate ของ Gateway

เมื่อเปลี่ยน IP/hostname/port ของ Gateway จึงค่อยแก้ URL ฝั่งแอป, public URL,
DNS/TLS และ deploy เว็บใหม่ตามจริง

### 2.7 ตรวจสถานะหลัง Raspberry Pi reboot

ไม่ต้องรันคำสั่งเหล่านี้ทุกครั้งหลังเปิดเครื่อง ใช้สำหรับตรวจสอบหลังติดตั้ง,
หลัง reboot หรือเมื่อสงสัยว่า Gateway ไม่ทำงาน:

```bash
systemctl is-enabled saijai-gateway.service
systemctl is-active saijai-gateway.service
```

ผลที่ถูกต้องคือ:

```text
enabled
active
```

ตรวจ health สำหรับค่าทดสอบ local-only:

```bash
curl -fsS -H 'Origin: http://localhost:3004' \
  http://127.0.0.1:17321/health
```

ถ้าเป็น production ให้ใช้ Origin และ hostname จริงของเว็บ/Gateway:

```bash
curl -fsS -H 'Origin: https://saijaiphareab.shop' \
  https://print.saijaiphareab.shop:17321/health
```

ผลปกติคือ `{"available":true,"version":"0.3.0"}` คำสั่งนี้ไม่สั่งพิมพ์

ถ้าไม่เป็น `active` ให้ดู log ของ boot ปัจจุบัน:

```bash
sudo journalctl -u saijai-gateway.service -b -n 50 --no-pager
```

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
PRINT_GATEWAY_TLS_CERT_PATH=/absolute/path/to/fullchain.pem
PRINT_GATEWAY_TLS_KEY_PATH=/absolute/path/to/privkey.pem
```

สุดท้ายแก้ DNS/certificate, อัปเดต LIFF Endpoint URL ใน LINE Developers (ถ้าใช้),
rebuild/redeploy เว็บ และ recreate Gateway ค่า Gateway URL เป็น build input ของ CSP

> ห้ามเปิด TCP `9100` หรือ Gateway สู่ public internet และอย่าลบ volume
> `saijai-pgdata`/`saijai-print-gateway-state` หากไม่ได้ตั้งใจล้างข้อมูล

## Production: ใช้กับ `saijaiphareab.shop` และเปลี่ยน IP

ส่วนนี้เป็น checklist หลังติดตั้ง Gateway แล้ว โดยไม่รวมกรณีเปลี่ยน port ของ
Gateway

### A. ค่าฝั่งเว็บ production

แก้ `.env` ของแอป:

```dotenv
NUXT_PUBLIC_PRINT_GATEWAY_ENABLED=true
NUXT_PUBLIC_PRINT_GATEWAY_URL=https://print.saijaiphareab.shop:17321
```

หลังแก้ `NUXT_PUBLIC_*` ต้อง rebuild/redeploy เว็บ

### B. ค่าฝั่ง Raspberry Pi print-gateway

แก้ไฟล์:

```bash
sudo nano /etc/saijai-print-gateway.env
```

ค่าหลักสำหรับ production:

```dotenv
PRINT_GATEWAY_BIND_HOST=0.0.0.0
PRINT_GATEWAY_PORT=17321
PRINT_GATEWAY_PUBLIC_URL=https://print.saijaiphareab.shop:17321
PRINT_GATEWAY_ALLOWED_ORIGINS=https://saijaiphareab.shop
PRINT_GATEWAY_DISCOVERY_CIDRS=<IP_เครื่องพิมพ์ที่ยืนยันแล้ว>/32
PRINT_GATEWAY_DISCOVERY_PORTS=<port_เครื่องพิมพ์ที่ยืนยันแล้ว>
PRINT_GATEWAY_TLS_CERT_PATH=/etc/saijai-print-gateway/tls/fullchain.pem
PRINT_GATEWAY_TLS_KEY_PATH=/etc/saijai-print-gateway/tls/privkey.pem
```

`print.saijaiphareab.shop` ต้อง resolve ไปยัง Raspberry Pi จาก browser ในร้าน
และ certificate ต้องครอบคลุมชื่อนี้ ห้ามใช้ชื่อเว็บหลักแทนชื่อ Gateway และห้าม
เปิด Gateway หรือ TCP port เครื่องพิมพ์ออก public internet

### C. คำสั่งดูค่าจริงของ Raspberry Pi print-gateway

ดู hostname ของ Pi:

```bash
hostnamectl --static
```

ดู IP ทั้งหมดของ Pi:

```bash
hostname -I
ip -4 -br addr
```

ดู interface และ IP ที่ใช้ route ออกอินเทอร์เน็ต:

```bash
ip -4 route show default
ip route get 1.1.1.1
```

ดูค่า Gateway ที่ใช้อยู่ โดยไม่แสดง env ทั้งไฟล์:

```bash
sudo grep -E '^(PRINT_GATEWAY_BIND_HOST|PRINT_GATEWAY_PORT|PRINT_GATEWAY_PUBLIC_URL|PRINT_GATEWAY_ALLOWED_ORIGINS|PRINT_GATEWAY_DISCOVERY_CIDRS|PRINT_GATEWAY_DISCOVERY_PORTS)=' /etc/saijai-print-gateway.env
```

ตรวจว่า hostname production resolve จาก Pi ได้:

```bash
getent hosts print.saijaiphareab.shop
```

ตรวจจาก Mac หรือเครื่องในร้าน:

```bash
dig +short print.saijaiphareab.shop
ping -c 1 print.saijaiphareab.shop
```

### D. ตรวจ service และ health หลังแก้ค่า

```bash
sudo systemctl restart saijai-gateway.service
systemctl is-enabled saijai-gateway.service
systemctl is-active saijai-gateway.service
```

ตรวจ health จาก Raspberry Pi หรือเครื่องในร้าน:

```bash
curl -fsS -H 'Origin: https://saijaiphareab.shop' \
  https://print.saijaiphareab.shop:17321/health
```

ผลปกติคือ:

```json
{"available":true,"version":"0.3.0"}
```

ตรวจการต่ออายุ TLS อัตโนมัติ (ไม่สั่งพิมพ์):

```bash
systemctl is-active certbot.timer
sudo certbot renew --dry-run
```

ผลที่ยืนยันว่าพร้อมต่ออายุคือ `certbot.timer` เป็น `active` และมีข้อความ
`all simulated renewals succeeded` ห้ามเปิดเผยไฟล์
`/root/.secrets/certbot/cloudflare.ini` เพราะมี Cloudflare API token

ถ้าไม่เป็น `active`:

```bash
sudo journalctl -u saijai-gateway.service -b -n 50 --no-pager
```

### E. เมื่อ IP เครื่องพิมพ์เปลี่ยน

1. ดู IP ใหม่จาก self-test, network page หรือ DHCP list และยืนยัน TCP port
2. ตรวจจาก Pi:

   ```bash
   ping -c 3 <IP_ใหม่ของเครื่องพิมพ์>
   nc -vz <IP_ใหม่ของเครื่องพิมพ์> <port_ที่ยืนยันแล้ว>
   ```

3. แก้เฉพาะค่าใน `/etc/saijai-print-gateway.env`:

   ```dotenv
   PRINT_GATEWAY_DISCOVERY_CIDRS=<IP_ใหม่ของเครื่องพิมพ์>/32
   PRINT_GATEWAY_DISCOVERY_PORTS=<port_ที่ยืนยันแล้ว>
   ```

4. Restart service และตรวจ `/health`
5. ในเว็บกดค้นหาเครื่องพิมพ์ แล้ว trust candidate ใหม่แทน mapping เดิม

เมื่อเปลี่ยนเฉพาะ IP เครื่องพิมพ์ ไม่ต้องแก้ `NUXT_PUBLIC_PRINT_GATEWAY_URL`,
`PRINT_GATEWAY_PUBLIC_URL`, DNS, TLS, source code หรือ database และอย่าแก้
`gateway-state.json` ด้วยมือ

### F. เมื่อ IP ของ print-gateway เปลี่ยน

ถ้า hostname `print.saijaiphareab.shop` เดิมยังใช้ได้:

1. เปลี่ยน DHCP reservation หรือ DNS ให้ชี้ไป IP ใหม่ของ Pi
2. ตรวจจากเครื่องในร้านด้วย `dig`, `ping` และ `curl` ด้านบน
3. ไม่ต้องเปลี่ยน URL ใน app ถ้า hostname และ certificate ยังเดิม

ถ้า hostname หรือชื่อที่ใช้ใน URL เปลี่ยน ให้แก้ทั้งสองฝั่ง:

ฝั่งเว็บ:

```dotenv
NUXT_PUBLIC_PRINT_GATEWAY_URL=https://<gateway-hostname-ใหม่>:17321
```

ฝั่ง Pi:

```dotenv
PRINT_GATEWAY_PUBLIC_URL=https://<gateway-hostname-ใหม่>:17321
```

จากนั้นออก certificate ใหม่/แก้ DNS, restart Gateway และ rebuild/redeploy เว็บ

### G. ลำดับตรวจ production ก่อนสั่งพิมพ์

1. `systemctl is-active` ได้ `active`
2. `/health` ได้ `available: true`
3. Browser ในร้านเปิด `saijaiphareab.shop` ได้
4. ค้นพบ printer candidate ที่ตรงกับเครื่องจริง
5. Trust candidate และตรวจสถานะ online
6. สั่ง physical test print เมื่อได้รับอนุญาตเท่านั้น
