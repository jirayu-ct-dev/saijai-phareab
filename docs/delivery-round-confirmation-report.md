# รายงานวิเคราะห์ระบบยืนยันรอบรับผ้า

สถานะเอกสาร: ข้อเสนอสำหรับพัฒนา ยังไม่มีการแก้ application code  
วันที่: 8 สิงหาคม 2569

## เป้าหมาย

แจ้งถามลูกค้าที่มีแพ็กเกจเสริมรับ–ส่งผ้าก่อนรอบวันพุธและวันเสาร์ เพื่อให้ร้านวางแผนการรับผ้าได้ล่วงหน้า โดยคำตอบของลูกค้าเป็นข้อมูลด้านการขนส่งเท่านั้น ไม่สร้างออเดอร์และไม่ตัดเครดิต

ปุ่มตอบใน LINE:

1. มีผ้าส่งซัก
2. นำผ้ามาส่งที่ร้านเอง
3. ไม่มีผ้ารอบนี้
4. ขอเลื่อน / ติดต่อร้าน

## ข้อสรุปการออกแบบ

### ใช้ scheduled task เป็นแหล่งสร้างรอบเพียงแห่งเดียว

ไม่ควรสร้างรอบถัดไปจากการปิดออเดอร์ เพราะลูกค้าที่ไม่มีผ้าในสัปดาห์หนึ่งจะไม่มีออเดอร์ `COMPLETED` และอาจไม่ได้รับคำถามในรอบถัดไป

scheduled task ต้องสร้างรอบวันพุธ/เสาร์ตามปฏิทินแบบ idempotent และมี unique constraint ป้องกันรอบซ้ำ การปิดออเดอร์ยังคงทำหน้าที่ตัดเครดิตและส่งสถานะออเดอร์ตามระบบเดิมเท่านั้น

### แยกรอบรับผ้าออกจากออเดอร์และเครดิต

- การตอบ `มีผ้าส่งซัก` ไม่ได้แปลว่าร้านได้รับผ้าแล้ว
- ระบบไม่สร้าง `ServiceOrder` จากคำตอบของลูกค้า
- ระบบไม่ผูก `serviceOrderId` กับรอบในเวอร์ชันแรก
- เมื่อพนักงานได้รับผ้าจริง ให้สร้างออเดอร์จาก POS ตามปกติ
- พนักงานเลือกแพ็กเกจเสริมรับ–ส่งในออเดอร์นั้น
- เครดิตถูกบันทึกผ่าน `ServiceOrderAddonUsage` และหักตาม `PackageProduct.deductOn` ด้วยกระบวนการเดิม

แนวทางนี้รักษา POS เป็นแหล่งสร้างออเดอร์หลัก และป้องกันออเดอร์หรือการตัดเครดิตที่เกิดจากคำตอบซึ่งยังไม่ยืนยันการให้บริการจริง

## กระบวนการทำงานที่เสนอ

1. scheduled task ค้นหา entitlement ที่มีสิทธิ์ในรอบถัดไป
2. สร้างรอบรับผ้าแบบ idempotent สำหรับวันพุธหรือวันเสาร์
3. ส่ง LINE Flex Message พร้อม postback สี่ปุ่ม
4. ลูกค้ากดตอบ และ LINE ส่ง webhook กลับมายังระบบ
5. ระบบตรวจลายเซ็น webhook และยืนยันว่า LINE user เป็นเจ้าของรอบ
6. บันทึกหรือแก้ไขคำตอบของรอบโดยไม่สร้างออเดอร์และไม่ตัดเครดิต
7. หน้าแอดมินแสดงลูกค้า รอบเวลา คำตอบ เบอร์โทร และเครดิตคงเหลือ
8. เมื่อได้รับผ้าจริง พนักงานสร้างออเดอร์ใน POS และเลือกเครดิตรับ–ส่งตามบริการที่เกิดขึ้นจริง

## แบบจำลองข้อมูลที่เสนอ

ควรใช้ชื่อที่สื่อว่าระเบียนแทนหนึ่งรอบ ไม่ใช่เพียงคำตอบ เช่น `DeliveryRound`:

```prisma
enum DeliveryRoundResponse {
  HOME_PICKUP
  SELF_DROPOFF
  SKIP
  CONTACT_REQUESTED
}

enum DeliveryNotificationStatus {
  PENDING
  SENT
  FAILED
  UNREACHABLE
}

model DeliveryRound {
  id                 String                     @id @default(cuid())
  entitlementId      String
  customerId         String
  scheduledAt        DateTime
  response           DeliveryRoundResponse?
  respondedAt        DateTime?
  notificationStatus DeliveryNotificationStatus @default(PENDING)
  initialSentAt      DateTime?
  reminderSentAt     DateTime?
  sendAttempts       Int                        @default(0)
  lastSendError      String?
  createdAt          DateTime                   @default(now())
  updatedAt          DateTime                   @updatedAt

  @@unique([entitlementId, scheduledAt])
  @@index([scheduledAt, notificationStatus])
  @@index([customerId, scheduledAt])
}
```

