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
  <UCard
    ref="cardRef"
    :ui="{
      root: 'overflow-visible',
      header: '!px-4 sm:!px-5',
      body: '!px-3 !pt-2 !pb-4 sm:!px-4 sm:!pt-3 sm:!pb-5'
    }"
  >
    <template #header>
      <div class="py-3">
        <p class="mb-1.5 text-xs text-muted">เปรียบเทียบออเดอร์แต่ละประเภท</p>
        <div class="flex justify-between">
          <p class="wrap-break-word text-2xl font-semibold text-highlighted sm:text-3xl">
            <template v-if="isLoading">...</template>
            <template v-else>
              {{ total.toLocaleString() }}
              <span class="ml-1 text-sm font-normal text-muted">ออเดอร์</span>
            </template>
        </p>
        <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span v-for="(label, i) in LABELS" :key="i" class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-sm shrink-0" :style="{ background: COLORS[i] }" />
            {{ label }}
          </span>
        </div>
      </div>
      </div>
    </template>

    <div class="relative h-72 sm:h-96">
      <div v-if="isLoading" class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
      </div>
      <VisXYContainer v-if="data.length" :data="data" :padding="{ top: 32, right: 12, bottom: 32, left: 12 }" :y-domain="[0, undefined]" class="h-full" :width="width">
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
    </div>
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
