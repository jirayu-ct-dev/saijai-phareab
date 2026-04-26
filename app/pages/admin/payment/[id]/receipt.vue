<script setup lang="ts">
import ThermalSlip from "~~/app/components/admin/thermal/ThermalSlip.vue";
import ThermalHeader from "~~/app/components/admin/thermal/ThermalHeader.vue";
import ThermalTitle from "~~/app/components/admin/thermal/ThermalTitle.vue";
import ThermalInfoRows from "~~/app/components/admin/thermal/ThermalInfoRows.vue";
import ThermalLineQr from "~~/app/components/admin/thermal/ThermalLineQr.vue";
import { formatCurrency, formatDate, formatDateTime } from "~~/shared/utils/format";

type ReceiptPayload = {
  id: string;
  paymentNo: string | null;
  receiptType: "PACKAGE" | "STOREFRONT";
  createdAt: string;
  paidAt: string | null;
  amount: number;
  paymentMethod: "CASH" | "TRANSFER";
  note: string | null;
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
      isPackageIncluded: boolean;
    }>;
    creditUsed: number;
    usageHistory: Array<{
      sessionIndex: number;
      orderId: string;
      orderNo: string | null;
      receivedAt: string;
      quantity: number;
      isCurrent: boolean;
    }>;
    memberEntitlement: {
      id: string;
      productName: string;
      creditInitial: number;
      creditRemaining: number;
      endAt: string | null;
    } | null;
  } | null;
};

type ReceiptLineItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  subtitle: string | null;
};

definePageMeta({
  layout: "admin",
  middleware: ["role-employee"],
});

const route = useRoute();
const paymentId = computed(() => String(route.params.id ?? ""));

const { settings: shopSettings } = useAdminShopSettings();

const { data, status, refresh, error } = await useFetch<ReceiptPayload>(() => `/api/admin/payments/${paymentId.value}/receipt`, {
  key: () => `payment-receipt-${paymentId.value}`,
});

const isLoading = computed(() => status.value === "pending");
const hasError = computed(() => Boolean(error.value) || !data.value);
const receiptCode = computed(() => data.value?.paymentNo || `PAY-${paymentId.value.slice(-8).toUpperCase()}`);
const sellerName = computed(
  () => data.value?.packageSale?.soldBy?.name ?? data.value?.serviceOrder?.employee?.name ?? data.value?.verifiedBy?.name ?? "-",
);
const customerName = computed(() => data.value?.customer.name || data.value?.customer.email || "-");
const receiptLines = computed<ReceiptLineItem[]>(() => {
  if (data.value?.packageSale) {
    return data.value.packageSale.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      subtitle: item.type === "MAIN" ? "แพ็กเกจหลัก" : "แพ็กเกจเสริม",
    }));
  }

  return data.value?.serviceOrder?.items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    subtitle: null,
  })) ?? [];
});
const totalItemQuantity = computed(() => receiptLines.value.reduce((sum, item) => sum + item.quantity, 0));
const subtotalAmount = computed(() => data.value?.packageSale?.subtotalAmount ?? data.value?.serviceOrder?.subtotalAmount ?? 0);
const discountAmount = computed(() => data.value?.packageSale?.discountAmount ?? data.value?.serviceOrder?.discountAmount ?? 0);
const hangerCharge = computed(() => data.value?.serviceOrder?.hangerCharge ?? null);
const noteText = computed(() => data.value?.note || data.value?.packageSale?.note || data.value?.serviceOrder?.note || null);
const memberEntitlement = computed(() => data.value?.serviceOrder?.memberEntitlement ?? null);
const isMemberOrder = computed(() => Boolean(memberEntitlement.value));
const isMemberFreeOrder = computed(
  () => isMemberOrder.value && Number(data.value?.amount ?? 0) === 0,
);
const receiptTitle = computed(() => {
  if (data.value?.receiptType === "PACKAGE") return "ใบเสร็จรับเงิน";
  if (isMemberFreeOrder.value) return "ใบแจ้งการใช้บริการ";
  return "ใบเสร็จรับเงิน";
});
const creditUsed = computed(() => data.value?.serviceOrder?.creditUsed ?? 0);
const usageHistory = computed(() => data.value?.serviceOrder?.usageHistory ?? []);
const totalUsedCredits = computed(() => usageHistory.value.reduce((sum, row) => sum + row.quantity, 0));

