<script setup lang="ts">
import ThermalSlip from "~~/app/components/thermal/ThermalSlip.vue";
import QuotationDocument from "~~/app/components/print/QuotationDocument.vue";
import type { ReceiptPayload } from "~~/shared/types/receipt";

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

type QuotationPayload = ReceiptPayload & {
  receiptNo: string | null;
  quotationNo: string | null;
};

const route = useRoute();
const paymentId = computed(() => String(route.params.id ?? ""));
const { settings: shopSettings } = useShopSettings();

const { data, status, refresh, error } = useFetch<ReceiptPayload>(
  () => `/api/me/payment/${paymentId.value}`,
  { key: () => `my-payment-quotation-${paymentId.value}`, lazy: true, server: false },
);

const quotationData = computed<QuotationPayload | null>(() => {
  if (!data.value) return null;
  return {
    ...data.value,
    receiptNo: null,
    quotationNo: data.value.serviceOrder?.orderNo ?? null,
  };
});

const isLoading = computed(() => status.value === "pending" || status.value === "idle");
const hasError = computed(() => Boolean(error.value) || !quotationData.value);
const documentCode = computed(
  () => quotationData.value?.quotationNo || quotationData.value?.serviceOrder?.orderNo || `QT-${paymentId.value.slice(-8).toUpperCase()}`,
);
</script>

<template>
  <ThermalSlip
    panel-id="my-payment-quotation"
    navbar-title="ใบแจ้งราคา"
    navbar-icon="i-lucide-file-text"
    :file-name="documentCode"
    :is-loading="isLoading"
    :has-error="hasError"
    fallback-path="/me/payment"
    empty-title="ไม่พบใบแจ้งราคา"
    print-label="พิมพ์ใบแจ้งราคา"
    :show-actions="false"
    @retry="refresh()"
  >
    <QuotationDocument v-if="quotationData" :data="quotationData" :shop="shopSettings ?? null" />
  </ThermalSlip>
</template>
