<script setup lang="ts">
import { computed } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = withDefaults(defineProps<{
  lineUserId: string | null | undefined;
  label?: string;
  tooltip?: string;
  size?: string | any;
  iconOnly?: boolean;
}>(), {
  label: "แชท LINE",
  tooltip: "เปิดแชท LINE",
  size: "2xs",
  iconOnly: false,
});

const chatUrl = computed(() => {
  if (!props.lineUserId) return "#";
  const config = useRuntimeConfig();
  const baseUrl = String(config.public.lineBizChatUrl || "").replace(/\/+$/, "");
  return baseUrl ? `${baseUrl}/${props.lineUserId}` : "#";
});
</script>

<template>
  <UButton
    v-if="lineUserId && chatUrl !== '#'"
    icon="i-simple-icons-line"
    variant="ghost"
    :size="size"
    color="neutral"
    :to="chatUrl"
    target="_blank"
    :title="tooltip"
    :class="iconOnly
      ? 'shrink-0 transition-all text-[#06C755] hover:text-[#06C755]/80 duration-150 active:shadow-[inset_0_0_0_100vmax_rgba(0,0,0,0.3)]'
      : 'gap-1.5 bg-[#06C755] shrink-0 rounded border border-[#000000]/8 p-2 font-medium text-sm text-white transition-all duration-150 hover:bg-[#06C755]/80 hover:shadow-[inset_0_0_0_100vmax_rgba(0,0,0,0.1)] active:shadow-[inset_0_0_0_100vmax_rgba(0,0,0,0.3)] disabled:border-[#E5E5E5]/60 disabled:bg-white disabled:text-[#1E1E1E]/20'"
    v-bind="$attrs"
  >
    <template v-if="!iconOnly">
      <span class="hidden sm:inline">{{ label }}</span>
      <UIcon name="i-lucide-arrow-up-right" class="size-5" />
    </template>
  </UButton>
</template>
