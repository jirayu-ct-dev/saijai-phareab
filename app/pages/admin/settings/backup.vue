<script setup lang="ts">
definePageMeta({
  middleware: ["role-admin"],
  layout: "admin",
});

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

const toBangkokDate = (d: Date) => new Date(d.getTime() + BANGKOK_OFFSET_MS);
const fromBangkokDateParts = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month, day) - BANGKOK_OFFSET_MS);
const formatDateInput = (d: Date) => {
  const bkk = toBangkokDate(d);
  const year = bkk.getUTCFullYear();
  const month = String(bkk.getUTCMonth() + 1).padStart(2, "0");
  const day = String(bkk.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const today = new Date();
const bangkokToday = toBangkokDate(today);
const startOfMonth = fromBangkokDateParts(bangkokToday.getUTCFullYear(), bangkokToday.getUTCMonth(), 1);

const fromDate = ref(formatDateInput(startOfMonth));
const toDate = ref(formatDateInput(today));

const reports = [
  {
    key: "customers",
    label: "รายงานลูกค้า",
    description: "บัญชีลูกค้าหน้าร้านและลูกค้าที่เปิดใช้งานแล้ว พร้อมจำนวนออเดอร์และสถานะ LINE",
    icon: "i-lucide-users-round",
    endpoint: "/api/admin/exports/customers",
  },
  {
    key: "sales",
    label: "รายงานยอดขาย",
    description: "ประวัติการชำระเงินทั้งหมดในช่วงเวลา (เลขที่บิล, ลูกค้า, ยอด, วิธีชำระเงิน)",
    icon: "i-lucide-receipt",
    endpoint: "/api/admin/exports/sales",
  },
  {
    key: "orders",
    label: "รายงานออเดอร์",
    description: "ServiceOrder ทุกใบ (เลขรับ, ลูกค้า, สถานะ, ยอด, แพ็กเกจหลักและแพ็กเกจเสริม)",
    icon: "i-lucide-shirt",
    endpoint: "/api/admin/exports/orders",
  },
  {
    key: "addon-usages",
    label: "รายงานแพ็กเกจเสริม",
    description: "การใช้แพ็กเกจเสริมใน service_order_addon_usage (เลขรับ, ลูกค้า, เครดิตที่ใช้, วันที่หัก)",
    icon: "i-lucide-package-plus",
    endpoint: "/api/admin/exports/addon-usages",
  },
  {
    key: "members",
    label: "รายงานสมาชิก",
    description: "ประวัติ MemberEntitlement (ลูกค้า, แพ็กเกจ, เครดิต, วันเริ่ม/หมดอายุ)",
    icon: "i-lucide-crown",
    endpoint: "/api/admin/exports/members",
  },
  {
    key: "employee-performance",
    label: "รายงานพนักงาน",
    description: "สรุปออเดอร์ที่แต่ละคนรับและยอดรวม สำหรับคำนวณค่าคอมมิชชั่น",
    icon: "i-lucide-users",
    endpoint: "/api/admin/exports/employee-performance",
  },
  {
    key: "expenses",
    label: "รายงานรายจ่าย",
    description: "รายจ่ายร้านแยกตามวันที่ หมวดหมู่ จำนวนเงิน และผู้บันทึก",
    icon: "i-lucide-badge-minus",
    endpoint: "/api/admin/exports/expenses",
  },
];

const downloadingKey = ref<string | null>(null);

const onDownload = async (key: string, endpoint: string) => {
  if (!fromDate.value || !toDate.value) return;
  downloadingKey.value = key;
  try {
    const url = `${endpoint}?from=${fromDate.value}&to=${toDate.value}`;
    window.location.href = url;
  } finally {
    setTimeout(() => {
      downloadingKey.value = null;
    }, 1000);
  }
};

const setPreset = (preset: "this-month" | "last-month" | "last-30-days" | "this-year") => {
  const now = new Date();
  const bkk = toBangkokDate(now);
  const year = bkk.getUTCFullYear();
  const month = bkk.getUTCMonth();
  if (preset === "this-month") {
    fromDate.value = formatDateInput(fromBangkokDateParts(year, month, 1));
    toDate.value = formatDateInput(now);
  } else if (preset === "last-month") {
    fromDate.value = formatDateInput(fromBangkokDateParts(year, month - 1, 1));
    toDate.value = formatDateInput(fromBangkokDateParts(year, month, 0));
  } else if (preset === "last-30-days") {
    fromDate.value = formatDateInput(new Date(now.getTime() - 30 * 86400000));
    toDate.value = formatDateInput(now);
  } else if (preset === "this-year") {
    fromDate.value = formatDateInput(fromBangkokDateParts(year, 0, 1));
    toDate.value = formatDateInput(now);
  }
};
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 p-2 sm:p-6">
    <section class="-mx-2 border border-default/30 bg-default px-4 py-3 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
      <h1 class="text-xl font-semibold text-highlighted">สำรองข้อมูล</h1>
      <p class="mt-1 text-sm text-muted">ดาวน์โหลดรายงานเป็นไฟล์ CSV ให้ตรงกับข้อมูลปัจจุบันของระบบ</p>
    </section>

    <section class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
      <div class="mb-4">
        <p class="font-semibold text-highlighted">เลือกช่วงเวลา</p>
        <p class="mt-1 text-xs text-muted">รายงานจะรวมเฉพาะข้อมูลในช่วงเวลาที่เลือก</p>
      </div>

      <div class="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <UFormField label="วันที่เริ่ม">
          <UInput v-model="fromDate" type="date" class="w-full" />
        </UFormField>
        <UFormField label="วันที่สิ้นสุด">
          <UInput v-model="toDate" type="date" class="w-full" />
        </UFormField>
      </div>

      <div class="flex flex-wrap gap-2">
        <UButton size="xs" color="neutral" variant="outline" @click="setPreset('this-month')">เดือนนี้</UButton>
        <UButton size="xs" color="neutral" variant="outline" @click="setPreset('last-month')">เดือนที่แล้ว</UButton>
        <UButton size="xs" color="neutral" variant="outline" @click="setPreset('last-30-days')">30 วันล่าสุด</UButton>
        <UButton size="xs" color="neutral" variant="outline" @click="setPreset('this-year')">ปีนี้</UButton>
      </div>
    </section>

    <div class="-mx-2 space-y-1 sm:mx-0">
      <div
        v-for="r in reports"
        :key="r.key"
        class="border border-default/30 bg-default p-2 transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70 sm:rounded-lg"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="flex min-w-0 items-center gap-3">
            <UIcon :name="r.icon" class="size-8 shrink-0 text-primary" />
            <div class="min-w-0">
              <p class="font-medium">{{ r.label }}</p>
              <p class="truncate text-xs text-muted">{{ r.description }}</p>
            </div>
          </div>
          <UButton
            icon="i-lucide-download"
            :loading="downloadingKey === r.key"
            :disabled="!fromDate || !toDate"
            @click="onDownload(r.key, r.endpoint)"
          >
            CSV
          </UButton>
        </div>
      </div>
    </div>

    <div class="flex flex-row items-start justify-start gap-2 rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-left text-xs text-muted dark:border-default/20 dark:bg-elevated/30">
      <UIcon name="i-lucide-lightbulb" class="mt-0.5 size-4 shrink-0 text-primary" />
      <span>ไฟล์ CSV รองรับภาษาไทย (UTF-8 with BOM) สามารถเปิดด้วย Excel หรือ Google Sheets ได้ทันที</span>
    </div>
  </div>
</template>
