<script setup lang="ts">
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";

type IntakePayload = {
  id: string;
  orderNo: string | null;
  status: string;
  note: string | null;
  receivedAt: string;
  dueAt: string | null;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  hangerCharge: {
    count: number;
    pricePerUnit: number;
    total: number;
  } | null;
  customer: {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string | null;
    image: string | null;
  };
  employee: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    notes: string | null;
  }>;
  payments: Array<{
    id: string;
    paymentNo: string | null;
    paymentMethod: "CASH" | "TRANSFER";
    status: "PENDING" | "VERIFIED" | "FAILED";
    amount: number;
    paidAt: string | null;
  }>;
};

definePageMeta({
  layout: "admin",
  middleware: ["role-employee"],
});

const route = useRoute();
const serviceOrderId = computed(() => String(route.params.id ?? ""));
const intakeElement = useTemplateRef<HTMLElement>("intakeElement");
const SLIP_EXPORT_WIDTH_PX = 302;

const SHOP_PROFILE = {
  name: "ร้านใส่ใจผ้าเรียบ",
  subtitle: "ใบรับผ้า",
  address: "หน้าร้านบุรีรัมย์",
  phone: "เบอร์โทรศัพท์",
};

const { data, status, refresh, error } = await useFetch<IntakePayload>(() => `/api/admin/service-orders/${serviceOrderId.value}/intake`, {
  key: () => `service-order-intake-${serviceOrderId.value}`,
});

const isLoading = computed(() => status.value === "pending");
const orderCode = computed(() => data.value?.orderNo || `ORD-${serviceOrderId.value.slice(-8).toUpperCase()}`);
const customerName = computed(() => data.value?.customer.name || data.value?.customer.email || "-");
const employeeName = computed(() => data.value?.employee?.name || data.value?.employee?.email || "system");
const totalQuantity = computed(() => (data.value?.items ?? []).reduce((sum, item) => sum + item.quantity, 0));
const paymentSummary = computed(() => data.value?.payments[0] ?? null);
const paymentStatusLabel = computed(() => {
  if (!paymentSummary.value) return "ยังไม่ชำระ";
  if (paymentSummary.value.status === "VERIFIED") return "ชำระแล้ว";
  if (paymentSummary.value.status === "FAILED") return "ชำระไม่สำเร็จ";
  return "รอตรวจสอบ";
});
const goBack = () => {
  if (import.meta.client && window.history.length > 1) {
    window.history.back();
    return;
  }

  void navigateTo("/admin/sales");
};
const handlePrint = () => {
  if (import.meta.client) window.print();
};

