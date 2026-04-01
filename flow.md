ถ้าทิ้งของเดิมแล้วออกแบบใหม่ให้ยืดหยุ่นจริง ผมจะออกแบบแยก 4 เรื่องนี้ออกจากกันชัดๆ:

- `Catalog` สิ่งที่ขาย
- `Purchase` รายการที่ลูกค้าซื้อ
- `Entitlement` สิทธิ์ที่ลูกค้าใช้ได้จริง
- `Payment` การชำระเงิน

แบบนี้จะไม่ปนกัน และขยายระบบได้ง่ายสุด

**แนวคิดหลัก**
- “แพ็กเกจ” เป็นสินค้า
- “การซื้อแพ็กเกจ” เป็นเอกสารขาย
- “UserPackage” ไม่ใช่เอกสารขาย แต่เป็นสิทธิ์ใช้งาน
- “Order งานผ้า” เป็นอีกโดเมนหนึ่ง ไม่ควรใช้ table เดียวกับการขายแพ็กเกจ
- “Payment” ต้องชี้ได้ทั้งงานผ้าและการซื้อแพ็กเกจ

**โครงที่แนะนำ**
1. `PackageProduct`
เก็บสินค้าแพ็กเกจที่ขาย
- เช่น แพ็กเกจหลัก, แพ็กเกจเสริม, เครดิต, อายุใช้งาน, active
- ถ้าจะมี bundle ก็เก็บ relation ว่า product ไหนแถม product ไหน

2. `PackageSale`
หัวบิลขายแพ็กเกจ
- `id`
- `customerId`
- `status`
- `subtotal`
- `discountAmount`
- `totalAmount`
- `note`
- `soldById`
- `createdAt`

3. `PackageSaleItem`
รายการในบิล
- `packageSaleId`
- `productId`
- `itemType` เช่น `MAIN`, `ADDON`
- `qty`
- `unitPrice`
- `totalPrice`
- `attachedToItemId` ถ้า addon ผูกกับ main ชิ้นไหน

4. `MemberEntitlement`
สิทธิ์ที่ลูกค้าใช้จริง
- `id`
- `customerId`
- `sourceSaleItemId`
- `productId`
- `parentEntitlementId`
- `status`
- `creditInitial`
- `creditRemaining`
- `startAt`
- `endAt`
- `activatedAt`
- `suspendedAt`

ตรงนี้แทน `UserPackage` เดิม และควรคิดว่าเป็น “asset ของลูกค้า”

5. `ServiceOrder`
งานผ้า/งานบริการ
- คงแยกจาก package sale ชัดๆ
- มี `customerId`, `status`, `totalAmount`, `note`

6. `PaymentRecord`
รายการชำระเงิน
- `id`
- `customerId`
- `paymentMethod`
- `status`
- `amount`
- `paidAt`
- `slipImageId`
- `referenceNo`
- `note`
- `verifiedById`
- `verifiedAt`
- `packageSaleId?`
- `serviceOrderId?`

ถ้าอยากเข้มกว่านี้ เพิ่ม `paymentTargetType` ได้ แต่ไม่จำเป็นถ้ามี validation ว่าต้องชี้อย่างน้อยหนึ่ง target

**ทำไมแบบนี้ยืดหยุ่น**
- ลูกค้าซื้อ main ก่อน แล้วค่อยซื้อ addon ทีหลังได้
- addon ผูกกับ entitlement หลักได้ แต่ยังเป็นคนละ record
- 1 บิลมีหลาย package ได้
- 1 บิลจ่ายหลายครั้งได้
- งานผ้ากับแพ็กเกจใช้ระบบชำระเงินร่วมกันได้ แต่ไม่ปนกัน
- อนาคตเพิ่ม subscription, promotion, invoice, refund ได้ง่าย

**สิ่งที่ไม่ควรทำ**
- ไม่ควรให้ `Order` ตัวเดียวรองรับทั้งงานผ้าและขายแพ็กเกจ
- ไม่ควรให้ `UserPackage` เป็นทั้ง “สิทธิ์” และ “ประวัติการซื้อ”
- ไม่ควรเก็บ main กับ addon ใน row เดียว ถ้ามันมี lifecycle แยกกันได้

