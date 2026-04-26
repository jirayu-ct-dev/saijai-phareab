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
    <img v-if="logoUrl" :src="logoUrl" alt="logo" class="mx-auto mb-2 h-16 w-16 object-contain" crossorigin="anonymous">
    <p class="text-[22px] font-bold leading-7">{{ name }}</p>
    <p v-if="subtitle" class="mt-1 text-[15px] font-semibold">{{ subtitle }}</p>
    <p class="mt-1 text-[12px] leading-5">{{ address }}</p>
    <p class="text-[12px] leading-5">{{ phone }}</p>
  </header>
</template>
