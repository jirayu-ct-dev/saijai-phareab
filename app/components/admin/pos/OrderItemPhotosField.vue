<script setup lang="ts">
import ConfirmModal from "~~/app/components/UI/ConfirmModal.vue";
import ImagePreviewModal from "~~/app/components/UI/ImagePreviewModal.vue";

export type OrderItemPhoto = {
  key: string;
  file: File | null;
  uploadedImageId: string | null;
  uploadedUrl: string | null;
  isDamaged: boolean;
};

const props = withDefaults(defineProps<{
  photos: OrderItemPhoto[];
  disabled?: boolean;
  label?: string;
  description?: string;
  capture?: "environment" | "user" | null;
}>(), {
  disabled: false,
  label: "รูปผ้าชำรุด",
  description: "แนบรูปเฉพาะผ้าที่มีตำหนิหรือชำรุด",
  capture: "environment",
});

const emit = defineEmits<{
  "update:photos": [value: OrderItemPhoto[]];
}>();

const fileInputRef = ref<HTMLInputElement | null>(null);
const objectUrls = ref(new Map<string, string>());
const previewOpen = ref(false);
const previewUrl = ref("");
const removeConfirmOpen = ref(false);
const pendingRemoveKey = ref<string | null>(null);

let seed = 0;
const createPhotoKey = () => `order-item-photo-${Date.now()}-${++seed}`;

const resolvePreviewUrl = (photo: OrderItemPhoto) => {
  if (photo.uploadedUrl) return photo.uploadedUrl;
  return objectUrls.value.get(photo.key) || "";
};

const syncObjectUrls = () => {
  const activeKeys = new Set<string>();
  for (const photo of props.photos) {
    if (!photo.file) continue;
    activeKeys.add(photo.key);
    if (!objectUrls.value.has(photo.key) && import.meta.client) {
      objectUrls.value.set(photo.key, URL.createObjectURL(photo.file));
    }
  }

  for (const [key, url] of Array.from(objectUrls.value.entries())) {
    if (!activeKeys.has(key)) {
      if (import.meta.client) URL.revokeObjectURL(url);
      objectUrls.value.delete(key);
    }
  }
};

watch(() => props.photos, syncObjectUrls, { immediate: true, deep: true });

onBeforeUnmount(() => {
  if (import.meta.client) {
    for (const url of objectUrls.value.values()) URL.revokeObjectURL(url);
  }
  objectUrls.value.clear();
});

const openPicker = () => {
  if (props.disabled) return;
  fileInputRef.value?.click();
};

const onFileSelected = (event: Event) => {
  const input = event.target as HTMLInputElement | null;
  const files = Array.from(input?.files ?? []);
  if (!files.length) return;

  const additions: OrderItemPhoto[] = files.map((file) => ({
    key: createPhotoKey(),
    file,
    uploadedImageId: null,
    uploadedUrl: null,
    isDamaged: true,
  }));

  emit("update:photos", [...props.photos, ...additions]);
  if (input) input.value = "";
};

const openPreview = (photo: OrderItemPhoto) => {
  const url = resolvePreviewUrl(photo);
  if (!url) return;
  previewUrl.value = url;
  previewOpen.value = true;
};

const requestRemove = (key: string) => {
  pendingRemoveKey.value = key;
  removeConfirmOpen.value = true;
};

const performRemove = () => {
  if (!pendingRemoveKey.value) return;
  emit(
    "update:photos",
    props.photos.filter((photo) => photo.key !== pendingRemoveKey.value),
  );
  pendingRemoveKey.value = null;
  removeConfirmOpen.value = false;
};
</script>

<template>
  <div class="rounded-xl border border-dashed border-default p-4">
    <div class="flex items-center justify-between gap-3">
      <div>
        <p class="font-medium text-highlighted">{{ label }}</p>
        <p v-if="photos.length === 0" class="text-sm text-muted">ยังไม่ได้แนบรูป</p>
      </div>

      <div>
        <UButton
          label="เพิ่มรูป"
          icon="i-lucide-camera"
          color="neutral"
          variant="solid"
          :disabled="disabled"
          @click="openPicker"
        />
      </div>
    </div>

    <input
      ref="fileInputRef"
      type="file"
      accept="image/*"
      multiple
      :capture="capture ?? undefined"
      class="hidden"
      @change="onFileSelected"
    >

    <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" >
      <div
        v-for="photo in photos"
        :key="photo.key"
        class="group relative overflow-hidden rounded-xl border border-default bg-muted/30"
      >
        <img
          :src="resolvePreviewUrl(photo)"
          alt="รูปผ้าชำรุด"
          class="h-28 w-full cursor-pointer object-cover"
          @click="openPreview(photo)"
        >

        <UButton
          icon="i-lucide-x"
          color="error"
          variant="solid"
          size="xs"
          class="absolute right-1 top-1"
          :disabled="disabled"
          @click.stop="requestRemove(photo.key)"
        />
      </div>
    </div>
  </div>

  <ImagePreviewModal
    v-model:open="previewOpen"
    title="รูปผ้า"
    :image-url="previewUrl"
    image-alt="รูปผ้า"
  />

  <ConfirmModal
    v-model:open="removeConfirmOpen"
    title="ลบรูปนี้"
    icon="i-lucide-trash-2"
    icon-color="error"
    confirm-label="ลบรูป"
    confirm-color="error"
    message="ต้องการลบรูปนี้หรือไม่"
    sub-message="หากยืนยันแล้ว รูปจะถูกถอดออกจากรายการผ้าชิ้นนี้"
    @confirm="performRemove"
  />
</template>