const downloadPng = async () => {
  if (!import.meta.client || !intakeElement.value) return;

  const { toPng } = await import("html-to-image");

  const exportHost = document.createElement("div");
  exportHost.style.position = "fixed";
  exportHost.style.left = "-10000px";
  exportHost.style.top = "0";
  exportHost.style.width = `${SLIP_EXPORT_WIDTH_PX}px`;
  exportHost.style.padding = "0";
  exportHost.style.margin = "0";
  exportHost.style.background = "#ffffff";

  const slipClone = intakeElement.value.cloneNode(true) as HTMLElement;
  slipClone.style.width = `${SLIP_EXPORT_WIDTH_PX}px`;
  slipClone.style.maxWidth = `${SLIP_EXPORT_WIDTH_PX}px`;
  slipClone.style.margin = "0 auto";
  slipClone.style.boxSizing = "border-box";

  exportHost.appendChild(slipClone);
  document.body.appendChild(exportHost);

  const dataUrl = await toPng(slipClone, {
    backgroundColor: "#ffffff",
    pixelRatio: 2,
    canvasWidth: SLIP_EXPORT_WIDTH_PX,
    skipFonts: true,
  });

  document.body.removeChild(exportHost);

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${orderCode.value}.png`;
  link.click();
};

</script>

<template>
  <UDashboardPanel id="service-order-intake-slip">
    <template #header>
      <UDashboardNavbar title="ใบรับผ้า" icon="i-lucide-ticket">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex intake-actions" />
        </template>

        <template #right>
          <div class="intake-actions flex items-center gap-2">
            <UButton label="กลับ" color="neutral" variant="outline" icon="i-lucide-arrow-left" @click="goBack" />
            <UButton label="บันทึก PNG" color="neutral" variant="outline" icon="i-lucide-image-down" @click="downloadPng" />
            <UButton label="พิมพ์ใบรับผ้า" color="neutral" icon="i-lucide-printer" @click="handlePrint" />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="isLoading" class="receipt-card rounded-2xl border border-default bg-default p-6">
        <USkeleton class="mx-auto h-5 w-40" />
        <USkeleton class="mx-auto mt-2 h-4 w-56" />
        <USkeleton class="mt-6 h-80 w-full" />
      </div>

      <div v-else-if="error || !data" class="receipt-card rounded-2xl border border-default bg-default p-6">
        <p class="text-base font-semibold text-highlighted">ไม่พบข้อมูลใบรับผ้า</p>
        <p class="mt-2 text-sm text-muted">รายการนี้อาจถูกลบหรือยังไม่พร้อมสำหรับพิมพ์</p>
        <div class="mt-4">
          <UButton label="ลองใหม่" color="neutral" variant="outline" @click="refresh()" />
        </div>
      </div>

      <article ref="intakeElement" v-else class="receipt-card mx-auto bg-white px-4 py-5 text-[13px] leading-5 text-black">
        <header class="text-center">
          <p class="text-[22px] font-bold leading-7">{{ SHOP_PROFILE.name }}</p>
          <p class="mt-1 text-[15px] font-semibold">{{ SHOP_PROFILE.subtitle }}</p>
          <p class="mt-1 text-[12px] leading-5">{{ SHOP_PROFILE.address }}</p>
          <p class="text-[12px] leading-5">{{ SHOP_PROFILE.phone }}</p>
        </header>

        <div class="receipt-rule mt-4" />

        <section class="pt-3 text-center">
          <p class="text-[18px] font-bold">ใบรับผ้า</p>
        </section>

        <section class="mt-3 grid gap-1 text-[12px] leading-4">
          <div class="receipt-info-row">
            <span>เลขรับผ้า:</span>
            <span class="text-right">{{ orderCode }}</span>
          </div>
          <div class="receipt-info-row">
            <span>วันที่รับ:</span>
            <span class="text-right">{{ formatDateTime(data.receivedAt) }}</span>
          </div>
          <div class="receipt-info-row" v-if="data.dueAt">
            <span>วันนัดรับ:</span>
            <span class="text-right">{{ formatDateTime(data.dueAt) }}</span>
          </div>
          <div class="receipt-info-row">
            <span>สถานะ:</span>
            <span class="text-right">{{ paymentStatusLabel }}</span>
          </div>
          <div class="receipt-info-row">
            <span>ชื่อลูกค้า:</span>
            <span class="text-right">{{ customerName }}</span>
          </div>
          <div class="receipt-info-row" v-if="data.customer.phoneNumber">
            <span>โทร:</span>
            <span class="text-right">{{ data.customer.phoneNumber }}</span>
          </div>
          <div class="receipt-info-row">
            <span>พนักงาน:</span>
            <span class="text-right">{{ employeeName }}</span>
          </div>
        </section>

        <div class="receipt-dash mt-3" />

        <section class="mt-2">
          <div class="flex items-start gap-2 text-[12px] font-bold">
            <p class="min-w-0 flex-1">รายการ</p>
            <p class="w-10 shrink-0 text-right whitespace-nowrap">จำนวน</p>
            <p class="w-19.5 shrink-0 text-right whitespace-nowrap">รวม</p>
          </div>

          <div class="receipt-dash mt-1" />

          <div class="mt-2 space-y-2">
            <div v-for="item in data.items" :key="item.id">
              <div class="receipt-item-row text-[12px]">
                <div class="min-w-0">
                  <p class="receipt-item-name font-semibold leading-4">{{ item.name }}</p>
                </div>
                <p class="text-right whitespace-nowrap">x{{ item.quantity }}</p>
                <p class="text-right whitespace-nowrap">{{ formatCurrency(item.totalPrice) }}</p>
              </div>
            </div>
          </div>
        </section>

        <div class="receipt-dash mt-3" />

        <section class="mt-3 space-y-1 text-[12px] leading-4">
          <div class="receipt-info-row">
            <span>รวมจำนวนรายการ</span>
            <span>{{ totalQuantity }} ชิ้น</span>
          </div>
          <div class="receipt-info-row">
            <span>รวมไม้แขวน</span>
            <span>{{ data.hangerCharge?.count ?? 0 }} ชิ้น</span>
          </div>
          <div class="receipt-info-row">
            <span>ค่าบริการ</span>
            <span>{{ formatCurrency(data.subtotalAmount) }}</span>
          </div>
          <div v-if="data.hangerCharge && data.hangerCharge.total > 0" class="receipt-info-row">
            <span>ค่าไม้แขวน</span>
            <span>{{ formatCurrency(data.hangerCharge.total) }}</span>
          </div>
          <div class="receipt-info-row">
            <span>ส่วนลด</span>
            <span>{{ formatCurrency(data.discountAmount) }}</span>
          </div>
          <div class="receipt-info-row">
            <span>ยอดประเมินรวม</span>
            <span>{{ formatCurrency(data.totalAmount) }}</span>
          </div>
          <div v-if="data.note" class="pt-1 text-[11px] leading-4 text-neutral-700">
            <p class="font-semibold">หมายเหตุ</p>
            <p class="mt-1 wrap-break-word">{{ data.note }}</p>
          </div>
        </section>

        <div class="receipt-rule mt-4" />

        <section class="mt-3 text-center text-[12px] leading-5">
          <p>กรุณานำใบรับผ้ามาแสดงเมื่อติดต่อรับผ้า</p>
          <p v-if="paymentSummary" class="mt-1">
            อ้างอิงการชำระเงิน {{ paymentSummary.paymentNo || paymentSummary.id }}
          </p>
        </section>
      </article>
    </template>
  </UDashboardPanel>
</template>

<style scoped>
.receipt-card {
  width: min(100%, 80mm);
}

.receipt-rule {
  border-top: 2px solid #000;
}

.receipt-dash {
  border-top: 2px dashed #000;
}

.receipt-info-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: start;
  gap: 12px;
}

.receipt-info-row > span:first-child {
  white-space: nowrap;
}

.receipt-info-row > span:last-child {
  min-width: 0;
  text-align: right;
  white-space: nowrap;
}

.receipt-item-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 36px 56px;
  align-items: start;
  gap: 8px;
}

.receipt-item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media print {
  .intake-actions {
    display: none !important;
  }

  .receipt-card {
    width: 80mm;
    max-width: 80mm;
    border: 0;
    box-shadow: none;
    margin: 0 auto;
    padding-left: 10px;
    padding-right: 10px;
  }

  :global(body) {
    background: #fff !important;
  }
}
</style>
