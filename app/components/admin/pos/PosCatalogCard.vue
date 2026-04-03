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
  decrementDisabled?: boolean;
}>();

const emit = defineEmits<{
  select: [];
  decrement: [];
  increment: [];
}>();

const handleContextMenu = (event: MouseEvent) => {
  event.preventDefault();
  emit("decrement");
};
</script>

<template>
  <div
    role="button"
    tabindex="0"
    class="group flex h-full cursor-pointer flex-col rounded-2xl border p-4 text-left transition-colors"
    :class="selected ? 'border-primary bg-primary/10' : 'border-default bg-default hover:border-primary/60 hover:bg-neutral-50'"
    @click="emit('select')"
    @contextmenu="handleContextMenu"
    @keydown.enter.prevent="emit('select')"
    @keydown.space.prevent="emit('select')"
  >
    <div class="flex min-h-0 flex-1 flex-col">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <p class="min-h-12 text-base font-semibold text-highlighted wrap-break-word">
          {{ title }}
          </p>
          <p class="mt-1 min-h-10 text-sm text-muted wrap-break-word">
            {{ description || "ไม่มีรายละเอียดเพิ่มเติม" }}
          </p>
        </div>

        <UBadge :color="badgeColor" class="min-w-22 flex items-center justify-center self-start" variant="solid">
          {{ badgeLabel }}
        </UBadge>
      </div>
    </div>

    <div class="mt-4 flex items-end justify-between gap-3">
      <div>
        <p class="text-xl font-semibold text-highlighted">
          {{ priceLabel }}
        </p>
        <p v-if="metaLabel" class="text-xs text-muted wrap-break-word">
          {{ metaLabel }}
        </p>
      </div>

      <div class="text-right">
        <p class="text-xs text-muted">เลือกแล้ว</p>
        <div class="mt-1 inline-flex items-center gap-1 rounded-md border border-default bg-default px-1 py-1">
          <UButton icon="i-lucide-minus" color="neutral" variant="ghost" size="xs" :disabled="decrementDisabled" @click.stop="emit('decrement')" />
          <p class="min-w-8 text-center text-lg font-semibold text-highlighted">
            {{ quantity }}
          </p>
          <UButton icon="i-lucide-plus" color="neutral" variant="ghost" size="xs" @click.stop="emit('increment')" />
        </div>
      </div>
    </div>
  </div>
</template>
