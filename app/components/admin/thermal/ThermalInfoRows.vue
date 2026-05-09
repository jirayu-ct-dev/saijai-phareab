<script setup lang="ts">
import { computed } from "vue";

type InfoRow = {
  label: string;
  value: string | number | null | undefined;
  show?: boolean;
  multiline?: boolean;
};

const props = defineProps<{
  rows: InfoRow[];
}>();

const visibleRows = computed(() => props.rows.filter((row) => row.show !== false && row.value !== null && row.value !== undefined && row.value !== ""));
</script>

<template>
  <section class="thermal-info-section grid gap-1 text-[22px]">
    <div
      v-for="(row, idx) in visibleRows"
      :key="idx"
      :class="['thermal-info-row', { 'items-start': row.multiline }]"
    >
      <span>{{ row.label }}:</span>
      <span :class="['text-right', row.multiline ? 'wrap-break-word whitespace-pre-line' : 'whitespace-nowrap']">{{ row.value }}</span>
    </div>
  </section>
</template>

<style scoped>
.thermal-info-section { line-height: 1.45; }

.thermal-info-row {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  align-items: start;
  gap: 16px;
}

.thermal-info-row > span:first-child {
  white-space: nowrap;
}

.thermal-info-row > span:last-child {
  min-width: 0;
  text-align: right;
  overflow-wrap: anywhere;
}
</style>
