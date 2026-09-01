# แผนงาน: ระบบพิมพ์ XP-C260M ใหม่แบบ Hybrid รองรับทุกการเชื่อมต่อ

## เป้าหมาย

สร้างระบบพิมพ์ใบแจ้งราคาและใบเสร็จใหม่สำหรับ Xprinter XP-C260M โดยใช้ semantic print document, Hybrid ESC/POS renderer, Local Print Bridge และ queue ต่อเครื่องร่วมกันทุก transport รองรับ Wi-Fi เป็นค่าเริ่มต้น รวมถึง Ethernet, USB และ Bluetooth เมื่อ unit จริงรองรับ พร้อมติดตามสถานะงานและจัดการความล้มเหลวอย่างชัดเจน

print flow ใหม่ไม่ต้องรักษา WebUSB/Puppeteer/raster-only architecture เดิม แต่ต้องไม่เปลี่ยน business flow ของ payment, quotation, receipt, order, authentication หรือระบบอื่นที่ไม่เกี่ยวกับการพิมพ์ PDF และ PNG ยังคงเป็น document exports แยกจาก physical print transport

## เงื่อนไขที่ตกลงแล้ว

- รองรับ transport ผ่าน Print Bridge ชุดเดียวกัน ได้แก่ Wi-Fi, Ethernet, USB และ Bluetooth ตาม interface ของ unit จริง
- XP-C260M เชื่อม Wi-Fi ของร้านเป็น transport หลัก และ bridge ต้องอยู่ใน LAN ที่สื่อสารกับ printer ได้
- USB และ Bluetooth เป็นทางเลือกที่ผู้ใช้เลือกได้ ไม่ใช่ browser-specific legacy flow
- Local Print Bridge เป็นเจ้าของ connection, queue, transport adapters และ printer endpoint เพื่อรองรับทั้ง Nuxt ที่ deploy บน cloud/Vercel และ Docker
- browser ทำเพียงสร้าง print job และดูสถานะ ไม่เปิด raw TCP, WebUSB หรือ Web Bluetooth connection ใน target architecture
- PDF และ PNG ยังดาวน์โหลดได้ แต่ไม่เป็น intermediate format บังคับของ physical print flow ใหม่
- ห้าม fallback ข้าม transport อัตโนมัติหลังเริ่มส่งงาน เพราะอาจพิมพ์ซ้ำ ต้องให้ผู้ใช้เลือก fallback หรือ reprint อย่างชัดเจน
- Render mode เป้าหมายคือ Hybrid ตั้งแต่เริ่ม: ภาษาไทย/complex layout เป็น shaped raster และใช้ native ESC/POS กับ QR/barcode/logo/feed/cut/อุปกรณ์เสริมที่ verify แล้ว
- ห้ามสมมติว่า printer ใช้ RAW TCP port `9100`, printable width 576 dots หรือรองรับคำสั่งเสริมทุกคำสั่ง ต้องยืนยันจาก self-test/configuration page และ physical test
- ไม่เปิด printer port หรือ Local Print Bridge ให้ public internet เข้าถึงโดยตรง
- ยังไม่ commit, deploy, apply migration, เปลี่ยน network setting หรือส่ง test print จนกว่าจะมีคำสั่งในรอบ implementation ที่เกี่ยวข้อง

## ข้อเท็จจริงของระบบปัจจุบัน

- หน้า admin ใบเสร็จและใบแจ้งราคาโหลด payment document payload แล้วแสดง preview ด้วย `ReceiptDocument.vue` และ `QuotationDocument.vue`
- PDF, PNG และ ESC/POS สร้างผ่าน `server/api/admin/payments/[id]/document.get.ts`
- server ใช้ Puppeteer เปิด `/print/payment/:id/:type`, จับ PNG แล้วใช้ Sharp แปลงเป็น monochrome raster
- ESC/POS ปัจจุบันใช้ `GS v 0` ส่ง raster เป็นช่วง ตามด้วย feed และ partial cut
- browser ส่ง bytes ผ่าน `useThermalPrinter.ts` ด้วย WebUSB หรือ Web Bluetooth
- state ฝั่ง browser เก็บเพียง paper width; ยังไม่มี logical printer profile, durable queue, job ID, Wi-Fi transport หรือ status lifecycle
- `escposRaster.ts` มี `openDrawer` option แต่ flow ปัจจุบันไม่ได้เปิดใช้
- current flow เป็นข้อมูล baseline และแหล่ง business/document contracts เท่านั้น ไม่ใช่ข้อจำกัดของ target architecture

จุดอ้างอิงหลัก:

- [`app/pages/admin/payment/[id]/receipt.vue`](../app/pages/admin/payment/[id]/receipt.vue)
- [`app/pages/admin/payment/[id]/quotation.vue`](../app/pages/admin/payment/[id]/quotation.vue)
- [`app/composables/useThermalPrinter.ts`](../app/composables/useThermalPrinter.ts)
- [`server/api/admin/payments/[id]/document.get.ts`](../server/api/admin/payments/[id]/document.get.ts)
- [`server/utils/escposRaster.ts`](../server/utils/escposRaster.ts)
- [`server/utils/pdfRenderer.ts`](../server/utils/pdfRenderer.ts)
- [`server/utils/paymentDocument.ts`](../server/utils/paymentDocument.ts)
- [`shared/types/receipt.ts`](../shared/types/receipt.ts)
- [XP-C260M project skill](../.agents/skills/xprinter-xp-c260m/SKILL.md)

## Completion check

ถือว่างานเสร็จเมื่อ:

