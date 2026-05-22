<script setup lang="ts">
import type { Period, Range } from '~~/shared/types/dashboard'
import { eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfWeek, startOfMonth, format } from 'date-fns'
import { VisXYContainer, VisLine, VisAxis, VisArea, VisCrosshair, VisTooltip } from '@unovis/vue'
import { formatCurrency } from '~~/shared/utils/format'
import { useElementSize } from '@vueuse/core'

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')

const props = defineProps<{
  period: Period
  range: Range
}>()

type DataRecord = { date: Date; amount: number }

const { width } = useElementSize(cardRef)
const data = ref<DataRecord[]>([])
const isLoading = ref(false)

const fetchData = async () => {
  isLoading.value = true
  try {
    const raw = await $fetch<{ date: string; amount: number }[]>('/api/admin/dashboard/chart', {
      query: {
        from: props.range.start.toISOString(),
        to: props.range.end.toISOString(),
      },
    })

    if (props.period === 'daily') {
      data.value = raw.map((r) => ({ date: new Date(r.date), amount: r.amount }))
    } else if (props.period === 'weekly') {
      const weekly = new Map<string, number>()
      for (const r of raw) {
        const d = new Date(r.date)
        const week = startOfWeek(d, { weekStartsOn: 1 })
        const key = week.toISOString()
        weekly.set(key, (weekly.get(key) ?? 0) + r.amount)
      }
      data.value = Array.from(weekly.entries()).map(([k, amount]) => ({ date: new Date(k), amount }))
    } else {
      const monthly = new Map<string, number>()
      for (const r of raw) {
        const d = new Date(r.date)
        const month = startOfMonth(d)
        const key = month.toISOString()
        monthly.set(key, (monthly.get(key) ?? 0) + r.amount)
      }
      data.value = Array.from(monthly.entries()).map(([k, amount]) => ({ date: new Date(k), amount }))
    }
  } catch {
    data.value = []
  } finally {
    isLoading.value = false
  }
}

watch([() => props.period, () => props.range], fetchData, { immediate: true })

const x = (_: DataRecord, i: number) => i
const y = (d: DataRecord) => d.amount

const total = computed(() => data.value.reduce((acc, d) => acc + d.amount, 0))

const formatLabel = (date: Date): string => {
  if (props.period === 'daily') return format(date, 'd MMM')
  if (props.period === 'weekly') return `W${format(date, 'w')}`
  return format(date, 'MMM yy')
}

const xTicks = (i: number) => {
  if (i === 0 || i === data.value.length - 1 || !data.value[i]) return ''
  return formatLabel(data.value[i].date)
}

const template = (d: DataRecord) => `${formatLabel(d.date)}: ${formatCurrency(d.amount)}`
</script>

<template>
  <UCard
    ref="cardRef"
    :ui="{
      root: 'overflow-visible',
      header: '!px-4 sm:!px-5',
      body: 'px-3! !pt-2 !pb-4 sm:!px-4 sm:!pt-3 sm:!pb-5'
    }"
  >
    <template #header>
      <div class="py-3">
        <p class="mb-1.5 text-xs text-muted">รายได้รวม</p>
        <p class="wrap-break-word text-2xl font-semibold text-highlighted sm:text-3xl">
          {{ isLoading ? '...' : formatCurrency(total) }}
        </p>
      </div>
    </template>

    <div class="relative h-72 sm:h-96">
      <div v-if="isLoading" class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
      </div>
      <VisXYContainer v-if="data.length" :data="data" :padding="{ top: 32, right: 12, bottom: 32, left: 12 }" class="h-full" :width="width">
        <VisLine :x="x" :y="y" color="var(--ui-primary)" />
        <VisArea :x="x" :y="y" color="var(--ui-primary)" :opacity="0.1" />
        <VisAxis type="x" :x="x" :tick-format="xTicks" />
        <VisCrosshair :x="x" :y="y" color="var(--ui-primary)" :template="template" />
        <VisTooltip />
      </VisXYContainer>
    </div>
  </UCard>
</template>

<style scoped>
.unovis-xy-container {
  --vis-crosshair-line-stroke-color: var(--ui-primary);
  --vis-crosshair-circle-stroke-color: var(--ui-bg);
  --vis-axis-grid-color: var(--ui-border);
  --vis-axis-tick-color: var(--ui-border);
  --vis-axis-tick-label-color: var(--ui-text-dimmed);
  --vis-tooltip-background-color: var(--ui-bg);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text-highlighted);
}
</style>
