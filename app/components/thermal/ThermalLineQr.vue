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
    <img :src="props.imageUrl" alt="LINE QR" class="h-52 w-52 object-contain" crossorigin="anonymous">
    <p class="text-[20px] leading-6">{{ caption }}</p>
  </section>
</template>
