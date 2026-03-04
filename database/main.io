//// -------------------------------------- ////
////    SaiJai Phareab DB Schema    ////
//// -------------------------------------- ////

Project SaiJaiPhareab {
  database_type: 'PostgreSQL'
  Note: 'Full-Stack Laundry Management System Schema with AI, Package, Storefront, QR Basket, and Line OA Integration'
}

//// -------------------------------------- ////
////          1. ENUM DEFINITIONS           ////
//// -------------------------------------- ////

Enum Role {
  USER     [note: 'ลูกค้าทั่วไป']
  EMPLOYEE [note: 'พนักงานร้าน']
  ADMIN    [note: 'ผู้ดูแลระบบ/เจ้าของร้าน']
}

Enum OrderType {
  PACKAGE    [note: 'ออเดอร์แบบรายเดือน (ตัดเครดิตแพ็คเกจ)']
  STOREFRONT [note: 'ออเดอร์แบบหน้าร้าน (คิดเงินตามชิ้น/กก.)']
}

Enum OrderStatus {
  RECEIVED       [note: 'รับผ้าแล้ว']
  PENDING        [note: 'รอดำเนินการ']
  CHECKING       [note: 'เช็คผ้า ตรวจผ้า']
  PROCESSING     [note: 'กำลังซัก/รีด กำลังดำเนินการ']
  PENDING_REVIEW [note: 'พร้อมรับ/แพ็คเสร็จ รอลูกค้ามารับ/จัดส่ง']
  COMPLETED      [note: 'ลูกค้ารับผ้าแล้ว (จบงาน)']
  CANCELLED      [note: 'ยกเลิก']
}

Enum PackageStatus {
  PENDING [note: 'รออนุมัติ/ยังไม่เปิดใช้งาน']
  ACTIVE  [note: 'เปิดใช้งานแล้ว ใช้เครดิตได้']
  EXPIRED [note: 'หมดอายุ/เครดิตหมด']
}

Enum BasketStatus {
  AVAILABLE [note: 'ว่าง พร้อมใช้งาน']
  IN_USE    [note: 'กำลังใช้งาน (ผูกกับ Order)']
}

Enum PackageType {
  MAIN  [note: 'แพ็คเกจหลัก (มีเครดิตซัก)']
  ADDON [note: 'แพ็คเกจเสริม (บริการเพิ่มเติม)']
}

Enum PaymentStatus {
  PENDING  [note: 'รอแอดมินตรวจสอบสลิป/การจ่ายเงิน']
  VERIFIED [note: 'ตรวจสอบและอนุมัติแล้ว']
  FAILED   [note: 'ไม่ผ่านการตรวจสอบ/สลิปผิด/ยกเลิก']
}


//// -------------------------------------- ////
////       2. AUTHENTICATION TABLES         ////
//// -------------------------------------- ////

Table user {
  id             varchar      [pk, note: 'Cuid จาก Better Auth']
  name           varchar      [note: 'ชื่อ-นามสกุล']
  email          varchar      [note: 'อีเมลสำหรับ login / ติดต่อ']
  emailVerified  boolean      [default: false, note: 'ยืนยันอีเมลแล้วหรือยัง']
  imageId           varchar     [ref: > image.id, note: 'URL รูปโปรไฟล์']
  role           Role         [default: 'USER', note: 'บทบาท: USER=ลูกค้า, EMPLOYEE=พนักงาน, ADMIN=เจ้าของ']
  phoneNumber    varchar      [note: 'เบอร์โทรศัพท์']
  lineUserId     varchar      [note: 'Line User ID สำหรับ Line Notify / LIFF binding']
  createdAt      timestamptz  [default: `now()`, note: 'วันที่สร้าง']
  updatedAt      timestamptz  [note: 'วันที่แก้ไขล่าสุด']
  deletedAt      timestamptz  [note: 'วันที่ลบ (Soft Delete)']
  deletedBy      varchar      [ref: > user.id, note: 'ผู้ที่ทำการลบ']

  indexes {
    email      [unique, note: 'อีเมลห้ามซ้ำ']
    lineUserId [unique, note: 'Line ID ห้ามซ้ำ']
  }
}

Table session {
  id        varchar     [pk, note: 'Session ID']
  expiresAt timestamptz [note: 'วันหมดอายุ session']
  token     varchar     [unique, note: 'Session token']
  userId    varchar     [ref: > user.id, note: 'FK - เจ้าของ session']
  ipAddress varchar     [note: 'IP Address ที่ login']
  userAgent varchar     [note: 'Browser/Device info']
  createdAt timestamptz [default: `now()`, note: 'วันที่สร้าง']
  updatedAt timestamptz [note: 'วันที่แก้ไขล่าสุด']

  indexes {
    (userId, expiresAt) [note: 'ค้นหา session ตาม user และวันหมดอายุ']
  }
}