ก่อน implement ต้องเพิ่ม relations และ deletion behavior ให้เหมาะกับ `User` และ `MemberEntitlement` หลังตรวจข้อมูลจริงและนโยบายเก็บประวัติ ห้ามแก้ migration เดิม ให้สร้าง migration ใหม่

## เงื่อนไขผู้มีสิทธิ์ได้รับคำถาม

ลูกค้าต้องผ่านทุกเงื่อนไขต่อไปนี้:

- ผู้ใช้ active และไม่ถูก soft-delete
- เปิด `lineNotifyEnabled`
- มี Better Auth account ที่ `providerId = "line"`
- entitlement มีสถานะ `ACTIVE` และไม่ถูก soft-delete
- product ไม่ถูก soft-delete, เป็น `ADDON` และมี `isDelivery = true`
- วันของรอบอยู่ภายใน `startAt` และ `endAt`
- `creditRemaining > 0`

หากไม่มี LINE account หรือส่งข้อความไม่ได้ ต้องเก็บสถานะ `UNREACHABLE` หรือ `FAILED` และแสดงให้พนักงานเห็น ไม่ควรปล่อยให้หายไปเฉย ๆ

## ความปลอดภัยและความถูกต้องของ LINE postback

webhook ปัจจุบันรองรับเฉพาะ `follow` จึงต้องเพิ่ม postback type และ handler โดยมีข้อกำหนดดังนี้:

- ตรวจ raw body ด้วย `x-line-signature` ก่อนอ่านหรือทำงานกับ payload
- postback ส่ง opaque round ID และค่าคำตอบ เช่น `action=delivery_round&round=<id>&response=HOME_PICKUP`
- ใช้ `source.userId` ค้นหา account ที่ `providerId = "line"`
- ตรวจว่า account ดังกล่าวเป็นเจ้าของ `customerId` ของรอบ
- ไม่เชื่อ `customerId` หรือ `entitlementId` ที่ส่งมากับ postback
- จำกัด response ให้เป็น enum ที่ระบบรองรับ
- รองรับ webhook redelivery และการกดซ้ำแบบ idempotent
- ไม่ให้แก้รอบหมดอายุหรือรอบที่ถูกล็อกแล้ว
- ตอบ LINE เพื่อยืนยันผลหลังบันทึกสำเร็จ

ไม่ควรใช้ fire-and-forget กับงานบันทึกคำตอบที่สำคัญโดยไม่มี durable queue เพราะ serverless runtime อาจยุติการทำงานหลังส่ง HTTP response

## การส่งข้อความและ retry

สร้างรอบในฐานข้อมูลก่อนเรียก LINE API จากนั้นจึงอัปเดตสถานะการส่ง ห้ามเรียก external API ภายใน Prisma transaction

scheduled task ต้องสามารถเรียกซ้ำได้อย่างปลอดภัย:

- unique constraint ป้องกันการสร้างรอบซ้ำ
- `initialSentAt` ป้องกันการส่งข้อความแรกซ้ำ
- `reminderSentAt` ป้องกัน reminder ซ้ำ
- `sendAttempts` และ `lastSendError` ช่วยวิเคราะห์ failure
- กำหนดจำนวน retry สูงสุดและแสดงรายการที่ยังส่งไม่สำเร็จในหน้าแอดมิน

## พฤติกรรมแต่ละคำตอบ

| คำตอบ | ผลด้าน logistics | ผลต่อออเดอร์/เครดิต |
| --- | --- | --- |
| มีผ้าส่งซัก | เพิ่มลูกค้าในรายการรับผ้าที่บ้าน | ไม่มี |
| นำผ้ามาส่งที่ร้านเอง | ไม่ต้องเข้ารับผ้าที่บ้าน | ไม่มี |
| ไม่มีผ้ารอบนี้ | ตัดออกจากแผนรถเฉพาะรอบนี้ | ไม่มี |
| ขอเลื่อน / ติดต่อร้าน | ทำเครื่องหมายเร่งด่วนและแจ้งพนักงาน | ไม่มี |

กรณี `CONTACT_REQUESTED` ต้องแจ้ง admin/employee และแสดงเบอร์โทรกับทางลัดเปิด LINE chat ไม่ควรสร้างวันเลื่อนอัตโนมัติในเวอร์ชันแรก

กรณี `SELF_DROPOFF` ถ้าร้านยังส่งผ้าสะอาดกลับบ้าน พนักงานสามารถเลือกแพ็กเกจรับ–ส่งในออเดอร์ได้ แต่ถ้าลูกค้ามาส่งและรับคืนที่ร้าน ไม่ควรเลือกแพ็กเกจเสริมดังกล่าว

## หน้าแอดมินขั้นต่ำ

ตารางรอบควรแสดง:

