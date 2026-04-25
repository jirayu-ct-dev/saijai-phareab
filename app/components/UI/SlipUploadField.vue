<script setup lang="ts">
import ConfirmModal from "~~/app/components/UI/ConfirmModal.vue";
import ImagePreviewModal from "~~/app/components/UI/ImagePreviewModal.vue";

const props = withDefaults(defineProps<{
  label?: string;
  description?: string | null;
  file?: File | null;
  imageUrl?: string | null;
  imageLabel?: string | null;
  disabled?: boolean;
  loading?: boolean;
  showRemove?: boolean;
  uploadLabel?: string;
  previewLabel?: string;
  removeLabel?: string;
  emptyText?: string;
  accept?: string;
  blockedMessage?: string | null;
  confirmRemove?: boolean;
  confirmTitle?: string;
  confirmMessage?: string;
  confirmSubMessage?: string;
  capture?: "environment" | "user" | null;
}>(), {
  label: "หลักฐานการชำระเงิน",
  description: null,
  file: null,
  imageUrl: null,
  imageLabel: null,
  disabled: false,
  loading: false,
  showRemove: true,
  uploadLabel: "อัปโหลด",
  previewLabel: "ดูรูป",
  removeLabel: "ลบ",
  emptyText: "ยังไม่มีไฟล์แนบ",
  accept: "image/*",
  blockedMessage: null,
  confirmRemove: false,
  confirmTitle: "ยืนยันการลบรูป",
  confirmMessage: "ต้องการลบรูปนี้หรือไม่",
  confirmSubMessage: "หากยืนยันแล้ว รูปที่เลือกไว้จะถูกยกเลิกหรือถอดออกจากรายการนี้",
  capture: null,
});

const emit = defineEmits<{
  "update:file": [value: File | null];
  blocked: [message: string];
  remove: [];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const previewOpen = ref(false);
const removeConfirmOpen = ref(false);
const objectUrl = ref<string | null>(null);

const revokeObjectUrl = () => {
  if (objectUrl.value && import.meta.client) {
    URL.revokeObjectURL(objectUrl.value);
  }
  objectUrl.value = null;
};

watch(
  () => props.file,
  (file) => {
    revokeObjectUrl();

    if (file && import.meta.client) {
      objectUrl.value = URL.createObjectURL(file);
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  revokeObjectUrl();
});

const previewUrl = computed(() => objectUrl.value || props.imageUrl || "");
const displayLabel = computed(() => props.file?.name || props.imageLabel || previewUrl.value || props.emptyText);
const helperText = computed(() => {
  if (props.file) {
    return "เลือกไฟล์ไว้แล้ว ระบบจะอัปโหลดเมื่อบันทึก";
  }

  if (props.imageUrl) {
    return props.description || "มีไฟล์แนบแล้ว";
  }

  return props.description || props.emptyText;
});

const openPicker = () => {
  if (props.disabled) return;
  if (props.blockedMessage) {
    emit("blocked", props.blockedMessage);
    return;
  }
  fileInputRef.value?.click();
};

const onFileSelected = (event: Event) => {
  const input = event.target as HTMLInputElement | null;
  const file = input?.files?.[0] ?? null;
  emit("update:file", file);
  if (input) input.value = "";
};

const performRemove = () => {
  emit("update:file", null);
  emit("remove");
  removeConfirmOpen.value = false;
};

const handleRemoveClick = () => {
  if (props.blockedMessage) {
    emit("blocked", props.blockedMessage);
    return;
  }

  if (props.confirmRemove) {
    removeConfirmOpen.value = true;
    return;
  }

  performRemove();
};
</script>

<template>
  <div class="rounded-xl border border-dashed border-default p-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <p class="font-medium text-highlighted">{{ label }}</p>
        <p class="text-sm text-muted">{{ helperText }}</p>
      </div>

      <UButton
        :label="uploadLabel"
        icon="i-lucide-upload"
        color="neutral"
        variant="solid"
        :loading="loading"
        :disabled="disabled"
        @click="openPicker"
      />
    </div>

    <input
      ref="fileInputRef"
      type="file"
      :accept="accept"
      :capture="capture ?? undefined"
      class="hidden"
      @change="onFileSelected"
    >

    <div v-if="previewUrl" class="mt-4 space-y-3">
      <div class="flex min-h-48 items-center justify-center overflow-hidden rounded-xl border border-default bg-muted/30 p-2">
        <img
          :src="previewUrl"
          :alt="displayLabel"
          class="max-h-64 w-full rounded-lg object-contain"
        >
      </div>

      <!-- <p class="truncate text-sm text-muted">{{ displayLabel }}</p> -->

      <div class="flex justify-between flex-wrap gap-2">
        <UButton
          v-if="showRemove"
          :label="removeLabel"
          color="error"
          variant="ghost"
          icon="i-lucide-x"
          :disabled="disabled || loading"
          @click="handleRemoveClick"
        />
        <UButton
          :label="previewLabel"
          color="neutral"
          variant="outline"
          icon="i-lucide-image"
          @click="previewOpen = true"
        />
      </div>
    </div>
  </div>

  <ImagePreviewModal
    v-model:open="previewOpen"
    title="ดูหลักฐานการชำระเงิน"
    :image-url="previewUrl"
    :image-alt="displayLabel"
  />

  <ConfirmModal
    v-model:open="removeConfirmOpen"
    :title="confirmTitle"
    icon="i-lucide-trash-2"
    icon-color="error"
    confirm-label="ลบรูป"
    confirm-color="error"
    :message="confirmMessage"
    :sub-message="confirmSubMessage"
    :loading="loading"
    @confirm="performRemove"
  />
</template>
