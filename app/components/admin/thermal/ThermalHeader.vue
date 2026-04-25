<script setup lang="ts">
defineProps<{
  name: string;
  subtitle: string;
  address: string;
  phone: string;
}>();
</script>

<template>
  <header class="text-center">
    <p class="text-[22px] font-bold leading-7">{{ name }}</p>
    <p class="mt-1 text-[15px] font-semibold">{{ subtitle }}</p>
    <p class="mt-1 text-[12px] leading-5">{{ address }}</p>
    <p class="text-[12px] leading-5">{{ phone }}</p>
  </header>
</template>
