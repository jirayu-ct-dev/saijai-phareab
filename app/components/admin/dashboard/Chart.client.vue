<script setup lang="ts">
import type { Period, Range } from '~~/shared/types/dashboard'
import type { DashboardCashflowPoint } from '~~/shared/types/expense'
import { startOfWeek, startOfMonth, format } from 'date-fns'
import { VisXYContainer, VisLine, VisAxis, VisArea, VisCrosshair, VisTooltip } from '@unovis/vue'
import { formatCurrency } from '~~/shared/utils/format'
import { useElementSize } from '@vueuse/core'

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')

const props = defineProps<{
  period: Period
  range: Range
}>()

type CashflowRecord = { date: Date; income: number; expense: number; net: number }

const { width } = useElementSize(cardRef)
const data = ref<CashflowRecord[]>([])
const isLoading = ref(false)

const fetchData = async () => {
  isLoading.value = true
  try {
    const raw = await $fetch<DashboardCashflowPoint[]>('/api/admin/dashboard/chart', {
      query: {
        from: props.range.start.toISOString(),
        to: props.range.end.toISOString(),
      },
    })

    if (props.period === 'daily') {
      data.value = raw.map((r) => ({
        date: new Date(r.date),
        income: r.income,
        expense: r.expense,
        net: r.net,
      }))
    } else if (props.period === 'weekly') {
      const weekly = new Map<string, { income: number; expense: number; net: number }>()
      for (const r of raw) {
        const d = new Date(r.date)
        const week = startOfWeek(d, { weekStartsOn: 1 })
        const key = week.toISOString()
        const current = weekly.get(key) ?? { income: 0, expense: 0, net: 0 }
        weekly.set(key, {
          income: current.income + r.income,
          expense: current.expense + r.expense,
          net: current.net + r.net,
        })
      }
      data.value = Array.from(weekly.entries()).map(([k, val]) => ({
        date: new Date(k),
        income: val.income,
        expense: val.expense,
        net: val.net,
      }))
    } else {
      const monthly = new Map<string, { income: number; expense: number; net: number }>()
      for (const r of raw) {
        const d = new Date(r.date)
        const month = startOfMonth(d)
        const key = month.toISOString()
        const current = monthly.get(key) ?? { income: 0, expense: 0, net: 0 }
        monthly.set(key, {
          income: current.income + r.income,
          expense: current.expense + r.expense,
          net: current.net + r.net,
        })
      }
      data.value = Array.from(monthly.entries()).map(([k, val]) => ({
        date: new Date(k),
        income: val.income,
        expense: val.expense,
        net: val.net,
      }))
    }
  } catch {
    data.value = []
  } finally {
    isLoading.value = false
  }
}

watch([() => props.period, () => props.range], fetchData, { immediate: true })

const x = (_: CashflowRecord, i: number) => i
const yIncome = (d: CashflowRecord) => d.income
const yExpense = (d: CashflowRecord) => d.expense

const totalIncome = computed(() => data.value.reduce((acc, d) => acc + d.income, 0))
const totalExpense = computed(() => data.value.reduce((acc, d) => acc + d.expense, 0))
const totalNet = computed(() => totalIncome.value - totalExpense.value)

const formatLabel = (date: Date): string => {
  if (props.period === 'daily') return format(date, 'd MMM')
  if (props.period === 'weekly') return `W${format(date, 'w')}`
  return format(date, 'MMM yy')
}

const xTicks = (i: number) => {
  if (i === 0 || i === data.value.length - 1 || !data.value[i]) return ''
  return formatLabel(data.value[i].date)
}

const template = (d: CashflowRecord) => {
  return `<div class="p-1 space-y-1">
    <div class="font-medium text-xs text-muted">${formatLabel(d.date)}</div>
    <div class="text-xs text-emerald-600 dark:text-emerald-400">รายรับ: ${formatCurrency(d.income)}</div>
    <div class="text-xs text-amber-600 dark:text-amber-400">รายจ่าย: ${formatCurrency(d.expense)}</div>
    <div class="text-xs font-semibold ${d.net >= 0 ? 'text-primary' : 'text-rose-600'}">สุทธิ: ${formatCurrency(d.net)}</div>
  </div>`
}
</script>

<template>
  <section
    ref="cardRef"
    class="-mx-2 overflow-visible border border-default/30 bg-default dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg"
  >
    <div class="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
      <div>
        <p class="mb-1.5 text-xs text-muted">สรุปกระแสเงินสด</p>
        <div class="flex items-baseline gap-3">
          <p class="wrap-break-word text-2xl font-semibold text-highlighted sm:text-3xl">
            {{ isLoading ? '...' : formatCurrency(totalNet) }}
          </p>
          <span class="text-xs font-medium text-muted">
            (รายรับ {{ formatCurrency(totalIncome) }} - รายจ่าย {{ formatCurrency(totalExpense) }})
          </span>
        </div>
      </div>
      <div class="flex items-center gap-3 text-xs">
        <span class="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <span class="size-2.5 rounded-full bg-emerald-500" />
          รายรับ
        </span>
        <span class="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <span class="size-2.5 rounded-full bg-amber-500" />
          รายจ่าย
        </span>
      </div>
    </div>

    <div class="relative h-72 px-3 pb-4 pt-2 sm:h-96 sm:px-4 sm:pb-5 sm:pt-3">
      <div v-if="isLoading" class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
      </div>
      <VisXYContainer v-if="data.length" :data="data" :padding="{ top: 32, right: 12, bottom: 32, left: 12 }" class="h-full" :width="width">
        <!-- Income Line & Area -->
        <VisLine :x="x" :y="yIncome" color="#10b981" />
        <VisArea :x="x" :y="yIncome" color="#10b981" :opacity="0.1" />

        <!-- Expense Line & Area -->
        <VisLine :x="x" :y="yExpense" color="#f59e0b" />
        <VisArea :x="x" :y="yExpense" color="#f59e0b" :opacity="0.1" />

        <VisAxis type="x" :x="x" :tick-format="xTicks" />
        <VisCrosshair :x="x" :template="template" />
        <VisTooltip />
      </VisXYContainer>
    </div>
  </section>
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
