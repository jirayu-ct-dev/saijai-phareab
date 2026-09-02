# Agent Prompt — เพิ่มเครื่องพิมพ์เข้าระบบ + ตั้งค่า Bridge + บันทึก Evidence HW-01

> วิธีใช้: กรอกช่อง `{{...}}` ในหัว prompt ให้ครบจากหน้า self-test ของเครื่องพิมพ์
> (กดปุ่ม FEED ค้างไว้แล้วเปิดเครื่อง = พิมพ์หน้า self-test ออกมา) แล้วคัดลอกทั้งไฟล์
> นี้ไปส่งให้ agent ตัวที่จะทำงาน

---

## ข้อมูลเครื่องพิมพ์ของฉัน (กรอกให้ครบก่อนส่ง — ถ้าช่องไหนไม่มีให้ถามฉัน อย่าเดา)

- ชื่อที่จะตั้งให้เครื่อง: `{{เช่น พิมพ์หน้าร้าน}}`
- Interface ที่จะใช้เชื่อมจริง: `{{WIFI หรือ ETHERNET — v1 bridge รองรับ TCP เท่านั้น}}`
- IP ของเครื่องพิมพ์: `{{เช่น 192.168.1.50}}` / พอร์ต (ยืนยันจาก self-test): `{{ปกติ 9100}}`
- Printable dots จาก self-test: `{{576 หรือ 512}}`
- Firmware / version: `{{จาก self-test}}`
- Code page ที่ self-test แสดง: `{{เช่น TIS-620 / ISO 8859-11 / 0x16}}`
- Capabilities ที่ self-test ยืนยัน: `{{nativeQr, partialCut, nvLogo, blackMark, buzzer, ...}}`
- สภาพแวดล้อมเป้าหมาย: `{{local (http://localhost:3004) หรือ production — ถ้า production ต้องทำตามกติกาด้านล่าง}}`
- เครื่องที่จะรัน bridge: `{{เครื่องอะไร OS อะไร และ ping ไปถึง IP เครื่องพิมพ์ได้ไหม}}`

---

## Prompt (ส่งส่วนนี้ให้ agent)

### บริบท

- Repo: **saijai-phareab** (Nuxt 4 full-stack, pnpm) — อ่าน `AGENTS.md` ก่อนแก้ไฟล์ใด ๆ
- แผนหลัก: `docs/plan-database-printing-master-orchestration.md` — งานนี้คือ **HW-01**
  (เก็บค่าจากตัวเครื่องจริง) และเริ่มขั้นต้นของ **HW-02** (พิมพ์ทดสอบจริง)
- สรุประบบพิมพ์ทั้งหมด: `docs/printing-system-guide-2026-09-03.md` (อ่านก่อนเริ่ม)
- Skill ที่ต้องโหลดและปฏิบัติตาม: **xprinter-xp-c260m** — อ่านทั้ง
  `references/device-profile.md` และ `references/integration.md`
- สถานะระบบ: PRN-01..07 implement/deploy ครบแล้ว ระบบผ่าน e2e บน local compose
  (ปุ่มพิมพ์ → คิว → bridge → ESC/POS ไทยถูกต้อง) — ยังไม่เคยมีเครื่องพิมพ์จริง

### เป้าหมาย

1. ลงทะเบียนเครื่องพิมพ์ XP-C260M ของฉันในระบบด้วยค่าจริงจาก self-test
2. ตั้งค่าและรัน Print Bridge ให้หยิบงานจากคิวและส่งถึงเครื่องพิมพ์ได้จริง
3. ทดสอบพิมพ์ตาม verification ladder และบันทึก evidence ของ HW-01 ลงเอกสาร
4. อัพเดต ledger ของแผนหลักและ push commit ที่สะอาด

### ข้อจำกัดด้านความปลอดภัย (ห้ามละเมิดเด็ดขาด)

- **ห้าม commit หรือ log**: bridge credential (plaintext), IP/พอร์ตภายในของเครื่องพิมพ์,
  รหัส Wi-Fi ของเครื่องพิมพ์ — ทั้งในไฟล์ repo, git history, และ log ที่พิมพ์ออกจอ
- ไฟล์ config ของ bridge ต้อง `chmod 0600` และเก็บ**นอก repo**
  (เช่น `~/.saijai/print-bridge/config.json`) — repo มีได้แค่ `config.example.json`
- ห้าม expose พอร์ตเครื่องพิมพ์ออกอินเทอร์เน็ต — bridge และเครื่องพิมพ์ต้องอยู่ LAN เดียวกัน
- ถ้าเป้าหมายเป็น **production**: ห้ามรัน migration/แก้ข้อมูลเอง — ต้องขอ approval จากฉันก่อน
  ทุกครั้งที่กระทบระบบจริง; evidence raw ที่มีข้อมูลอ่อนไหวเก็บใน restricted dir
  (chmod 600) ไม่คัดลอกออก
- ไม่มี lint command ที่ใช้งานได้ใน repo นี้ — ห้ามอ้างว่า "lint ผ่าน"
- `SENT` บนหน้าเว็บ = เขียน bytes ถึงเครื่องพิมพ์สำเร็จเท่านั้น **ไม่ใช่หลักฐานว่า
  กระดาษออกจริง** — ต้องยืนยันกับฉัน (คนดูกระดาษ) ทุกครั้ง

