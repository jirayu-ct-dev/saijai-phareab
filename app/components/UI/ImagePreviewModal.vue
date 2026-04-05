<script setup lang="ts">
const open = defineModel<boolean>("open", { default: false });

withDefaults(defineProps<{
  title?: string;
  imageUrl?: string | null;
  imageAlt?: string | null;
}>(), {
  title: "ดูรูปภาพ",
  imageUrl: null,
  imageAlt: null,
});
</script>

<template>
  <UModal v-model:open="open" :title="title">
    <template #body>
      <div class="space-y-3">
        <img
          v-if="imageUrl"
          :src="imageUrl"
          :alt="imageAlt || title"
          class="max-h-[75vh] w-full rounded-xl border border-default object-contain"
        >
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end">
        <UButton label="ปิด" color="neutral" variant="outline" @click="open = false" />
      </div>
    </template>
  </UModal>
</template>
