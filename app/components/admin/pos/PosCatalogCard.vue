<script setup lang="ts">
defineProps<{
  title: string;
  description?: string | null;
  badgeLabel: string;
  badgeColor: "primary" | "warning" | "info";
  priceLabel: string;
  metaLabel?: string;
  quantity: number;
  selected?: boolean;
}>();

const emit = defineEmits<{
  increment: [];
  decrement: [];
  change: [value: number];
}>();
</script>

<template>
  <div
    role="button"
    tabindex="0"
    title="คลิกเพื่อเพิ่ม | คลิกขวาเพื่อลด"
    class="group relative flex cursor-pointer flex-col justify-between gap-2 rounded-xl border p-3 text-left transition-colors"
    :class="selected
      ? 'border-primary/60 bg-primary/5'
      : 'border-default bg-default hover:bg-elevated/20'"
    @click="emit('increment')"
    @contextmenu.prevent="emit('decrement')"
    @keydown.enter.prevent="emit('increment')"
    @keydown.space.prevent="emit('increment')"
  >
    <div class="min-w-0 space-y-1">
      <p class="line-clamp-2 text-sm font-medium leading-snug text-highlighted">{{ title }}</p>
      <p v-if="description" class="line-clamp-1 text-xs text-muted">{{ description }}</p>
      <UBadge :color="badgeColor" variant="subtle" size="xs" class="mt-0.5">{{ badgeLabel }}</UBadge>
    </div>

    <div class="flex items-end justify-between gap-2">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-highlighted">{{ priceLabel }}</p>
        <p v-if="metaLabel" class="truncate text-xs text-muted">{{ metaLabel }}</p>
      </div>

      <div v-if="quantity > 0" class="shrink-0" @click.stop @contextmenu.stop>
        <UInputNumber
          :model-value="quantity"
          :step="1"
          size="xs"
          class="w-20"
          @update:model-value="emit('change', Math.max(0, Number.isFinite($event) ? Math.floor($event) : 0))"
        />
      </div>
    </div>
  </div>
</template>
