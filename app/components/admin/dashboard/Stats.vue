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

const totalRevenue = computed(() =>
  (stats.value ?? [])
    .filter((s) => s.isCurrency)
    .reduce((sum, s) => sum + s.value, 0)
)

const cardUi = {
  container: 'gap-y-1.5',
  wrapper: 'items-start',
  leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
  title: 'font-normal text-muted text-xs',
}
</script>

<template>
  <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px">
    <!-- Skeleton while loading -->
    <template v-if="isPending">
      <UPageCard
        v-for="i in 4"
        :key="`sk-${i}`"
        variant="subtle"
        :ui="cardUi"
        class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg"
      >
        <template #leading>
          <div class="p-2.5 rounded-full bg-elevated animate-pulse size-10" />
        </template>
        <template #title>
          <div class="h-3 w-16 rounded bg-elevated animate-pulse" />
        </template>
        <div class="h-8 w-28 rounded bg-elevated animate-pulse mt-1" />
      </UPageCard>
    </template>

    <!-- ยอดรวม + stats -->
    <template v-else>
      <UPageCard
        icon="i-lucide-wallet"
        title="ยอดรวม"
        to="/admin/payment"
        variant="subtle"
        :ui="cardUi"
        class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1"
      >
        <div class="flex items-center gap-2">
          <span class="text-2xl font-semibold text-highlighted">
            {{ formatCurrency(totalRevenue) }}
          </span>
        </div>
      </UPageCard>

      <UPageCard
        v-for="(stat, index) in stats"
        :key="index"
        :icon="stat.icon"
        :title="stat.title"
        :to="stat.to"
        variant="subtle"
        :ui="cardUi"
        class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1"
      >
        <div class="flex items-center gap-2">
          <span class="text-2xl font-semibold text-highlighted">
            {{ stat.isCurrency ? formatCurrency(stat.value) : formatNumber(stat.value) }}
          </span>
          <UBadge
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
