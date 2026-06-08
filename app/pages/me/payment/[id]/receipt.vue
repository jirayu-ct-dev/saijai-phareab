<script setup lang="ts">
import ThermalSlip from "~~/app/components/thermal/ThermalSlip.vue";
import ReceiptDocument from "~~/app/components/print/ReceiptDocument.vue";
import type { ReceiptPayload } from "~~/shared/types/receipt";

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

type UserReceiptPayload = ReceiptPayload & {
  receiptNo?: string | null;
};

const route = useRoute();
const router = useRouter();
const paymentId = computed(() => String(route.params.id ?? ""));
const { settings: shopSettings } = useShopSettings();

const { data, status, refresh, error } = await useFetch<UserReceiptPayload>(
  () => `/api/me/payment/${paymentId.value}`,
  { key: () => `my-payment-receipt-${paymentId.value}` },
);

watch(data, (value) => {
  if (value && !value.paidAt && Number(value.amount ?? 0) > 0) {
    void router.replace(`/me/payment/${paymentId.value}/quotation`);
  }
}, { immediate: true });

const isLoading = computed(() => status.value === "pending");
const hasError = computed(() => Boolean(error.value) || !data.value);
const receiptCode = computed(
  () => data.value?.receiptNo || data.value?.paymentNo || `RC-${paymentId.value.slice(-8).toUpperCase()}`,
);
</script>

<template>
  <ThermalSlip
    panel-id="my-payment-receipt"
    navbar-title="ใบเสร็จ"
    navbar-icon="i-lucide-receipt"
    :file-name="receiptCode"
    :is-loading="isLoading"
    :has-error="hasError"
    fallback-path="/me/payment"
    empty-title="ไม่พบข้อมูลใบเสร็จ"
    print-label="พิมพ์ใบเสร็จ"
    @retry="refresh()"
  >
    <ReceiptDocument v-if="data" :data="data" :shop="shopSettings ?? null" />
  </ThermalSlip>
</template>
