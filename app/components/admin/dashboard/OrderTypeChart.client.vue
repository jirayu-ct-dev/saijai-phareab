<script setup lang="ts">
import type { Period, Range } from '~~/shared/types/dashboard'
import { VisSingleContainer, VisDonut } from '@unovis/vue'

const props = defineProps<{
  period: Period
  range: Range
}>()

type RawRecord = { date: string; storefront: number; washfold: number; package: number }
type TypeRecord = { label: string; value: number }

const data = ref<TypeRecord[]>([])
const isLoading = ref(false)

const COLORS = ['var(--ui-primary)', 'var(--ui-secondary)', 'var(--ui-success)']
const LABELS = ['หน้าร้าน', 'ชั่งกิโล', 'แพ็กเกจ']

const fetchData = async () => {
  isLoading.value = true
  try {
    const raw = await $fetch<RawRecord[]>('/api/admin/dashboard/order-types', {
      query: {
        from: props.range.start.toISOString(),
        to: props.range.end.toISOString(),
      },
    })

    const totals = raw.reduce(
      (acc, r) => ({
        storefront: acc.storefront + r.storefront,
        washfold: acc.washfold + r.washfold,
        package: acc.package + r.package,
      }),
      { storefront: 0, washfold: 0, package: 0 }
    )
    data.value = [
      { label: LABELS[0]!, value: totals.storefront },
      { label: LABELS[1]!, value: totals.washfold },
      { label: LABELS[2]!, value: totals.package },
    ]
  } catch {
    data.value = []
  } finally {
    isLoading.value = false
  }
}

watch([() => props.period, () => props.range], fetchData, { immediate: true })

const total = computed(() => data.value.reduce((sum, d) => sum + d.value, 0))

const percent = (value: number) => {
  if (!total.value) return 0
  return Math.round((value / total.value) * 100)
}
</script>

<template>
  <section
    class="-mx-2 overflow-visible border border-default/30 bg-default dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg"
  >
    <div class="px-4 py-3 sm:px-5">
      <p class="mb-1.5 text-xs text-muted">เปรียบเทียบออเดอร์แต่ละประเภท</p>
      <div class="flex justify-between">
        <p class="wrap-break-word text-2xl font-semibold text-highlighted sm:text-3xl">
          <template v-if="isLoading">...</template>
          <template v-else>
            {{ total.toLocaleString() }}
            <span class="ml-1 text-sm font-normal text-muted">ออเดอร์</span>
          </template>
        </p>
        <div class="mt-2 hidden flex-wrap gap-x-4 gap-y-1 text-xs text-muted sm:flex">
          <span v-for="(label, i) in LABELS" :key="i" class="flex items-center gap-1.5">
            <span class="size-2.5 rounded-sm shrink-0" :style="{ background: COLORS[i] }" />
            {{ label }}
          </span>
        </div>
      </div>
    </div>

    <div class="relative h-72 px-3 pb-4 pt-2 sm:h-80 sm:px-4 sm:pb-5 sm:pt-3">
      <div v-if="isLoading" class="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
        <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
      </div>

      <div v-if="total > 0" class="flex h-full flex-col items-center justify-center gap-4 sm:flex-row sm:gap-10">
        <div class="h-44 w-44 shrink-0 sm:h-60 sm:w-60">
          <VisSingleContainer :data="data">
            <VisDonut
              :value="(d: TypeRecord) => d.value"
              :color="(_: TypeRecord, i: number) => COLORS[i]"
              :arc-width="32"
              :pad-angle="0.02"
              :corner-radius="4"
              :central-label="total.toLocaleString()"
              central-sub-label="ออเดอร์"
            />
          </VisSingleContainer>
        </div>

        <ul class="flex flex-col gap-2.5 text-sm">
          <li v-for="(d, i) in data" :key="d.label" class="flex items-center gap-2.5">
            <span class="size-2.5 shrink-0 rounded-sm" :style="{ background: COLORS[i] }" />
            <span class="text-muted">{{ d.label }}</span>
            <span class="font-medium text-highlighted">{{ d.value.toLocaleString() }}</span>
            <span class="text-xs text-dimmed">({{ percent(d.value) }}%)</span>
          </li>
        </ul>
      </div>

      <div
        v-else-if="!isLoading"
        class="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted"
      >
        <UIcon name="i-lucide-chart-pie" class="size-8 text-dimmed" />
        <p>ไม่มีข้อมูลออเดอร์ในช่วงนี้</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.unovis-single-container {
  --vis-donut-central-label-text-color: var(--ui-text-highlighted);
  --vis-donut-central-sub-label-text-color: var(--ui-text-muted);
  --vis-donut-background-color: var(--ui-border);
}

/* unovis sizes its svg from this container's box; keep it locked to the
   fixed-size wrapper so it cannot overflow onto the legend */
section :deep([data-vis-single-container]) {
  width: 100%;
  height: 100%;
}
</style>
