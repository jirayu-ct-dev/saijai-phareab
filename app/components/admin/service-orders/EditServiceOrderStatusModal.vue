<script setup lang="ts">
import type { ServiceOrderStatus } from "~~/shared/types/enums";
import { getNextServiceOrderStatus, orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
import type { AdminServiceOrder } from "~~/app/composables/useAdminServiceOrders";

type BadgeColor = "success" | "error" | "info" | "primary" | "secondary" | "warning" | "neutral";

const orderStatusBadgeColors = orderStatusColors as Record<ServiceOrderStatus, BadgeColor>;

const props = defineProps<{
  order: Pick<AdminServiceOrder, "id" | "orderNo" | "status" | "customer"> | null;
}>();

const open = defineModel<boolean>("open", { default: false });
const closeModal = (): void => {
  open.value = false;
};
const emit = defineEmits<{
  updated: [];
}>();

const isSubmitting = ref(false);
const cancelConfirmOpen = ref(false);
const { updateServiceOrderStatus } = useAdminServiceOrders({ fetchList: false, refreshAfterMutation: false });

const nextStatus = computed(() => props.order ? getNextServiceOrderStatus(props.order.status) : null);

const handleSubmit = async (status: ServiceOrderStatus) => {
  if (!props.order || isSubmitting.value) return;

  isSubmitting.value = true;
  const ok = await updateServiceOrderStatus(props.order.id, { status });
  isSubmitting.value = false;

  if (!ok) return;
  cancelConfirmOpen.value = false;
  open.value = false;
  emit("updated");
};

const handleNextStatus = () => {
  if (nextStatus.value) void handleSubmit(nextStatus.value);
};

const confirmCancellation = () => {
  void handleSubmit("CANCELLED");
};
</script>

<template>
  <UModal v-model:open="open" title="อัปเดตสถานะผ้า"
    :description="order?.orderNo || order?.customer.name || 'รายการรับผ้า'" :ui="{ content: 'max-w-md' }">
    <template #body>
      <div v-if="order" class="space-y-4">
        <div class="rounded-md border border-default/40 bg-elevated/50 p-3">
          <p class="text-sm font-medium text-highlighted">
            {{ order.customer.name || order.customer.email || "-" }}
          </p>
          <p class="mt-1 font-mono text-xs text-muted">{{ order.orderNo || order.id }}</p>
        </div>

        <div v-if="nextStatus" class="rounded-md border border-primary/20 bg-primary/5 p-3">
          <p class="text-xs text-muted">สถานะถัดไป</p>
          <div class="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <UBadge :color="orderStatusBadgeColors[order.status]" variant="subtle">
            {{ orderStatusLabels[order.status] }}
          </UBadge>
            <UIcon name="i-lucide-arrow-right" class="size-4 text-muted" />
            <UBadge :color="orderStatusBadgeColors[nextStatus]" variant="subtle">
              {{ orderStatusLabels[nextStatus] }}
            </UBadge>
          </div>
        </div>
        <div v-else class="rounded-md border border-default/40 bg-elevated/30 p-3 text-sm text-muted">
          สถานะนี้เป็นสถานะสุดท้ายแล้ว
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-wrap items-center justify-between gap-2">
        <UButton label="ปิด" color="neutral" variant="outline" :disabled="isSubmitting" @click="closeModal" />
        <div class="flex flex-wrap justify-end gap-2">
          <UButton v-if="order && nextStatus" label="ยกเลิกออเดอร์" color="error" variant="ghost"
            :disabled="isSubmitting" @click="cancelConfirmOpen = true" />
          <UButton v-if="nextStatus" :label="`อัปเดตเป็น ${orderStatusLabels[nextStatus]}`" color="primary"
            icon="i-lucide-arrow-right" :loading="isSubmitting" @click="handleNextStatus" />
        </div>
      </div>
    </template>
  </UModal>

  <UIConfirmModal v-model:open="cancelConfirmOpen" title="ยกเลิกออเดอร์" description="ยืนยันการยกเลิกรายการรับผ้า"
    icon="i-lucide-ban" icon-color="error" confirm-label="ยืนยันยกเลิก" confirm-color="error"
    :loading="isSubmitting" @confirm="confirmCancellation">
    <template #message>
      ต้องการยกเลิกออเดอร์
      <strong class="text-highlighted">{{ order?.orderNo || order?.customer.name || "นี้" }}</strong>
      ใช่หรือไม่?
    </template>
    <template #subMessage>
      ระบบจะคืนเครดิตที่ถูกใช้ให้ลูกค้าโดยอัตโนมัติถ้ามี
    </template>
  </UIConfirmModal>
</template>