### ขั้นตอน

1. **ยืนยันข้อมูลให้ครบ** — ตรวจว่าข้อมูลในหัว prompt ครบทุกช่อง ถ้าขาดให้ถามฉันก่อน
   ห้ามเดาค่า dots/พอร์ต/capabilities
2. **ลงทะเบียนเครื่องพิมพ์** — ที่ `/admin/printing` (หรือ `POST /api/admin/printers`
   ด้วย session admin):
   - `defaultTransport` = ตามที่ระบุ (WIFI/ETHERNET), `paperWidthMm` = 80
   - `printableDots` = ค่าจาก self-test, `renderMode` = เริ่มด้วย **HYBRID**
     (ถ้าทดสอบไทยแล้วเพี้ยนค่อยเปลี่ยนเป็น RASTER และจดเหตุผล)
   - `capabilities` = ติ๊กเฉพาะอันที่ self-test ยืนยัน (nativeQr, partialCut ฯลฯ);
     ช่องที่ไม่แน่ใจให้ปล่อยปิด (fail-safe)
3. **หมุน bridge credential** — จากหน้าจัดการเครื่องพิมพ์ กด rotate แล้วเก็บ plaintext
   ครั้งเดียว (แสดงครั้งเดียวเท่านั้น ถ้าพลาดให้ rotate ใหม่)
4. **ตั้งค่า bridge บนเครื่องที่เห็นเครื่องพิมพ์** —
   `node print-bridge/bin/bridge.mjs --config <path นอก repo>` โดย config มี
   `baseUrl` ของแอป, `printerId`, `bridgeCredential`, `tcpTarget: {host, port}`;
   ตรวจว่า `chmod 0600` แล้ว รันแล้ว heartbeat สำเร็จ และ grep log ยืนยันว่า
   credential ไม่ถูกพิมพ์ออกมา
5. **ทดสอบตาม verification ladder** (ทำตามลำดับ หยุดและรายงานทันทีเมื่อข้อใด fail):
   1. สร้างงานพิมพ์จากหน้า admin จริง (ใบเสร็จสั้น) → ตรวจสถานะ SENT + **ยืนยันกระดาษกับฉัน**
   2. ใบเสร็จภาษาไทยเนื้อหาจริง — สระ/วรรณยุกต์ลอย, ไทยผสมตัวเลข, ตัดบรรทัดยาว;
      ถ้าบิดเบี้ยว → เปลี่ยน `renderMode` เป็น RASTER แล้วทดสอบซ้ำ
   3. QR (LINE QR / PromptPay) — dry-scan ด้วยแอปธนาคาร 2 แอป **โดยไม่กดโอน**
      เว้นแต่ฉันอนุมัติให้โอนจริง
   4. feed/cut — กระดาษถูกตัดบางส่วนเมื่อ partialCut เปิด
   5. (ถ้าผ่านครบ) offline/reconnect: ปิด bridge ระหว่างมีงานค้าง → เปิดใหม่
      → ต้องไม่พิมพ์ซ้ำเองเงียบ ๆ (งาน bytes-uncertain ต้องขึ้น NEEDS_REVIEW)
6. **บันทึก evidence HW-01** — เขียน record ตาม template "Configuration record" ใน
   `references/device-profile.md` (model, revision, interfaces, dots, firmware,
   code page, connection, render_mode, power label) **โดย redact IP/credential/Wi-Fi**
   แล้ว: เพิ่มแถว HW-01 ใน ledger ของ `docs/plan-database-printing-master-orchestration.md`
   เปลี่ยนสถานะเป็น complete พร้อมวันที่ + ผลทดสอบข้อ 5 แต่ละข้อ
7. **อัพเดตเอกสาร + commit** — อัพเดต `docs/printing-system-guide-2026-09-03.md`
   (ส่วนสิ่งที่เหลือ), commit แยกเป็นชิ้น อย่าใส่ไฟล์ config/credential ลง git,
   push ทั้ง branch และ main

### เกณฑ์ตรวจรับ (completion checks)

- [ ] เครื่องพิมพ์แสดงใน `/admin/printing` พร้อมค่าตรง self-test และ bridge heartbeat ปรากฏ
- [ ] งานพิมพ์จากหน้าเว็บจริงถึงสถานะ SENT **และฉันยืนยันว่ากระดาษออกจริง**
- [ ] ทดสอบข้อ 5 ผ่านทุกข้อที่ทำ (หรือรายงานชัดว่าข้อไหน fail/ข้าม พร้อมเหตุผล)
- [ ] evidence HW-01 บันทึกครบและ redact แล้ว, ledger อัพเดต
- [ ] `git show --stat` ของทุก commit ไม่มีไฟล์ config จริงหรือข้อมูลอ่อนไหว
- [ ] รายงานสุดท้าย: สิ่งที่ทำ/ผ่าน/ไม่ผ่าน/ไม่ได้ทำ อย่างตรงไปตรงมา
