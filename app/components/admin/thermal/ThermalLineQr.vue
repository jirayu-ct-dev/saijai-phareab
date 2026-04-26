<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{
  caption?: string;
  imageUrl?: string | null;
}>(), {
  caption: "สอบถาม/ติดตามผ้าได้ที่ LINE",
  imageUrl: null,
});
</script>

<template>
  <section v-if="props.imageUrl" class="flex flex-col items-center gap-1">
    <img :src="props.imageUrl" alt="LINE QR" class="h-27.5 w-27.5 object-contain" crossorigin="anonymous">
    <p class="text-[11px] leading-4">{{ caption }}</p>
  </section>
</template>
