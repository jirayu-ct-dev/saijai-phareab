<script setup lang="ts">
definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

type Paragraph =
  | string
  | { type: "list"; items: string[] }
  | { type: "step"; items: string[] }
  | { type: "note"; text: string };

type Section = {
  id: string;
  title: string;
  icon: string;
  description: string;
  to?: string;
  paragraphs: Paragraph[];
};

const quickLinks = [
  {
    label: "แดชบอร์ด",
    icon: "i-lucide-layout-dashboard",
    to: "/me",
    description: "ดูสรุปยอดใช้จ่าย แพ็กเกจ และรายการล่าสุด",
  },
  {
    label: "ออเดอร์ของฉัน",
    icon: "i-lucide-shopping-basket",
    to: "/me/service-orders",
    description: "ติดตามสถานะและรายละเอียดรายการรับผ้า",
  },
  {
    label: "ประวัติการชำระเงิน",
    icon: "i-lucide-receipt",
    to: "/me/payment",
    description: "ดูใบแจ้งราคา ใบเสร็จ และประวัติชำระเงิน",
  },
  {
    label: "แพ็กเกจบริการ",
    icon: "i-lucide-package",
    to: "/me/packages",
    description: "เลือกซื้อแพ็กเกจหลักและแพ็กเกจเสริม",
  },
  {
    label: "อัตราค่าบริการ",
    icon: "i-lucide-tags",
    to: "/me/pricing",
    description: "ตรวจราคาหน้าร้านและบริการซักอบพับ",
  },
  {
    label: "ตั้งค่า",
    icon: "i-lucide-settings",
    to: "/me/settings/profile",
    description: "จัดการโปรไฟล์ ที่อยู่ การแจ้งเตือน และความปลอดภัย",
  },
];

