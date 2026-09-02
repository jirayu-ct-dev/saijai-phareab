# ระบบพิมพ์ (Printing System) — สถานะ ณ วันที่ 2026-09-03

เอกสารสรุประบบพิมพ์ใบเสร็จ/ใบแจ้งราคาแบบครบวงจรที่ implement เสร็จแล้วใน repo นี้
เป้าหมายหลักคือเครื่องพิมพ์ **Xprinter XP-C260M** (thermal 80 มม.) พิมพ์ภาษาไทยได้ถูกต้อง
โดยแยกความเสี่ยงออกจากเบราว์เซอร์ผ่าน **Print Bridge** และคิวงานฝั่งเซิร์ฟเวอร์

> แหล่งอ้างอิง: `docs/plan-database-printing-master-orchestration.md` (PRN-01..07, C7–C12)
> และ `docs/summary-database-and-printing-2026-09-03.md` (สรุปงานรวม DB + Printing)

---

## 1. ภาพรวมสถานะ

| ส่วน | สถานะ | หมายเหตุ |
|---|---|---|
| สเปก contract (PRN-01) | ✅ เสร็จ | `shared/types/printing.ts` frozen union |
| Schema + migration (PRN-02) | ✅ เสร็จ | ตาราง `printer`, `print_job` + apply บน production แล้ว |
| API คิวงาน + Bridge (PRN-03) | ✅ เสร็จ | `/api/admin/print-jobs`, `/api/admin/print-bridge/*` |
| Local Print Bridge (PRN-04) | ✅ เสร็จ | `print-bridge/` Node 24 ไม่มี dependency |
| Renderer ESC/POS ไทย (PRN-05) | ✅ เสร็จ | TIS-620 + native QR + raster fallback |
| หน้า UI Admin (PRN-06) | ✅ เสร็จ | `/admin/printing` + ปุ่มพิมพ์บนหน้าเอกสารเดินคิวแล้ว |
| Deploy production (PRN-07) | ✅ ขึ้นแล้ว (ฟีเจอร์ยังไม่เปิดใช้จริง) | ยังไม่มีเครื่องพิมพ์ลงทะเบียนจริง |
| เก็บค่าจากเครื่องจริง (HW-01) | ⏳ รอตัวเครื่อง | interfaces/port/dots/capabilities |
| ทดสอบบนกระดาษจริง (HW-02) | ⏳ รอตัวเครื่อง | ตารางทดสอบ physical matrix |
| ถอดการเชื่อมตรงแบบเดิม | ⏳ รองานด้านบนผ่านก่อน | ยังเก็บไว้ใต้ rollback flag |

**ทดสอบ e2e บน local ผ่านแล้วทั้งระบบ** (โดยไม่ต้องมีเครื่องพิมพ์จริง):
สร้างงาน → bridge หยิบ → ส่ง ESC/POS ไปเครื่องพิมพ์จำลอง → ถอดรหัสได้ใบเสร็จภาษาไทยครบถ้วน

---

## 2. สถาปัตยกรรม

```
เบราว์เซอร์ (admin)                เซิร์ฟเวอร์ (Nuxt/Nitro)              เครื่องพิมพ์
────────────────────               ──────────────────────              ───────────
หน้าเอกสาร  ── POST /api/admin/print-jobs ──▶ สร้าง PrintJob (snapshot + สถานะ QUEUED)
                                              │
หน้า /admin/printing ◀── GET print-jobs ────  คิวงาน (status/timeline)
                                              │
Print Bridge (เครื่อง local) ── claim ──────▶ FOR UPDATE SKIP LOCKED + lease 30 วิ
   │   GET/POST heartbeat, claim, events      ตรวจ stale (C9) ก่อนปล่อยงาน
   │
   ├─ สร้าง bytes: ESC/POS (TIS-620) จาก snapshot
   ├─ outbox JSONL (fsync) — ทน crash
   └─ transport ────────────────────────────▶ TCP :9100 (จริง) / fake printer (ทดสอบ)
        รายงานผล ── POST events ────────────▶ SENT / NEEDS_REVIEW / FAILED / RETRY_WAIT
```

หลักการสำคัญที่ออกแบบไว้ (ตามสเปก C7–C12):

- **C7** — มีแค่ 2 ตาราง: `printer` (โปรไฟล์เครื่อง) และ `print_job` (คิวงาน)
- **C8** — lease + fencing token: bridge ยืมงาน 30 วินาที งานซ้ำสองเครื่องไม่พิมพ์ซ้ำ
- **C9** — stale guard: งานจะถูกส่งเมื่อเอกสารต้นทางยังตรงกับตอนสร้าง snapshot เท่านั้น
  (สถานะ/ยอดเงิน/revision/QR config เปลี่ยน → `STALE_DOCUMENT` จะไม่พิมพ์ของเก่า)