- วันที่และช่วงเวลาของรอบ
- ชื่อลูกค้า เบอร์โทร และทางลัด LINE chat
- คำตอบล่าสุดและเวลาที่ตอบ
- เครดิตรับ–ส่งคงเหลือ
- สถานะส่งข้อความและจำนวนครั้งที่ลองส่ง
- ตัวกรองตามวัน คำตอบ และสถานะการส่ง
- สัญลักษณ์เด่นสำหรับ `CONTACT_REQUESTED`, `FAILED`, `UNREACHABLE` และผู้ยังไม่ตอบ

หน้าแอดมินนี้เป็นหน้าวางแผน logistics เท่านั้น การสร้างออเดอร์ยังทำผ่าน POS

## ค่าเริ่มต้นที่เสนอและประเด็นรอยืนยัน

ค่าเริ่มต้นที่เสนอ:

- ส่งคำถามก่อนรอบ 24 ชั่วโมง
- เตือนผู้ที่ยังไม่ตอบก่อนรอบ 4 ชั่วโมง
- ลูกค้าเปลี่ยนคำตอบได้ถึง 2 ชั่วโมงก่อนรอบ
- หลังเวลาตัดรอบ ให้ติดต่อร้านแทนการแก้คำตอบโดยตรง
- การไม่ตอบต้องแสดงเป็น `NO_RESPONSE` ใน UI และห้ามตีความเป็น `ไม่มีผ้า`
- ใช้เขตเวลา `Asia/Bangkok`; cron ใน `nuxt.config.ts` ต้องเขียนเป็น UTC

ต้องให้เจ้าของร้านยืนยันก่อน implement:

1. เวลาที่รถออกในวันพุธและเสาร์
2. เวลาส่งคำถาม reminder และเวลาปิดรับคำตอบ
3. นโยบายวันหยุดและการยกเลิกรอบทั้งวัน
4. ลูกค้าที่ซื้อแพ็กเกจกลางสัปดาห์จะเริ่มได้รับคำถามจากรอบใด
5. หากเครดิตเหลือหนึ่งครั้ง แต่มีรอบพุธและเสาร์ จะถามทั้งสองรอบหรือหยุดหลังได้รับคำตอบแรก

## ขอบเขตการพัฒนาที่แนะนำ

### ระยะที่ 1

- schema, migration และ utility สำหรับสร้างรอบแบบ idempotent
- scheduled task และการส่ง LINE Flex Message
- postback handler พร้อม ownership validation
- หน้าแอดมินสำหรับดูและกรองรอบ
- focused tests สำหรับ eligibility, time boundary, duplicate task, webhook redelivery และ unauthorized postback

### ระยะถัดไปเมื่อมีข้อมูลใช้งานจริง

- กำหนดเส้นทางรถหรือผู้รับผิดชอบ
- เปลี่ยนวันรับผ่านระบบโดยไม่ต้องติดต่อร้าน
- สรุปอัตราการตอบและจำนวนเที่ยวที่ลดได้

ไม่ควรเพิ่มความสามารถเหล่านี้ในระยะแรก เพราะยังไม่จำเป็นต่อเป้าหมายการลดการโทรตามลูกค้า

## จุดเชื่อมกับโค้ดปัจจุบัน

- `nuxt.config.ts`: มี Nitro scheduled task อยู่แล้ว แต่ปัจจุบันกำหนดเฉพาะ `notify:expiring-packages`
- `server/tasks/`: ใช้เป็นตำแหน่งสำหรับ task สร้างและส่งรอบ
- `server/api/line/webhook.post.ts`: ตรวจ signature แล้ว แต่รองรับเฉพาะ follow event
- `server/utils/line-messaging.ts`: มี push/reply message แต่ webhook type ยังไม่มี postback
- `server/utils/notify.ts`: มีรูปแบบค้นหา LINE account และส่งข้อความ แต่ failure ปัจจุบันจบที่ log
- `app/components/admin/pos/StorefrontPosWorkspace.vue`: รองรับเลือกเครดิตแพ็กเกจเสริมใน POS อยู่แล้ว
- `server/api/admin/service-orders/index.post.ts`: สร้าง usage ของแพ็กเกจเสริมเมื่อสร้างออเดอร์
- `server/api/admin/service-orders/[id]/status.patch.ts`: หักเครดิต add-on ที่ตั้ง `deductOn = COMPLETED` เมื่อปิดงาน
- `prisma/schema.prisma`: มี `PackageProduct.isDelivery`, `MemberEntitlement` และ `ServiceOrderAddonUsage` ซึ่งควรใช้ต่อโดยไม่เปลี่ยนความหมาย

## Verdict

ควรพัฒนาหลังยืนยันเวลาและนโยบายตัดรอบ โดยใช้ scheduled task เป็นแหล่งสร้างรอบเดียว และรักษาการสร้างออเดอร์กับการตัดเครดิตไว้ใน POS/ServiceOrder flow เดิม
