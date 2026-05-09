<script setup lang="ts">
import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";
import { paymentMethodLabels, paymentStatusLabels } from "~~/shared/config/paymentConfig";
import { formatCurrency } from "~~/shared/utils/format";

const props = defineProps<{
  paymentId: string;
  paymentNo?: string | null;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod | null;
}>();

const emit = defineEmits<{
  (e: "updated"): void;
}>();

const open = defineModel<boolean>("open", { default: false });
const notify = useNotify();
const { updatePaymentState } = useAdminPayments();

const statusOptions: Array<{ label: string; value: PaymentStatus }> = [
  { label: paymentStatusLabels.UNPAID, value: "UNPAID" },
  { label: paymentStatusLabels.PENDING_VERIFICATION, value: "PENDING_VERIFICATION" },
  { label: paymentStatusLabels.PAID, value: "PAID" },
  { label: paymentStatusLabels.CANCELLED, value: "CANCELLED" },
];

const methodOptions: Array<{ label: string; value: PaymentMethod | "NONE" }> = [
  { label: "ไม่ระบุ", value: "NONE" },
  { label: paymentMethodLabels.CASH, value: "CASH" },
  { label: paymentMethodLabels.TRANSFER, value: "TRANSFER" },
];

const form = reactive<{
  status: PaymentStatus;
  method: PaymentMethod | "NONE";
}>({
  status: "UNPAID",
  method: "NONE",
});
const isSaving = ref(false);

watch(open, (value) => {
  if (!value) return;
  form.status = props.status;
  form.method = props.method ?? "NONE";
});

watch(() => form.status, (status) => {
  if (status === "PAID" && form.method === "NONE") {
    form.method = "CASH";
  }
});

const submit = async () => {
  if (form.status === "PAID" && form.method === "NONE") {
    notify.validationError("กรุณาเลือกวิธีชำระเงิน");
    return;
  }

  isSaving.value = true;
  const ok = await updatePaymentState(props.paymentId, {
    status: form.status,
    method: form.method === "NONE" ? null : form.method,
  });
  isSaving.value = false;

  if (ok) {
    open.value = false;
    emit("updated");
  }
};
</script>

<template>
  <UModal v-model:open="open" title="แก้ไขการชำระเงิน">
    <template #body>
      <div class="space-y-4">
        <div class="flex items-start justify-between gap-3 rounded-lg bg-elevated px-3 py-2 text-sm">
          <span class="min-w-0 break-all font-mono text-muted">{{ paymentNo || paymentId }}</span>
          <span class="shrink-0 font-semibold text-highlighted">{{ formatCurrency(amount) }}</span>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField label="สถานะ">
            <USelect v-model="form.status" :items="statusOptions" value-key="value" class="w-full" />
          </UFormField>

          <UFormField label="วิธีชำระ">
            <USelect v-model="form.method" :items="methodOptions" value-key="value" class="w-full" />
          </UFormField>
        </div>

        <p v-if="form.status === 'PAID'" class="text-xs text-muted">
          เมื่อบันทึกเป็นชำระแล้ว ระบบจะออกเลขใบเสร็จให้หากยังไม่มี
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="outline" :disabled="isSaving" @click="open = false">
          ยกเลิก
        </UButton>
        <UButton color="primary" icon="i-lucide-save" :loading="isSaving" @click="submit">
          บันทึก
        </UButton>
      </div>
    </template>
  </UModal>
</template>
