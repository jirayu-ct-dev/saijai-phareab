<script setup lang="ts">
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";

type ReceiptPayload = {
  id: string;
  paymentNo: string | null;
  receiptType: "PACKAGE" | "STOREFRONT";
  createdAt: string;
  paidAt: string | null;
  amount: number;
  paymentMethod: "CASH" | "TRANSFER";
  status: "PENDING" | "VERIFIED" | "FAILED";
  note: string | null;
  referenceNo: string | null;
  customer: {
    id: string;
    name: string | null;
    email: string;
    phoneNumber: string | null;
    image: string | null;
  };
  verifiedBy: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  packageSale: {
    id: string;
    status: string;
    note: string | null;
    subtotalAmount: number;
    discountAmount: number;
    totalAmount: number;
    soldBy: {
      id: string;
      name: string | null;
      email: string;
    } | null;
    items: Array<{
      id: string;
      name: string;
      type: "MAIN" | "ADDON";
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
  } | null;
  serviceOrder: {
    id: string;
    orderNo: string | null;
    status: string;
    note: string | null;
    receivedAt: string;
    dueAt: string | null;
    subtotalAmount: number;
    discountAmount: number;
    totalAmount: number;
    employee: {
      id: string;
      name: string | null;
      email: string;
    } | null;
    hangerCharge: {
      count: number;
      pricePerUnit: number;
      total: number;
    } | null;
    items: Array<{
      id: string;
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      notes: string | null;
    }>;
  } | null;
};

type ReceiptLineItem = {
  id: string;
  name: string;
  quantity: number;
  totalPrice: number;
  subtitle: string | null;
};

definePageMeta({
  layout: "admin",
  middleware: ["role-employee"],
});

const route = useRoute();
const paymentId = computed(() => String(route.params.id ?? ""));
const receiptElement = useTemplateRef<HTMLElement>("receiptElement");
const RECEIPT_EXPORT_WIDTH_PX = 302;

const SHOP_PROFILE = {
  name: "ร้านใส่ใจผ้าเรียบ",
  subtitle: "ซัก อบ รีด",
  address: "หน้าร้านบุรีรัมย์",
  phone: "เบอร์โทรศัพท์",
};

const { data, status, refresh, error } = await useFetch<ReceiptPayload>(() => `/api/admin/payments/${paymentId.value}/receipt`, {
  key: () => `payment-receipt-${paymentId.value}`,
});

const isLoading = computed(() => status.value === "pending");
const receiptCode = computed(() => data.value?.paymentNo || data.value?.referenceNo || `PAY-${paymentId.value.slice(-8).toUpperCase()}`);
const sellerName = computed(
  () => data.value?.packageSale?.soldBy?.name ?? data.value?.serviceOrder?.employee?.name ?? data.value?.verifiedBy?.name ?? "-",
);
const customerName = computed(() => data.value?.customer.name || data.value?.customer.email || "-");
const paymentMethodLabel = computed(() => (data.value?.paymentMethod === "TRANSFER" ? "โอน" : "เงินสด"));
const paymentStatusLabel = computed(() => {
  if (data.value?.status === "VERIFIED") return "ชำระเรียบร้อย";
  if (data.value?.status === "FAILED") return "ชำระไม่สำเร็จ";
  return "รอตรวจสอบ";
});
const receiptLines = computed<ReceiptLineItem[]>(() => {
  if (data.value?.packageSale) {
    return data.value.packageSale.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      subtitle: item.type === "MAIN" ? "แพ็กเกจหลัก" : "แพ็กเกจเสริม",
    }));
  }

  return data.value?.serviceOrder?.items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    totalPrice: item.totalPrice,
    subtitle: null,
  })) ?? [];
});
const totalItemQuantity = computed(() => receiptLines.value.reduce((sum, item) => sum + item.quantity, 0));
const subtotalAmount = computed(() => data.value?.packageSale?.subtotalAmount ?? data.value?.serviceOrder?.subtotalAmount ?? 0);
const discountAmount = computed(() => data.value?.packageSale?.discountAmount ?? data.value?.serviceOrder?.discountAmount ?? 0);
const hangerCharge = computed(() => data.value?.serviceOrder?.hangerCharge ?? null);
const noteText = computed(() => data.value?.note || data.value?.packageSale?.note || data.value?.serviceOrder?.note || null);
const goBack = () => {
  if (import.meta.client && window.history.length > 1) {
    window.history.back();
    return;
  }

  void navigateTo("/admin/payment");
};
const handlePrint = () => {
  if (import.meta.client) window.print();
};

