<script setup lang="ts">
import type { ServiceOrderStatus } from "~~/shared/types/enums";
import { orderStatusLabels } from "~~/shared/config/orderConfig";
import type { AdminServiceOrder } from "~~/app/composables/useAdminServiceOrders";

const serviceOrderStatuses: ServiceOrderStatus[] = ["RECEIVED", "PROCESSING", "DELIVERING", "COMPLETED"];

const statusStepperIcons: Record<ServiceOrderStatus, string> = {
  RECEIVED: "i-lucide-package-check",
  PROCESSING: "i-lucide-washing-machine",
  DELIVERING: "i-lucide-truck",
  COMPLETED: "i-lucide-circle-check",
  CANCELLED: "i-lucide-ban",
};

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

const stepperItems = computed(() => serviceOrderStatuses.map((status) => ({
  value: status,
  title: orderStatusLabels[status],
  icon: statusStepperIcons[status],
  disabled: !selectableStatuses.value.has(status),
})));

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

        <UFormField label="ขั้นตอนการดูแลผ้า">
          <UStepper v-if="order.status !== 'CANCELLED'" v-model="selectedStatus" :items="stepperItems"
            :linear="false" orientation="horizontal" :disabled="isSubmitting" class="w-full" />
          <p v-if="order.status === 'CANCELLED'" class="text-xs text-error">รายการนี้ถูกยกเลิกแล้ว จึงไม่สามารถเปลี่ยนสถานะได้</p>
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <UButton v-if="order && order.status !== 'CANCELLED'" label="ยกเลิกรายการ" color="error" variant="ghost"
          icon="i-lucide-ban" :disabled="isSubmitting" @click="cancelConfirmOpen = true" />
        <div class="ml-auto flex items-center gap-2">
          <UButton label="ปิด" color="neutral" variant="outline" :disabled="isSubmitting" @click="closeModal" />
          <UButton label="บันทึก" color="primary" icon="i-lucide-save" :loading="isSubmitting"
            :disabled="!order" @click="submitSelectedStatus" />
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