const infoRows = computed(() => {
  const d = data.value;
  if (!d) return [];
  const isServiceOrder = Boolean(d.serviceOrder);
  return [
    { label: "เลขที่บิล", value: receiptCode.value },
    { label: "เลขรับผ้า", value: d.serviceOrder?.orderNo ?? null },
    { label: "วันที่", value: formatDateTime(d.createdAt), show: !isServiceOrder },
    { label: "วันที่รับผ้า", value: d.serviceOrder?.receivedAt ? formatDateTime(d.serviceOrder.receivedAt) : null },
    {
      label: "วันนัดรับ",
      value: d.serviceOrder?.status === "COMPLETED"
        ? null
        : (d.serviceOrder?.dueAt ? formatDateTime(d.serviceOrder.dueAt) : "ไม่ระบุ"),
      show: isServiceOrder && d.serviceOrder?.status !== "COMPLETED",
    },
    {
      label: "วันที่ส่งผ้า",
      value: (() => {
        const date = d.paidAt ?? d.serviceOrder?.dueAt ?? null;
        return date ? formatDateTime(date) : "ไม่ระบุ";
      })(),
      show: isServiceOrder && d.serviceOrder?.status === "COMPLETED",
    },
    { label: "แพ็กเกจ", value: memberEntitlement.value?.productName ?? null, show: isMemberOrder.value },
    { label: "รูปแบบ", value: "แพ็กเกจรายเดือน", show: isMemberOrder.value },
    { label: "ชื่อลูกค้า", value: customerName.value },
    { label: "พนักงาน", value: sellerName.value },
    { label: "โทร", value: d.customer.phoneNumber },
  ];
});
</script>

