<script setup lang="ts">
import { computed } from "vue";

withDefaults(defineProps<{
  caption?: string;
}>(), {
  caption: "สอบถาม/ติดตามผ้าได้ที่ LINE",
});

const runtimeConfig = useRuntimeConfig();
const lineBizChatUrl = computed(() => (runtimeConfig.public as Record<string, string | undefined>).lineBizChatUrl || "");
const qrUrl = computed(() => {
  if (!lineBizChatUrl.value) return "";
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=0&data=${encodeURIComponent(lineBizChatUrl.value)}`;
});
</script>

<template>
  <section v-if="qrUrl" class="flex flex-col items-center gap-1">
    <img :src="qrUrl" alt="LINE QR" class="h-27.5 w-27.5" crossorigin="anonymous">
    <p class="text-[11px] leading-4">{{ caption }}</p>
  </section>
</template>