- **C10** — เงินแบบ exact: คำนวณเป็น minor unit (สตางค์) ด้วย integer ไม่ใช้ float
- **C12** — snapshot ปลอดภัย: เก็บ snapshot ที่จำกัดขอบเขต + sha256 hash + วันหมดอายุ
  (ข้อมูล QR ผู้รับเงินเข้ารหัส AES-256-GCM ด้วย env `PAYMENT_QR_RECEIVER_KEYS`)
- **Idempotency** — สร้างงานซ้ำด้วย key เดิมจะได้งานเดิม ไม่พิมพ์ซ้ำ (กันดับเบิลคลิก/ซิกแนลซ้ำ)

---

## 3. ทำอะไรได้แล้ว (ความสามารถ ณ ตอนนี้)

### 3.1 สั่งพิมพ์จากหน้าเอกสาร (ใหม่ — เดินผ่านคิวระบบ)

- หน้า **ใบแจ้งราคา** (`/admin/payment/[id]/quotation`) และ **ใบเสร็จ**
  (`/admin/payment/[id]/receipt`) มีปุ่มพิมพ์หลักที่สร้างงานพิมพ์บนเซิร์ฟเวอร์ทันที
  - QUOTATION → ใช้ serviceOrderId / RECEIPT → ใช้ paymentId
  - **ไม่ต้องเชื่อมต่อเครื่องพิมพ์จากเบราว์เซอร์** — รองรับ transport ทุกแบบ
    ที่ลงทะเบียนไว้บนโปรไฟล์เครื่อง (WIFI / ETHERNET / USB / BLUETOOTH)
- ไอคอนเครื่องพิมพ์บนหน้าเอกสารลิงก์ไป `/admin/printing` (จัดการเครื่อง + ดูคิว)
- สร้างงานซ้ำด้วย idempotency key เดิม → ได้งานเดิม พร้อมข้อความ
  "งานพิมพ์นี้ถูกสร้างไว้แล้ว (ไม่สร้างซ้ำ)"

### 3.2 การพิมพ์แบบเดิม (legacy — เก็บไว้ใต้ rollback flag)

- ปุ่มรอง "พิมพ์เชื่อมตรง (เดิม)" ยังใช้ได้บนหน้า admin quotation/receipt
  (เชื่อมตรง WebUSB/Bluetooth จากเบราว์เซอร์ + modal เชื่อมต่อเดิม)
- ควบคุมด้วย env `NUXT_PUBLIC_PRINT_LEGACY_DIRECT` (default `true` = แสดง;
  ตั้ง `false` เพื่อซ่อน) — ตามสเปกจะถอดออกหลัง physical regression ผ่าน
- หน้า `/me/**` ของลูกค้าคงใช้โหมดเดิมทั้งหมด ไม่ได้เชื่อมคิวระบบ

### 3.3 หน้าจัดการระบบพิมพ์ `/admin/printing` (สิทธิ์ ADMIN)

1. **เครื่องพิมพ์** — เพิ่ม/แก้ไข/ลบเครื่องพิมพ์ 1 ตัว (v1 รองรับ logical printer เดียว)
   - ตั้งชื่อ, transport เริ่มต้น, โหมดเรนเดอร์, ความกว้างกระดาษ (58/80 มม.),
     printable dots (384/576), และ capabilities รายบิต (native QR, raster, ตัดกระดาษ,
     NV logo, buzzer, cash drawer ฯลฯ)
   - หมุนเวียน bridge credential ได้ (แสดง plaintext **ครั้งเดียว** ปิดไม่ได้จนกว่าจะกดรับทราบ)
   - ลบเครื่องที่มีงาน QUEUED ค้าง → ถูกปฏิเสธ (409)
2. **คิวงานพิมพ์** — ดูรายการงานล่าสุด พร้อม badge สถานะภาษาไทย, กรองตามสถานะ
   - งาน NEEDS_REVIEW ปิดได้ 2 ทางชัดเจน: "พิมพ์ออกจริง" / "ไม่ได้พิมพ์"
   - พิมพ์ซ้ำ (reprint) ได้เฉพาะงาน SENT / FAILED / NEEDS_REVIEW / STALE_DOCUMENT
     — สร้างงานใหม่จาก snapshot เดิม และทำเครื่องหมายงานต้นทางเป็น REPRINTED
3. **สถานะ Bridge** — ดู heartbeat ล่าสุดของ bridge

