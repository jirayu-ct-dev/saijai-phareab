<script setup lang="ts">
/**
 * Dashboard Revenue Chart Component
 * 
 * แสดงกราฟรายได้สำหรับ Admin Dashboard
 * รองรับการแสดงผลแบบ รายวัน, รายสัปดาห์, รายเดือน
 */

import type { Period, Range } from '~~/shared/types/dashboard'
import { eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns'
import { VisXYContainer, VisLine, VisAxis, VisArea, VisCrosshair, VisTooltip } from '@unovis/vue'
import { formatCurrency, formatDateByPeriod } from '~~/shared/utils/format'
import { randomInt } from '~~/shared/utils/math'
import { useElementSize } from '@vueuse/core'

const cardRef = useTemplateRef<HTMLElement | null>('cardRef')

const props = defineProps<{
    period: Period
    range: Range
}>()

// ============================================================
// Types
// ============================================================

type DataRecord = {
    date: Date
    amount: number
}

// ============================================================
// Reactive State
// ============================================================

const { width } = useElementSize(cardRef)
const data = ref<DataRecord[]>([])
const isLoading = ref(false)

// ============================================================
// Data Fetching
// ============================================================

/**
 * ดึงข้อมูลจาก API
 * TODO: เปลี่ยนเป็น API จริงเมื่อพร้อม
 */
const fetchData = async () => {
    isLoading.value = true

    try {
        // TODO: เปลี่ยนเป็นเรียก API จริง
        // const response = await $fetch('/api/dashboard/revenue', {
        //   query: {
        //     period: props.period,
        //     startDate: props.range.start.toISOString(),
        //     endDate: props.range.end.toISOString()
        //   }
        // })
        // data.value = response.data

        // Mock Data (ลบเมื่อเชื่อม API จริง)
        const dates = ({
            daily: eachDayOfInterval,
            weekly: eachWeekOfInterval,
            monthly: eachMonthOfInterval
        } as Record<Period, typeof eachDayOfInterval>)[props.period](props.range)

        const minAmount = 1000
        const maxAmount = 15000

        data.value = dates.map(date => ({
            date,
            amount: randomInt(minAmount, maxAmount)
        }))

    } catch (error) {
        console.error('Failed to fetch chart data:', error)
        data.value = []
    } finally {
        isLoading.value = false
    }
}

// Watch for changes and refetch
watch([() => props.period, () => props.range], fetchData, { immediate: true })

// ============================================================
// Chart Configuration
// ============================================================

/** แกน X = index */
const x = (_: DataRecord, i: number) => i

/** แกน Y = amount */
const y = (d: DataRecord) => d.amount

/** ยอดรวมทั้งหมด */
const total = computed(() =>
    data.value.reduce((acc: number, { amount }) => acc + amount, 0)
)

// ============================================================
// Chart Formatters
// ============================================================

/** Format วันที่ตาม period */
const formatDate = (date: Date): string => formatDateByPeriod(date, props.period)

/** Label แกน X */
const xTicks = (i: number) => {
    // ซ่อน label แรกและสุดท้าย
    if (i === 0 || i === data.value.length - 1 || !data.value[i]) {
        return ''
    }
    return formatDate(data.value[i].date)
}

/** Template สำหรับ Tooltip */
const template = (d: DataRecord) =>
    `${formatDate(d.date)}: ${formatCurrency(d.amount)}`
</script>

<template>
    <UCard ref="cardRef" :ui="{ root: 'overflow-visible', body: '!px-0 !pt-0 !pb-3' }">
        <!-- Header: ยอดรวม -->
        <template #header>
            <div>
                <p class="text-xs text-muted mb-1.5">
                    รายได้รวม
                </p>
                <p class="text-3xl text-highlighted font-semibold">
                    {{ formatCurrency(total) }}
                </p>
            </div>
        </template>

        <!-- Loading State -->
        <div v-if="isLoading" class="h-96 flex items-center justify-center">
            <UIcon name="i-lucide-loader-2" class="size-8 animate-spin text-primary" />
        </div>

        <!-- Chart -->
        <VisXYContainer v-else :data="data" :padding="{ top: 40 }" class="h-96" :width="width">
            <!-- เส้นกราฟ -->
            <VisLine :x="x" :y="y" color="var(--ui-primary)" />

            <!-- พื้นที่ใต้เส้น (Gradient) -->
            <VisArea :x="x" :y="y" color="var(--ui-primary)" :opacity="0.1" />

            <!-- แกน X (วันที่) -->
            <VisAxis type="x" :x="x" :tick-format="xTicks" />

            <!-- Crosshair (เส้นตาม cursor) -->
            <VisCrosshair :x="x" :y="y" color="var(--ui-primary)" :template="template" />

            <!-- Tooltip -->
            <VisTooltip />
        </VisXYContainer>
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
