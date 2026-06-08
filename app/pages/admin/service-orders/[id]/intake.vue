<script setup lang="ts">
definePageMeta({
  layout: "admin",
  middleware: ["role-employee"],
});

const route = useRoute();
const serviceOrderId = computed(() => String(route.params.id ?? ""));

type ServiceOrderResponse = {
  payments: Array<{ id: string; createdAt?: string }>;
};

const { data } = useFetch<ServiceOrderResponse>(
  () => `/api/admin/service-orders/${serviceOrderId.value}`,
  { key: () => `service-order-intake-redirect-${serviceOrderId.value}`, lazy: true, server: false },
);

const paymentId = computed(() => data.value?.payments[0]?.id ?? null);

watchEffect(async () => {
  if (paymentId.value) {
    await navigateTo(`/admin/payment/${paymentId.value}/quotation`, { replace: true });
  }
});
</script>

<template>
  <UDashboardPanel id="service-order-intake-redirect">
    <template #body>
      <div class="flex h-full items-center justify-center p-10">
        <div v-if="!paymentId && data" class="text-center">
          <p class="text-base font-semibold text-highlighted">ไม่พบใบเสร็จของรายการนี้</p>
          <p class="mt-2 text-sm text-muted">กรุณาตรวจสอบรายการชำระเงิน</p>
          <div class="mt-4">
            <UButton label="กลับ" color="neutral" variant="outline" @click="navigateTo('/admin/service-orders')" />
          </div>
        </div>
        <USkeleton v-else class="h-40 w-full max-w-md" />
      </div>
    </template>
  </UDashboardPanel>
</template>