<template>
  <ThermalSlip
    panel-id="payment-receipt"
    navbar-title="ใบเสร็จ"
    navbar-icon="i-lucide-receipt"
    :file-name="receiptCode"
    :is-loading="isLoading"
    :has-error="hasError"
    fallback-path="/admin/payment"
    empty-title="ไม่พบข้อมูลใบเสร็จ"
    print-label="พิมพ์ใบเสร็จ"
    @retry="refresh()"
  >
    <template v-if="data">
      <ThermalHeader
        :name="shopSettings?.name ?? ''"
        :address="shopSettings?.address ?? ''"
        :phone="shopSettings?.phone ?? ''"
        :logo-url="shopSettings?.logoUrl"
      />

      <ThermalTitle :text="receiptTitle" />

      <div class="mt-3">
        <ThermalInfoRows :rows="infoRows" />
      </div>

      <div class="thermal-dash mt-3" />

      <section class="mt-2">
        <div class="item-row text-[12px] font-bold">
          <p class="min-w-0">รายการ</p>
          <p class="text-right whitespace-nowrap">ราคา/ชิ้น</p>
          <p class="text-right whitespace-nowrap">จำนวน</p>
          <p class="text-right whitespace-nowrap">รวม</p>
        </div>

        <div class="thermal-dash mt-1" />

        <div class="mt-2 space-y-2">
          <div v-for="item in receiptLines" :key="item.id">
            <div class="item-row text-[12px]">
              <div class="min-w-0">
                <p class="item-name font-semibold leading-4">{{ item.name }}</p>
                <p v-if="item.subtitle" class="item-name mt-0.5 text-[11px] leading-4 text-neutral-600">{{ item.subtitle }}</p>
              </div>
              <p class="text-right whitespace-nowrap">
                {{ isMemberOrder && item.unitPrice === 0 ? "-" : formatCurrency(item.unitPrice) }}
              </p>
              <p class="text-right whitespace-nowrap">x{{ item.quantity }}</p>
              <p class="text-right whitespace-nowrap">
                {{ isMemberOrder && item.totalPrice === 0 ? `${item.quantity} เครดิต` : formatCurrency(item.totalPrice) }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div class="thermal-dash mt-3" />

      <section class="mt-3 space-y-1 text-[12px] leading-4">
        <div class="summary-row">
          <span>รวมจำนวนรายการ</span>
          <span>{{ totalItemQuantity }} ชิ้น</span>
        </div>
        <div v-if="hangerCharge" class="summary-row">
          <span>รวมไม้แขวน</span>
          <span>{{ hangerCharge?.count ?? 0 }} ชิ้น</span>
        </div>
        <div class="summary-row">
          <span>ราคา</span>
          <span>{{ formatCurrency(subtotalAmount) }}</span>
        </div>
        <div v-if="hangerCharge && hangerCharge.total > 0" class="summary-row">
          <span>ค่าไม้แขวน</span>
          <span>{{ formatCurrency(hangerCharge.total) }}</span>
        </div>
        <div class="summary-row">
          <span>ส่วนลด</span>
          <span>{{ formatCurrency(discountAmount) }}</span>
        </div>
        <div v-if="noteText" class="pt-1 text-[11px] leading-4 text-neutral-700">
          <p class="font-semibold">หมายเหตุ</p>
          <p class="mt-1 wrap-break-word">{{ noteText }}</p>
        </div>
      </section>

      <template v-if="isMemberOrder && memberEntitlement">
        <div class="thermal-rule mt-4" />
        <section class="mt-3">
          <p class="text-center text-[13px] font-bold">สรุปการใช้บริการ</p>
          <div class="thermal-dash mt-2" />

          <div class="usage-header mt-2 text-[12px] font-bold">
            <p class="text-left whitespace-nowrap">ครั้งที่</p>
            <p class="min-w-0 text-left">วันที่ใช้บริการ</p>
            <p class="text-right whitespace-nowrap">จำนวน(ชิ้น)</p>
          </div>
          <div class="thermal-dash mt-1" />

          <div class="mt-2 space-y-1">
            <div
              v-for="row in usageHistory"
              :key="row.orderId"
              class="usage-row text-[12px]"
            >
              <p class="text-left whitespace-nowrap">
                {{ row.sessionIndex }}<span v-if="row.isCurrent">*</span>
              </p>
              <p class="min-w-0 truncate">{{ formatDate(row.receivedAt) }}</p>
              <p class="text-right whitespace-nowrap">{{ row.quantity }}</p>
            </div>
          </div>

          <div class="thermal-dash mt-2" />

          <div class="usage-row mt-1 text-[12px] font-semibold">
            <p />
            <p class="text-left">รวม</p>
            <p class="text-right">{{ totalUsedCredits }}</p>
          </div>
          <div class="usage-row mt-1 text-[12px] font-semibold">
            <p />
            <p class="text-left">คงเหลือ(เครดิต)</p>
            <p class="text-right">
              {{ memberEntitlement.creditRemaining }}/{{ memberEntitlement.creditInitial }}
            </p>
          </div>
          <div v-if="memberEntitlement.endAt" class="usage-row mt-1 text-[12px]">
            <p />
            <p class="text-left">หมดอายุ</p>
            <p class="text-right whitespace-nowrap">{{ formatDate(memberEntitlement.endAt) }}</p>
          </div>
        </section>
      </template>

      <div class="thermal-rule mt-4" />

      <section class="mt-3">
        <div class="flex items-end justify-between gap-4 text-[16px] font-bold leading-5">
          <span class="shrink-0 whitespace-nowrap">รวมทั้งสิ้น</span>
          <span class="shrink-0 whitespace-nowrap text-right">
            {{ isMemberFreeOrder ? "ใช้สิทธิ์แพ็กเกจ" : formatCurrency(data.amount) }}
          </span>
        </div>
        <div class="mt-1 border-b-4 border-double border-black" />
      </section>

      <div class="mt-4 flex flex-col items-center">
        <ThermalLineQr :image-url="shopSettings?.lineQrImageUrl" />
      </div>

      <div class="thermal-dash mt-6" />

      <footer class="pt-4 text-center text-[13px]">
        <p>ขอบคุณที่ใช้บริการ</p>
      </footer>
    </template>
  </ThermalSlip>
</template>

<style scoped>
.thermal-rule {
  border-top: 2px solid #000;
}

.thermal-dash {
  border-top: 2px dashed #000;
}

.item-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 52px 36px 56px;
  align-items: start;
  gap: 6px;
}

.item-name {
  overflow: hidden;
  text-overflow: ellipsis;
  
}

.summary-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: start;
  gap: 12px;
}

.summary-row > span:first-child {
  white-space: nowrap;
}

.summary-row > span:last-child {
  min-width: 0;
  text-align: right;
  white-space: nowrap;
}

.usage-header,
.usage-row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr) 85px;
  align-items: start;
  gap: 6px;
}
</style>
