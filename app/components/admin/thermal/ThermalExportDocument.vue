<script setup lang="ts">
import { useTemplateRef } from "vue";

const element = useTemplateRef<HTMLElement>("element");

defineExpose({ element });
</script>

<template>
  <article ref="element" class="thermal-export-document">
    <slot />
  </article>
</template>

<style scoped>
.thermal-export-document {
  width: 390px;
  max-width: 390px;
  box-sizing: border-box;
  overflow: hidden;
  margin: 0;
  padding: 24px;
  background: #ffffff;
  color: #111827;
  font-family: "Noto Sans Thai", "Sarabun", "Tahoma", "Arial", sans-serif;
  font-size: 14px;
  line-height: 1.55;
  letter-spacing: 0;
  text-rendering: geometricPrecision;
  -webkit-font-smoothing: antialiased;
}
</style>
