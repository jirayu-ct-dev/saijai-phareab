<script setup lang="ts">
// Print-only route (no admin chrome). Used by Puppeteer to render the receipt
// to PDF/PNG. Width is locked to the printer paper width via ?w= query param
// (576 = 80mm, 384 = 58mm) so the rendered viewport matches the printer 1:1.

import ReceiptDocument from "~~/app/components/print/ReceiptDocument.vue";
import type { ReceiptPayload } from "~~/shared/types/receipt";

definePageMeta({ layout: "print", middleware: ["role-employee"] });

const route = useRoute();
const paymentId = computed(() => String(route.params.id ?? ""));
const widthPx = computed(() => {
  const w = Number(route.query.w);
  return Number.isFinite(w) && w > 0 ? Math.round(w) : 576;
});

const { settings: shopSettings } = useAdminShopSettings();
const { data } = await useFetch<ReceiptPayload>(
  () => `/api/admin/payments/${paymentId.value}/receipt`,
  { key: () => `print-receipt-${paymentId.value}` },
);
</script>

<template>
  <div class="print-frame" :style="{ width: `${widthPx}px` }">
    <ReceiptDocument v-if="data" :data="data" :shop="shopSettings ?? null" />
  </div>
</template>

<style scoped>
.print-frame {
  margin: 0 auto;
  background: #ffffff;
}
</style>
