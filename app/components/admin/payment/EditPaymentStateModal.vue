<script setup lang="ts">
import type { PaymentMethod, PaymentStatus } from "~~/shared/types/enums";
import { paymentMethodLabels, paymentStatusLabels } from "~~/shared/config/paymentConfig";
import { formatCurrency } from "~~/shared/utils/format";
import type { Photo } from "~~/app/components/UI/PhotoUpload.vue";

type SlipImage = { id: string; url: string | null; secureUrl: string | null };

const props = defineProps<{
  paymentId: string;
  paymentNo?: string | null;
  amount: number;
  status: PaymentStatus;
  method: PaymentMethod | null;
  existingSlip?: SlipImage | null;
}>();

const emit = defineEmits<{
  (e: "updated"): void;
}>();

const open = defineModel<boolean>("open", { default: false });
const notify = useNotify();
const { updatePaymentState, uploadSlip } = useAdminPayments({ fetchList: false, refreshAfterMutation: false });

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
const isUploading = ref(false);
const slipFile = ref<File | null>(null);
const uploadedSlip = ref<SlipImage | null>(null);

watch(open, (value) => {
  if (!value) return;
  form.status = props.status;
  form.method = props.method ?? "NONE";
  slipFile.value = null;
  uploadedSlip.value = props.existingSlip ?? null;
}, { immediate: true });

watch(() => form.status, (status) => {
  if (status === "PAID" && form.method === "NONE") {
    form.method = "CASH";
  }
});

const slipPhotos = computed<Photo[]>(() => {
  if (slipFile.value) return [{ key: "slip", file: slipFile.value, url: null }];
  const url = uploadedSlip.value?.secureUrl ?? uploadedSlip.value?.url ?? null;
  return url ? [{ key: "slip", file: null, url }] : [];
});

const onSlipPhotosUpdate = (photos: Photo[]) => {
  const photo = photos[0] ?? null;
  slipFile.value = photo?.file ?? null;
  if (!photo) uploadedSlip.value = null;
};

const submit = async () => {
  if (form.status === "PAID" && form.method === "NONE") {
    notify.validationError("กรุณาเลือกวิธีชำระเงิน");
    return;
  }

  isSaving.value = true;
  try {
    let slipImageId: string | null = uploadedSlip.value?.id ?? null;
    if (form.status === "PAID" && slipFile.value) {
      isUploading.value = true;
      const uploaded = await uploadSlip(slipFile.value);
      isUploading.value = false;
      if (!uploaded) {
        return;
      }
      uploadedSlip.value = uploaded;
      slipImageId = uploaded.id;
    }

    const ok = await updatePaymentState(props.paymentId, {
      status: form.status,
      method: form.method === "NONE" ? null : form.method,
      slipImageId,
    });

    if (ok) {
      open.value = false;
      emit("updated");
    }
  } finally {
    isSaving.value = false;
    isUploading.value = false;
  }
};
</script>

<template>
  <UModal
    v-model:open="open"
    title="แก้ไขการชำระเงิน"
    :ui="{ content: 'bg-default dark:bg-default', body: 'bg-default dark:bg-default', header: 'bg-default dark:bg-default', footer: 'bg-default dark:bg-default' }"
  >
    <template #body>
      <div class="space-y-4">
        <div class="flex items-start justify-between gap-3 rounded-md bg-elevated px-3 py-2 text-sm">
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

        <UIPhotoUpload
          v-if="form.status === 'PAID'"
          label="หลักฐานการชำระเงิน"
          description="แนบรูปสลิป/หลักฐาน (ไม่บังคับ - JPEG / PNG / WebP)"
          :photos="slipPhotos"
          :max="1"
          :disabled="isSaving || isUploading"
          confirm-remove
          @update:photos="onSlipPhotosUpdate"
        />

        <p v-if="form.status === 'PAID'" class="text-xs text-muted">
          เมื่อบันทึกเป็นชำระแล้ว ระบบจะออกเลขใบเสร็จให้หากยังไม่มี
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton color="neutral" variant="outline" :disabled="isSaving || isUploading" @click="open = false">
          ยกเลิก
        </UButton>
        <UButton color="primary" icon="i-lucide-save" :loading="isSaving || isUploading" @click="submit">
          บันทึก
        </UButton>
      </div>
    </template>
  </UModal>
</template>
