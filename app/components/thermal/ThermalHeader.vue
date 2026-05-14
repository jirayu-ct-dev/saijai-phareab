<script setup lang="ts">
defineProps<{
  name: string;
  subtitle?: string;
  address: string;
  phone: string;
  logoUrl?: string | null;
}>();
</script>

<template>
  <header class="text-center">
    <img
      v-if="logoUrl"
      :src="logoUrl"
      alt="logo"
      class="mx-auto mb-3 h-28 w-28 object-contain"
      crossorigin="anonymous"
    >
    <p class="thermal-header-name text-[34px] font-bold">{{ name }}</p>
    <p v-if="subtitle" class="thermal-header-subtitle mt-1 text-[24px] font-semibold">{{ subtitle }}</p>
    <p class="thermal-header-detail mt-2 text-[20px]">{{ address }}</p>
    <p class="thermal-header-detail text-[20px]">{{ phone }}</p>
  </header>
</template>

<style scoped>
.thermal-header-name,
.thermal-header-subtitle,
.thermal-header-detail {
  line-height: 1.4;
  overflow-wrap: anywhere;
  word-break: normal;
}
</style>
