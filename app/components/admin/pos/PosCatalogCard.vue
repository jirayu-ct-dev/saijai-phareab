<script setup lang="ts">
import { adminCatalogCardBaseClass } from "~~/shared/config/adminUi";

defineProps<{
  title?: string;
  description?: string | null;
  badgeLabel?: string;
  badgeColor?: "primary" | "warning" | "info";
  priceLabel?: string;
  metaLabel?: string;
  quantity?: number;
  selected?: boolean;
  isRange?: boolean;
  toneClass?: string;
  loading?: boolean;
}>();

const emit = defineEmits<{
  increment: [];
  decrement: [];
  change: [value: number];
}>();

const defaultSelectedToneClass = {
  primary: "border-primary/30 bg-primary/[0.05] hover:bg-primary/[0.08] dark:border-primary/25 dark:bg-elevated/65 dark:hover:bg-elevated/75",
  warning: "border-warning/30 bg-warning/[0.06] hover:bg-warning/[0.09] dark:border-warning/25 dark:bg-elevated/65 dark:hover:bg-elevated/75",
  info: "border-info/30 bg-info/[0.05] hover:bg-info/[0.08] dark:border-info/25 dark:bg-elevated/65 dark:hover:bg-elevated/75",
};
</script>

<template>
  <div
    v-if="loading"
    :class="[adminCatalogCardBaseClass, 'admin-pos-catalog-card rounded-md border-default/30 bg-default dark:border-default/20 dark:bg-elevated/55']"
    aria-hidden="true"
  >
    <div class="min-w-0 space-y-2">
      <USkeleton class="h-4 w-3/4 rounded" />
      <USkeleton class="h-3 w-1/2 rounded" />
      <USkeleton class="h-4 w-16 rounded-full" />
    </div>
    <div class="flex items-end justify-between gap-3 border-t border-default/15 pt-2.5 dark:border-default/10">
      <div class="min-w-0 space-y-1.5">
        <USkeleton class="h-4 w-16 rounded" />
        <USkeleton class="h-3 w-24 rounded" />
      </div>
      <USkeleton class="h-7 w-14 rounded-md" />
    </div>
  </div>

  <div
    v-else
    role="button"
    tabindex="0"
    title="คลิกเพื่อเพิ่ม | คลิกขวาเพื่อลด"
    :class="[
      adminCatalogCardBaseClass,
      'admin-pos-catalog-card rounded-md',
      toneClass || (selected ? defaultSelectedToneClass[badgeColor || 'primary'] : 'border-default/30 bg-default hover:border-default/45 dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70')
    ]"
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

    <div class="flex items-end justify-between gap-3 border-t border-default/15 pt-2.5 dark:border-default/10">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-highlighted">{{ priceLabel }}</p>
        <p v-if="metaLabel" class="truncate text-xs text-muted">{{ metaLabel }}</p>
      </div>

      <div v-if="(quantity ?? 0) > 0 && !isRange" class="shrink-0" @click.stop @contextmenu.stop>
        <UInputNumber
          :model-value="quantity"
          :step="1"
          size="xs"
          class="w-20"
          @update:model-value="emit('change', Math.max(0, Number.isFinite($event) ? Math.floor($event) : 0))"
        />
      </div>
      <UBadge v-else-if="(quantity ?? 0) > 0 && isRange" color="primary" variant="subtle" size="xs" class="shrink-0">
        {{ quantity }}
      </UBadge>
    </div>
  </div>
</template>

<style scoped>
.admin-pos-catalog-card {
  border-radius: 0.375rem !important;
}
</style>