Table account {
  id           varchar     [pk, note: 'Account ID']
  userId       varchar     [ref: > user.id, note: 'FK - ผู้ใช้']
  providerId   varchar     [note: 'Provider: line, google, email']
  accountId    varchar     [note: 'ID ฝั่ง provider เช่น line user id / google sub']
  accessToken  varchar     [note: 'Access Token จาก provider']
  createdAt    timestamptz [default: `now()`, note: 'วันที่สร้าง']
  updatedAt    timestamptz [note: 'วันที่แก้ไขล่าสุด']

  indexes {
    (providerId, accountId) [unique, note: 'Provider + Account ห้ามซ้ำ']
  }
}

Table verification {
  id         varchar     [pk, note: 'Verification ID']
  identifier varchar     [note: 'ตัวระบุ: email, phone หรือ line id']
  value      varchar     [note: 'โค้ดยืนยัน / token']
  expiresAt  timestamptz [note: 'วันหมดอายุโค้ด']
  createdAt  timestamptz [default: `now()`, note: 'วันที่สร้าง']

  indexes {
    (identifier, value) [note: 'ค้นหาตาม identifier และ value']
  }
}

//// -------------------------------------- ////
////       3. PACKAGE & SUBSCRIPTION        ////
//// -------------------------------------- ////

Table package {
  id           varchar     [pk, note: 'Primary Key - UUID']
  name         varchar     [not null, note: 'ชื่อแพ็คเกจ เช่น "แพ็คเกจรายเดือน Premium"']
  description  text        [note: 'รายละเอียดแพ็คเกจ']
  packageType  PackageType [default: 'MAIN', note: 'ประเภท: MAIN=แพ็คเกจหลัก, ADDON=เสริม']
  price        decimal     [not null, note: 'ราคาแพ็คเกจ (บาท)']
  credits      int         [note: 'จำนวนเครดิต (ชิ้น) ที่ได้รับ - ใช้สำหรับ MAIN']
  validityDays int         [note: 'อายุการใช้งาน (วัน)']
  isActive     boolean     [default: true, note: 'สถานะเปิด/ปิดขาย']
  createdAt    timestamptz [default: `now()`, note: 'วันที่สร้าง']
  updatedAt    timestamptz [note: 'วันที่แก้ไขล่าสุด']
  deletedAt    timestamptz [note: 'วันที่ลบ (Soft Delete)']
  deletedBy    varchar     [ref: > user.id, note: 'ผู้ที่ทำการลบ']
}

Table packageBonus {
  id                varchar     [pk, note: 'Primary Key - UUID']
  packageId         varchar     [ref: > package.id, not null, note: 'FK - แพ็คเกจที่มีของแถม']
  storefrontPriceId varchar     [ref: > storefrontPrice.id, not null, note: 'FK - รายการบริการที่แถม']
  quantity          int         [not null, note: 'จำนวนที่แถม (ชิ้น)']
  description       text        [note: 'คำอธิบาย เช่น "แถมซักเสื้อยืด 5 ตัว"']
  createdAt         timestamptz [default: `now()`, note: 'วันที่สร้าง']
  updatedAt         timestamptz [note: 'วันที่แก้ไขล่าสุด']
  deletedAt         timestamptz [note: 'วันที่ลบ (Soft Delete)']
  deletedBy         varchar     [ref: > user.id, note: 'ผู้ที่ทำการลบ']

  indexes {
    packageId [note: 'ค้นหาของแถมตามแพ็คเกจ']
  }
}

