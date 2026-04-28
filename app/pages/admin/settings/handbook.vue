<script setup lang="ts">
definePageMeta({
  middleware: ["role-employee"],
  layout: "admin",
});

type Section = {
  id: string;
  title: string;
  icon: string;
  paragraphs: Array<string | { type: "list"; items: string[] } | { type: "step"; items: string[] } | { type: "note"; text: string }>;
};

const sections: Section[] = [
  {
    id: "pos-storefront",
    title: "การรับผ้าหน้าร้าน",
    icon: "i-lucide-shirt",
    paragraphs: [
      "หน้า POS รับผ้าใช้ที่เมนู 'รับผ้า → หน้าร้าน' หรือ /admin/sales",
      {
        type: "step",
        items: [
          "เลือกลูกค้า (หรือเปิด toggle 'ลูกค้าหน้าร้าน' สำหรับ walk-in)",
          "เลือกบริการ + จำนวนชิ้น จากตาราง catalog",
          "ถ่ายรูปผ้า — ถ้ามีผ้าชำรุดติ๊ก 'ผ้าชำรุด' ในรูปนั้น",
          "ระบุจำนวนไม้แขวนที่ขาด (ถ้ามี — โหมดชั่งกิโลไม่นับไม้แขวน)",
          "ระบุวันนัดรับผ้า (ปุ่มลัด พุธ/เสาร์ หรือไม่ระบุ)",
          "ถ้าลูกค้าเป็นสมาชิกแพ็กเกจ ระบบจะ toggle ให้ใช้เครดิตอัตโนมัติ",
          "กดบันทึก — ระบบส่งใบเสร็จและการแจ้งเตือนไปยังลูกค้าทาง LINE",
        ],
      },
      {
        type: "note",
        text: "ลูกค้าที่ผูก LINE จะได้รับ flex message พร้อมรูปผ้า รูปชำรุด และรายละเอียดออเดอร์",
      },
    ],
  },
  {
    id: "pos-wash-fold",
    title: "การรับผ้าโหมดชั่งกิโล (ซัก-พับ)",
    icon: "i-lucide-scale",
    paragraphs: [
      "เปิด toggle 'โหมดซัก-พับ ชั่งกิโล' บนหน้า POS เพื่อคิดราคาตามน้ำหนักรวม",
      {
        type: "step",
        items: [
          "เปิด toggle 'โหมดซัก-พับ ชั่งกิโล'",
          "กรอกน้ำหนักรวม (กก.) + หมายเหตุถ้ามี",
          "เพิ่ม items จาก catalog ได้ตามปกติ — เพื่อบันทึกชนิด/จำนวน + ถ่ายรูปผ้า/ผ้าชำรุด",
          "ราคาคิดจาก น้ำหนัก × ราคา/กก. ที่ตั้งไว้ใน 'ตั้งค่าธุรกิจ' (default 60 บาท/กก.)",
          "ไม่นับไม้แขวน + ใช้แพ็กเกจรายเดือนไม่ได้",
        ],
      },
      {
        type: "note",
        text: "ตั้งค่าราคา/กก. และน้ำหนักขั้นต่ำได้ที่ 'ตั้งค่าระบบ → ตั้งค่าธุรกิจ → ซัก-พับ ชั่งกิโล'",
      },
    ],
  },
  {
    id: "pos-package",
    title: "การขายแพ็กเกจรายเดือน",
    icon: "i-lucide-package",
    paragraphs: [
      "เมนู 'รับผ้า → ขายแพ็กเกจ' สำหรับขายแพ็กเกจหลัก/เสริมให้ลูกค้า",
      {
        type: "step",
        items: [
          "เลือกลูกค้า (ต้องเป็นสมาชิกที่มีบัญชี ห้ามเป็น walk-in)",
          "เลือกแพ็กเกจ + จำนวน",
          "กดบันทึก ระบบสร้าง MemberEntitlement พร้อมเครดิตเริ่มต้นและกำหนดวันหมดอายุ",
        ],
      },
      {
        type: "note",
        text: "ลูกค้าจะได้ flex message ใบเสร็จ + รายละเอียดเครดิต/วันเริ่ม/วันหมดอายุทาง LINE",
      },
    ],
  },
  {
    id: "status-update",
    title: "การอัปเดตสถานะออเดอร์",
    icon: "i-lucide-refresh-cw",
    paragraphs: [
      "เปิด /admin/service-orders/scan หรือเข้าหน้ารายละเอียดออเดอร์",
      {
        type: "list",
        items: [
          "RECEIVED → PROCESSING: เริ่มซักผ้า",
          "PROCESSING → DELIVERING: ผ้าพร้อมส่ง",
          "DELIVERING → COMPLETED: ส่งให้ลูกค้าแล้ว (ต้องอัปโหลดรูปหลักฐานการส่ง)",
          "ทุก status → CANCELLED: ยกเลิกออเดอร์ (จะคืนเครดิตให้ลูกค้าโดยอัตโนมัติ ถ้าใช้แพ็กเกจ)",
        ],
      },
      {
        type: "note",
        text: "ทุกครั้งที่เปลี่ยนสถานะ ลูกค้าจะได้รับ LINE notification ตามที่ admin ตั้งค่าไว้",
      },
    ],
  },
  {
    id: "customer-management",
    title: "การจัดการลูกค้า",
    icon: "i-lucide-users",
    paragraphs: [
      "ดูรายชื่อลูกค้าทั้งหมดได้ที่ 'ตั้งค่าระบบ → จัดการสมาชิก' หรือ /admin/users",
      {
        type: "list",
        items: [
          "คลิกชื่อลูกค้าเพื่อดูประวัติ entitlement, การชำระ, ออเดอร์",
          "ใช้ filter 'ใกล้หมดอายุ' เพื่อดูใครต้องต่อแพ็กเกจ",
          "ลูกค้าที่ผูก LINE จะมี badge LINE ติดอยู่",
        ],
      },
    ],
  },
  {
    id: "settings",
    title: "การตั้งค่าระบบ",
    icon: "i-lucide-settings",
    paragraphs: [
      {
        type: "list",
        items: [
          "ข้อมูลร้าน — ชื่อร้าน, ที่อยู่, โลโก้, QR LINE สำหรับใบเสร็จ",
          "การแจ้งเตือน — เปิด/ปิดการแจ้งเตือนแต่ละสถานะผ่าน LINE",
          "ตั้งค่าธุรกิจ — ค่าไม้แขวน, ราคา/กก. ซัก-พับ, VAT, prefix เลขเอกสาร",
          "Export ข้อมูล — ดาวน์โหลดรายงานยอดขาย/ออเดอร์/สมาชิกเป็น CSV",
          "จัดการพนักงาน — เพิ่ม/ลบพนักงานและกำหนด role",
          "จัดการสมาชิก — แก้ไข/ลบลูกค้าที่มีบัญชี + ดูเครดิตคงเหลือ",
        ],
      },
    ],
  },
  {
    id: "faq",
    title: "คำถามที่พบบ่อย",
    icon: "i-lucide-help-circle",
    paragraphs: [
      "ลูกค้าไม่ได้รับ LINE notification?",
      {
        type: "list",
        items: [
          "เช็คว่าลูกค้าผูกบัญชี LINE แล้ว (ดูจาก badge LINE ในรายชื่อ)",
          "เช็คว่าลูกค้าเพิ่ม OA ของร้านเป็นเพื่อนแล้ว",
          "เช็คใน 'ตั้งค่าระบบ → การแจ้งเตือน' ว่า toggle ของสถานะนั้นเปิดอยู่",
          "ลูกค้าอาจปิดการแจ้งเตือนของตัวเองในหน้า user settings",
        ],
      },
      "ลบออเดอร์/ใบเสร็จไม่ได้?",
      {
        type: "note",
        text: "ระบบใช้ soft delete — ออเดอร์/ใบเสร็จที่มีการใช้สิทธิ์แล้วจะลบไม่ได้ ต้องเปลี่ยนสถานะเป็น CANCELLED แทน",
      },
      "พนักงาน login เข้าระบบไม่ได้?",
      {
        type: "list",
        items: [
          "ตรวจสอบใน 'จัดการพนักงาน' ว่ายังมีบัญชีอยู่",
          "ถ้าลืมรหัสผ่าน admin สามารถสร้างบัญชีใหม่ + ลบของเก่าได้",
        ],
      },
    ],
  },
];