1. ADMIN/EMPLOYEE ที่มีสิทธิ์เลือก XP-C260M Wi-Fi และสร้าง print job จากหน้าใบเสร็จหรือใบแจ้งราคาได้
2. Local Print Bridge รับเฉพาะงานของ logical printer ที่ตั้งค่าไว้ แล้วส่ง ESC/POS ไป XP-C260M ผ่าน IP/port ที่ยืนยันจากเครื่องจริง
3. งานของ printer เดียวกันถูก serialize และ bytes จากสองงานไม่ interleave
4. UI แยกสถานะอย่างน้อย `queued`, `sending`, `sent`, `needs_review` และ `failed` โดยไม่อ้างว่า physical print สำเร็จเมื่อมีหลักฐานเพียง socket write
5. timeout หลังเริ่มส่งไม่ถูก retry อัตโนมัติ แต่เข้าสู่ `needs_review` และให้พนักงานตัดสินใจ reprint
6. reprint สร้าง job ใหม่ที่อ้างถึง job เดิม และแสดงว่าเป็นสำเนาเมื่อ business requirement กำหนด
7. ภาษาไทย สระ วรรณยุกต์ ตัวเลข ชื่อรายการยาว logo และ LINE QR พิมพ์ได้ถูกต้องบนเครื่องจริง
8. feed และ partial cut ทำงานตาม profile ของเครื่องจริง
9. printer offline, Wi-Fi หลุด, bridge restart และ app restart มีผลลัพธ์ตาม state machine ที่กำหนด โดยงานไม่หายหรือถูกส่งซ้ำโดยไม่ทราบสาเหตุ
10. PDF และ PNG ยังดาวน์โหลดได้โดยไม่ผูกกับ physical print jobs
11. Wi-Fi, Ethernet, USB และ Bluetooth ใช้ print-job/state/renderer flow เดียวกัน โดยเลือก transport adapter ตาม printer profile และ hardware จริง
12. การเปิดใช้ native QR/barcode, NV logo, buzzer/light, cash drawer, status query หรือ black-mark ทำได้เฉพาะ capability ที่ยืนยันแล้ว และ capability ที่ไม่รองรับไม่ทำให้ receipt ปกติพิมพ์ไม่ได้
13. client ไม่สามารถกำหนด arbitrary printer host/port และไม่สามารถใช้ API เป็น SSRF proxy ไปยัง LAN target อื่น
14. tests, typecheck และ build ที่เกี่ยวข้องผ่าน หรือมี baseline failure แยกจาก failure ที่เกิดจากงานนี้ชัดเจน
15. มี runbook สำหรับติดตั้ง bridge, ตั้ง printer, ทดสอบ, rollback และสลับระหว่าง Wi-Fi/Ethernet/USB/Bluetooth หรือใช้ PDF/PNG

## สิ่งที่อยู่นอกขอบเขต

- เปลี่ยน business logic ของ payment, receipt number, quotation number, order state หรือ entitlement
- เปลี่ยน template เอกสารทั้งหมดเพียงเพื่อรองรับ Wi-Fi
- เปลี่ยน PDF/PNG renderer หากไม่จำเป็นต่อ document export; physical print flow ใหม่ต้องไม่พึ่ง renderer นี้
- สั่ง firmware update, factory reset หรือเปลี่ยน network settings ของเครื่องจริงโดยไม่มีคำสั่งและการยืนยัน target
- เปิด cash drawer อัตโนมัติใน flow ที่ยังไม่ได้ตกลง
- เปิด black-mark mode หากยังใช้กระดาษ thermal roll ต่อเนื่องธรรมดา
- รับประกันว่าใบพิมพ์ถูกหยิบออกจากเครื่อง เพราะ software เห็นได้สูงสุดตาม status mechanism ที่ firmware เปิดให้ใช้
- รองรับ arbitrary ESC/POS printer ที่ไม่ผ่าน printer profile; compatibility ทั่วไปเป็น fallback ไม่ใช่ completion criterion ของ XP-C260M

## Decisions

### D1 — One new print flow, multiple transport adapters

ทุก physical transport ใช้ flow ใหม่ชุดเดียว:

```text
Document data
    |
    +--> PDF download
    +--> PNG download
    +--> Print Job --> Hybrid ESC/POS --> Local Print Bridge
                                         +--> Wi-Fi TCP
                                         +--> Ethernet TCP
                                         +--> USB
                                         +--> Bluetooth
```

แต่ละ job เลือก physical transport หนึ่งเส้นทาง การเปลี่ยนเส้นทางต้องเกิดก่อนเริ่มส่ง หรือผ่าน explicit reprint/fallback action เท่านั้น เมื่อ rollout เสร็จให้ถอด browser-direct WebUSB/BLE flow เพื่อให้ queue owner มีเพียง bridge

### D2 — Wi-Fi means network transport owned by the bridge

อุปกรณ์ POS ไม่เชื่อม printer socket โดยตรง Browser ทำเพียงเรียก authenticated API ส่วน bridge เป็นผู้ map `printerId` ไปยัง endpoint ภายในร้านและส่ง ESC/POS ผ่าน TCP หรือ protocol ที่เครื่องจริงระบุ

การอยู่ Wi-Fi วงเดียวกันเป็น requirement ระหว่าง bridge กับ printer ส่วน POS ติดต่อ Nuxt ผ่าน HTTPS ตามปกติ หากภายหลังต้องบังคับว่า POS ต้องอยู่ในร้านจริง ให้เพิ่ม local-presence proof เป็นงานแยก ไม่อนุมานจาก public IP โดยเงียบ

### D3 — Hybrid ESC/POS is the target renderer

สร้าง operation-based Hybrid composer ใหม่จาก canonical document data โดยไม่ใช้ PNG/PDF ของหน้าเว็บเป็น source of truth:

- Thai/complex layout: shaped raster
- QR/barcode/PDF417: native command เมื่อทดสอบผ่าน
- logo: NV logo เมื่อ provision และ verify แล้ว; shaped raster fallback
- feed/cut: native command ตาม profile
- buzzer/light/status/cash drawer/black-mark: explicit capability flags ปิดเป็นค่าเริ่มต้น

### D4 — One queue owner per logical printer

Local Print Bridge เป็นผู้ serialize งานต่อ printer งานทุกชิ้นมี ID และ lifecycle ฝั่ง server ส่วน bridge มี persistent local state สำหรับงานที่ claim แล้ว เพื่อให้ process restart ไม่ลืมว่าส่งถึงขั้นใด