Table userPackage {
  id                  varchar       [pk, note: 'Primary Key - UUID']
  userId              varchar       [ref: > user.id, note: 'FK - ผู้ใช้ที่ซื้อแพ็คเกจ']
  packageId           varchar       [ref: > package.id, note: 'FK - แพ็คเกจที่ซื้อ']
  parentUserPackageId varchar       [ref: > userPackage.id, note: 'FK - ถ้าเป็น ADDON จะอ้างอิง MAIN package']
  startDate           timestamptz   [note: 'วันที่เริ่มใช้งาน']
  endDate             timestamptz   [note: 'วันที่หมดอายุ']
  status              PackageStatus [default: 'PENDING', note: 'สถานะ: PENDING, ACTIVE, EXPIRED']
  creditRemain        int           [note: 'เครดิตคงเหลือ (ชิ้น) - ใช้สำหรับ MAIN']
  createdAt           timestamptz   [default: `now()`, note: 'วันที่สร้าง']
  updatedAt           timestamptz   [note: 'วันที่แก้ไขล่าสุด']
  deletedAt           timestamptz   [note: 'วันที่ลบ (Soft Delete)']
  deletedBy           varchar       [ref: > user.id, note: 'ผู้ที่ทำการลบ']

  indexes {
    userId    [note: 'ค้นหาแพ็คเกจตามผู้ใช้']
    packageId [note: 'ค้นหาผู้ใช้ตามแพ็คเกจ']
  }
}

//// -------------------------------------- ////
////       4. STOREFRONT (SERVICES/ITEMS)   ////
//// -------------------------------------- ////

Table storefrontService {
  id          varchar     [pk, note: 'Primary Key - UUID']
  name        varchar     [not null, note: 'ชื่อบริการ เช่น "ซักอบรีด", "ซักอย่างเดียว", "รีดอย่างเดียว"']
  description text        [note: 'รายละเอียดบริการ']
  isActive    boolean     [default: true, note: 'สถานะเปิด/ปิดบริการ']
  createdAt   timestamptz [default: `now()`, note: 'วันที่สร้าง']
  updatedAt   timestamptz [note: 'วันที่แก้ไขล่าสุด']
  deletedAt   timestamptz [note: 'วันที่ลบ (Soft Delete)']
  deletedBy   varchar     [ref: > user.id, note: 'ผู้ที่ทำการลบ']
}

Table storefrontItem {
  id          varchar     [pk, note: 'Primary Key - UUID']
  name        varchar     [not null, note: 'ชื่อรายการ เช่น "เสื้อยืด", "กางเกงขายาว", "ผ้านวม"']
  description text        [note: 'รายละเอียดรายการ']
  isActive    boolean     [default: true, note: 'สถานะเปิด/ปิดรายการ']
  createdAt   timestamptz [default: `now()`, note: 'วันที่สร้าง']
  updatedAt   timestamptz [note: 'วันที่แก้ไขล่าสุด']
  deletedAt   timestamptz [note: 'วันที่ลบ (Soft Delete)']
  deletedBy   varchar     [ref: > user.id, note: 'ผู้ที่ทำการลบ']
}

Table storefrontPrice {
  id                  varchar     [pk, note: 'Primary Key - UUID']
  storefrontServiceId varchar     [ref: > storefrontService.id, note: 'FK - บริการ (ซักอบรีด, ซักอย่างเดียว, ฯลฯ)']
  storefrontItemId    varchar     [ref: > storefrontItem.id, note: 'FK - รายการ (เสื้อยืด, กางเกง, ฯลฯ)']
  price               decimal     [not null, note: 'ราคา (บาท) สำหรับ Service + Item นี้']
  isActive            boolean     [default: true, note: 'สถานะเปิด/ปิดราคา']
  createdAt           timestamptz [default: `now()`, note: 'วันที่สร้าง']
  updatedAt           timestamptz [note: 'วันที่แก้ไขล่าสุด']
  deletedAt           timestamptz [note: 'วันที่ลบ (Soft Delete)']
  deletedBy           varchar     [ref: > user.id, note: 'ผู้ที่ทำการลบ']

  indexes {
    (storefrontServiceId, storefrontItemId) [unique, note: 'Unique: 1 Service + 1 Item = 1 Price']
  }
}

//// -------------------------------------- ////
////       5. BASKET (QR CODE)              ////
//// -------------------------------------- ////

Table basket {
  id          varchar      [pk, note: 'Primary Key - UUID']
  qrCode      varchar      [note: 'URL หรือ String ของ QR Code']
  label       varchar      [note: 'ชื่อเรียกตะกร้า เช่น "บ้านสมศรี"']
  status      BasketStatus [default: 'AVAILABLE', note: 'สถานะ: AVAILABLE, IN_USE, RETURNED']
  isActivated boolean      [default: true, note: 'เปิด/ปิดการใช้งานตะกร้า']
  createdAt   timestamptz  [default: `now()`, note: 'วันที่สร้าง']
  updatedAt   timestamptz  [note: 'วันที่แก้ไขล่าสุด']
  deletedAt   timestamptz  [note: 'วันที่ลบ (Soft Delete)']
  deletedBy   varchar      [ref: > user.id, note: 'ผู้ที่ทำการลบ']
}