const sections: Section[] = [
  {
    id: "dashboard",
    title: "แดชบอร์ด",
    icon: "i-lucide-layout-dashboard",
    to: "/me",
    description: "หน้าแรกหลังเข้าสู่ระบบ สำหรับดูภาพรวมการใช้งานของคุณ",
    paragraphs: [
      {
        type: "list",
        items: [
          "ดูยอดใช้จ่ายและจำนวนรายการตามช่วงวันที่ที่เลือก",
          "ดูกราฟยอดใช้จ่ายของตัวเองตามรายวัน รายสัปดาห์ หรือรายเดือน",
          "ดูแพ็กเกจที่กำลังใช้งาน เครดิตคงเหลือ และวันหมดอายุ",
          "ดูประวัติการชำระเงินล่าสุดและออเดอร์ล่าสุด",
        ],
      },
      {
        type: "note",
        text: "ถ้าข้อมูลยังไม่อัปเดต ให้กดปุ่มรีเฟรชที่มุมขวาบนของหน้า ระหว่างโหลดใหม่ระบบจะแสดงหน้าจอรอข้อมูลให้เห็นชัดเจน",
      },
    ],
  },
  {
    id: "service-orders",
    title: "รายการออเดอร์",
    icon: "i-lucide-shopping-basket",
    to: "/me/service-orders",
    description: "ใช้ติดตามงานซักรีดตั้งแต่รับผ้าจนถึงส่งคืน",
    paragraphs: [
      {
        type: "step",
        items: [
          "เปิดเมนู 'รายการออเดอร์'",
          "ค้นหาด้วยเลขที่ออเดอร์ หรือกรองตามสถานะ",
          "กดรายการที่ต้องการเพื่อดูรายละเอียด",
          "ตรวจรายการผ้า รูปภาพผ้า สถานะ ยอดรวม และข้อมูลการชำระเงิน",
        ],
      },
      {
        type: "list",
        items: [
          "สถานะ 'รับผ้า' หมายถึงร้านบันทึกรายการแล้ว",
          "สถานะ 'กำลังดำเนินการ' หมายถึงร้านกำลังซัก รีด หรือจัดเตรียมรายการ",
          "สถานะ 'กำลังจัดส่ง' หมายถึงรายการพร้อมส่งคืน",
          "สถานะ 'เสร็จสิ้น' หมายถึงส่งคืนเรียบร้อยแล้ว",
        ],
      },
    ],
  },
  {
    id: "payment",
    title: "ประวัติการชำระเงิน ใบแจ้งราคา และใบเสร็จ",
    icon: "i-lucide-receipt",
    to: "/me/payment",
    description: "รวมประวัติการชำระเงินจากออเดอร์และการซื้อแพ็กเกจ",
    paragraphs: [
      {
        type: "step",
        items: [
          "เปิดเมนู 'ประวัติการชำระเงิน'",
          "ค้นหาหรือกรองประเภทการขาย เช่น แพ็กเกจ งานซักรีด หรือรายเดือน",
          "กดรายการเพื่อดูรายละเอียดประวัติการชำระเงิน",
          "เปิดใบแจ้งราคา หรือใบเสร็จจากปุ่มในหน้ารายละเอียด",
        ],
      },
      {
        type: "note",
        text: "ถ้าออเดอร์ใช้สิทธิ์แพ็กเกจแล้วและยอดชำระเป็น 0 ระบบจะบันทึกเป็นชำระแล้วอัตโนมัติ แต่ถ้ามีค่าใช้จ่ายเพิ่ม เช่น ค่าไม้แขวน จะยังคงแสดงประวัติการชำระเงินให้ตรวจสอบ",
      },
    ],
  },
  {
    id: "packages",
    title: "เลือกซื้อแพ็กเกจ",
    icon: "i-lucide-package-plus",
    to: "/me/packages",
    description: "ดูแพ็กเกจหลักและแพ็กเกจเสริมที่ร้านเปิดให้บริการ",
    paragraphs: [
      {
        type: "list",
        items: [
          "แพ็กเกจหลักใช้กับรายการผ้าที่แพ็กเกจครอบคลุม",
          "แพ็กเกจเสริมใช้กับบริการเพิ่มเติมตามเงื่อนไขของร้าน",
          "รายการที่แพ็กเกจไม่ครอบคลุมจะคิดตามราคาหน้าร้าน",
          "ถ้าต้องการซื้อ ให้กดปุ่มติดต่อผ่าน LINE เพื่อให้ร้านดำเนินการขายแพ็กเกจ",
        ],
      },
    ],
  },
  {
    id: "membership",
    title: "แพ็กเกจของฉัน",
    icon: "i-lucide-package-check",
    to: "/me/membership",
    description: "สำหรับลูกค้าที่มีแพ็กเกจใช้งานอยู่",
    paragraphs: [
      {
        type: "list",
        items: [
          "ดูแพ็กเกจที่กำลังใช้งาน เครดิตเริ่มต้น เครดิตคงเหลือ และวันหมดอายุ",
          "ดูแพ็กเกจที่หมดอายุหรือถูกยกเลิกแล้ว",
          "กด 'ดูประวัติการใช้งาน' เพื่อตรวจว่าเครดิตถูกใช้กับออเดอร์ใด",
        ],
      },
      {
        type: "note",
        text: "เมนูนี้จะแสดงเฉพาะลูกค้าที่มีสถานะสมาชิกแพ็กเกจ ถ้ายังไม่มีแพ็กเกจให้เลือกซื้อที่หน้าแพ็กเกจบริการ",
      },
    ],
  },
  {
    id: "pricing",
    title: "อัตราค่าบริการ",
    icon: "i-lucide-tags",
    to: "/me/pricing",
    description: "ใช้ตรวจราคาหน้าร้านก่อนส่งผ้า",
    paragraphs: [
      {
        type: "list",
        items: [
          "ดูราคาบริการซักอบพับแบบคิดตามกิโล",
          "ดูราคาซักแยกชิ้น แยกตามหมวดบริการ",
          "ใช้ช่องค้นหาและตัวเลือกหมวดบริการเพื่อหารายการผ้าที่ต้องการ",
          "ราคาหน้าร้านใช้กับลูกค้าทั่วไป หรือรายการที่แพ็กเกจไม่ครอบคลุม",
        ],
      },
    ],
  },
  {
    id: "settings",
    title: "ตั้งค่าบัญชี",
    icon: "i-lucide-settings",
    to: "/me/settings",
    description: "จัดการข้อมูลส่วนตัวและการใช้งานบัญชี",
    paragraphs: [
      {
        type: "list",
        items: [
          "ข้อมูลส่วนตัว: แก้ไขชื่อ เบอร์โทร และรูปโปรไฟล์",
          "ที่อยู่จัดส่ง: เพิ่ม แก้ไข หรือลบที่อยู่สำหรับจัดส่ง",
          "การแจ้งเตือน: เปิดหรือปิดการแจ้งเตือนที่ต้องการรับ",
          "ความปลอดภัย: จัดการข้อมูลเข้าสู่ระบบตามช่องทางที่รองรับ",
        ],
      },
    ],
  },
  {
    id: "faq",
    title: "คำถามที่พบบ่อย",
    icon: "i-lucide-help-circle",
    description: "คำตอบสั้น ๆ สำหรับปัญหาที่พบบ่อย",
    paragraphs: [
      "ไม่เห็นแพ็กเกจของฉัน?",
      {
        type: "note",
        text: "ตรวจสอบก่อนว่าร้านขายแพ็กเกจให้บัญชีที่คุณกำลังใช้งานอยู่ และแพ็กเกจยังไม่หมดอายุหรือถูกยกเลิก",
      },
      "ไม่เห็นใบเสร็จหรือใบแจ้งราคา?",
      {
        type: "note",
        text: "ให้ตรวจที่เมนูประวัติการชำระเงิน หากเพิ่งทำรายการกับร้าน ให้กดรีเฟรชหรือรอสักครู่เพื่อให้ระบบอัปเดต",
      },
      "ไม่ได้รับแจ้งเตือน LINE?",
      {
        type: "list",
        items: [
          "ตรวจสอบว่าเพิ่ม LINE OA ของร้านเป็นเพื่อนแล้ว",
          "ตรวจสอบว่าเข้าสู่ระบบด้วยบัญชีเดียวกับที่ร้านบันทึกไว้",
          "ตรวจสอบการตั้งค่าการแจ้งเตือนในเมนูตั้งค่า",
        ],
      },
    ],
  },
];