### D5 — Ambiguous failures require human reconciliation

ถ้า connection หลุดก่อนเริ่มส่ง สามารถ retry แบบ bounded ได้ ถ้าหลุดหลังเริ่มส่ง bytes แล้วให้ mark `needs_review` ห้าม retry อัตโนมัติ เพราะอาจออกใบซ้ำ

## Frontier: ข้อมูลที่ต้องยืนยันก่อน implementation แต่ไม่ขวางการเขียนแผน

- [D6] เครื่องใดจะรัน Local Print Bridge ตลอดเวลา: Windows POS, macOS, Linux mini PC หรือ Raspberry Pi
- [D7] Nuxt production รันบน Vercel/cloud หรือ Docker host ภายในร้าน
- [D8] self-test/configuration page ของ XP-C260M ตัวจริงระบุ firmware, Wi-Fi mode, IP assignment, protocol/port และ printable dots เท่าใด
- [D9] เครื่องจริงรองรับ status query, native QR/barcode/PDF417, NV logo, buzzer/light และ cash-drawer command ใดบ้าง
- [D10] ต้องการเก็บ immutable document snapshot นานเท่าใด และมีข้อกำหนด retention ด้านเอกสาร/ข้อมูลลูกค้าหรือไม่
- [D11] มี printer เดียวหรือหลายเครื่อง และต้องเตรียม logical site/printer mapping สำหรับหลายสาขาหรือไม่

ค่าเริ่มต้นของแผนจนกว่าจะได้คำตอบ:

- bridge เป็น Node.js/TypeScript service เพื่อ reuse types และ ESC/POS code ใน repo
- backend อาจอยู่ cloud จึงใช้ bridge แบบ outbound connection
- มีหนึ่งร้านและหนึ่ง XP-C260M แต่ schema ไม่ผูกกับ IP เดียวแบบ hard-code
- Wi-Fi เป็น default transport; Ethernet/USB/Bluetooth เป็น explicit physical alternatives ภายใต้ flow ใหม่
- printable dots, port และ optional capabilities ยังเป็น unverified ห้ามใส่ production default ที่ทำให้ส่งจริงโดยไม่ได้ตรวจ

## Target architecture

### Control plane

Nuxt/Prisma รับผิดชอบ:

- authorization
- logical printer registry ที่ไม่มี arbitrary LAN endpoint จาก client
- document identity และ snapshot/version
- print-job lifecycle และ audit
- idempotency ตอนสร้าง job
- UI status และ explicit reprint
- bridge authentication และ assignment

### Data plane

Local Print Bridge รับผิดชอบ:

- local printer endpoint และ transport configuration
- TCP connect/write timeout
- queue serialization
- artifact verification/hash
- XP-C260M ESC/POS composition
- capability gating
- local durable state ระหว่าง claim กับ completion
- status probe เมื่อเครื่องจริงรองรับ
- report event กลับ backend

### Document boundary

Business domain ต้องสร้าง canonical document data ก่อน render ห้ามคำนวณยอดเงินหรือเปลี่ยน payment/order state ใน printer adapter

```ts
type PrintDocument = {
  kind: "RECEIPT" | "QUOTATION"
  documentId: string
  documentNo: string
  revision: number
  issuedAt: string
  shop: ShopPrintInfo
  customer: CustomerPrintInfo
  items: PrintLineItem[]
  totals: PrintTotals
  note: string | null
  qr: PrintQr | null
}
```

Contract จริงควร reuse/derive จาก `PaymentDocumentPayload` และ `ReceiptPayload` แทนการสร้าง business shape ซ้ำโดยไม่จำเป็น

## Printer profile

แยก logical profile จาก connection secret/endpoint:

```ts
type PrinterProfile = {
  id: string
  name: string
  model: "XP-C260M"
  defaultTransport: "WIFI_BRIDGE" | "WEB_USB" | "WEB_BLUETOOTH"
  paperWidthMm: 80 | 58
  printableDots: 576 | 512 | 384
  renderMode: "RASTER" | "HYBRID"
  capabilities: {
    partialCut: boolean
    nativeQr: boolean
    nativeBarcode: boolean
    pdf417: boolean
    nvLogo: boolean
    buzzer: boolean
    statusQuery: boolean
    cashDrawer: boolean
    blackMark: boolean
  }
}
```

Bridge local configuration เป็นผู้ถือข้อมูล network:

```yaml
bridge_id: <generated-id>
printers:
  - printer_id: <logical-printer-id>
    transport: tcp
    host: <LAN address>
    port: <verified port>
    connect_timeout_ms: <bounded>
    write_timeout_ms: <bounded>
```

ข้อกำหนด:

- config ห้าม commit IP, Wi-Fi password, bridge token หรือ identifier ที่อ่อนไหว
- printer ใช้ DHCP reservation หรือ static lease เพื่อให้ endpoint คงที่
- bridge startup ต้อง validate profile กับ local mapping และไม่ claim งานของ printer ที่ไม่มี mapping
- client ส่งได้เพียง `printerId` ที่ backend อนุญาต ไม่ส่ง `host` หรือ `port`
- capability ที่ยังไม่ verify ต้องเป็น `false`

## Print job model และ state machine

### ข้อมูลขั้นต่ำ

เสนอให้เพิ่ม printing-only models โดยไม่เปลี่ยน payment/order models:

```text
Printer
- id
- name
- model
- defaultTransport
- paperWidthMm
- printableDots
- renderMode
- capabilities JSON
- isActive
- createdAt / updatedAt

PrintBridge
- id
- name
- credentialHash
- isActive
- lastSeenAt
- createdAt / updatedAt

PrintJob
- id
- printerId
- bridgeId nullable จนถูก claim
- documentType
- documentId
- documentRevision
- documentSnapshot JSON หรือ artifact reference ตาม D10
- transport
- status
- idempotencyKey
- requestedById
- reprintOfId nullable
- attemptCount
- failureCode nullable
- failureMessageSafe nullable
- queuedAt / claimedAt / sendStartedAt / sentAt / acknowledgedAt / resolvedAt
- createdAt / updatedAt

PrintJobEvent
- id
- printJobId
- type
- metadataSafe JSON
- createdAt
```

