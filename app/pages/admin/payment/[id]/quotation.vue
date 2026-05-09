<script setup lang="ts">
import ThermalSlip from "~~/app/components/admin/thermal/ThermalSlip.vue";
import ThermalHeader from "~~/app/components/admin/thermal/ThermalHeader.vue";
import ThermalTitle from "~~/app/components/admin/thermal/ThermalTitle.vue";
import ThermalInfoRows from "~~/app/components/admin/thermal/ThermalInfoRows.vue";
import ThermalLineQr from "~~/app/components/admin/thermal/ThermalLineQr.vue";
import { formatCurrency, formatDate, formatDateTime } from "~~/shared/utils/format";
import type { ReceiptPayload } from "~~/shared/types/receipt";
import { buildRasterBytes } from "~~/app/composables/useRasterReceipt";
type QuotationPayload = ReceiptPayload & {
  receiptNo: string | null;
  quotationNo: string | null;
};

type ReceiptLineItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  subtitle: string | null;
  isWashFold?: boolean;
  weightKg?: number | null;
};

definePageMeta({
  layout: "admin",
  middleware: ["role-employee"],
});

const route = useRoute();
const paymentId = computed(() => String(route.params.id ?? ""));

const { settings: shopSettings } = useAdminShopSettings();

const { data, status, refresh, error } = await useFetch<QuotationPayload>(
  () => `/api/admin/payments/${paymentId.value}/quotation`,
  { key: () => `payment-quotation-${paymentId.value}` },
);

const isLoading = computed(() => status.value === "pending");
const hasError = computed(() => Boolean(error.value) || !data.value);
const documentCode = computed(
  () => data.value?.quotationNo || data.value?.serviceOrder?.orderNo || `QT-${paymentId.value.slice(-8).toUpperCase()}`,
);
const sellerName = computed(
  () => data.value?.packageSale?.soldBy?.name ?? data.value?.serviceOrder?.employee?.name ?? "-",
);
const customerName = computed(() => data.value?.customer.name || data.value?.customer.email || "-");
const lines = computed<ReceiptLineItem[]>(() => {
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
    isWashFold: item.isWashFold,
    weightKg: item.weightKg,
  })) ?? [];
});

const washFoldInfo = computed(() => {
  const so = data.value?.serviceOrder;
  if (!so?.weightKg) return null;
  return { weightKg: so.weightKg, pricePerKg: so.washFoldPricePerKg ?? 0, total: so.subtotalAmount };
});
const totalItemQuantity = computed(() => lines.value.reduce((sum, item) => sum + item.quantity, 0));
const subtotalAmount = computed(() => data.value?.packageSale?.subtotalAmount ?? data.value?.serviceOrder?.subtotalAmount ?? 0);
const discountAmount = computed(() => data.value?.packageSale?.discountAmount ?? data.value?.serviceOrder?.discountAmount ?? 0);
const hangerCharge = computed(() => data.value?.serviceOrder?.hangerCharge ?? null);
const noteText = computed(() => data.value?.note || data.value?.packageSale?.note || data.value?.serviceOrder?.note || null);
const memberEntitlement = computed(() => data.value?.serviceOrder?.memberEntitlement ?? null);
const isMemberOrder = computed(() => Boolean(memberEntitlement.value));

const notify = useNotify();
const { state: printerState, send } = useThermalPrinter();

const slipRef = ref<{ getPrintElement: () => HTMLElement | null } | null>(null);

async function handleEscPosPrint() {
  if (!data.value) return;
  try {
    const el = slipRef.value?.getPrintElement();
    if (!el) throw new Error("ยังไม่พร้อมพิมพ์ — กรุณาลองใหม่");
    const bytes = await buildRasterBytes(el, printerState.value.paperWidth);
    await send(bytes);
    notify.success("ส่งงานพิมพ์เรียบร้อย");
  } catch (e) {
    notify.error(e instanceof Error ? e.message : "เกิดข้อผิดพลาดในการพิมพ์");
  }
}

const infoRows = computed(() => {
  const d = data.value;
  if (!d) return [];
  const isServiceOrder = Boolean(d.serviceOrder);
  return [
    { label: "เลขที่ใบแจ้งราคา", value: documentCode.value },
    { label: "เลขรับผ้า", value: d.serviceOrder?.orderNo ?? null },
    { label: "วันที่ออก", value: formatDateTime(d.createdAt) },
    { label: "วันที่รับผ้า", value: d.serviceOrder?.receivedAt ? formatDateTime(d.serviceOrder.receivedAt) : null, show: isServiceOrder },
    {
      label: "วันนัดรับ",
      value: d.serviceOrder?.dueAt ? formatDateTime(d.serviceOrder.dueAt) : "ไม่ระบุ",
      show: isServiceOrder,
    },
    { label: "แพ็กเกจ", value: memberEntitlement.value?.productName ?? null, show: isMemberOrder.value },
    { label: "ชื่อลูกค้า", value: customerName.value },
    { label: "พนักงาน", value: sellerName.value },
    { label: "โทร", value: d.customer.phoneNumber },
  ];
});
</script>

