<script setup lang="ts">
import type { ServiceOrderStatus } from "~~/shared/types/enums";
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";

type BadgeColor = "success" | "info" | "error" | "neutral" | "primary" | "secondary" | "warning";

const props = defineProps<{
  status: ServiceOrderStatus;
}>();

const statusBadgeColors = orderStatusColors as Record<ServiceOrderStatus, BadgeColor>;
const steps = [
  { value: "RECEIVED", title: orderStatusLabels.RECEIVED, icon: "i-lucide-package-check" },
  { value: "PROCESSING", title: orderStatusLabels.PROCESSING, icon: "i-lucide-washing-machine" },
  { value: "DELIVERING", title: orderStatusLabels.DELIVERING, icon: "i-lucide-truck" },
  { value: "COMPLETED", title: orderStatusLabels.COMPLETED, icon: "i-lucide-circle-check" },
] satisfies Array<{ value: ServiceOrderStatus; title: string; icon: string }>;

const isCancelled = computed(() => props.status === "CANCELLED");
</script>

<template>
  <section class="space-y-3 rounded-lg border border-default/30 bg-default p-3 dark:border-default/20 dark:bg-elevated/55">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <p class="text-sm font-semibold text-highlighted">ขั้นตอนการดูแลผ้า</p>
        <p class="mt-0.5 text-xs text-muted">ติดตามสถานะล่าสุดของรายการนี้</p>
      </div>
      <UBadge :color="statusBadgeColors[status]" variant="subtle" size="sm">
        {{ orderStatusLabels[status] }}
      </UBadge>
    </div>

    <UStepper v-if="!isCancelled" :model-value="status" :items="steps" :linear="false" :disabled="true"
      orientation="horizontal" size="sm" />

    <div v-else class="flex items-center gap-2 rounded-md border border-error/30 bg-error/5 px-3 py-2 text-sm text-error">
      <UIcon name="i-lucide-ban" class="size-4 shrink-0" />
      <span>รายการนี้ถูกยกเลิกแล้ว</span>
    </div>
  </section>
</template>