ห้ามเก็บ raw printer response, receipt bytes, tokens หรือ customer document ทั้งใบใน log ทั่วไป

### State machine

```text
QUEUED
  -> CLAIMED
  -> RENDERING
  -> READY
  -> SENDING
  -> SENT
  -> ACKNOWLEDGED     (เฉพาะเมื่อมี status mechanism ที่ยืนยันแล้ว)

QUEUED/CLAIMED/RENDERING/READY
  -> FAILED           (ยังไม่ได้ส่ง bytes และ retry policy อนุญาต)

SENDING
  -> NEEDS_REVIEW     (ไม่ทราบว่า printer รับ bytes ไปเท่าใด)

NEEDS_REVIEW
  -> RESOLVED_PRINTED
  -> RESOLVED_NOT_PRINTED
  -> REPRINTED        (อ้างถึง job ใหม่)
```

ห้ามใช้ชื่อ `PRINTED` จาก socket success เพียงอย่างเดียว ใช้ `SENT` และแสดงข้อความภาษาไทยที่ไม่เกินหลักฐาน เช่น “ส่งข้อมูลไปยังเครื่องพิมพ์แล้ว”

### Idempotency และ reprint

- create-job request ต้องมี idempotency key ต่อ user action เพื่อกัน double-click/network retry
- unique scope ขั้นต้น: requester + document + transport + client-generated request ID
- reprint ไม่ reuse job เดิม แต่สร้าง job ใหม่พร้อม `reprintOfId`
- UI ต้องแยก “ลองส่งใหม่ก่อนเริ่มพิมพ์” ออกจาก “พิมพ์สำเนา”
- automatic retry ทำได้เฉพาะ failure ก่อน `sendStartedAt` และต้อง bounded

## API และ authorization

### Admin/employee APIs

- `GET /api/admin/printers`
  - คืน logical printers, transport availability, bridge heartbeat และ capability summary
- `POST /api/admin/print-jobs`
  - body: `documentType`, `documentId`, `printerId`, `transport`, `requestId`, options ที่ allowlist แล้ว
  - server โหลด document จาก database เอง ไม่รับ totals/customer data จาก client
- `GET /api/admin/print-jobs/:id`
  - คืน status และ safe timeline
- `POST /api/admin/print-jobs/:id/reprint`
  - สร้าง job ใหม่อย่างชัดเจน
- `POST /api/admin/print-jobs/:id/resolve`
  - ใช้กับ `needs_review`; บันทึกผู้ตัดสินใจและผลที่ตรวจจริง

ทุก endpoint ต้องเรียก `requireRole(event, ["EMPLOYEE", "ADMIN"])` และเพิ่ม centralized prefix policy ใน `server/middleware/auth-session.ts` หากเปิด route family ใหม่

การสร้าง/แก้ printer profile, rotate bridge credential และ test connection ควรเป็น ADMIN-only ส่วนพนักงานใช้ printer ที่ active แล้วได้

### Bridge APIs

- bridge authenticate ด้วย credential แยกจาก user session และเก็บเฉพาะ hash ฝั่ง server
- `POST /api/print-bridge/claim`
  - long-poll หรือ bounded polling เพื่อ claim งานทีละงานต่อ printer
- `POST /api/print-bridge/jobs/:id/events`
  - ส่ง state transition และ safe failure code
- `POST /api/print-bridge/heartbeat`
  - ส่ง bridge version และ printer availability โดยไม่ส่ง credential/network detail กลับมา
- ใช้ atomic claim ป้องกัน bridge สอง instance รับ job เดียวกัน
- validate state transition ฝั่ง server; bridge ห้ามเขียน arbitrary final status
- rate-limit และ revoke credential ได้

## Local Print Bridge

### Runtime

ค่าเริ่มต้นเสนอ Node.js/TypeScript เพื่อ reuse contracts และใช้งาน `net.Socket` สำหรับ verified TCP transport แต่ packaging/final runtime ต้องเลือกหลังทราบ OS ใน D6

Bridge ต้อง:

1. โหลด local config และ secret จาก environment/OS secret storage
2. เปิด persistent local queue/store เช่น SQLite
3. heartbeat ไป backend
4. claim งานผ่าน outbound HTTPS
5. verify job schema, printer mapping และ artifact hash
6. compose ESC/POS ตาม verified profile
7. acquire per-printer mutex
8. connect และส่งด้วย timeout
9. probe status เมื่อ capability รองรับ
10. บันทึก local transition ก่อน report backend เพื่อ recover หลัง restart
11. ไม่เปิด unauthenticated HTTP/TCP control endpoint บน LAN

### Transport interface

```ts
interface PrinterTransport {
  connect(signal: AbortSignal): Promise<void>
  write(bytes: Uint8Array, signal: AbortSignal): Promise<WriteResult>
  queryStatus?(signal: AbortSignal): Promise<PrinterStatus>
  close(): Promise<void>
}
```

Adapters:

- `TcpEscposTransport`: Wi-Fi/LAN default
- `UsbEscposTransport`: bridge-side USB สำหรับเครื่องที่ต่อสาย
- `BluetoothEscposTransport`: bridge-side BLE หรือ Classic/SPP ตาม interface และ OS ที่ verify แล้ว
- `TcpEscposTransport` ใช้ร่วมกันได้ทั้ง Wi-Fi และ Ethernet เพราะต่างกันที่ network medium ไม่ใช่ ESC/POS job contract

ทุก adapter ต้องคืนผลลัพธ์มาตรฐานเดียวกันและผ่าน queue owner เดียวกัน ห้ามมี browser-direct adapter ใน target architecture