<template>
  <ThermalSlip
    ref="slipRef"
    panel-id="payment-quotation"
    navbar-title="ใบแจ้งราคา"
    navbar-icon="i-lucide-file-text"
    :file-name="documentCode"
    :is-loading="isLoading"
    :has-error="hasError"
    fallback-path="/admin/payment"
    empty-title="ไม่พบใบแจ้งราคา"
    print-label="พิมพ์ใบแจ้งราคา"
    @retry="refresh()"
    @print="handleEscPosPrint"
  >
    <template v-if="data">
      <ThermalHeader
        :name="shopSettings?.name ?? ''"
        :address="shopSettings?.address ?? ''"
        :phone="shopSettings?.phone ?? ''"
        :logo-url="shopSettings?.logoUrl"
      />

      <ThermalTitle text="ใบแจ้งราคา" />

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
          <div v-for="item in lines" :key="item.id">
            <div class="item-row text-[12px]">
              <div class="min-w-0">
                <p class="item-name font-semibold leading-4">{{ item.name }}</p>
                <p v-if="item.subtitle" class="item-name mt-0.5 text-[11px] leading-4 text-neutral-600">{{ item.subtitle }}</p>
              </div>
              <p class="text-right whitespace-nowrap">
                {{ item.isWashFold ? "—" : (isMemberOrder && item.unitPrice === 0 ? "-" : formatCurrency(item.unitPrice)) }}
              </p>
              <p class="text-right whitespace-nowrap">x{{ item.quantity }}</p>
              <p class="text-right whitespace-nowrap">
                {{ item.isWashFold ? "ชั่งกิโล" : (isMemberOrder && item.totalPrice === 0 ? `${item.quantity} เครดิต` : formatCurrency(item.totalPrice)) }}
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
        <div v-if="washFoldInfo" class="summary-row">
          <span>ซัก-พับ ชั่งกิโล</span>
          <span>{{ washFoldInfo.weightKg.toFixed(1) }} กก. × {{ formatCurrency(washFoldInfo.pricePerKg) }}</span>
        </div>
        <div v-if="hangerCharge && !washFoldInfo" class="summary-row">
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
        <template v-if="data.vat">
          <div class="summary-row">
            <span>{{ data.vat.included ? `ราคารวม VAT ${data.vat.rate}% แล้ว` : `ราคาก่อน VAT` }}</span>
            <span>{{ formatCurrency(data.vat.baseAmount) }}</span>
          </div>
          <div class="summary-row">
            <span>VAT {{ data.vat.rate }}%</span>
            <span>{{ formatCurrency(data.vat.amount) }}</span>
          </div>
        </template>
        <div v-if="noteText" class="pt-1 text-[11px] leading-4 text-neutral-700">
          <p class="font-semibold">หมายเหตุ</p>
          <p class="mt-1 wrap-break-word">{{ noteText }}</p>
        </div>
      </section>

      <div class="thermal-rule mt-4" />

      <section class="mt-3">
        <div class="flex items-end justify-between gap-4 text-[16px] font-bold leading-5">
          <span class="shrink-0 whitespace-nowrap">ยอดที่ต้องชำระ</span>
          <span class="shrink-0 whitespace-nowrap text-right">{{ formatCurrency(data.amount) }}</span>
        </div>
        <div class="mt-1 border-b-4 border-double border-black" />
      </section>

      <div class="mt-4 flex flex-col items-center">
        <ThermalLineQr :image-url="shopSettings?.lineQrImageUrl" />
      </div>

      <div class="thermal-dash mt-6" />

      <footer class="pt-4 text-center text-[12px] text-neutral-700">
        <p>เอกสารนี้เป็นใบแจ้งราคาเท่านั้น ใบเสร็จจะออกเมื่อยืนยันการชำระเงินแล้ว</p>
      </footer>
    </template>
  </ThermalSlip>
</template>

<style scoped>
.thermal-rule { border-top: 2px solid #000; }
.thermal-dash { border-top: 2px dashed #000; }
.item-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 52px 36px 56px;
  align-items: start;
  gap: 6px;
}
.item-name { overflow: hidden; text-overflow: ellipsis; }
.summary-row {
  display: grid;
  grid-template-columns: 88px minmax(0, 1fr);
  align-items: start;
  gap: 12px;
}
.summary-row > span:first-child { white-space: nowrap; }
.summary-row > span:last-child { min-width: 0; text-align: right; white-space: nowrap; }
</style>