### 3.4 Print Bridge (โปรแกรมฝั่งเครื่องร้าน)

`print-bridge/` — Node 24 ESM **ไม่มี dependency ภายนอก** ไม่ต้อง `npm install`:

```bash
node print-bridge/bin/bridge.mjs --config /path/to/config.json
# --help / --version ใช้ได้; config default = ./config.json
```

- ดึงงานเป็นรอบ: heartbeat ทุก 60 วิ / claim ทุก 15 วิ (ปรับได้ใน config)
- **Durable outbox**: บันทึกงานลงไฟล์ JSONL แบบ fsync ทุกแถว — ปิดเครื่อง/ไฟดับแล้ว
  เปิดใหม่งานไม่หาย; ถ้าเขียน bytes ลงเครื่องพิมพ์ไปแล้วแต่สถานะไม่ชัด
  → ขึ้น **NEEDS_REVIEW ทุกครั้งที่ start** (ห้าม retry เงียบ ๆ เด็ดขาด)
- **Per-printer mutex**: เครื่องเดียวส่งได้ทีละงาน
- **Retry ที่ควบคุม**: ล้มเหลวก่อนถึงเครื่องพิมพ์ → ลองใหม่สูงสุด 3 ครั้ง (RETRY_WAIT +
  backoff); ล้มเหลวหลังเริ่มส่งแล้ว → NEEDS_REVIEW เสมอ (ไม่มี FAILED หลัง sendStartedAt)
- ส่งเฉพาะข้อมูลที่จำเป็น: **host/port ของเครื่องพิมพ์อยู่ใน config เครื่อง local เท่านั้น
  ไม่ถูกส่งขึ้นเซิร์ฟเวอร์**; credential ไม่ถูก log; config ที่ group/others อ่านได้
  จะถูกปฏิเสธ (ต้อง chmod 0600)
- มี transport จำลอง (fake) สำหรับทดสอบโดยไม่มีฮาร์ดแวร์

### 3.5 การเรนเดอร์เอกสาร ESC/POS ภาษาไทย

- Hybrid composer: PrintDocument + PrinterProfile → PrintOperation[]
  แล้ว encoder แปลงเป็น bytes จริงตาม capabilities ของเครื่อง
- **ภาษาไทย**: UTF-8 → TIS-620 (codepage `ESC t 16`) พร้อมการจัดการสระ/วรรณยุกต์
  ลอย (zero-width) ให้ไม่กินความกว้างคอลัมน์; ตัดบรรทัดยาวถูกต้อง
- **QR**: ถ้าเครื่องรองรับ native QR (`GS ( k`) ใช้ native; ถ้าไม่ ทำ raster bitmap
  ด้วย payload **ชุดเดียวกัน** (กัน QR สองระบบไม่ตรงกัน)
- Feed / ตัดกระดาษบางส่วน (`GS V 66 0`), ตัวหนา/จัดกึ่งกลาง, ตารางสองคอลัมน์
  จัดชิดขวาแบบคำนวณความกว้างจริง
- **PromptPay/Thai QR** บนใบเสร็จ: ข้อมูลผู้รับเงินเข้ารหัส AES-256-GCM ก่อนเก็บ
  แก้รหัสผิด/ยังไม่ activate → ข้ามบล็อก QR และรายงานใน compose report (ไม่เดาแทน)
- หัวเอกสารถูกต้องตามชนิด: ใบเสร็จ = "ใบเสร็จรับเงิน", ใบแจ้งราคา = "ใบเสนอราคา"
- เอกสารไม่ตรงสถานะล่าสุด (เช่น ใบเสร็จของรายการที่เลิกแล้ว) → `STALE_DOCUMENT` ไม่พิมพ์

### 3.6 API สำหรับ bridge (contract คงที่)

| Endpoint | หน้าที่ |
|---|---|
| `POST /api/admin/print-bridge/heartbeat` | bridge รายงานตัว (Bearer bridgeCredential, เทียบ SHA-256 แบบ timing-safe) |
| `POST /api/admin/print-bridge/claim` | ของาน (server lock แบบ SKIP LOCKED + lease 30 วิ + ตรวจ stale) |
| `POST /api/admin/print-bridge/events` | รายงานผลต่อ job (แนบ leaseToken + fencingToken) — ตอบ `{results:[{jobId,accepted,reason?}]}` |
| `GET/POST /api/admin/print-jobs` | ดูคิว / สร้างงาน (สิทธิ์ EMPLOYEE, ADMIN) |
| `PUT /api/admin/print-jobs/[id]/resolve` | ปิดงาน NEEDS_REVIEW (สองทางเลือก) |
| `POST /api/admin/print-jobs/[id]/reprint` | พิมพ์ซ้ำจาก snapshot เดิม |
| `GET/POST/PUT/DELETE /api/admin/printers/**` | จัดการเครื่องพิมพ์ + หมุน credential (สิทธิ์ ADMIN) |

