<script setup lang="ts">
defineProps<{
  text: string;
}>();
</script>

<template>
  <div>
    <div class="thermal-rule mt-4" />
    <section class="pt-3 text-center">
      <p class="thermal-title text-[34px] font-bold">{{ text }}</p>
    </section>
  </div>
</template>

<style scoped>
.thermal-rule {
  border-top: 4px solid #000;
}

.thermal-title {
  line-height: 1.4;
  overflow-wrap: anywhere;
}
</style>