//// -------------------------------------- ////
////       6. IMAGES                        ////
//// -------------------------------------- ////

Table image {
  id        varchar     [pk, note: 'Primary Key - UUID']
  assetId   varchar     [note: 'Cloudinary Asset ID']
  publicId  varchar     [note: 'Cloudinary Public ID']
  url       varchar     [note: 'HTTP URL ของรูปภาพ']
  secureUrl varchar     [note: 'HTTPS URL ของรูปภาพ']
  createdAt timestamptz [default: `now()`, note: 'วันที่อัปโหลด']
  updatedAt timestamptz [note: 'วันที่แก้ไขล่าสุด']
  deletedAt timestamptz [note: 'วันที่ลบ (Soft Delete)']
  deletedBy varchar     [ref: > user.id, note: 'ผู้ที่ทำการลบ']
}

//// -------------------------------------- ////
////       7. ORDERS                        ////
//// -------------------------------------- ////

Table order {
  id                      varchar     [pk, note: 'Primary Key - UUID']
  customerId              varchar     [ref: > user.id, not null, note: 'FK - ลูกค้าที่สั่งซัก']
  employeeId              varchar     [ref: > user.id, note: 'FK - พนักงานที่รับผิดชอบ']
  orderType               OrderType   [not null, note: 'ประเภท: PACKAGE=ใช้เครดิต, STOREFRONT=จ่ายเงินสด']
  currentStatus           OrderStatus [default: 'PENDING', note: 'สถานะปัจจุบันของ Order']
  isWalkIn                boolean     [default: false, note: 'true = ลูกค้าหน้าร้านที่ไม่มีข้อมูลในระบบ']
  walkInName              varchar     [note: 'ชื่อลูกค้าหน้าร้าน (ไม่บังคับ) — ใช้เมื่อ isWalkIn=true']
  walkInPhone             varchar     [note: 'เบอร์โทรลูกค้าหน้าร้าน (ไม่บังคับ) — ใช้เมื่อ isWalkIn=true']
  userPackageId           varchar     [ref: > userPackage.id, note: 'FK - แพ็คเกจที่ใช้ (ถ้า orderType=PACKAGE)']
  creditUsed              int         [note: 'จำนวนเครดิตที่ใช้ (ชิ้น) - นับตาม quantity ของ orderItems']
  hangerCharge            jsonb       [note: 'ค่าไม้แขวน (JSONB): { count, pricePerUnit, total }']
  totalAmount             decimal     [note: 'ยอดที่ต้องชำระ (บาท) - สำหรับ STOREFRONT หรือค่าปรับ']
  basketId                varchar     [ref: > basket.id, note: 'FK - ตะกร้าที่ใช้ส่งผ้า']
  note                    text        [note: 'หมายเหตุจากลูกค้า เช่น "ขอเรียบๆ"']
  usedBonuses             jsonb       [note: 'โบนัสที่ใช้ในออเดอร์ (JSONB Array): [{ packageBonusId, quantity, description }]']
  deliveryAddressSnapshot jsonb       [note: 'ที่อยู่จัดส่ง (JSONB): { contactName, contactPhone, addressLine, subDistrict, district, province, postalCode, latitude, longitude }']
  imageId                 image       [ref: > image.id]
  createdAt               timestamptz [default: `now()`, note: 'วันที่สร้าง Order']
  updatedAt               timestamptz [note: 'วันที่แก้ไขล่าสุด']
  deletedAt               timestamptz [note: 'วันที่ลบ (Soft Delete)']
  deletedBy               varchar     [ref: > user.id, note: 'ผู้ที่ทำการลบ']

  indexes {
    customerId    [note: 'ค้นหา Order ตามลูกค้า']
    employeeId    [note: 'ค้นหา Order ตามพนักงาน']
    currentStatus [note: 'กรอง Order ตามสถานะ']
    createdAt     [note: 'เรียงลำดับตามวันที่']
  }
}

