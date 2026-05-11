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
  isRange?: boolean;
  toneClass?: string;
}>();

const emit = defineEmits<{
  increment: [];
  decrement: [];
  change: [value: number];
}>();

const defaultSelectedToneClass = {
  primary: "border-default/30 bg-primary/10 hover:bg-primary/15",
  warning: "border-default/30 bg-warning/10 hover:bg-warning/15",
  info: "border-default/30 bg-info/10 hover:bg-info/15",
};
</script>

<template>
  <div
    role="button"
    tabindex="0"
    title="คลิกเพื่อเพิ่ม | คลิกขวาเพื่อลด"
    class="group relative flex cursor-pointer flex-col justify-between gap-2 rounded-xl border p-3 text-left transition-colors"
    :class="toneClass || (selected ? defaultSelectedToneClass[badgeColor] : 'border-default/30 bg-default hover:bg-elevated/20')"
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

      <div v-if="quantity > 0 && !isRange" class="shrink-0" @click.stop @contextmenu.stop>
        <UInputNumber
          :model-value="quantity"
          :step="1"
          size="xs"
          class="w-20"
          @update:model-value="emit('change', Math.max(0, Number.isFinite($event) ? Math.floor($event) : 0))"
        />
      </div>
      <UBadge v-else-if="quantity > 0 && isRange" color="primary" variant="subtle" size="xs" class="shrink-0">
        {{ quantity }}
      </UBadge>
    </div>
  </div>
</template>
