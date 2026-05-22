<script setup lang="ts">
import ThermalHeader from "~~/app/components/thermal/ThermalHeader.vue";
import ThermalTitle from "~~/app/components/thermal/ThermalTitle.vue";
import ThermalInfoRows from "~~/app/components/thermal/ThermalInfoRows.vue";
import ThermalLineQr from "~~/app/components/thermal/ThermalLineQr.vue";
import { formatCurrency, formatDate, formatDateTime } from "~~/shared/utils/format";
import type { ReceiptPayload } from "~~/shared/types/receipt";
import { paymentMethodLabels } from "~~/shared/config/paymentConfig";
import type { PaymentMethod } from "~~/shared/types/enums";

type ShopSettingLike = {
  name?: string;
  address?: string;
  phone?: string;
  logoUrl?: string | null;
  lineQrImageUrl?: string | null;
};

type ReceiptExtras = {
  method?: PaymentMethod | null;
  receiptNo?: string | null;
  confirmedAt?: string | null;
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

const props = defineProps<{
  data: ReceiptPayload;
  shop: ShopSettingLike | null;
}>();

const extras = computed<ReceiptExtras>(() => props.data as unknown as ReceiptExtras);
const receiptCode = computed(
  () => extras.value.receiptNo || props.data.paymentNo || `RC-${props.data.id.slice(-8).toUpperCase()}`,
);
const paymentMethod = computed<PaymentMethod | null>(() => extras.value.method ?? null);
const paymentMethodLabel = computed(() =>
  paymentMethod.value ? paymentMethodLabels[paymentMethod.value] : null,
);
const sellerName = computed(
  () => props.data.packageSale?.soldBy?.name ?? props.data.serviceOrder?.employee?.name ?? "-",
);
const customerName = computed(() => props.data.customer.name || props.data.customer.email || "-");

const receiptLines = computed<ReceiptLineItem[]>(() => {
  if (props.data.packageSale) {
    return props.data.packageSale.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      subtitle: item.type === "MAIN" ? "แพ็กเกจหลัก" : "แพ็กเกจเสริม",
    }));
  }
  return (
    props.data.serviceOrder?.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: item.totalPrice,
      subtitle: null,
      isWashFold: item.isWashFold,
      weightKg: item.weightKg,
    })) ?? []
  );
});

const washFoldInfo = computed(() => {
  const so = props.data.serviceOrder;
  if (!so?.weightKg) return null;
  return { weightKg: so.weightKg, pricePerKg: so.washFoldPricePerKg ?? 0, total: so.subtotalAmount };
});
const totalItemQuantity = computed(() => receiptLines.value.reduce((sum, item) => sum + item.quantity, 0));
const subtotalAmount = computed(() => props.data.packageSale?.subtotalAmount ?? props.data.serviceOrder?.subtotalAmount ?? 0);
const discountAmount = computed(() => props.data.packageSale?.discountAmount ?? props.data.serviceOrder?.discountAmount ?? 0);
const hangerCharge = computed(() => props.data.serviceOrder?.hangerCharge ?? null);
const noteText = computed(
  () => props.data.note || props.data.packageSale?.note || props.data.serviceOrder?.note || null,
);
const memberEntitlement = computed(() => props.data.serviceOrder?.memberEntitlement ?? null);
const isMemberOrder = computed(() => Boolean(memberEntitlement.value));
const isMemberFreeOrder = computed(() => isMemberOrder.value && Number(props.data.amount ?? 0) === 0);
const receiptTitle = computed(() => {
  if (props.data.receiptType === "PACKAGE") return "ใบเสร็จรับเงิน";
  if (isMemberFreeOrder.value) return "ใบแจ้งการใช้บริการ";
  return "ใบเสร็จรับเงิน";
});
const usageHistory = computed(() => props.data.serviceOrder?.usageHistory ?? []);
const totalUsedCredits = computed(() => usageHistory.value.reduce((sum, row) => sum + row.quantity, 0));

const infoRows = computed(() => {
  const d = props.data;
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
        const date = d.serviceOrder?.deliveredAt ?? d.paidAt ?? d.serviceOrder?.dueAt ?? null;
        return date ? formatDateTime(date) : "ไม่ระบุ";
      })(),
      show: isServiceOrder && d.serviceOrder?.status === "COMPLETED",
    },
    { label: "แพ็กเกจ", value: memberEntitlement.value?.productName ?? null, show: isMemberOrder.value },
    { label: "รูปแบบ", value: "แพ็กเกจรายเดือน", show: isMemberOrder.value },
    { label: "ชื่อลูกค้า", value: customerName.value },
    { label: "พนักงาน", value: sellerName.value },
    { label: "โทร", value: d.customer.phoneNumber },
    {
      label: "ช่องทางการชำระเงิน",
      value: paymentMethodLabel.value,
      show: !isMemberFreeOrder.value && Boolean(paymentMethodLabel.value),
    },
    {
      label: "วันที่ชำระเงิน",
      value: extras.value.confirmedAt
        ? formatDateTime(extras.value.confirmedAt)
        : (d.paidAt ? formatDateTime(d.paidAt) : null),
      show: !isMemberFreeOrder.value,
    },
  ];
});
</script>