### Queue discipline

- concurrency เท่ากับ 1 ต่อ physical printer
- printer ต่างเครื่องทำงานพร้อมกันได้
- จำกัดขนาด artifact/job ก่อนรับ
- connect/write/status timeout แยกกัน
- exponential backoff เฉพาะก่อนเริ่มส่ง
- bridge restart ต้องอ่าน local state แล้ว reconcile job ที่อยู่ `SENDING` เป็น `needs_review`
- shutdown ต้องหยุด claim งานใหม่และปล่อยงานที่ยังไม่เริ่มอย่างปลอดภัย

## ESC/POS composer

แยก composer จาก transport:

```text
PrintDocument + PrinterProfile + PrintOptions
                    |
                    v
               ESC/POS bytes
                    |
        +-----------+-----------+-----------+
        |           |           |           |
      Wi-Fi      Ethernet      USB      Bluetooth
```

สร้าง operation-based composer ใหม่ โดย reuse เฉพาะ utility ที่ตรวจแล้วว่าเข้ากับ contract ใหม่ ไม่ให้ `buildEscposBytes()` หรือ HTML screenshot เดิมกำหนด architecture:

```ts
type PrintOperation =
  | { type: "initialize" }
  | { type: "raster"; bytes: Uint8Array; widthDots: number }
  | { type: "nativeQr"; data: string; size: number }
  | { type: "nativeBarcode"; symbology: string; data: string }
  | { type: "nvLogo"; key: string }
  | { type: "feed"; lines: number }
  | { type: "partialCut" }
  | { type: "buzzer"; pattern: string }
  | { type: "drawerPulse"; pin: number; onMs: number; offMs: number }
```

ข้อกำหนด composer:

- init/reset อยู่ใน adapter ไม่กระจายตามหน้า Vue
- raster width มาจาก verified profile ไม่อนุมานจาก `80mm` อย่างเดียว
- split raster เป็น band ที่ไม่เกิน buffer/command limit
- feed ก่อน cut เพียงพอให้เนื้อหาพ้น cutter
- native QR รักษา quiet zone และมี raster fallback
- cash drawer เป็น operation แยก ห้ามแอบผูกกับ receipt ทุกใบ
- buzzer/light เป็น post-print notification เฉพาะ profile ที่ verify
- black-mark command แยกจาก continuous-paper profile
- final reset ไม่ทำลาย pending status query ตาม firmware behavior ที่ทดสอบแล้ว

## ภาษาไทยและ layout

### Hybrid baseline

- ใช้ฟอนต์ไทยที่เก็บใน project และมีสิทธิ์ใช้
- ใช้ shaping engine ที่ผลลัพธ์คงที่และ package ไปกับ bridge ได้ ไม่พึ่งฟอนต์จาก OS โดยไม่ควบคุม
- rasterize เฉพาะ Thai/complex blocks และ image fallback ที่จำเป็น
- render ที่ 203 DPI ตาม printable dots จริง
- threshold/dithering ปรับจาก test fixture ไม่ใช้ภาพลูกค้าจริง
- cache static shop logo และส่วนที่ไม่เปลี่ยนบ่อย
- provision NV logo พร้อม version/hash และ raster fallback
- ใช้ native QR/barcode เฉพาะเมื่อ scanner/payment app จริงอ่านผ่าน
- วัด byte size, render duration และ print duration เพื่อปรับ band size/density โดย Hybrid ยังคงเป็น default
- text mode ภาษาไทยเปิดได้เฉพาะ profile ที่ทดสอบ vowels, tone marks, mixed Thai/Latin และ wrapping ผ่านทั้งหมด

## UI/UX

### Printer selector

สร้าง printer/transport selector สำหรับ flow ใหม่:

- `XP-C260M ผ่าน Wi-Fi` — ค่าเริ่มต้นเมื่อ bridge online
- `XP-C260M ผ่าน Ethernet`
- `XP-C260M ผ่าน USB`
- `XP-C260M ผ่าน Bluetooth` — เมื่อ unit/bridge OS รองรับ
- `ดาวน์โหลด PDF`
- `ดาวน์โหลด PNG`

Paper width และ capabilities ของทุก physical transport มาจาก printer profile ไม่ให้พนักงานเปลี่ยนต่อ job โดยไม่มีเหตุผล การตั้งเครื่องเป็นงาน ADMIN-only แยกจากการพิมพ์ประจำวัน

### Print action

- ปุ่มหลักใช้ selected transport
- Wi-Fi flow แสดง progress จาก print job
- ถ้า selected transport หรือ bridge offline ให้แจ้งชัดและเสนอ transport อื่น/PDF/PNG เป็นตัวเลือก ไม่ส่ง fallback เอง
- ถ้า job เป็น `needs_review` ให้แสดงคำแนะนำตรวจใบที่เครื่องก่อน พร้อมปุ่ม “พิมพ์สำเนา” และ “ยืนยันว่าพิมพ์แล้ว” ตามสิทธิ์
- disable double submit ด้วย client request ID แต่ไม่พึ่ง UI อย่างเดียว
- customer `/me/**` ไม่ควรเห็น admin printer controls; รักษาการดูเอกสารและเพิ่ม download เฉพาะเมื่อมี API/authorization ที่รองรับจริง

## Network และ security

- printer และ bridge อยู่ trusted LAN; หลีกเลี่ยง guest Wi-Fi/client isolation
- ใช้ DHCP reservation สำหรับ printer และบันทึก address เฉพาะ local config
- firewall อนุญาต bridge ไป printer เฉพาะ verified IP/port
- printer ไม่ expose ผ่าน router port-forward, public DNS หรือ tunnel สาธารณะ
- bridge ติดต่อ backend ออกทาง HTTPS/WSS เท่านั้น
- bridge token ต้อง rotate/revoke ได้และไม่อยู่ใน repository/log
- server ไม่รับ `host`, `port`, raw ESC/POS หรือ arbitrary URL จาก browser
- print options เป็น allowlist และ validate ด้วย Zod
- จำกัด artifact size, job rate และ concurrent claims
- log ใช้ job/printer/bridge IDs; ไม่ log session cookie, token, raw receipt หรือ customer PII โดยไม่จำเป็น
- test-print, cutter, buzzer, drawer และ network changes เป็น physical side effects ต้องอยู่หลัง explicit admin action