Table orderItem {
  id                varchar     [pk, note: 'Primary Key - UUID']
  orderId           varchar     [ref: > order.id, not null, note: 'FK - Order ที่เป็นเจ้าของ']
  storefrontPriceId varchar     [ref: > storefrontPrice.id, not null, note: 'FK - ราคาที่ใช้ (Service + Item)']
  isPackageIncluded boolean     [default: false, note: 'true = รวมในแพ็คเกจ (ไม่คิดเงิน), false = คิดเงินปกติ']
  quantity          int         [not null, note: 'จำนวน (ชิ้น)']
  unitPrice         decimal     [not null, note: 'ราคาต่อหน่วย (บาท) - 0 ถ้า isPackageIncluded=true']
  totalPrice        decimal     [not null, note: 'ราคารวม (บาท) = quantity × unitPrice']
  imageId           varchar     [ref: > image.id, note: 'FK - รูปถ่ายสินค้า (ถ้ามี)']
  notes             text        [note: 'หมายเหตุ เช่น "ตำหนิแขนขวาขาด"']
  createdAt         timestamptz [default: `now()`, note: 'วันที่สร้าง']
  updatedAt         timestamptz [note: 'วันที่แก้ไขล่าสุด']
  deletedAt         timestamptz [note: 'วันที่ลบ (Soft Delete)']
  deletedBy         varchar     [ref: > user.id, note: 'ผู้ที่ทำการลบ']

  indexes {
    orderId           [note: 'ค้นหา Items ตาม Order']
    storefrontPriceId [note: 'ค้นหา Items ตาม Price']
  }
}

Table paymentTransaction as PT {
  id            bigint        [pk, increment]
  userId        varchar       [ref: > user.id]
  userPackageId bigint        [ref: > userPackage.id]
  amount        decimal(10,2)
  slipImage     varchar       [ref: > image.id, note: 'URL รูปสลิป']
  status        PaymentStatus [default: 'PENDING']
  verifiedById  varchar       [ref: > user.id]

  verifiedAt    timestamptz
  createdAt     timestamptz   [default: `now()`]
  updatedAt     timestamptz
  deletedAt     timestamptz [note: 'วันที่ลบ (Soft Delete)']
  deletedBy     varchar     [ref: > user.id, note: 'ผู้ที่ทำการลบ']

  Indexes {
    userPackageId [unique]
    (status, createdAt)
  }
}

Table userAddress as UA {
  id           bigint        [pk, increment]
  userId       varchar       [ref: > user.id]

  address varchar
  subdistrict  varchar
  district     varchar
  province     varchar
  postalCode   varchar
  latitude     decimal(10,7)
  longitude    decimal(10,7)

  isDefault    boolean       [default: false]

  createdAt    timestamptz   [default: `now()`]
  updatedAt    timestamptz
  deletedAt    timestamptz
  deletedBy    varchar     [ref: > user.id, note: 'ผู้ที่ทำการลบ']

  Indexes {
    userId
    (userId, isDefault)
  }
}

//// -------------------------------------- ////
////       8. RELATIONSHIPS SUMMARY         ////
//// -------------------------------------- ////

// Authentication:
// session.userId > user.id                    Session ของผู้ใช้
// account.userId > user.id                    บัญชี Social Login

// Orders:
// order.customerId > user.id                 ลูกค้าที่สั่ง
// order.employeeId > user.id                 พนักงานที่รับผิดชอบ
// order.userPackageId > userPackage.id     แพ็คเกจที่ใช้
// order.basketId > basket.id                ตะกร้าที่ใช้
// order.deletedBy > user.id                  ผู้ลบ

// Order Items:
// orderItem.orderId > order.id             รายการใน Order
// orderItem.storefrontPriceId > storefrontPrice.id   ราคาที่ใช้
// orderItem.imageId > image.id             รูปถ่าย

// Packages:
// userPackage.userId > user.id              ผู้ใช้ที่ซื้อ
// userPackage.packageId > package.id       แพ็คเกจที่ซื้อ
// userPackage.parentUserPackageId > userPackage.id   ADDON อ้างอิง MAIN
// packageBonus.packageId > package.id     ของแถมของแพ็คเกจ
// packageBonus.storefrontPriceId > storefrontPrice.id   รายการที่แถม

// Storefront:
// storefrontPrice.storefrontServiceId > storefrontService.id   บริการ
// storefrontPrice.storefrontItemId > storefrontItem.id         รายการ

// Baskets:
// basket.userId > user.id                    เจ้าของตะกร้า

//// -------------------------------------- ////
////       9. SOFT DELETE SUMMARY           ////
//// -------------------------------------- ////

// Tables with deletedAt/deletedBy:
// ✅ user, package, packageBonus, userPackage
// ✅ basket, order
// ✅ storefrontService, storefrontItem, storefrontPrice
//
// Tables WITHOUT soft delete:
// ❌ session, account, verification (auth tables - ลบจริง)
// ❌ image (ลบผ่าน Cloudinary)
// ❌ orderItem (ลบตาม order - cascade)
