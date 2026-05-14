<script setup lang="ts">
import ThermalSlip from "~~/app/components/admin/thermal/ThermalSlip.vue";
import QuotationDocument from "~~/app/components/print/QuotationDocument.vue";
import EditPaymentStateModal from "~~/app/components/admin/payment/EditPaymentStateModal.vue";
import type { ReceiptPayload } from "~~/shared/types/receipt";
import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";

definePageMeta({ layout: "admin", middleware: ["role-employee"] });

type QuotationPayload = ReceiptPayload & { receiptNo: string | null; quotationNo: string | null };

type PaymentTarget = {
  id: string;
  paymentNo: string | null;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod | null;
  slipImage: { id: string; url: string | null; secureUrl: string | null } | null;
};

const route = useRoute();
const paymentId = computed(() => String(route.params.id ?? ""));
const notify = useNotify();
const { settings: shopSettings } = useAdminShopSettings();
const { state: printerState, send } = useThermalPrinter();

const { data, status, refresh, error } = await useFetch<QuotationPayload>(
  () => `/api/admin/payments/${paymentId.value}/quotation`,
  { key: () => `payment-quotation-${paymentId.value}` },
);

const isLoading = computed(() => status.value === "pending");
const hasError = computed(() => Boolean(error.value) || !data.value);
const documentCode = computed(
  () => data.value?.quotationNo || data.value?.serviceOrder?.orderNo || `QT-${paymentId.value.slice(-8).toUpperCase()}`,
);

const isDownloadingPdf = ref(false);
const isDownloadingPng = ref(false);
const isPrinting = ref(false);

async function fetchDocument(format: "pdf" | "png" | "escpos") {
  const width = printerState.value.paperWidth === 58 ? 384 : 576;
  return $fetch<Blob>(`/api/admin/payments/${paymentId.value}/document`, {
    query: { type: "quotation", format, width },
    responseType: "blob",
  });
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function handleDownloadPdf() {
  if (!data.value) return;
  isDownloadingPdf.value = true;
  try {
    const blob = await fetchDocument("pdf");
    triggerDownload(blob, `${documentCode.value}.pdf`);
  } catch (e) {
    notify.error(e instanceof Error ? e.message : "ดาวน์โหลด PDF ไม่สำเร็จ");
  } finally {
    isDownloadingPdf.value = false;
  }
}

async function handleDownloadPng() {
  if (!data.value) return;
  isDownloadingPng.value = true;
  try {
    const blob = await fetchDocument("png");
    triggerDownload(blob, `${documentCode.value}.png`);
  } catch (e) {
    notify.error(e instanceof Error ? e.message : "ดาวน์โหลด PNG ไม่สำเร็จ");
  } finally {
    isDownloadingPng.value = false;
  }
}

const editPaymentOpen = ref(false);
const editPaymentTarget = ref<PaymentTarget | null>(null);
const isLoadingPayment = ref(false);

async function openEditPaymentModal() {
  if (!paymentId.value) return;
  isLoadingPayment.value = true;
  try {
    const payment = await $fetch<PaymentTarget>(`/api/admin/payments/${paymentId.value}`);
    editPaymentTarget.value = {
      id: payment.id,
      paymentNo: payment.paymentNo,
      amount: Number(payment.amount ?? 0),
      status: payment.status,
      method: payment.method,
      slipImage: payment.slipImage ?? null,
    };
    editPaymentOpen.value = true;
  } catch (e) {
    notify.error(e instanceof Error ? e.message : "โหลดข้อมูลการชำระเงินไม่สำเร็จ");
  } finally {
    isLoadingPayment.value = false;
  }
}

async function onPaymentUpdated() {
  try {
    const payment = await $fetch<PaymentTarget>(`/api/admin/payments/${paymentId.value}`);
    if (payment.status === "PAID") {
      await navigateTo(`/admin/payment/${paymentId.value}/receipt`);
      return;
    }
  } catch (e) {
    console.error("Failed to refresh payment", e);
  }
  await refresh();
}

async function handlePrint() {
  if (!data.value) return;
  if (!printerState.value.isConnected) {
    notify.error("ยังไม่ได้เชื่อมต่อเครื่องพิมพ์ — กดไอคอนเครื่องพิมพ์เพื่อเชื่อมต่อก่อน");
    return;
  }
  isPrinting.value = true;
  try {
    const blob = await fetchDocument("escpos");
    const buf = new Uint8Array(await blob.arrayBuffer());
    await send(buf);
    notify.success("ส่งงานพิมพ์เรียบร้อย");
  } catch (e) {
    notify.error(e instanceof Error ? e.message : "เกิดข้อผิดพลาดในการพิมพ์");
  } finally {
    isPrinting.value = false;
  }
}
</script>

<template>
  <ThermalSlip
    panel-id="payment-quotation"
    navbar-title="ใบแจ้งราคา"
    navbar-icon="i-lucide-file-text"
    :file-name="documentCode"
    :is-loading="isLoading"
    :has-error="hasError"
    fallback-path="/admin/payment"
    empty-title="ไม่พบใบแจ้งราคา"
    print-label="พิมพ์ใบแจ้งราคา"
    :is-printing="isPrinting"
    :is-downloading-pdf="isDownloadingPdf"
    :is-downloading-png="isDownloadingPng"
    @retry="refresh()"
    @print="handlePrint"
    @download-pdf="handleDownloadPdf"
    @download-png="handleDownloadPng"
  >
    <template #navbar-actions>
      <UButton
        label="แก้ไขการชำระเงิน"
        icon="i-lucide-wallet"
        color="primary"
        variant="outline"
        class="shrink-0"
        aria-label="แก้ไขการชำระเงิน"
        :ui="{ label: 'hidden md:inline' }"
        :loading="isLoadingPayment"
        @click="openEditPaymentModal"
      />
    </template>

    <QuotationDocument v-if="data" :data="data" :shop="shopSettings ?? null" />
  </ThermalSlip>

  <EditPaymentStateModal
    v-if="editPaymentTarget?.id"
    v-model:open="editPaymentOpen"
    :payment-id="editPaymentTarget.id"
    :payment-no="editPaymentTarget.paymentNo"
    :amount="editPaymentTarget.amount"
    :status="editPaymentTarget.status"
    :method="editPaymentTarget.method"
    :existing-slip="editPaymentTarget.slipImage"
    @updated="onPaymentUpdated"
  />
</template>
