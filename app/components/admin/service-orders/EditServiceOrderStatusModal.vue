<script setup lang="ts">
import type { ServiceOrderStatus } from "~~/shared/types/enums";
import { orderStatusColors, orderStatusLabels } from "~~/shared/config/orderConfig";
import type { AdminServiceOrder } from "~~/app/composables/useAdminServiceOrders";

type BadgeColor = "success" | "error" | "info" | "primary" | "secondary" | "warning" | "neutral";

const orderStatusBadgeColors = orderStatusColors as Record<ServiceOrderStatus, BadgeColor>;
const serviceOrderStatuses: ServiceOrderStatus[] = ["RECEIVED", "PROCESSING", "DELIVERING", "COMPLETED", "CANCELLED"];

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
const selectedStatus = ref<ServiceOrderStatus>("RECEIVED");
const notify = useNotify();
const { updateServiceOrderStatus } = useAdminServiceOrders({ fetchList: false, refreshAfterMutation: false });

const selectableStatuses = computed(() => {
  if (!props.order) return new Set<ServiceOrderStatus>();
  if (props.order.status === "CANCELLED") {
    return new Set<ServiceOrderStatus>([props.order.status]);
  }
  return new Set<ServiceOrderStatus>(serviceOrderStatuses.filter((status) => status !== "RECEIVED" || status === props.order?.status));
});

watch([open, () => props.order], ([isOpen]) => {
  if (isOpen && props.order) selectedStatus.value = props.order.status;
}, { immediate: true });

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

const selectStatus = (status: ServiceOrderStatus) => {
  if (!props.order || isSubmitting.value) return;
  if (selectableStatuses.value.has(status)) {
    selectedStatus.value = status;
    return;
  }

  if (props.order.status === "CANCELLED") {
    notify.info("รายการนี้ถูกยกเลิกแล้ว จึงไม่สามารถเปลี่ยนสถานะได้");
    return;
  }
  notify.info("ไม่สามารถย้อนสถานะกลับเป็นรับผ้าได้");
};

const submitSelectedStatus = () => {
  if (!props.order) return;
  if (selectedStatus.value === props.order.status) {
    notify.info("สถานะนี้เป็นสถานะปัจจุบันอยู่แล้ว");
    return;
  }
  if (selectedStatus.value === "CANCELLED") {
    cancelConfirmOpen.value = true;
    return;
  }
  void handleSubmit(selectedStatus.value);
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

        <UFormField label="เลือกสถานะผ้า">
          <div class="grid grid-cols-2 gap-2">
            <UButton v-for="status in serviceOrderStatuses" :key="status" :label="orderStatusLabels[status]"
              :color="selectedStatus === status ? orderStatusBadgeColors[status] : 'neutral'"
              :variant="selectedStatus === status ? 'solid' : 'outline'" block
              :class="{ 'opacity-60': !selectableStatuses.has(status) }" :disabled="isSubmitting"
              @click="selectStatus(status)" />
          </div>
          <p class="mt-1 text-xs text-muted">เปลี่ยนหรือย้อนสถานะได้ ยกเว้นย้อนกลับเป็นรับผ้า</p>
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <UButton label="ปิด" color="neutral" variant="outline" :disabled="isSubmitting" @click="closeModal" />
        <UButton label="บันทึก" color="primary" icon="i-lucide-save" :loading="isSubmitting"
          :disabled="!order" @click="submitSelectedStatus" />
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