## Failure handling

| เหตุการณ์ | ผลลัพธ์ |
| --- | --- |
| Bridge offline ก่อนสร้างงาน | ปฏิเสธหรือ queue ตาม policy พร้อมแสดงสถานะจริง |
| Printer mapping ไม่มี | `FAILED_CONFIG`; ไม่ลอง host อื่น |
| Connect timeout ก่อนส่ง | retry bounded ได้ แล้ว `FAILED_OFFLINE` |
| Connection หลุดระหว่างส่ง | `NEEDS_REVIEW`; ไม่ retry อัตโนมัติ |
| Printer รายงาน cover/paper error | `FAILED_DEVICE` หรือ `NEEDS_REVIEW` ตามช่วงที่เกิด |
| Status query ไม่รองรับ | จบที่ `SENT`; UI ไม่ใช้คำว่า physical success |
| Bridge restart ก่อนส่ง | resume จาก local queue |
| Bridge restart ระหว่างส่ง | reconcile เป็น `NEEDS_REVIEW` |
| Backend event report ล้มเหลวหลังส่ง | เก็บ local outbox แล้ว retry report โดยไม่ส่ง receipt ซ้ำ |
| ผู้ใช้กดซ้ำ | idempotency key คืน job เดิม |
| ผู้ใช้สั่ง reprint | สร้าง job ใหม่ที่มี `reprintOfId` |

## File impact map ที่คาดไว้

ไฟล์จริงอาจปรับตามผล D6-D11 แต่ขอบเขตควรอยู่ใกล้ส่วนพิมพ์:

### Shared contracts

- เพิ่ม `shared/types/printing.ts`
- reuse `shared/types/receipt.ts`
- เพิ่ม Zod schemas ใกล้ API/bridge boundary ตาม convention ที่มีอยู่

### Server

- เพิ่ม `server/utils/printing/printDocument.ts`
- เพิ่ม `server/utils/printing/printJobState.ts`
- เพิ่ม `server/utils/printing/printerProfile.ts`
- เพิ่ม `server/api/admin/printers/**`
- เพิ่ม `server/api/admin/print-jobs/**`
- เพิ่ม `server/api/print-bridge/**`
- ปรับ `server/middleware/auth-session.ts` เฉพาะ centralized policies ที่จำเป็น
- reuse `server/utils/paymentDocument.ts`
- รักษา `server/utils/pdfRenderer.ts` สำหรับ PDF/PNG exports
- แทนที่บทบาท `server/utils/escposRaster.ts` ด้วย Hybrid composer หลัง cutover และลบเมื่อไม่มี caller

### App

- เพิ่ม composable สำหรับ printer selection, create job และ job status ที่ไม่ถือ device handle ใน browser
- ปรับ `PrinterConnectModal.vue` ให้เป็น printer/transport selector
- ปรับหน้า admin receipt/quotation ให้ route action ตาม selected transport
- ปรับ `ThermalSlip.vue` เท่าที่จำเป็นต่อ status/fallback UI
- ไม่เปลี่ยน document template โดยไม่มี visual requirement
- หลัง cutover ให้ลบ `useThermalPrinter.ts`, WebUSB/Web Bluetooth typings/dependencies และ browser-direct handlers ที่ไม่มี caller แล้ว โดยตรวจ `rg` และ regression ก่อนลบ

### Database

- เพิ่ม models/enums ของ printer/bridge/job/event ผ่าน migration ใหม่
- ไม่แก้ migration เก่า รวมถึง migrations ที่เคย add/remove printer settings
- ตรวจ full migration chain บน disposable database ตามข้อควรระวังของ project

### Bridge

- ตำแหน่ง source และ packaging ตัดสินหลัง D6
- ถ้าอยู่ repo นี้ ให้มี README/runbook, config example, service lifecycle และ test command ของตัวเอง
- ต้อง package transport dependencies สำหรับ TCP, USB และ Bluetooth ตาม OS เป้าหมาย และ isolate platform-specific code หลัง adapter interface
- ห้ามเพิ่ม dependency หรือ workspace structure จนกว่าจะเลือก runtime/package boundary ชัดเจน

## ลำดับ implementation

### Phase 0 — Hardware and network evidence

1. ถ่าย/บันทึก unit label และ self-test/configuration page โดย redact ข้อมูลที่ไม่ควรเผยแพร่
2. ยืนยัน hardware revision, firmware, interfaces, speed, printable dots และ power label
3. ยืนยัน Wi-Fi SSID/network mode โดยไม่บันทึกรหัสผ่านใน repo
4. ตั้ง DHCP reservation และตรวจว่า bridge host ติดต่อ printer ได้
5. ยืนยัน protocol/port จาก printer configuration ไม่เดา
6. ส่ง minimal ASCII + feed โดยใช้เครื่องมือทดสอบที่กำหนด target ชัดเจน

Completion: มี project-local configuration record ที่ไม่มี secret และ minimal transport test ผ่าน

### Phase 1 — Contracts and state machine

1. เพิ่ม printing types และ state-transition utility
2. เพิ่ม tests ของ allowed/forbidden transitions
3. กำหนด safe error codes และ user-facing Thai labels
4. กำหนด idempotency/reprint semantics
5. ตัดสิน snapshot retention ใน D10 ก่อนสร้าง schema สุดท้าย

Completion: print job lifecycle ถูกทดสอบแบบ pure utility โดยไม่แตะ printer

### Phase 2 — Persistence and APIs

