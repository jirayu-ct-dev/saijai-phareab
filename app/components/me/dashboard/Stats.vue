<script setup lang="ts">
import type { Period, Range } from '~~/shared/types/dashboard'
import { formatCurrency, formatNumber } from '~~/shared/utils/format'

const props = withDefaults(defineProps<{
  period: Period
  range: Range
  refreshing?: boolean
}>(), {
  refreshing: false,
})

interface StatItem {
  title: string
  icon: string
  to: string
  value: number
  variation: number
  isCurrency?: boolean
}

interface DisplayStat extends StatItem {
  isTotal?: boolean
}

const { data: stats, status } = useAsyncData<StatItem[]>(
  'me-dashboard-stats',
  () => $fetch('/api/me/dashboard/stats', {
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

const isPending = computed(() => status.value === 'pending' || props.refreshing)

// เพิ่มการ์ดยอดใช้จ่ายรวม (คำนวณจาก isCurrency items)
const displayStats = computed<DisplayStat[]>(() => {
  const list = stats.value ?? []
  const totalSpent = list
    .filter((s) => s.isCurrency)
    .reduce((sum, s) => sum + s.value, 0)

  return [
    ...list,
    {
      title: 'ยอดใช้จ่ายรวม',
      icon: 'i-lucide-wallet',
      to: '/me/payment',
      value: totalSpent,
      variation: 0,
      isCurrency: true,
      isTotal: true,
    },
  ]
})

</script>

<template>
  <section class="-mx-2 grid grid-cols-2 gap-2 sm:mx-0 sm:gap-3 xl:grid-cols-4">
    <template v-if="isPending">
      <div
        v-for="i in 4"
        :key="`sk-${i}`"
        class="min-h-28 bg-default p-3 dark:bg-elevated/55 sm:rounded-lg sm:border sm:border-default/30 sm:dark:border-default/20"
      >
        <div class="space-y-3">
          <USkeleton class="size-10 rounded-full" />
          <USkeleton class="h-3 w-16 rounded-lg" />
          <USkeleton class="h-8 w-28 rounded-lg" />
        </div>
      </div>
    </template>

    <template v-else>
      <NuxtLink
        v-for="(stat, index) in displayStats"
        :key="index"
        :to="stat.to"
        class="min-h-28 bg-default p-3 transition-[background-color,border-color] duration-200 hover:bg-default dark:bg-elevated/55 dark:hover:bg-elevated/70 sm:rounded-lg sm:border sm:border-default/30 sm:hover:border-default/45 sm:dark:border-default/20"
      >
        <div class="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary ring ring-inset ring-primary/25">
          <UIcon :name="stat.icon" class="size-5" />
        </div>
        <p class="mt-3 text-xs text-muted">{{ stat.title }}</p>
        <div class="flex items-center gap-2">
          <span class="text-2xl font-semibold text-highlighted">
            {{ stat.isCurrency ? formatCurrency(stat.value) : formatNumber(stat.value) }}
          </span>
          <UBadge
            v-if="!stat.isTotal"
            :color="stat.variation > 0 ? 'success' : stat.variation < 0 ? 'error' : 'neutral'"
            variant="subtle"
            class="text-xs"
          >
            {{ stat.variation > 0 ? '+' : '' }}{{ stat.variation }}%
          </UBadge>
        </div>
      </NuxtLink>
    </template>
  </section>
</template>
