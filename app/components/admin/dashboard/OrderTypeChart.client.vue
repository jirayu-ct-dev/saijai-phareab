<script setup lang="ts">
import type { Period, Range } from '~~/shared/types/dashboard'
import { startOfWeek, startOfMonth } from 'date-fns'
import { VisXYContainer, VisGroupedBar, VisAxis, VisCrosshair, VisTooltip } from '@unovis/vue'
import { useElementSize } from '@vueuse/core'

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')

const props = defineProps<{
  period: Period
  range: Range
}>()

type RawRecord = { date: string; storefront: number; washfold: number; package: number }
type DataRecord = { date: Date; storefront: number; washfold: number; package: number }

const { width } = useElementSize(cardRef)
const data = ref<DataRecord[]>([])
const isLoading = ref(false)

const COLORS = ['var(--ui-primary)', 'var(--ui-secondary)', 'var(--ui-success)']

const fetchData = async () => {
  isLoading.value = true
  try {
    const raw = await $fetch<RawRecord[]>('/api/admin/dashboard/order-types', {
      query: {
        from: props.range.start.toISOString(),
        to: props.range.end.toISOString(),
      },
    })

    if (props.period === 'daily') {
      data.value = raw.map((r) => ({ ...r, date: new Date(r.date) }))
    } else if (props.period === 'weekly') {
      const weekly = new Map<string, DataRecord>()
      for (const r of raw) {
        const week = startOfWeek(new Date(r.date), { weekStartsOn: 1 })
        const key = week.toISOString()
        const existing = weekly.get(key) ?? { date: week, storefront: 0, washfold: 0, package: 0 }
        existing.storefront += r.storefront
        existing.washfold += r.washfold
        existing.package += r.package
        weekly.set(key, existing)
      }
      data.value = Array.from(weekly.values())
    } else {
      const monthly = new Map<string, DataRecord>()
      for (const r of raw) {
        const month = startOfMonth(new Date(r.date))
        const key = month.toISOString()
        const existing = monthly.get(key) ?? { date: month, storefront: 0, washfold: 0, package: 0 }
        existing.storefront += r.storefront
        existing.washfold += r.washfold
        existing.package += r.package
        monthly.set(key, existing)
      }
      data.value = Array.from(monthly.values())
    }
  } catch {
    data.value = []
  } finally {
    isLoading.value = false
  }
}

watch([() => props.period, () => props.range], fetchData, { immediate: true })

const x = (_: DataRecord, i: number) => i
const y = [
  (d: DataRecord) => d.storefront,
  (d: DataRecord) => d.washfold,
  (d: DataRecord) => d.package,
]

const total = computed(() =>
  data.value.reduce((sum, d) => sum + d.storefront + d.washfold + d.package, 0)
)

const xTicks = (i: number) => {
  if (!data.value[i]) return ''
  const d = data.value[i].date
  if (props.period === 'monthly') return `${d.toLocaleString('th', { month: 'short' })}`
  return `${d.getDate()}/${d.getMonth() + 1}`
}

const LABELS = ['หน้าร้าน', 'ชั่งกิโล', 'แพ็กเกจ']

const tooltipTemplate = (d: DataRecord) =>
  `<div class="space-y-1 text-sm p-1">
    <p class="font-medium">${d.date.getDate()}/${d.date.getMonth() + 1}/${d.date.getFullYear()}</p>
    <p>หน้าร้าน: <b>${d.storefront}</b></p>
    <p>ชั่งกิโล: <b>${d.washfold}</b></p>
    <p>แพ็กเกจ: <b>${d.package}</b></p>
  </div>`
</script>

<template>
  <UCard ref="cardRef" :ui="{ root: 'overflow-visible', body: '!px-0 !pt-0 !pb-3' }">
    <template #header>
      <div class="flex items-start justify-between">
        <div>
          <p class="text-xs text-muted mb-1">เปรียบเทียบออเดอร์แต่ละประเภท</p>
          <p class="text-3xl text-highlighted font-semibold">
            {{ isLoading ? '...' : total.toLocaleString() }}
            <span class="text-sm font-normal text-muted ml-1">ออเดอร์</span>
          </p>
        </div>
        <!-- Legend -->
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted mt-1">
          <span v-for="(label, i) in LABELS" :key="i" class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-sm shrink-0" :style="{ background: COLORS[i] }" />
            {{ label }}
          </span>
        </div>
      </div>
    </template>

    <div v-if="isLoading" class="h-64 flex items-center justify-center">
      <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
    </div>

    <VisXYContainer v-else :data="data" :padding="{ top: 40, bottom: 32 }" :y-domain="[0, undefined]" class="h-96" :width="width">
      <VisGroupedBar
        :x="x"
        :y="y"
        :color="COLORS"
        :rounded-corners="3"
        :bar-padding="0.1"
        :group-padding="0.2"
      />
      <VisAxis type="x" :x="x" :tick-format="xTicks" />
      <VisCrosshair :x="x" :y="y" :color="COLORS" :template="tooltipTemplate" />
      <VisTooltip />
    </VisXYContainer>
  </UCard>
</template>

<style scoped>
.unovis-xy-container {
  --vis-axis-grid-color: var(--ui-border);
  --vis-axis-tick-color: var(--ui-border);
  --vis-axis-tick-label-color: var(--ui-text-dimmed);
  --vis-tooltip-background-color: var(--ui-bg);
  --vis-tooltip-border-color: var(--ui-border);
  --vis-tooltip-text-color: var(--ui-text-highlighted);
  --vis-crosshair-line-stroke-color: var(--ui-border);
  --vis-crosshair-circle-stroke-color: var(--ui-bg);
}
</style>
