<script setup lang="ts">
import ThermalHeader from "~~/app/components/thermal/ThermalHeader.vue";
import ThermalTitle from "~~/app/components/thermal/ThermalTitle.vue";
import ThermalInfoRows from "~~/app/components/thermal/ThermalInfoRows.vue";
import { formatCurrency, formatDate, formatDateTime } from "~~/shared/utils/format";
import type { ReceiptPayload } from "~~/shared/types/receipt";

type ShopSettingLike = {
  name?: string;
  address?: string;
  phone?: string;
  logoUrl?: string | null;
  lineQrImageUrl?: string | null;
};

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
  isPackageIncluded?: boolean;
  isChargeable?: boolean;
};

const props = defineProps<{
  data: QuotationPayload;
  shop: ShopSettingLike | null;
}>();

const documentCode = computed(
  () => props.data.quotationNo || props.data.serviceOrder?.orderNo || `QT-${props.data.id.slice(-8).toUpperCase()}`,
);
const sellerName = computed(
  () => props.data.packageSale?.soldBy?.name ?? props.data.serviceOrder?.employee?.name ?? "-",
);
const customerName = computed(() => props.data.customer.name || props.data.customer.email || "-");

const lines = computed<ReceiptLineItem[]>(() => {
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
      subtitle: item.isPackageIncluded
        ? "รวมในแพ็กเกจ"
        : item.isChargeable === false
          ? "นอกแพ็กเกจ · ไม่คิดเงิน"
          : props.data.serviceOrder?.memberEntitlement
            ? "นอกแพ็กเกจ · คิดเงิน"
            : null,
      isWashFold: item.isWashFold,
      weightKg: item.weightKg,
      isPackageIncluded: item.isPackageIncluded,
      isChargeable: item.isChargeable,
    })) ?? []
  );
});

const washFoldInfo = computed(() => {
  const so = props.data.serviceOrder;
  if (!so?.weightKg) return null;
  return { weightKg: so.weightKg, pricePerKg: so.washFoldPricePerKg ?? 0, total: so.subtotalAmount };
});
const totalItemQuantity = computed(() => lines.value.reduce((sum, item) => sum + item.quantity, 0));
const subtotalAmount = computed(() => props.data.packageSale?.subtotalAmount ?? props.data.serviceOrder?.subtotalAmount ?? 0);
const discountAmount = computed(() => props.data.packageSale?.discountAmount ?? props.data.serviceOrder?.discountAmount ?? 0);
const hangerCharge = computed(() => props.data.serviceOrder?.hangerCharge ?? null);
const noteText = computed(
  () => props.data.note || props.data.packageSale?.note || props.data.serviceOrder?.note || null,
);
const memberEntitlement = computed(() => props.data.serviceOrder?.memberEntitlement ?? null);
const isMemberOrder = computed(() => Boolean(memberEntitlement.value));
const usageHistory = computed(() => props.data.serviceOrder?.usageHistory ?? []);
const totalUsedCredits = computed(() => usageHistory.value.reduce((sum, row) => sum + row.quantity, 0));
const addonUsages = computed(() => props.data.serviceOrder?.addonUsages ?? []);

const infoRows = computed(() => {
  const d = props.data;
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
  <article class="receipt-document">
    <ThermalHeader
      :name="shop?.name ?? ''"
      :address="shop?.address ?? ''"
      :phone="shop?.phone ?? ''"
      logo-url="/logo-saijai-phareab.png"
    />

    <ThermalTitle text="ใบแจ้งราคา" />

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
        <div v-for="item in lines" :key="item.id">
          <div class="item-row text-[22px]">
            <div class="min-w-0">
              <p class="item-name font-semibold">{{ item.name }}</p>
              <p v-if="item.subtitle" class="item-name mt-0.5 text-[18px] text-neutral-600">{{ item.subtitle }}</p>
            </div>
            <p class="text-right whitespace-nowrap">
              {{ item.isWashFold || item.isPackageIncluded || item.isChargeable === false ? "—" : formatCurrency(item.unitPrice) }}
            </p>
            <p class="text-right whitespace-nowrap">x{{ item.quantity }}</p>
            <p class="text-right whitespace-nowrap">
              {{ item.isWashFold ? "ชั่งกิโล" : item.isPackageIncluded ? `${item.quantity} เครดิต` : item.isChargeable === false ? "ไม่คิดเงิน" : formatCurrency(item.totalPrice) }}
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
      <div v-if="(hangerCharge?.providedCount ?? 0) > 0 && !washFoldInfo" class="summary-row">
        <span>ไม้แขวนที่ลูกค้าให้มา</span>
        <span>{{ hangerCharge?.providedCount ?? 0 }} ชิ้น</span>
      </div>
      <div v-if="hangerCharge && hangerCharge.count > 0 && !washFoldInfo" class="summary-row">
        <span>ซื้อไม้แขวนเพิ่ม</span>
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

    <template v-if="addonUsages.length">
      <div class="thermal-dash mt-3" />
      <section class="mt-3 space-y-1 text-[22px]">
        <p class="text-center text-[24px] font-bold">แพ็กเกจเสริม</p>
        <div v-for="usage in addonUsages" :key="usage.id" class="summary-row">
          <span class="wrap-break-word">{{ usage.productName }}</span>
          <span>{{ usage.isDelivery ? 'ใช้บริการ' : `${usage.credits} เครดิต` }}</span>
        </div>
      </section>
    </template>

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
        <span class="shrink-0 whitespace-nowrap">ยอดที่ต้องชำระ</span>
        <span class="shrink-0 whitespace-nowrap text-right">{{ formatCurrency(data.amount) }}</span>
      </div>
      <div class="mt-1 border-b-4 border-double border-black" />
    </section>

    <section v-if="data.paymentQr" class="mt-4 flex flex-col items-center gap-1 text-center">
      <img
        :src="data.paymentQr.imageDataUrl"
        :alt="`QR Code PromptPay ยอด ${formatCurrency(data.amount)}`"
        class="size-60 object-contain"
      >
      <p class="max-w-full text-[20px] leading-6 wrap-break-word">{{ data.paymentQr.caption }}</p>
    </section>

    <div class="thermal-dash mt-6" />

    <footer class="pt-4 text-center">
      <p class="text-[24px] font-bold">ขอบคุณที่ไว้วางใจใช้บริการ</p>
      <p class="mt-2 text-[20px] text-neutral-700">เอกสารนี้เป็นใบแจ้งราคาเท่านั้น</p>
      <p class="mt-1 text-[20px] text-neutral-700">ใบเสร็จจะออกให้เมื่อชำระเงินเรียบร้อยแล้ว</p>
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
.usage-header,
.usage-row {
  display: grid;
  grid-template-columns: 80px minmax(0, 1fr) 150px;
  align-items: start;
  gap: 10px;
  padding-block: 3px;
}
.grand-total-row { line-height: 1.35; }
</style>