สถานะงานทั้ง 14 แบบ: QUEUED → CLAIMED → RENDERING → READY → SENDING → SENT →
ACKNOWLEDGED, และปลายทาง RETRY_WAIT / STALE_DOCUMENT / NEEDS_REVIEW /
RESOLVED_PRINTED / RESOLVED_NOT_PRINTED / REPRINTED / FAILED
(timeline ต่องานเก็บสูงสุด 20 รายการ) — ข้อความบนหน้าเว็บ **"ส่งไปที่เครื่องพิมพ์แล้ว"
= SENT เท่านั้น ไม่อ้างว่าพิมพ์ออกกระดาษจริง**

---

## 4. ทดสอบบนเครื่อง (local) — ทำงานอยู่ตอนนี้

Stack ทดสอบครบทั้งระบบโดยไม่ต้องมีเครื่องพิมพ์จริง:

```bash
docker compose -f docker-compose.local.yml -f docker-compose.print-test.yml up -d --build
```

- App: http://localhost:3004 (บัญชีทดสอบ `admin@saijai.local` / `password123`)
- DB จำลอง (postgres:16 พอร์ต 5434) + **fake printer** (TCP :9100 เขียนไฟล์ .bin) +
  **bridge ตัวจริง** ที่คุยกับ API จริง
- ไฟล์ที่เกี่ยว: `docker-compose.print-test.yml`, `print-bridge/test/fake-printer.mjs`,
  `print-bridge/test/print-seed.sql`, `print-bridge/test/local-test-config.json`
  (credential ในไฟล์ทดสอบเป็นของ stack ทิ้งได้เท่านั้น ห้ามใช้ที่อื่น)
- ผล e2e ที่ยืนยันแล้ว: QUOTATION + RECEIPT สร้างผ่าน API เดียวกับปุ่มบนเว็บ →
  bridge หยิบ → SENT → fake printer ได้ ESC/POS หัว `1b40 1b7416` →
  ถอด TIS-620 ออกมาเป็นใบเสร็จ/ใบแจ้งราคาภาษาไทยถูกต้องครบ
  (ชื่อร้าน/ที่อยู่/เลขที่/วันที่แบบ Asia/Bangkok/รายการ/ยอด)
- Idempotency ทดสอบแล้ว: ส่ง key เดิมซ้ำ → `existing: true` ได้งานเดิม ไม่พิมพ์ซ้ำ

---

## 5. สิ่งที่ยังไม่ได้ทำ / รอของ

1. **HW-01** — เสียบเครื่อง XP-C260M จริงแล้วเก็บค่า: พอร์ตที่ใช้ได้ (USB/Ethernet/Wi-Fi),
   firmware, printable dots, capabilities จริง → อัพเดตโปรไฟล์เครื่อง
2. **HW-02 Physical matrix** — พิมพ์ทดสอบบนกระดาษจริง: ASCII/ไทย/ใบยาว/logo/
   LINE QR/PromptPay QR/feed-cut/offline-reconnect/concurrent jobs/bridge restart
3. **PRN-07 เปิดใช้จริง** — ลงทะเบียนเครื่องบน production, pilot ADMIN, dry-scan QR
   (2 banking apps โดยไม่โอน) แล้วค่อยเปิด EMPLOYEE; Wi-Fi เป็น default
4. หลัง physical regression ผ่าน → ตั้ง `NUXT_PUBLIC_PRINT_LEGACY_DIRECT=false`
   แล้วถอดการพิมพ์เชื่อมตรงจากเบราว์เซอร์ออกในรอบถัดไป

## 6. ความปลอดภัยที่ฝังไว้ในระบบ

- Bridge auth ด้วย Bearer credential ที่เก็บเป็น SHA-256 hash เท่านั้น (หมุนได้จาก UI)
- ทุก event จาก bridge ต้องแนบ lease + fencing token ที่ได้จากการ claim จริง
- Snapshot เก็บข้อมูลจำกัดขอบเขต + hash ตรวจความถูกต้อง + QR ผู้รับเงินเข้ารหัสก่อนเก็บ
- host/port เครื่องพิมพ์ไม่ขึ้นเซิร์ฟเวอร์, credential/config ไม่ถูก log
- งานสร้างใหม่ได้จาก server เท่านั้น (client แค่ขอ) — ทุกงานผ่าน Zod + สิทธิ์ EMPLOYEE/ADMIN
