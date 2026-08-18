<script setup lang="ts">
import type { Period, Range } from '~~/shared/types/dashboard'
import { formatCurrency, formatNumber } from '~~/shared/utils/format'

const props = defineProps<{
  period: Period
  range: Range
}>()

interface StatItem {
  title: string
  icon: string
  to: string
  value: number
  variation: number
  isCurrency?: boolean
  statType?: 'users' | 'income' | 'expense' | 'net'
}

const { data: stats, status } = useAsyncData<StatItem[]>(
  'dashboard-stats',
  () => $fetch('/api/admin/dashboard/stats', {
    query: {
      from: props.range.start.toISOString(),
      to: props.range.end.toISOString(),
    },
  }),
  {
    server: false,
    watch: [() => props.period, () => props.range],
    default: () => [],
  }
)

const isPending = computed(() => status.value === 'pending')

const getBadgeColor = (stat: StatItem): 'success' | 'error' | 'warning' | 'neutral' => {
  if (stat.statType === 'expense') {
    // รายจ่ายเพิ่ม = error/warning, รายจ่ายลด = success
    if (stat.variation > 0) return 'error'
    if (stat.variation < 0) return 'success'
    return 'neutral'
  }

  if (stat.statType === 'net') {
    if (stat.value < 0) return 'error'
    if (stat.variation > 0) return 'success'
    if (stat.variation < 0) return 'error'
    return 'neutral'
  }

  if (stat.variation > 0) return 'success'
  if (stat.variation < 0) return 'error'
  return 'neutral'
}

const getIconColorClass = (stat: StatItem): string => {
  if (stat.statType === 'expense') {
    return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 ring-amber-500/25'
  }
  if (stat.statType === 'net') {
    return stat.value >= 0
      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ring-emerald-500/25'
      : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 ring-rose-500/25'
  }
  return 'bg-primary/10 text-primary ring-primary/25'
}
</script>

<template>
  <div class="-mx-2 grid grid-cols-2 gap-2 sm:mx-0 sm:gap-3 lg:grid-cols-4">
    <!-- Skeleton while loading -->
    <template v-if="isPending">
      <div
        v-for="i in 4"
        :key="`sk-${i}`"
        class="min-h-28 border border-default/30 bg-default p-3 dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg"
      >
        <div class="size-10 rounded-full bg-elevated animate-pulse" />
        <div class="mt-3 h-3 w-16 rounded bg-elevated animate-pulse" />
        <div class="mt-2 h-7 w-full max-w-28 rounded bg-elevated animate-pulse" />
      </div>
    </template>

    <!-- Stats cards -->
    <template v-else>
      <NuxtLink
        v-for="(stat, index) in stats"
        :key="index"
        :to="stat.to"
        class="min-h-28 border border-default/30 bg-default p-3 transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70 sm:rounded-lg"
      >
        <div :class="['flex size-10 items-center justify-center rounded-full ring ring-inset', getIconColorClass(stat)]">
          <UIcon :name="stat.icon" class="size-5" />
        </div>
        <p class="mt-3 truncate text-xs font-normal text-muted">{{ stat.title }}</p>
        <div class="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span
            class="min-w-0 wrap-break-word text-lg font-semibold leading-tight text-highlighted sm:text-2xl"
            :class="{ 'text-rose-600 dark:text-rose-400': stat.statType === 'net' && stat.value < 0 }"
          >
            {{ stat.isCurrency ? formatCurrency(stat.value) : formatNumber(stat.value) }}
          </span>
          <UBadge
            :color="getBadgeColor(stat)"
            variant="subtle"
            class="text-xs"
          >
            {{ stat.variation > 0 ? '+' : '' }}{{ stat.variation }}%
          </UBadge>
        </div>
      </NuxtLink>
    </template>
  </div>
</template>
