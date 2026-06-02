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
        v-for="(stat, index) in displayStats"
        :key="index"
        :to="stat.to"
        class="min-h-28 border border-default/30 bg-default p-3 transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70 sm:rounded-lg"
      >
        <div class="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary ring ring-inset ring-primary/25">
          <UIcon :name="stat.icon" class="size-5" />
        </div>
        <p class="mt-3 truncate text-xs font-normal text-muted">{{ stat.title }}</p>
        <div class="flex min-w-0 flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
          <span class="min-w-0 wrap-break-word text-lg font-semibold leading-tight text-highlighted sm:text-2xl">
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
  </div>
</template>
