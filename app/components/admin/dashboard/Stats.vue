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
}

interface DisplayStat extends StatItem {
  isTotal?: boolean
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

// ลำดับ: ลูกค้าใหม่ → ยอดซื้อแพ็กเกจ → ยอดออเดอร์ → ยอดรวม
const displayStats = computed<DisplayStat[]>(() => {
  const list = stats.value ?? []
  const totalRevenue = list
    .filter((s) => s.isCurrency)
    .reduce((sum, s) => sum + s.value, 0)

  return [
    ...list,
    {
      title: 'ยอดรวม',
      icon: 'i-lucide-wallet',
      to: '/admin/payment',
      value: totalRevenue,
      variation: 0,
      isCurrency: true,
      isTotal: true,
    },
  ]
})

const cardUi = {
  container: 'gap-y-1.5',
  wrapper: 'items-start',
  leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
  title: 'font-normal text-muted text-xs truncate',
}
</script>

<template>
  <UPageGrid class="grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-px">
    <!-- Skeleton while loading -->
    <template v-if="isPending">
      <UPageCard
        v-for="i in 4"
        :key="`sk-${i}`"
        variant="subtle"
        :ui="cardUi"
        class="min-w-0 lg:rounded-none first:rounded-l-lg last:rounded-r-lg"
      >
        <template #leading>
          <div class="p-2.5 rounded-full bg-elevated animate-pulse size-10" />
        </template>
        <template #title>
          <div class="h-3 w-16 rounded bg-elevated animate-pulse" />
        </template>
        <div class="h-7 w-full max-w-28 rounded bg-elevated animate-pulse mt-1" />
      </UPageCard>
    </template>

    <!-- Stats cards -->
    <template v-else>
      <UPageCard
        v-for="(stat, index) in displayStats"
        :key="index"
        :icon="stat.icon"
        :title="stat.title"
        :to="stat.to"
        variant="subtle"
        :ui="cardUi"
        class="min-w-0 lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1"
      >
        <div class="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span class="min-w-0 break-words text-lg font-semibold leading-tight text-highlighted sm:text-2xl">
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
      </UPageCard>
    </template>
  </UPageGrid>
</template>
