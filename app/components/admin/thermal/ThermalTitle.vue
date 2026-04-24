<script setup lang="ts">
defineProps<{
  text: string;
}>();
</script>

<template>
  <div>
    <div class="thermal-rule mt-4" />
    <section class="pt-3 text-center">
      <p class="text-[18px] font-bold">{{ text }}</p>
    </section>
  </div>
</template>

<style scoped>
.thermal-rule {
  border-top: 2px solid #000;
}
</style>
