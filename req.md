ใช้ prompt นี้ให้ AI agent ทำ old application binary drill เพื่อปิด G2:

```markdown
ทำงานในโปรเจกต์:

/Users/jirayu/dev/github/saijai-phareab

## เป้าหมายรอบนี้

ทำ **old application binary rollback drill บน disposable PostgreSQL เท่านั้น** เพื่อพิสูจน์ว่า application รุ่นก่อน database consolidation ยังสามารถเริ่มระบบ อ่านข้อมูล และทำงานกับ schema แบบ expand + dual-write + DB-05 backfill ได้จริง

ผลลัพธ์ที่ต้องการ:

1. ระบุ old application revision ที่ถูกต้องจากหลักฐาน Git
2. สร้างฐานข้อมูล PostgreSQL 16 แบบ disposable
3. ใช้ code ปัจจุบัน provision migration chain 48 ตัว + fixture + DB-05 backfill
4. build/start application จาก old revision จริงในพื้นที่ชั่วคราว
5. ทดสอบผ่าน HTTP/runtime ของ old application ไม่ใช่เพียง import utility
6. ยืนยันว่า legacy read/write paths ที่ old app พึ่งพายังทำงาน
7. ตรวจว่า drill ไม่แก้ current working tree และไม่แตะ production
8. ประเมิน G2 ตามหลักฐานจริง
9. ยังไม่เริ่ม DB-06, DB-07 หรือ printer

## ขอบเขตอำนาจ

อนุญาตให้:

- อ่าน Git history และ source code
- สร้าง temporary directory หรือ detached temporary worktree
- สร้างและลบ disposable Docker container
- ใช้ PostgreSQL 16 บน loopback
- build และ start old application บน loopback port
- ใช้ synthetic credentials/secrets และ non-PII fixture
- เพิ่ม test harness หรือ rehearsal script ใน repository เมื่อช่วยให้ drill ทำซ้ำได้
- แก้ runbook และ execution ledger หลังมีหลักฐานจริง

ห้าม:

- อ่านหรือใช้ database URL จาก `.env`
- เชื่อมต่อ production, staging หรือ shared database
- แตะ container เดิมชื่อ `saijai-rehearsal-pg`
- deploy application หรือ migration
- ใช้ข้อมูล production snapshot
- แก้ migration ที่ applied แล้ว
- แก้ generated Prisma Client ด้วยมือ
- reset, checkout หรือทำลาย current working tree
- commit
- เริ่ม DB-06 read cutover, DB-07 contract/drop หรือ printer implementation

การอนุญาตนี้ครอบคลุมเฉพาะ local disposable drill ไม่ใช่การอนุมัติ production operation

## สถานะที่ต้องรักษา

- Current HEAD ควรเป็น `8d87759`
- Working tree มีประมาณ 50 รายการจาก DB-02–DB-05
- การเปลี่ยนแปลงทั้งหมดเป็นงานเดิมที่ต้องรักษา
- DB-04 และ DB-05 รายงานว่า complete หลัง completion-audit รอบสอง
- G2 ยังเป็น `PARTIAL`
- G3, DB-06, DB-07 และ printer ยัง pending
- Container เดิม `saijai-rehearsal-pg` ต้องไม่ถูกแก้ หยุด หรือลบ

## ขั้นเริ่มต้น

1. อ่าน `AGENTS.md`
2. อ่าน skills:
   - `.agents/skills/testing-standards/SKILL.md`
   - `.agents/skills/scrutinize/SKILL.md`
   - `.agents/skills/docker-deployment-standards/SKILL.md`
   - `.agents/skills/diagnosing-bugs/SKILL.md` หาก build/runtime ล้ม
3. ตรวจ:
   ```bash
   git status --short
   git rev-parse --short HEAD
   docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}'
   ```
4. อ่าน:
   - `docs/db-rehearsal-runbook.md`
   - `docs/plan-database-consolidation.md`
   - `docs/plan-database-printing-master-orchestration.md`
   - `scripts/db-rehearsal/run-backfill-rehearsal.sh`
   - `scripts/db-rehearsal/backfill/legacy-read-check.mts`
5. ตรวจ Git history เพื่อยืนยันว่า revision ใดคือ application ก่อน DB-03/DB-04/DB-05

## การเลือก old revision

อย่าสมมติว่า `8d87759` เป็น old application โดยไม่ตรวจ

ต้องยืนยันว่า revision ที่เลือก:

- ไม่มี Prisma `AppSetting` rename และ `completedAt` compatibility writers รุ่นใหม่
- ไม่มี DB-04 dual-write/telemetry
- ไม่มี DB-05 backfill implementation
- เป็น commit จริงที่ application build/run ได้ก่อนการเปลี่ยนแปลงใน working tree ปัจจุบัน

หาก `8d87759` ตรงตามเงื่อนไข ให้บันทึก commit hash เต็มและใช้ revision นี้

หากไม่ตรง ให้ค้นหา revision ที่ถูกต้องจาก Git history แต่ห้ามเดาหรือเปลี่ยน branch ปัจจุบัน

## การแยก source ของ old application

เลือกวิธีที่ไม่แตะ current working tree เช่น:

- `git archive <old-revision>` ไปยัง `mktemp -d`
- detached temporary worktree ใน temporary directory

ห้าม checkout old revision ทับ repository ปัจจุบัน

บันทึก:

- old revision hash
- temporary source path
- package-lock fingerprint หรือ `pnpm-lock.yaml` hash
- Node/pnpm version
- build command ที่ใช้

Temporary source และ worktree ต้อง cleanup หลังจบ เว้นแต่ต้องเก็บไว้เป็น failure evidence

## Disposable database topology

สร้าง PostgreSQL 16 container ใหม่โดยใช้:

- container name แบบ unique
- loopback binding เท่านั้น
- database nameขึ้นต้นด้วย `rehearsal`
- port ที่ไม่ชนกับ `54329` ของ container เดิม
- synthetic password
- cleanup ด้วย trap แม้ command ล้ม

ห้าม reuse หรือแก้ `saijai-rehearsal-pg`

ใช้ repository ปัจจุบันเป็นผู้ provision database:

1. Replay migration chain ปัจจุบันครบ 48 migrations
2. โหลด synthetic non-PII fixture
3. รัน enforced preflight
4. รัน DB-05 backfill ทั้ง 3 operations
5. รัน apply รอบสองและยืนยัน `rowsChanged = 0`
6. รัน reconciliation หลัง backfill
7. เก็บรายงานก่อนเริ่ม old application

Old application ห้ามเป็นผู้รัน migration หรือ reset schema

## Old binary build

ใน temporary old source:

1. ติดตั้ง dependency ด้วย lockfile ของ old revision:
   ```bash
   pnpm install --frozen-lockfile
   ```
2. Generate Prisma Client จาก schema ของ old revision
3. Build old application ด้วย environment แบบ synthetic
4. Start binary ที่ build แล้วบน loopback port ที่ว่าง
5. ใช้ค่าทดสอบเท่านั้น เช่น:
   - `DATABASE_URL` และ `DIRECT_URL` ชี้ disposable DB เดียวกัน
   - `BETTER_AUTH_URL` ชี้ loopback old-app port
   - `BETTER_AUTH_SECRET` เป็น synthetic secret
   - public runtime config เป็นค่าทดสอบ
6. ห้ามใช้ LINE, Cloudinary, Resend หรือ credential จริง
7. หาก build ติด font download/network ให้แยกให้ชัดว่าเป็น environment failure หรือ application compatibility failure อย่ากลบด้วยการแก้ production codeโดยไม่จำเป็น

ต้องรัน **actual built server process** เช่น `.output/server/index.mjs` ไม่ใช่เพียง unit test หรือ import old utility

## Runtime smoke test

หลัง old application พร้อมรับ request ให้ทดสอบผ่าน HTTP จริง

อย่างน้อยต้องครอบคลุม:

### 1. Startup/schema compatibility

- Old server เริ่มสำเร็จ
- ไม่มี Prisma unknown-column/model initialization error
- health/public endpoint ตอบได้
- log ไม่มี migration attempt

### 2. Legacy settings reads

เรียก public shop/settings endpoint ของ old application และยืนยันว่าอ่านค่าจาก legacy tables ได้ตรง fixture หลัง DB-05 backfill

อย่างน้อยตรวจ:

- shop name
- phone/address ตาม fixture
- LINE QR legacy behavior
- response ไม่ leak server-only settings

### 3. Authenticated legacy read paths

สำรวจ auth/session convention ของ old revision แล้วสร้าง synthetic authentication ด้วยวิธีที่เป็นส่วนหนึ่งของระบบจริง เช่น:

- seed synthetic admin/account ใน disposable DB
- login ผ่าน old auth endpoint
- หรือสร้าง Better Auth session ตาม schema/contract จริง

ห้าม bypass authorization ด้วยการแก้ old source เพื่อให้ test ผ่าน

เรียก endpoint จริงเพื่อยืนยันเส้นทางที่ทำได้อย่างปลอดภัย เช่น:

- admin settings read
- service-order detail/list ที่มี legacy `addonUsages`
- service-order item ที่มี direct `imageId`
- completed legacy order ที่ `completedAt` เป็น null
- payment/package-sale projection ที่เกี่ยวข้อง

หาก endpoint ใดเรียก external provider ให้เลือก test state ที่ไม่ trigger provider หรือ mock ที่ boundary ของ providerโดยไม่ bypass database/application logic

### 4. Legacy write compatibility

ต้องพิสูจน์อย่างน้อยหนึ่ง old application write ผ่าน HTTP จริง เช่น shop หรือ notification setting:

1. บันทึก legacy และ target values ก่อนเขียน
2. ให้ old application เขียนค่าใหม่ไปยัง legacy source
3. ยืนยัน request สำเร็จและ old app อ่านค่ากลับได้
4. ยืนยันว่า old application ไม่พังแม้ target columns/tables ใหม่ยังอยู่
5. บันทึกผลกระทบอย่างตรงไปตรงมา:
   - old application รุ่นก่อน dual-write มีแนวโน้มเขียนเฉพาะ legacy source
   - target อาจไม่เปลี่ยนตาม ซึ่งเป็น expected rollback-window behavior
   - ก่อนนำ compatibility app รุ่นใหม่กลับมา ต้อง rerun reconciliation/backfill หรือมีขั้นตอน resync ที่ระบุชัด

อย่าตีความ target ที่ไม่ sync จาก old binary ว่า drill ล้มโดยอัตโนมัติ หากนี่คือพฤติกรรมที่ออกแบบไว้ แต่ต้องบันทึกเป็น operational requirement

### 5. Source preservation

หลัง old app run/write ให้ตรวจว่า:

- legacy `shop_setting` และ `notification_setting` ยังอยู่
- `service_order.addonUsages` ยังอยู่
- `service_order_item.imageId` ยังอยู่
- normalized ledger/join rows จาก DB-05 ไม่ถูกลบ
- partial unique indexes 2 ตัวอยู่ครบ
- ไม่มี schema mutation
- ไม่มี unexpected row deletion

## Test harness

ถ้าต้องเพิ่ม reusable drill ให้แยกชัด เช่น:

```text
scripts/db-rehearsal/run-old-binary-drill.sh
scripts/db-rehearsal/old-binary-http-check.mjs
```

ข้อกำหนดของ harness:

- ต้องรับ old revision อย่าง explicit
- guard loopback host
- database nameต้องขึ้นต้น `rehearsal`
- unique container/ports
- fail-fast และ fail-closed
- cleanup server process/container/temp source ผ่าน trap
- ไม่อ่าน `.env`
- ไม่แสดง connection password หรือ synthetic auth token ใน log
- เก็บ aggregate-safe evidence
- exit non-zero เมื่อ assertion ใดล้ม
- rerun ได้
- comment และ usage ตรงกับจำนวน stages จริง

หลีกเลี่ยงการเพิ่ม dependency ถ้า shell/Node built-ins และ dependency เดิมเพียงพอ

## หลักฐานที่ต้องเก็บ

สร้าง evidence directory แบบ temporary และเก็บเมื่อ:

- `REHEARSAL_KEEP_STAGE=1`
- หรือ drill ล้ม

อย่างน้อยต้องมี:

- old revision hash
- current revision hash
- migration count
- backfill reports
- preflight/reconciliation reportsก่อนและหลัง old binary
- build exit status
- server-ready evidence
- HTTP check summary โดยไม่เก็บ session token/cookie
- legacy/target values แบบ redacted หรือ fixture-safe
- schema fingerprint ก่อนและหลัง
- partial index checks
- old server sanitized log
- cleanup/container summary

ห้ามเก็บ secret, cookie, raw token หรือ customer data

## Completion criteria ของ G2

ให้เปลี่ยน G2 จาก `PARTIAL` เป็น `PASS` ต่อเมื่อครบทั้งหมด:

- actual old revision ถูกระบุด้วย Git hash
- actual old application build สำเร็จ
- actual built server start สำเร็จ
- HTTP public read ผ่าน
- authenticated legacy read ผ่านอย่างน้อยหนึ่งเส้นทาง
- legacy write ผ่าน HTTP จริง
- legacy add-on/photo/completed-order sources ยังอ่านได้
- DB-05 normalized data ไม่ถูก old app ทำลาย
- schema fingerprint ก่อน/หลังไม่มี unexpected mutation
- partial indexes ยังอยู่
- post-drill reconciliation ไม่มี unexpected invariant failure
- current working tree ไม่ถูกเปลี่ยนโดยขั้นตอน checkout/build
- ไม่มี production/shared DB access

หากทำได้เพียง import utility, direct SQL read หรือ `legacy-read-check.mts` เดิม ให้ G2 คง `PARTIAL`

หาก authenticated HTTP path ทำไม่ได้เพราะไม่สามารถสร้าง session ตาม contract จริง ให้รายงาน blocker และคง G2 `PARTIAL` ห้ามลด completion criteria

## Verification ของ repository ปัจจุบัน

หากเพิ่มหรือแก้ harness/docs ให้รัน:

```bash
pnpm test
pnpm exec nuxi typecheck
pnpm exec prisma validate
git diff --check
```

ตรวจสุดท้าย:

```bash
git rev-parse --short HEAD
git status --short
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}'
```

ต้องยืนยันว่า:

- HEAD ไม่เปลี่ยน
- ไม่มี commit
- user changes เดิมไม่สูญหาย
- disposable container/process ถูก cleanup
- `saijai-rehearsal-pg` ยังอยู่และไม่ถูกแตะ

## การอัปเดตเอกสาร

เมื่อ drill ผ่านจริง ให้อัปเดต:

- `docs/db-rehearsal-runbook.md`
- `docs/plan-database-printing-master-orchestration.md`
- `scripts/db-rehearsal/README.md` หากเพิ่ม runner

บันทึก:

- old revision ที่ใช้
- actual binary/build command
- HTTP paths ที่ตรวจ
- read/write assertions
- expected target staleness หลัง old-only write และขั้นตอน resync
- evidence directory
- G2 verdict

ห้าม:

- mark G3 ผ่าน
- mark DB-06 started
- อ้าง production compatibility จาก synthetic fixture เพียงอย่างเดียว
- อ้างว่า deploy/rollback production ปลอดภัยโดยไม่มี production-shape rehearsal

แม้ G2 ผ่านแล้ว จุดถัดไปยังต้องเป็นการประเมิน G3 และเตรียม production approval packet ไม่ใช่เริ่ม DB-06 โดยอัตโนมัติ

## รายงานสุดท้าย

รายงานตามหัวข้อนี้:

1. Old revision และเหตุผลที่เลือก
2. วิธีแยก/build/run old application
3. Disposable database topology
4. HTTP paths ที่ทดสอบ
5. Auth/session method
6. Legacy read/write results
7. ผลกระทบต่อ target fields หลัง old-only write
8. Schema/data reconciliation ก่อนและหลัง
9. Commands และผล verification
10. Evidence directory
11. Cleanup และ container/process ที่เหลือ
12. Current HEAD และ working-tree status
13. G2 verdict: PASS หรือ PARTIAL พร้อมเหตุผล
14. ข้อจำกัดที่ยังเหลือ
15. ยืนยันว่าไม่มี production access, deploy, DB-06/DB-07/printer หรือ commit

หากพบ schema incompatibility หรือ old binary ทำข้อมูล normalized เสียหาย ให้หยุด drill หลังเก็บ evidence และรายงานทันที ห้ามแก้ด้วยการลบข้อมูลหรือเปลี่ยน production migration