1. เพิ่ม Prisma models/enums และ migration ใหม่
2. เพิ่ม printer registry และ bridge credential management แบบ ADMIN-only
3. เพิ่ม create/status/reprint/resolve APIs
4. เพิ่ม bridge claim/event/heartbeat APIs พร้อม atomic claim
5. เพิ่ม centralized route policies และ handler-level authorization
6. เพิ่ม validation, rate limits และ safe logging

Completion: API tests ยืนยัน authorization, idempotency, atomic claim และ state transitions

### Phase 3 — Local Print Bridge MVP

1. เลือก runtime/packaging ตาม OS จริง
2. ทำ local config loader และ persistent queue/outbox
3. ทำ bridge authentication, heartbeat และ bounded job polling
4. ทำ TCP transport ด้วย verified endpoint และ timeouts
5. ทำ USB transport ตาม OS target
6. ทำ Bluetooth transport ตาม BLE/Classic profile ของ unit จริง
7. ทำ per-printer serialization ร่วมกันทุก transport
8. ทำ restart recovery และ `needs_review`

Completion: bridge รับ fixture job, route ผ่าน adapter ที่เลือก, serialize ได้ครั้งเดียว และ recover จาก restart ได้ตาม state โดย adapter failure มี contract เดียวกัน

### Phase 4 — Hybrid renderer และ XP-C260M physical baseline

1. สร้าง canonical print document mapper จาก payment document domain
2. สร้าง shaped Thai raster blocks โดยใช้ bundled font/shaping engine
3. สร้าง native numeric/text operations ที่ verify แล้ว
4. สร้าง native QR/barcode operations พร้อม raster fallback
5. สร้าง logo operation แบบ NV logo พร้อม raster fallback
6. สร้าง feed/partial-cut operations ตาม profile
7. พิมพ์ minimal ASCII และ Hybrid receipt fixture
8. ตรวจ 576/512 dots, clipping, density, alignment และ feed
9. ทดสอบงานยาว งานต่อเนื่อง และแต่ละ transport ที่ unit รองรับ
10. ทดสอบ offline/reconnect และ bridge restart

Completion: Hybrid output ผ่านภาษาไทย, layout, scan, feed/cut และ transport matrix โดยไม่พึ่ง HTML/Puppeteer raster pipeline

### Phase 5 — Admin UI cutover

1. เพิ่ม logical printer/transport selector
2. เลือก Wi-Fi เป็น default เมื่อ bridge online
3. route ทุก physical transport ไป print-job API
4. ให้ bridge เลือก Wi-Fi/Ethernet/USB/Bluetooth adapter ตาม job/profile
5. รักษา PDF/PNG actions เป็น document exports
6. เพิ่ม status timeline, explicit transport fallback และ reprint UX
7. ป้องกัน double submit ด้วย request ID
8. ถอด browser-direct WebUSB/BLE flow หลัง hardware/transport regression ผ่าน

Completion: พนักงานเลือกและใช้ทุก transport ผ่าน flow ใหม่ได้ และ PDF/PNG ไม่ได้รับผลกระทบ

### Phase 6 — Optional XP-C260M capabilities

เปิดทีละ capability หลัง physical test:

1. native QR
2. native barcode/PDF417 ตาม use case จริง
3. NV logo provisioning + version/hash
4. buzzer/light notification
5. supported status query
6. cash drawer หลังยืนยัน hardware/pinout/business flow
7. black-mark หลังยืนยัน media และ requirement

ทุก capability ต้องมี profile flag และ raster/no-op fallback ที่ปลอดภัย ส่วน Hybrid renderer, native QR เมื่อ verify, feed และ cut เป็นส่วนของ baseline ไม่ใช่งาน optimization ภายหลัง

Completion: capability matrix ของ unit จริงบันทึกผล pass/fail พร้อม firmware และ test fixture

### Phase 7 — Hardening and rollout

1. soak test หลายงานและหลาย client
2. ทดสอบ router/AP restart และ IP reservation
3. ทดสอบ bridge upgrade/restart พร้อม pending jobs
4. ตรวจ log/metrics ว่าไม่เก็บ PII หรือ secret
5. ทำ runbook ติดตั้ง อัปเดต troubleshoot และ rollback
6. rollout ด้วย feature flag ให้ร้าน/เครื่องทดสอบก่อน
7. คง legacy transports จน Wi-Fi มีผลใช้งานจริงเสถียรตามช่วงที่ตกลง

Completion: production checklist ผ่านและ rollback กลับ USB/BLE/PDF/PNG ได้โดยไม่ deploy schema rollback

## Test strategy

### Unit tests

- printer profile validation: 576/512/384 และ capability defaults
- print-job state transitions
- idempotency key behavior
- reprint linkage
- retry classification ก่อน/หลัง send start
- ESC/POS init/feed/cut envelope
- raster band sizing และ width packing
- native QR/barcode input validation
- safe error serialization

### API tests

- USER เรียก admin print APIs ไม่ได้
- EMPLOYEE พิมพ์ได้แต่แก้ printer/bridge credential ไม่ได้
- ADMIN จัดการ logical printer ได้
- client-supplied host/port/raw bytes ถูกปฏิเสธ
- document ownership/source โหลดจาก server ไม่เชื่อ totals จาก client
- concurrent claim ได้ผู้ชนะคนเดียว
- invalid state transition ถูกปฏิเสธ
- duplicate request ID คืน job เดิม
- reprint สร้าง job ใหม่และ link ถูกต้อง
- inactive printer/bridge ไม่ได้รับงาน

### Bridge tests โดยไม่ใช้ hardware

- fake TCP server รับ byte ตามลำดับและยืนยันไม่มี interleave
- connect failure ก่อนส่ง retry ตามจำนวนที่กำหนด
- disconnect ระหว่างส่งเข้าสู่ `needs_review`
- backend report failure ใช้ local outbox โดยไม่ resend receipt
- restart ทุก state ที่สำคัญ
- artifact hash mismatch ถูกปฏิเสธ
- printer mapping ที่ไม่อยู่ allowlist ถูกปฏิเสธ

### Physical hardware matrix