<template>
  <article class="receipt-document">
    <ThermalHeader
      :name="shop?.name ?? ''"
      :address="shop?.address ?? ''"
      :phone="shop?.phone ?? ''"
      :logo-url="shop?.logoUrl"
    />

    <ThermalTitle :text="receiptTitle" />

    <div class="mt-3">
      <ThermalInfoRows :rows="infoRows" />
    </div>

    <div class="thermal-dash mt-3" />

    <section class="mt-2">
      <div class="item-row text-[22px] font-bold">
        <p class="min-w-0">รายการ</p>
        <p class="text-right whitespace-nowrap">ราคา/ชิ้น</p>
        <p class="text-right whitespace-nowrap">จำนวน</p>
        <p class="text-right whitespace-nowrap">รวม</p>
      </div>
      <div class="thermal-dash mt-1" />
      <div class="mt-1 space-y-1">
        <div v-for="item in receiptLines" :key="item.id">
          <div class="item-row text-[22px]">
            <div class="min-w-0">
              <p class="item-name font-semibold">{{ item.name }}</p>
              <p v-if="item.subtitle" class="item-name mt-0.5 text-[18px] text-neutral-600">{{ item.subtitle }}</p>
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

    <section class="mt-3 space-y-1 text-[22px]">
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
      <div v-if="noteText" class="pt-1 text-[18px] leading-relaxed text-neutral-700">
        <p class="font-semibold">หมายเหตุ</p>
        <p class="mt-1 wrap-break-word">{{ noteText }}</p>
      </div>
    </section>

    <template v-if="isMemberOrder && memberEntitlement">
      <div class="thermal-rule mt-4" />
      <section class="mt-3">
        <p class="text-center text-[26px] font-bold">สรุปการใช้บริการ</p>
        <div class="thermal-dash mt-2" />
        <div class="usage-header mt-2 text-[22px] font-bold">
          <p class="text-left whitespace-nowrap">ครั้งที่</p>
          <p class="min-w-0 text-left">วันที่ใช้บริการ</p>
          <p class="text-right whitespace-nowrap">จำนวน(ชิ้น)</p>
        </div>
        <div class="thermal-dash mt-1" />
        <div class="mt-2 space-y-1">
          <div v-for="row in usageHistory" :key="row.orderId" class="usage-row text-[22px]">
            <p class="text-left whitespace-nowrap">
              {{ row.sessionIndex }}<span v-if="row.isCurrent">*</span>
            </p>
            <p class="min-w-0 truncate">{{ formatDate(row.receivedAt) }}</p>
            <p class="text-right whitespace-nowrap">{{ row.quantity }}</p>
          </div>
        </div>
        <div class="thermal-dash mt-2" />
        <div class="usage-row mt-1 text-[22px] font-semibold">
          <p />
          <p class="text-left">รวม</p>
          <p class="text-right">{{ totalUsedCredits }}</p>
        </div>
        <div class="usage-row mt-1 text-[22px] font-semibold">
          <p />
          <p class="text-left">คงเหลือ(เครดิต)</p>
          <p class="text-right">
            {{ memberEntitlement.creditRemaining }}/{{ memberEntitlement.creditInitial }}
          </p>
        </div>
        <div v-if="memberEntitlement.endAt" class="usage-row mt-1 text-[22px]">
          <p />
          <p class="text-left">หมดอายุ</p>
          <p class="text-right whitespace-nowrap">{{ formatDate(memberEntitlement.endAt) }}</p>
        </div>
      </section>
    </template>

    <div class="thermal-rule mt-4" />

    <section class="mt-3">
      <div class="grand-total-row flex items-end justify-between gap-4 text-[36px] font-bold">
        <span class="shrink-0 whitespace-nowrap">รวมทั้งสิ้น</span>
        <span class="shrink-0 whitespace-nowrap text-right">
          {{ isMemberFreeOrder ? "ใช้สิทธิ์แพ็กเกจ" : formatCurrency(data.amount) }}
        </span>
      </div>
      <div class="mt-1 border-b-4 border-double border-black" />
    </section>

    <div class="mt-4 flex flex-col items-center">
      <ThermalLineQr :image-url="shop?.lineQrImageUrl" />
    </div>

    <div class="thermal-dash mt-6" />

    <footer class="pt-4 text-center">
      <p class="text-[28px] font-bold">ขอบคุณที่ใช้บริการ</p>
      <p class="mt-2 text-[22px]">แล้วพบกันใหม่ค่ะ</p>
      <p class="mt-3 text-[18px] text-neutral-700">โปรดเก็บใบเสร็จไว้เป็นหลักฐาน</p>
    </footer>
  </article>
</template>

<style scoped>
.receipt-document {
  width: 100%;
  background: #ffffff;
  color: #000000;
  padding: 20px 14px;
  font-size: 22px;
  line-height: 1.7;
  font-weight: 500;
}
.receipt-document section { margin-bottom: 6px; }
.thermal-rule { border-top: 4px solid #000; margin-block: 6px; }
.thermal-dash { border-top: 4px dashed #000; margin-block: 6px; }
.item-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 100px 64px 110px;
  align-items: start;
  gap: 10px;
  padding-block: 0.1px;
}
.item-name {
  line-height: 1.45;
  overflow-wrap: anywhere;
  word-break: normal;
}
/* Summary block (รวมจำนวน, ราคา, ส่วนลด, VAT, ค่าไม้แขวน) — compact: short
   number rows don't need the breathable spacing items use. */
.summary-row {
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr);
  align-items: start;
  gap: 16px;
  line-height: 1.4;
}
.summary-row + .summary-row { margin-top: 2px; }
.summary-row > span:first-child { white-space: nowrap; }
.summary-row > span:last-child { min-width: 0; text-align: right; white-space: nowrap; }
.grand-total-row { line-height: 1.35; }
.usage-header,
.usage-row {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr) 150px;
  align-items: start;
  gap: 10px;
  padding-block: 3px;
}
</style>
