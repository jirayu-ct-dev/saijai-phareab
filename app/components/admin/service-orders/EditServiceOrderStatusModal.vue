<script setup lang="ts">
import type { ServiceOrderStatus } from "~~/shared/types/enums";
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
import type { AdminServiceOrder } from "~~/app/composables/useAdminServiceOrders";

type BadgeColor = "success" | "error" | "info" | "primary" | "secondary" | "warning" | "neutral";

const orderStatusBadgeColors = orderStatusColors as Record<ServiceOrderStatus, BadgeColor>;

const props = defineProps<{
  order: Pick<AdminServiceOrder, "id" | "orderNo" | "status" | "customer"> | null;
}>();

const open = defineModel<boolean>("open", { default: false });
const emit = defineEmits<{
  updated: [];
}>();

const statusOptions: Array<{ label: string; value: ServiceOrderStatus }> = [
  { label: orderStatusLabels.RECEIVED, value: "RECEIVED" },
  { label: orderStatusLabels.PROCESSING, value: "PROCESSING" },
  { label: orderStatusLabels.DELIVERING, value: "DELIVERING" },
  { label: orderStatusLabels.COMPLETED, value: "COMPLETED" },
  { label: orderStatusLabels.CANCELLED, value: "CANCELLED" },
];

const selectedStatus = ref<ServiceOrderStatus>("RECEIVED");
const isSubmitting = ref(false);
const { updateServiceOrderStatus } = useAdminServiceOrders({ fetchList: false, refreshAfterMutation: false });

watch(
  () => [open.value, props.order?.status] as const,
  ([isOpen]) => {
    if (isOpen && props.order) {
      selectedStatus.value = props.order.status;
    }
  },
  { immediate: true },
);

const handleSubmit = async () => {
  if (!props.order) return;

  isSubmitting.value = true;
  const ok = await updateServiceOrderStatus(props.order.id, { status: selectedStatus.value });
  isSubmitting.value = false;

  if (!ok) return;
  open.value = false;
  emit("updated");
};
</script>

<template>
  <UModal
    v-model:open="open"
    title="อัปเดตสถานะผ้า"
    :description="order?.orderNo || order?.customer.name || 'รายการรับผ้า'"
    :ui="{ content: 'max-w-md' }"
  >
    <template #body>
      <div v-if="order" class="space-y-4">
        <div class="rounded-md border border-default/40 bg-elevated/50 p-3">
          <p class="text-sm font-medium text-highlighted">
            {{ order.customer.name || order.customer.email || "-" }}
          </p>
          <p class="mt-1 font-mono text-xs text-muted">{{ order.orderNo || order.id }}</p>
        </div>

        <UFormField label="สถานะงาน">
          <USelect v-model="selectedStatus" :items="statusOptions" value-key="value" class="w-full" />
        </UFormField>

        <div class="flex items-center gap-2 text-sm text-muted">
          <span>เปลี่ยนจาก</span>
          <UBadge :color="orderStatusBadgeColors[order.status]" variant="subtle">
            {{ orderStatusLabels[order.status] }}
          </UBadge>
          <span>เป็น</span>
          <UBadge :color="orderStatusBadgeColors[selectedStatus]" variant="subtle">
            {{ orderStatusLabels[selectedStatus] }}
          </UBadge>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton label="ยกเลิก" color="neutral" variant="outline" @click="open = false" />
        <UButton
          label="บันทึกสถานะ"
          color="primary"
          icon="i-lucide-check"
          :loading="isSubmitting"
          :disabled="!order || selectedStatus === order.status"
          @click="handleSubmit"
        />
      </div>
    </template>
  </UModal>
</template>