| Test | Wi-Fi | Ethernet | USB | Bluetooth | Expected |
| --- | --- | --- | --- | --- | --- |
| Minimal ASCII | required | if supported | required | if supported | อ่านได้และ feed ถูกต้อง |
| ภาษาไทยหลายรูปแบบ | required | if supported | required | if supported | สระ/วรรณยุกต์ไม่เพี้ยน |
| ใบเสร็จยาว | required | if supported | required | if supported | ไม่ตัด/clip/interleave |
| Logo | required | if supported | required | if supported | contrast และขนาดถูกต้อง |
| LINE/payment QR | required | if supported | required | if supported | แอปจริงสแกนผ่าน |
| Partial cut | required | if supported | required | if supported | ตัดหลัง feed พอดี |
| Concurrent jobs | required | required | required | required | ออกตาม queue ทีละใบ |
| Printer offline | required | if supported | required | if supported | สถานะไม่อ้าง success |
| Transport reconnect | required | if supported | required | if supported | ไม่มี duplicate เงียบ |
| Bridge restart | required | required | required | required | recover/needs-review ถูกต้อง |
| Optional capabilities | after verify | after verify | after verify | after verify | เปิดเฉพาะ profile flag |

ใช้ fixture ที่ไม่มีข้อมูลลูกค้าจริง และบันทึก firmware, interface, port, dots, render mode และผลทดสอบทุกครั้ง

## Rollout และ rollback

### Feature flags/configuration

- `newPrintingEnabled`: เปิด physical print flow ใหม่
- `defaultPrinterId`: logical default
- capability flags อยู่ใน printer profile
- transport availability แยกตาม printer profile; การปิด transport หนึ่งไม่ทำให้ transport อื่นที่ configure แล้วหายไป

ชื่อจริงของ config ตัดสินตาม runtime-config convention ตอน implement ห้ามนำตัวอย่างนี้ไปเพิ่มโดยไม่ตรวจ config ปัจจุบัน

### Rollout

1. deploy schema/API และ bridge โดยยังปิด physical print flow ใหม่ใน UI
2. ติดตั้ง bridge และ verify heartbeat
3. ทดสอบ printer profile กับ fixture
4. เปิด flow ใหม่ให้ ADMIN กลุ่มเล็กและทดสอบ Wi-Fi/USB/Bluetooth ตาม hardware
5. เปิดให้ EMPLOYEE หลัง soak period
6. ตั้ง Wi-Fi เป็น default เมื่อ error/duplicate rate ผ่านเกณฑ์
7. ถอด browser-direct WebUSB/BLE หลัง cutover; คง USB/Bluetooth ผ่าน bridge และคง PDF/PNG exports

### Rollback

- ปิด `newPrintingEnabled`
- หยุด bridge claim งานใหม่
- reconcile jobs ที่ `SENDING` เป็น `needs_review`
- ให้ผู้ใช้เลือก transport adapter อื่นที่ bridge พร้อม หรือใช้ PDF/PNG
- ไม่ drop tables หรือ rollback migration เพื่อปิด feature
- เก็บ job/event audit ตาม retention policy

## Observability

Metrics ขั้นต่ำ:

- jobs queued/sent/failed/needs-review แยกตาม logical printer และ transport
- queue wait duration
- render duration
- connect/write duration
- bridge heartbeat age
- reconnect count
- explicit reprint count
- artifact byte size

Logs ต้องใช้ structured safe fields เช่น `jobId`, `printerId`, `bridgeId`, `state`, `failureCode`, `durationMs` และไม่ใส่ customer name, phone, receipt content, IP ภายในหรือ credential ใน user-facing report

## Verification commands

ระหว่าง implementation ให้ใช้ smallest relevant check แล้วจึง final checks:

```bash
pnpm test
pnpm exec nuxi typecheck
pnpm run build
git diff --check
```

หากเพิ่ม Prisma schema:

```bash
pnpm exec prisma generate
```

สร้าง migration ใหม่ด้วย `prisma migrate dev` เฉพาะ disposable local database ที่ได้รับอนุญาต ห้าม apply/reset/seed shared, staging หรือ production database โดยไม่มีคำสั่งชัดเจน และต้องทดสอบ migration chain ทั้งชุดตามข้อควรระวังใน `AGENTS.md`

ถ้า bridge มี package/test command แยก ต้องบันทึกคำสั่งจริงใน runbook และ CI หลังเลือก packaging แล้ว ห้าม invent command ไว้ล่วงหน้า

## Definition of ready ก่อนเริ่มเขียน production code

- ได้ข้อมูล D6-D11 ที่กระทบ architecture
- มี self-test/configuration page ของ unit จริง
- ยืนยัน bridge host OS และ deployment topology
- ยืนยัน printer protocol/port และ printable dots
- ตกลง retention ของ document snapshot/job events
- ตกลงว่า optional capabilities ใดอยู่ใน first production release
- ตกลงข้อความและ authority สำหรับ `needs_review`/reprint
- มี fixture เอกสารภาษาไทยที่ไม่มีข้อมูลจริงสำหรับ automated/physical test

## Definition of done

- completion checks ทุกข้อผ่าน
- Wi-Fi เป็น default ที่ใช้งานจริง และ Wi-Fi/Ethernet/USB/Bluetooth ที่ unit รองรับใช้ Hybrid print flow เดียวกัน
- PDF/PNG exports ยังทำงาน แต่ physical printing ไม่พึ่ง flow เดิม
- ไม่มี arbitrary LAN target จาก client
- ไม่มี silent retry/fallback ที่ทำให้พิมพ์ซ้ำ
- bridge และ printer มี runbook/health visibility
- capability profile ตรงกับ unit จริง ไม่ใช่เพียง model-family specification
- final diff ไม่มีการเปลี่ยน business logic หรือระบบอื่นนอก printing scope
- รายงาน tests ที่รัน, baseline failures, hardware tests และสิ่งที่ยังไม่ได้ verify ชัดเจน
