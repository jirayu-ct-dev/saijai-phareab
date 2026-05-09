<script setup lang="ts">
import QuotationDocument from "~~/app/components/print/QuotationDocument.vue";
import type { ReceiptPayload } from "~~/shared/types/receipt";

definePageMeta({ layout: "print", middleware: ["role-employee"] });

type QuotationPayload = ReceiptPayload & { receiptNo: string | null; quotationNo: string | null };

const route = useRoute();
const paymentId = computed(() => String(route.params.id ?? ""));
const widthPx = computed(() => {
  const w = Number(route.query.w);
  return Number.isFinite(w) && w > 0 ? Math.round(w) : 576;
});

const { settings: shopSettings } = useAdminShopSettings();
const { data } = await useFetch<QuotationPayload>(
  () => `/api/admin/payments/${paymentId.value}/quotation`,
  { key: () => `print-quotation-${paymentId.value}` },
);
</script>

<template>
  <div class="print-frame" :style="{ width: `${widthPx}px` }">
    <QuotationDocument v-if="data" :data="data" :shop="shopSettings ?? null" />
  </div>
</template>

<style scoped>
.print-frame {
  margin: 0 auto;
  background: #ffffff;
}
</style>
