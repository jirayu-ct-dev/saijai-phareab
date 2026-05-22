<script setup lang="ts">
import ImagePreviewModal from "~~/app/components/UI/ImagePreviewModal.vue";
import ConfirmModal from "~~/app/components/UI/ConfirmModal.vue";

export type Photo = {
  key: string;
  file: File | null;
  url: string | null;
};

const props = withDefaults(defineProps<{
  photos: Photo[];
  max?: number;
  label?: string;
  description?: string;
  disabled?: boolean;
  accept?: string;
  capture?: "environment" | "user" | null;
  confirmRemove?: boolean;
}>(), {
  max: undefined,
  label: "รูปภาพ",
  description: undefined,
  disabled: false,
  accept: "image/*",
  capture: null,
  confirmRemove: false,
});

const emit = defineEmits<{
  "update:photos": [value: Photo[]];
}>();

let seed = 0;
const createKey = () => `photo-${Date.now()}-${++seed}`;

const objectUrls = ref(new Map<string, string>());
const previewOpen = ref(false);
const previewUrl = ref("");
const removeConfirmOpen = ref(false);
const pendingRemoveKey = ref<string | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);

const resolveUrl = (photo: Photo): string => {
  if (photo.url) return photo.url;
  return objectUrls.value.get(photo.key) ?? "";
};

const syncObjectUrls = () => {
  const activeKeys = new Set(props.photos.map((p) => p.key));
  for (const photo of props.photos) {
    if (!photo.file) continue;
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
});

const isFull = computed(() => props.max !== undefined && props.photos.length >= props.max);
const helperText = computed(() => props.description ?? (props.photos.length === 0 ? "ยังไม่ได้แนบรูป" : `${props.photos.length} รูป`));

const openPicker = () => {
  if (props.disabled || isFull.value) return;
  fileInputRef.value?.click();
};

const onFileSelected = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  if (!files.length) return;

  const additions: Photo[] = files
    .slice(0, props.max !== undefined ? props.max - props.photos.length : undefined)
    .map((file) => ({ key: createKey(), file, url: null }));

  emit("update:photos", [...props.photos, ...additions]);
  input.value = "";
};

const openPreview = (photo: Photo) => {
  const url = resolveUrl(photo);
  if (!url) return;
  previewUrl.value = url;
  previewOpen.value = true;
};

const requestRemove = (key: string) => {
  if (props.confirmRemove) {
    pendingRemoveKey.value = key;
    removeConfirmOpen.value = true;
    return;
  }
  doRemove(key);
};

const doRemove = (key: string) => {
  emit("update:photos", props.photos.filter((p) => p.key !== key));
};

const performRemove = () => {
  if (pendingRemoveKey.value) doRemove(pendingRemoveKey.value);
  pendingRemoveKey.value = null;
  removeConfirmOpen.value = false;
};
</script>

<template>
  <div class="rounded-md border border-dashed border-default/45 bg-default/70 p-3 transition-colors dark:border-default/25 dark:bg-elevated/35">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <p class="truncate text-sm font-medium text-highlighted">{{ label }}</p>
        <p class="mt-0.5 text-xs text-muted">{{ helperText }}</p>
      </div>

      <UButton
        v-if="!isFull"
        label="เพิ่มรูป"
        icon="i-lucide-upload"
        color="neutral"
        variant="outline"
        size="sm"
        class="shrink-0"
        :disabled="disabled"
        @click="openPicker"
      />
    </div>

    <input
      ref="fileInputRef"
      type="file"
      :accept="accept"
      :capture="capture ?? undefined"
      :multiple="max === undefined || max > 1"
      class="hidden"
      @change="onFileSelected"
    >

    <div
      v-if="!photos.length"
      class="mt-3 rounded-md border border-dashed border-default/45 bg-elevated/20 px-3 py-2 text-xs text-muted dark:border-default/25 dark:bg-elevated/20"
    >
      ยังไม่มีรูปภาพ
    </div>

    <div v-if="photos.length" class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
      <div
        v-for="photo in photos"
        :key="photo.key"
        class="group relative overflow-hidden rounded-md border border-default/40 bg-elevated/30 dark:border-default/25 dark:bg-elevated/35"
      >
        <button type="button" class="block w-full" @click="openPreview(photo)">
          <img
            :src="resolveUrl(photo)"
            alt="รูปภาพ"
            class="aspect-square w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
          >
        </button>
        <UButton
          icon="i-lucide-x"
          color="error"
          variant="solid"
          size="xs"
          class="absolute right-1 top-1 opacity-95 shadow-sm"
          :disabled="disabled"
          aria-label="ลบรูป"
          @click.stop="requestRemove(photo.key)"
        />
      </div>
    </div>
  </div>

  <ImagePreviewModal v-model:open="previewOpen" title="ดูรูป" :image-url="previewUrl" image-alt="รูปภาพ" />

  <ConfirmModal
    v-model:open="removeConfirmOpen"
    title="ลบรูปนี้"
    icon="i-lucide-trash-2"
    icon-color="error"
    confirm-label="ลบรูป"
    confirm-color="error"
    message="ต้องการลบรูปนี้หรือไม่"
    @confirm="performRemove"
  />
</template>