const downloadPng = async () => {
  if (!import.meta.client || !receiptElement.value) return;

  const { toPng } = await import("html-to-image");

  const exportHost = document.createElement("div");
  exportHost.style.position = "fixed";
  exportHost.style.left = "-10000px";
  exportHost.style.top = "0";
  exportHost.style.width = `${RECEIPT_EXPORT_WIDTH_PX}px`;
  exportHost.style.padding = "0";
  exportHost.style.margin = "0";
  exportHost.style.background = "#ffffff";

  const receiptClone = receiptElement.value.cloneNode(true) as HTMLElement;
  receiptClone.style.width = `${RECEIPT_EXPORT_WIDTH_PX}px`;
  receiptClone.style.maxWidth = `${RECEIPT_EXPORT_WIDTH_PX}px`;
  receiptClone.style.margin = "0 auto";
  receiptClone.style.boxSizing = "border-box";

  exportHost.appendChild(receiptClone);
  document.body.appendChild(exportHost);

  const dataUrl = await toPng(receiptClone, {
    backgroundColor: "#ffffff",
    pixelRatio: 2,
    canvasWidth: RECEIPT_EXPORT_WIDTH_PX,
    skipFonts: true,
  });

  document.body.removeChild(exportHost);

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${receiptCode.value}.png`;
  link.click();
};

</script>

<template>
  <UDashboardPanel id="payment-receipt">
    <template #header>
      <UDashboardNavbar title="ใบเสร็จ" icon="i-lucide-receipt">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex receipt-actions" />
        </template>

        <template #right>
          <div class="receipt-actions flex items-center gap-2">
            <UButton label="กลับ" color="neutral" variant="outline" icon="i-lucide-arrow-left" @click="goBack" />
            <UButton label="บันทึก PNG" color="neutral" variant="outline" icon="i-lucide-image-down" @click="downloadPng" />
            <UButton label="พิมพ์ใบเสร็จ" color="neutral" icon="i-lucide-printer" @click="handlePrint" />
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
        <p class="text-base font-semibold text-highlighted">ไม่พบข้อมูลใบเสร็จ</p>
        <p class="mt-2 text-sm text-muted">รายการนี้อาจถูกลบหรือยังไม่พร้อมสำหรับพิมพ์</p>
        <div class="mt-4">
          <UButton label="ลองใหม่" color="neutral" variant="outline" @click="refresh()" />
        </div>
      </div>

      <article ref="receiptElement" v-else class="receipt-card mx-auto bg-white px-4 py-5 text-[13px] leading-5 text-black">
        <header class="text-center">
          <p class="text-[22px] font-bold leading-7">{{ SHOP_PROFILE.name }}</p>
          <p class="mt-1 text-[15px] font-semibold">{{ SHOP_PROFILE.subtitle }}</p>
          <p class="mt-1 text-[12px] leading-5">{{ SHOP_PROFILE.address }}</p>
          <p class="text-[12px] leading-5">{{ SHOP_PROFILE.phone }}</p>
        </header>

        <div class="receipt-rule mt-4" />

        <section class="pt-3 text-center">
          <p class="text-[18px] font-bold">ใบเสร็จรับเงิน</p>
        </section>

        <section class="mt-3 grid gap-1 text-[12px] leading-4">
          <div class="receipt-info-row">
            <span>เลขที่บิล:</span>
            <span class="text-right">{{ receiptCode }}</span>
          </div>
          <div v-if="data.serviceOrder?.orderNo" class="receipt-info-row">
            <span>เลขรับผ้า:</span>
            <span class="text-right">{{ data.serviceOrder.orderNo }}</span>
          </div>
          <div class="receipt-info-row">
            <span>วันที่:</span>
            <span class="text-right">{{ formatDateTime(data.createdAt) }}</span>
          </div>
          <div v-if="data.serviceOrder?.receivedAt" class="receipt-info-row">
            <span>วันที่รับ:</span>
            <span class="text-right">{{ formatDateTime(data.serviceOrder.receivedAt) }}</span>
          </div>
          <div v-if="data.serviceOrder?.dueAt" class="receipt-info-row">
            <span>วันนัดรับ:</span>
            <span class="text-right">{{ formatDateTime(data.serviceOrder.dueAt) }}</span>
          </div>
          <div v-if="data.paidAt" class="receipt-info-row">
            <span>วันที่ชำระ:</span>
            <span class="text-right">{{ formatDateTime(data.paidAt) }}</span>
          </div>
          <div class="receipt-info-row">
            <span>ประเภทการชำระ:</span>
            <span class="text-right">{{ paymentMethodLabel }}</span>
          </div>
          <div class="receipt-info-row">
            <span>สถานะ:</span>
            <span class="text-right">{{ paymentStatusLabel }}</span>
          </div>
          <div class="receipt-info-row">
            <span>ชื่อลูกค้า:</span>
            <span class="text-right">{{ customerName }}</span>
          </div>
          <div class="receipt-info-row">
            <span>พนักงาน:</span>
            <span class="text-right">{{ sellerName }}</span>
          </div>
          <div v-if="data.customer.phoneNumber" class="receipt-info-row">
            <span>โทร:</span>
            <span class="text-right">{{ data.customer.phoneNumber }}</span>
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
            <div v-for="item in receiptLines" :key="item.id">
              <div class="receipt-item-row text-[12px]">
                <div class="min-w-0">
                  <p class="receipt-item-name font-semibold leading-4">{{ item.name }}</p>
                  <p v-if="item.subtitle" class="receipt-item-subtitle mt-0.5 text-[11px] leading-4 text-neutral-600">{{ item.subtitle }}</p>
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
            <span>{{ totalItemQuantity }} ชิ้น</span>
          </div>
          <div v-if="hangerCharge" class="receipt-info-row">
            <span>รวมไม้แขวน</span>
            <span>{{ hangerCharge?.count ?? 0 }} ชิ้น</span>
          </div>
          <div class="receipt-info-row">
            <span>ราคา</span>
            <span>{{ formatCurrency(subtotalAmount) }}</span>
          </div>
          <div v-if="hangerCharge && hangerCharge.total > 0" class="receipt-info-row">
            <span>ค่าไม้แขวน</span>
            <span>{{ formatCurrency(hangerCharge.total) }}</span>
          </div>
          <div class="receipt-info-row">
            <span>ส่วนลด</span>
            <span>{{ formatCurrency(discountAmount) }}</span>
          </div>
          <div v-if="noteText" class="pt-1 text-[11px] leading-4 text-neutral-700">
            <p class="font-semibold">หมายเหตุ</p>
            <p class="mt-1 wrap-break-word">{{ noteText }}</p>
          </div>
        </section>

        <div class="receipt-rule mt-4" />

        <section class="mt-3">
          <div class="flex items-end justify-between gap-4 text-[16px] font-bold leading-5">
            <span class="shrink-0 whitespace-nowrap">รวมทั้งสิ้น</span>
            <span class="shrink-0 whitespace-nowrap text-right">{{ formatCurrency(data.amount) }}</span>
          </div>
          <div class="mt-1 border-b-4 border-double border-black" />
        </section>

        <div class="receipt-dash mt-6" />

        <footer class="pt-4 text-center text-[13px]">
          <p>ขอบคุณที่ใช้บริการ</p>
        </footer>
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

.receipt-item-name,
.receipt-item-subtitle {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media print {
  .receipt-actions {
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