const tocAnchors = sections.map((section) => ({
  id: section.id,
  title: section.title,
  icon: section.icon,
}));
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <UDashboardPanel id="me-handbook" grow>
      <template #header>
        <UDashboardNavbar title="คู่มือการใช้งาน" icon="i-lucide-book">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
        </UDashboardNavbar>
      </template>

      <template #body>
        <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 p-2 sm:p-6">
          <section class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
            <div class="flex items-start gap-3">
              <div class="flex size-10 shrink-0 items-center justify-center rounded-lg border border-default/30 bg-elevated/30 text-primary dark:border-default/20 dark:bg-default/80">
                <UIcon name="i-lucide-book-open" class="size-5" />
              </div>
              <div class="min-w-0">
                <h1 class="text-xl font-semibold text-highlighted">คู่มือการใช้งานส่วนลูกค้า</h1>
                <p class="mt-1 text-sm text-muted">
                  รวมวิธีใช้งานหน้าต่าง ๆ ในเมนูของฉัน ตั้งแต่ดูออเดอร์ ชำระเงิน ซื้อแพ็กเกจ ไปจนถึงตั้งค่าบัญชี
                </p>
              </div>
            </div>
          </section>

          <section class="flex flex-col gap-1">
            <div class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
              <p class="font-semibold text-highlighted">เมนูที่ใช้งานได้</p>
              <p class="mt-1 text-sm text-muted">เมนูหลักที่ลูกค้าสามารถใช้งานได้</p>
            </div>
            <div class="-mx-2 grid grid-cols-1 gap-1 sm:mx-0 sm:grid-cols-2">
              <NuxtLink
                v-for="link in quickLinks"
                :key="link.to"
                :to="link.to"
                class="border border-default/30 bg-default p-3 transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70 sm:rounded-lg"
              >
                <div class="flex items-start gap-2">
                  <UIcon :name="link.icon" class="mt-0.5 size-5 shrink-0 text-primary" />
                  <div class="min-w-0">
                    <p class="font-medium text-highlighted">{{ link.label }}</p>
                    <p class="mt-0.5 text-sm text-muted">{{ link.description }}</p>
                  </div>
                </div>
              </NuxtLink>
            </div>
          </section>

          <section class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
            <p class="font-semibold text-highlighted">สารบัญ</p>
            <ul class="mt-3 space-y-1.5">
              <li v-for="item in tocAnchors" :key="item.id">
                <a :href="`#${item.id}`" class="flex items-center gap-2 text-sm text-primary hover:underline">
                  <UIcon :name="item.icon" class="size-4" />
                  {{ item.title }}
                </a>
              </li>
            </ul>
          </section>

          <section
            v-for="section in sections"
            :id="section.id"
            :key="section.id"
            class="-mx-2 scroll-mt-20 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg"
          >
            <div class="mb-4 flex items-start justify-between gap-3">
              <div class="flex min-w-0 items-start gap-3">
                <UIcon :name="section.icon" class="mt-0.5 size-6 shrink-0 text-primary" />
                <div class="min-w-0">
                  <h2 class="text-lg font-semibold text-highlighted">{{ section.title }}</h2>
                  <p class="mt-1 text-sm text-muted">{{ section.description }}</p>
                </div>
              </div>
              <UButton
                v-if="section.to"
                :to="section.to"
                icon="i-lucide-arrow-up-right"
                color="neutral"
                variant="ghost"
                size="sm"
                aria-label="เปิดหน้านี้"
              />
            </div>

            <div class="space-y-3 text-sm">
              <template v-for="(paragraph, index) in section.paragraphs" :key="index">
                <p v-if="typeof paragraph === 'string'" class="text-default">{{ paragraph }}</p>
                <ul v-else-if="paragraph.type === 'list'" class="list-disc space-y-1 pl-5 text-muted">
                  <li v-for="(item, itemIndex) in paragraph.items" :key="itemIndex">{{ item }}</li>
                </ul>
                <ol v-else-if="paragraph.type === 'step'" class="list-decimal space-y-1 pl-5 text-muted">
                  <li v-for="(item, itemIndex) in paragraph.items" :key="itemIndex">{{ item }}</li>
                </ol>
                <div
                  v-else-if="paragraph.type === 'note'"
                  class="flex items-start gap-2 rounded-lg border border-info/30 bg-info/5 p-3 text-xs text-info"
                >
                  <UIcon name="i-lucide-lightbulb" class="mt-0.5 size-3.5 shrink-0" />
                  <span>{{ paragraph.text }}</span>
                </div>
              </template>
            </div>
          </section>
        </div>
      </template>
    </UDashboardPanel>
  </div>
</template>
