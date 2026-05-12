<script setup lang="ts">
definePageMeta({
  middleware: ["role-admin"],
  layout: "admin",
});

const today = new Date();
const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const formatDateInput = (d: Date) => d.toISOString().slice(0, 10);

const fromDate = ref(formatDateInput(startOfMonth));
const toDate = ref(formatDateInput(today));

const reports = [
  {
    key: "sales",
    label: "รายงานยอดขาย",
    description: "ทุก PaymentRecord ในช่วงเวลา (เลขที่บิล, ลูกค้า, ยอด, วิธีชำระเงิน)",
    icon: "i-lucide-receipt",
    endpoint: "/api/admin/exports/sales",
  },
  {
    key: "orders",
    label: "รายงานออเดอร์",
    description: "ServiceOrder ทุกใบ (เลขรับ, ลูกค้า, จำนวน, สถานะ, ยอด, พนักงาน)",
    icon: "i-lucide-shirt",
    endpoint: "/api/admin/exports/orders",
  },
  {
    key: "members",
    label: "รายงานสมาชิก",
    description: "MemberEntitlement (ลูกค้า, แพ็กเกจ, เครดิต, วันเริ่ม/หมดอายุ)",
    icon: "i-lucide-crown",
    endpoint: "/api/admin/exports/members",
  },
  {
    key: "employee-performance",
    label: "รายงานพนักงาน",
    description: "สรุปออเดอร์ที่แต่ละคนรับ + ยอดรวม สำหรับคำนวณค่าคอมมิชชั่น",
    icon: "i-lucide-users",
    endpoint: "/api/admin/exports/employee-performance",
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
  if (preset === "this-month") {
    fromDate.value = formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
    toDate.value = formatDateInput(now);
  } else if (preset === "last-month") {
    fromDate.value = formatDateInput(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    toDate.value = formatDateInput(new Date(now.getFullYear(), now.getMonth(), 0));
  } else if (preset === "last-30-days") {
    fromDate.value = formatDateInput(new Date(now.getTime() - 30 * 86400000));
    toDate.value = formatDateInput(now);
  } else if (preset === "this-year") {
    fromDate.value = formatDateInput(new Date(now.getFullYear(), 0, 1));
    toDate.value = formatDateInput(now);
  }
};
</script>

<template>
  <div class="w-full p-6 max-w-3xl mx-auto space-y-6">
    <div>
      <h1 class="text-xl font-semibold">Export ข้อมูล</h1>
      <p class="text-sm text-muted mt-1">ดาวน์โหลดรายงานเป็นไฟล์ CSV สำหรับทำบัญชี</p>
    </div>

    <UCard>
      <template #header>
        <div>
          <p class="font-semibold">เลือกช่วงเวลา</p>
          <p class="text-xs text-muted mt-1">รายงานจะรวมเฉพาะข้อมูลในช่วงเวลานี้</p>
        </div>
      </template>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
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
    </UCard>

    <div class="space-y-3">
      <UCard v-for="r in reports" :key="r.key">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-3 min-w-0">
            <UIcon :name="r.icon" class="size-8 text-primary shrink-0" />
            <div class="min-w-0">
              <p class="font-medium">{{ r.label }}</p>
              <p class="text-xs text-muted">{{ r.description }}</p>
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
      </UCard>
    </div>

    <div class="rounded-md border border-default bg-elevated/30 p-4 text-xs text-muted">
      💡 ไฟล์ CSV รองรับภาษาไทย (UTF-8 with BOM) สามารถเปิดด้วย Excel หรือ Google Sheets ได้ทันที
    </div>
  </div>
</template>
