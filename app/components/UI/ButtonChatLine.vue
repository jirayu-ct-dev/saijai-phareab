<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  lineUserId: string | null | undefined
  label?: string
  size?: string | any
}>(), {
  label: 'แชท LINE',
  size: '2xs'
})

const chatUrl = computed(() => {
  if (!props.lineUserId) return '#'
  const config = useRuntimeConfig()
  return `${config.public.lineBizChatUrl}/${props.lineUserId}`
})

</script>

<template>
  <UButton
    v-if="lineUserId"
    icon="i-simple-icons-line"
    variant="ghost"
    :size="size"
    color="neutral"
    :to="chatUrl"
    target="_blank"
    title="เปิดแชท LINE"
    :label="label"
    class="gap-1.5 bg-[#06C755] shrink-0 hover:bg-[#06C755]/80 text-white rounded p-2 border border-[#000000]/8 font-medium text-sm transition-all duration-150 hover:shadow-[inset_0_0_0_100vmax_rgba(0,0,0,0.1)] active:shadow-[inset_0_0_0_100vmax_rgba(0,0,0,0.3)] disabled:bg-white disabled:text-[#1E1E1E]/20 disabled:border-[#E5E5E5]/60"
    v-bind="$attrs"
  />
</template>