**ชื่อ model ที่ผมแนะนำ**
- `Package` เปลี่ยนเป็น `PackageProduct` ถ้าอยากชัดว่าเป็นสินค้าที่ขาย
- `UserPackage` เปลี่ยนเป็น `MemberEntitlement` หรือ `CustomerPackage`
- `PaymentTransaction` เปลี่ยนเป็น `PaymentRecord`
- `Order` ถ้าเป็นงานผ้า ให้เปลี่ยนเป็น `ServiceOrder`

**ชุด schema แบบสั้น**
```prisma
model PackageProduct {
  id           String   @id @default(cuid())
  name         String
  packageType  PackageType
  price        Decimal
  credits      Int?
  validityDays Int?
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model PackageSale {
  id             String            @id @default(cuid())
  customerId     String
  customer       User              @relation(fields: [customerId], references: [id])
  status         PackageSaleStatus @default(DRAFT)
  subtotalAmount Decimal
  discountAmount Decimal @default(0)
  totalAmount    Decimal
  note           String?
  soldById       String?
  soldBy         User?             @relation("PackageSaleSeller", fields: [soldById], references: [id])
  items          PackageSaleItem[]
  payments       PaymentRecord[]
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}

model PackageSaleItem {
  id               String          @id @default(cuid())
  packageSaleId    String
  packageSale      PackageSale     @relation(fields: [packageSaleId], references: [id])
  productId        String
  product          PackageProduct  @relation(fields: [productId], references: [id])
  itemType         PackageItemType
  qty              Int             @default(1)
  unitPrice        Decimal
  totalPrice       Decimal
  attachedToItemId String?
  attachedToItem   PackageSaleItem? @relation("SaleItemAttach", fields: [attachedToItemId], references: [id])
  childItems       PackageSaleItem[] @relation("SaleItemAttach")
  entitlements     MemberEntitlement[]
}

model MemberEntitlement {
  id                  String            @id @default(cuid())
  customerId          String
  sourceSaleItemId    String?
  productId           String
  parentEntitlementId String?
  childEntitlements   MemberEntitlement[] @relation("EntitlementAttach")
  status              EntitlementStatus @default(PENDING)
  creditInitial       Int?
  creditRemaining     Int?
  startAt             DateTime?
  endAt               DateTime?
  activatedAt         DateTime?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  //relation
  customer            User              @relation(fields: [customerId], references: [id])
  sourceSaleItem      PackageSaleItem?  @relation(fields: [sourceSaleItemId], references: [id])
  product             PackageProduct    @relation(fields: [productId], references: [id])
  parentEntitlement   MemberEntitlement? @relation("EntitlementAttach", fields: [parentEntitlementId], references: [id])
}

model ServiceOrder {
  id          String          @id @default(cuid())
  customerId  String
  customer    User            @relation(fields: [customerId], references: [id])
  status      ServiceOrderStatus
  totalAmount Decimal
  note        String?
  payments    PaymentRecord[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model PaymentRecord {
  id             String        @id @default(cuid())
  customerId     String
  customer       User          @relation(fields: [customerId], references: [id])
  packageSaleId  String?
  packageSale    PackageSale?  @relation(fields: [packageSaleId], references: [id])
  serviceOrderId String?
  serviceOrder   ServiceOrder? @relation(fields: [serviceOrderId], references: [id])
  paymentMethod  PaymentMethod
  status         PaymentStatus
  amount         Decimal
  paidAt         DateTime?
  slipImageId    String?
  note           String?
  referenceNo    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
}
```

**ข้อแนะนำสุดท้าย**
ถ้าระบบนี้จะโตต่อ ผมเลือกแนวนี้แน่นอน เพราะแยกความหมายชัดและรองรับ:
- ซื้อแพ็กเกจ
- ซื้อ addon เพิ่มทีหลัง
- จ่ายหลายงวด
- งานผ้าและแพ็กเกจอยู่ร่วมกัน
- report แยกยอดขาย/ยอดชำระเงินได้ตรง

ถ้าต้องการ ผมทำต่อได้ 2 แบบ:
1. แปลง `prisma/schema.prisma` ให้เป็นโครงใหม่นี้จริง
2. ทำ ERD/flow การทำงานก่อน แล้วค่อยลง schema รอบถัดไป