const tocAnchors = sections.map((s) => ({ id: s.id, title: s.title, icon: s.icon }));
</script>

<template>
  <div class="w-full p-6 max-w-4xl mx-auto space-y-6">
    <div>
      <h1 class="text-xl font-semibold">คู่มือการใช้งาน</h1>
      <p class="text-sm text-muted mt-1">วิธีใช้งานระบบสำหรับพนักงานและผู้ดูแล</p>
    </div>

    <UCard>
      <template #header>
        <p class="font-semibold">สารบัญ</p>
      </template>
      <ul class="space-y-1.5">
        <li v-for="t in tocAnchors" :key="t.id">
          <a :href="`#${t.id}`" class="flex items-center gap-2 text-sm text-primary hover:underline">
            <UIcon :name="t.icon" class="size-4" />
            {{ t.title }}
          </a>
        </li>
      </ul>
    </UCard>

    <section
      v-for="s in sections"
      :id="s.id"
      :key="s.id"
      class="rounded-2xl border border-default bg-default p-6 scroll-mt-20"
    >
      <div class="flex items-center gap-3 mb-4">
        <UIcon :name="s.icon" class="size-6 text-primary" />
        <h2 class="text-lg font-semibold">{{ s.title }}</h2>
      </div>

      <div class="space-y-3 text-sm">
        <template v-for="(p, i) in s.paragraphs" :key="i">
          <p v-if="typeof p === 'string'" class="text-default">{{ p }}</p>
          <ul v-else-if="p.type === 'list'" class="list-disc pl-5 space-y-1 text-muted">
            <li v-for="(item, j) in p.items" :key="j">{{ item }}</li>
          </ul>
          <ol v-else-if="p.type === 'step'" class="list-decimal pl-5 space-y-1 text-muted">
            <li v-for="(item, j) in p.items" :key="j">{{ item }}</li>
          </ol>
          <div
            v-else-if="p.type === 'note'"
            class="rounded-lg border border-info/30 bg-info/5 p-3 text-info text-xs"
          >
            💡 {{ p.text }}
          </div>
        </template>
      </div>
    </section>

    <div class="text-center text-xs text-muted py-4">
      หากมีปัญหาหรือข้อสงสัย ติดต่อทีมพัฒนาระบบ
    </div>
  </div>
</template>
