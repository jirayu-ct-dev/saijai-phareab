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
  <UModal v-model:open="open" :title="title" :ui="{ body: 'admin-workspace !p-2 sm:p-4!', content: 'max-w-3xl' }">
    <template #body>
      <div class="rounded-md border border-default/30 bg-default p-2 dark:border-default/20 dark:bg-elevated/55">
        <img
          v-if="imageUrl"
          :src="imageUrl"
          :alt="imageAlt || title"
          class="max-h-[75vh] w-full rounded-md object-contain"
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
