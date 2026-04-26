<script setup lang="ts">
/**
 * Dashboard Stats Component
 * แสดงสถิติสำหรับ Admin Dashboard
 */

import type { Period, Range, Stat } from '~~/shared/types/dashboard'
import { formatCurrency, formatNumber } from '~~/shared/utils/format'
import { randomInt } from '~~/shared/utils/math'

const props = defineProps<{
  period: Period
  range: Range
}>()

// ============================================================
// Stats Configuration (สถิติสำหรับร้านซักรีด)
// ============================================================

const baseStats = [
  {
    title: 'รับผ้า',
    icon: 'i-lucide-shopping-basket',
    to: '/admin/service-orders',
    minValue: 10,
    maxValue: 50,
    minVariation: -10,
    maxVariation: 25,
    formatter: formatNumber
  },
  {
    title: 'รายได้',
    icon: 'i-lucide-banknote',
    to: '/admin/payments',
    minValue: 5000,
    maxValue: 25000,
    minVariation: -15,
    maxVariation: 30,
    formatter: formatCurrency
  },
  {
    title: 'ลูกค้าใหม่',
    icon: 'i-lucide-user-plus',
    to: '/admin/users',
    minValue: 5,
    maxValue: 20,
    minVariation: -5,
    maxVariation: 50,
    formatter: formatNumber
  },
  {
    title: 'รอดำเนินการ',
    icon: 'i-lucide-clock',
    to: '/admin/service-orders?status=RECEIVED',
    minValue: 3,
    maxValue: 15,
    minVariation: -20,
    maxVariation: 10,
    formatter: formatNumber
  }
]

// ============================================================
// Data Fetching
// ============================================================

const { data: stats } = await useAsyncData<Stat[]>(
  'dashboard-stats',
  async () => {
    // TODO: เปลี่ยนเป็นเรียก API จริง
    return baseStats.map((stat) => {
      const value = randomInt(stat.minValue, stat.maxValue)
      const variation = randomInt(stat.minVariation, stat.maxVariation)

      return {
        title: stat.title,
        icon: stat.icon,
        to: stat.to,
        value: stat.formatter ? stat.formatter(value) : value,
        variation
      }
    })
  },
  {
    watch: [() => props.period, () => props.range],
    default: () => []
  }
)
</script>

<template>
  <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px">
    <UPageCard v-for="(stat, index) in stats" :key="index" :icon="stat.icon" :title="stat.title" :to="stat.to"
      variant="subtle" :ui="{
        container: 'gap-y-1.5',
        wrapper: 'items-start',
        leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
        title: 'font-normal text-muted text-xs'
      }" class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1">
      <div class="flex items-center gap-2">
        <span class="text-2xl font-semibold text-highlighted">
          {{ stat.value }}
        </span>

        <UBadge :color="stat.variation > 0 ? 'success' : 'error'" variant="subtle" class="text-xs">
          {{ stat.variation > 0 ? '+' : '' }}{{ stat.variation }}%
        </UBadge>
      </div>
    </UPageCard>
  </UPageGrid>
</template>
