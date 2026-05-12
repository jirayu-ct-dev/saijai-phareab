<script setup lang="ts">
import type { PaymentMethod } from "~~/shared/types/enums";
import { paymentMethodLabels } from "~~/shared/config/paymentConfig";
import type { Photo } from "~~/app/components/UI/PhotoUpload.vue";

const props = defineProps<{
  paymentId: string;
  amount: number;
}>();

const emit = defineEmits<{
  (e: "confirmed"): void;
}>();

const open = defineModel<boolean>("open", { default: false });

const { confirmPayment, uploadSlip } = useAdminPayments();
const notify = useNotify();

const method = ref<PaymentMethod>("CASH");
const slipFile = ref<File | null>(null);
const uploadedSlip = ref<{ id: string; url: string | null; secureUrl: string | null } | null>(null);
const note = ref("");
const submitting = ref(false);
const uploading = ref(false);

const reset = () => {
  method.value = "CASH";
  slipFile.value = null;
  uploadedSlip.value = null;
  note.value = "";
  submitting.value = false;
  uploading.value = false;
};

watch(open, (value) => {
  if (value) reset();
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
  if (method.value === "TRANSFER" && !slipFile.value && !uploadedSlip.value) {
    notify.error("การโอนเงินต้องแนบสลิปการโอน");
    return;
  }
  submitting.value = true;
  try {
    let slipImageId = uploadedSlip.value?.id ?? null;
    if (slipFile.value) {
      uploading.value = true;
      const uploaded = await uploadSlip(slipFile.value);
      uploading.value = false;
      if (!uploaded) {
        submitting.value = false;
        return;
      }
      uploadedSlip.value = uploaded;
      slipImageId = uploaded.id;
    }
    const ok = await confirmPayment(props.paymentId, {
      method: method.value,
      slipImageId,
      note: note.value.trim() || null,
    });
    if (ok) {
      open.value = false;
      emit("confirmed");
    }
  } finally {
    submitting.value = false;
    uploading.value = false;
  }
};
</script>

<template>
  <UModal v-model:open="open" title="ยืนยันการชำระเงิน">
    <template #body>
      <div class="space-y-4">
        <div class="flex items-center justify-between rounded-md bg-elevated p-3">
          <span class="text-sm text-muted">ยอดที่ต้องชำระ</span>
          <span class="text-lg font-semibold">{{ amount.toLocaleString("th-TH", { minimumFractionDigits: 2 }) }} ฿</span>
        </div>

        <UFormField label="วิธีการชำระเงิน" class="w-full">
          <USelect
            v-model="method"
            :items="[
              { label: paymentMethodLabels.CASH, value: 'CASH' },
              { label: paymentMethodLabels.TRANSFER, value: 'TRANSFER' },
            ]"
            value-key="value"
            class="w-full"
          />
        </UFormField>

        <UIPhotoUpload
          v-if="method === 'TRANSFER'"
          label="สลิปการโอน"
          description="แนบรูปสลิปการโอนเงิน (JPEG / PNG / WebP)"
          :photos="slipPhotos"
          :max="1"
          :disabled="submitting || uploading"
          confirm-remove
          @update:photos="onSlipPhotosUpdate"
        />

        <UFormField label="หมายเหตุ (ถ้ามี)" class="w-full">
          <UTextarea v-model="note" :rows="2" placeholder="เช่น เลขอ้างอิงการโอน" class="w-full" :ui="{ base: 'w-full' }" />
        </UFormField>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-2">
        <UButton variant="ghost" color="neutral" @click="open = false">ยกเลิก</UButton>
        <UButton
          color="primary"
          icon="i-lucide-check"
          :loading="submitting || uploading"
          @click="submit"
        >
          ยืนยันการชำระเงิน
        </UButton>
      </div>
    </template>
  </UModal>
</template>
