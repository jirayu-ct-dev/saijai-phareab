<script setup lang="ts">
import { getLocalTimeZone, CalendarDate, today } from '@internationalized/date'
import type { Range } from '~~/shared/types/dashboard'
import { THAI_MONTHS, formatDate } from '~~/shared/utils/format'

const selected = defineModel<Range>({ required: true })

// Preset ranges
const ranges = [
  { label: '7 วันที่ผ่านมา', days: 7 },
  { label: '14 วันที่ผ่านมา', days: 14 },
  { label: '30 วันที่ผ่านมา', days: 30 },
  { label: '3 เดือนที่ผ่านมา', months: 3 },
  { label: '6 เดือนที่ผ่านมา', months: 6 },
  { label: '1 ปีที่ผ่านมา', years: 1 }
]

// Year selection state
const currentYear = new Date().getFullYear()
const selectedYear = ref(currentYear)

// Generate available years (current year back to 5 years ago)
const availableYears = computed(() => {
  const years = []
  for (let year = currentYear; year >= currentYear - 10; year--) {
    years.push({
      value: year,
      label: `${year + 543}` // Buddhist Era
    })
  }
  return years
})

// Month options for selected year
const monthOptions = computed(() => {
  const options = []
  const currentMonth = new Date().getMonth()
  const buddhistYear = selectedYear.value + 543

  // If selected year is current year, only show months up to current month
  const maxMonth = selectedYear.value === currentYear ? currentMonth : 11

  // เรียงจากมกราคม (0) ไปเดือนล่าสุด
  for (let i = 0; i <= maxMonth; i++) {
    options.push({
      label: THAI_MONTHS[i],
      month: i,
      year: selectedYear.value,
      fullLabel: `${THAI_MONTHS[i]} ${buddhistYear}`
    })
  }

  return options
})

// Helpers
const toCalendarDate = (date: Date) => {
  return new CalendarDate(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  )
}

const calendarRange = computed({
  get: () => ({
    start: selected.value.start ? toCalendarDate(selected.value.start) : undefined,
    end: selected.value.end ? toCalendarDate(selected.value.end) : undefined
  }),
  set: (newValue: { start: CalendarDate | null, end: CalendarDate | null }) => {
    selected.value = {
      start: newValue.start ? newValue.start.toDate(getLocalTimeZone()) : new Date(),
      end: newValue.end ? newValue.end.toDate(getLocalTimeZone()) : new Date()
    }
  }
})

const isRangeSelected = (range: { days?: number, months?: number, years?: number }) => {
  if (!selected.value.start || !selected.value.end) return false

  const currentDate = today(getLocalTimeZone())
  let startDate = currentDate.copy()

  if (range.days) {
    startDate = startDate.subtract({ days: range.days })
  } else if (range.months) {
    startDate = startDate.subtract({ months: range.months })
  } else if (range.years) {
    startDate = startDate.subtract({ years: range.years })
  }

  const selectedStart = toCalendarDate(selected.value.start)
  const selectedEnd = toCalendarDate(selected.value.end)

  return selectedStart.compare(startDate) === 0 && selectedEnd.compare(currentDate) === 0
}

const selectRange = (range: { days?: number, months?: number, years?: number }) => {
  const endDate = today(getLocalTimeZone())
  let startDate = endDate.copy()

  if (range.days) {
    startDate = startDate.subtract({ days: range.days })
  } else if (range.months) {
    startDate = startDate.subtract({ months: range.months })
  } else if (range.years) {
    startDate = startDate.subtract({ years: range.years })
  }

  selected.value = {
    start: startDate.toDate(getLocalTimeZone()),
    end: endDate.toDate(getLocalTimeZone())
  }
}

// Select specific month
const selectMonth = (option: { month: number, year: number }) => {
  const startDate = new Date(option.year, option.month, 1)
  const endDate = new Date(option.year, option.month + 1, 0) // Last day of month

  selected.value = {
    start: startDate,
    end: endDate
  }
}

// Check if a month is selected
const isMonthSelected = (option: { month: number, year: number }) => {
  if (!selected.value.start || !selected.value.end) return false

  const startMonth = selected.value.start.getMonth()
  const startYear = selected.value.start.getFullYear()
  const startDay = selected.value.start.getDate()
  const endDate = new Date(option.year, option.month + 1, 0)

  return startMonth === option.month &&
    startYear === option.year &&
    startDay === 1 &&
    selected.value.end.getDate() === endDate.getDate()
}

// Format display text
const formatDisplayText = computed(() => {
  if (!selected.value.start) return 'เลือกวันที่'

  if (selected.value.end) {
    // Check if it's a full month selection
    const startDate = selected.value.start
    const endDate = selected.value.end
    const lastDayOfMonth = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0).getDate()

    if (startDate.getDate() === 1 &&
      endDate.getDate() === lastDayOfMonth &&
      startDate.getMonth() === endDate.getMonth() &&
      startDate.getFullYear() === endDate.getFullYear()) {
      // Full month - display as "เดือน ปี"
      const buddhistYear = startDate.getFullYear() + 543
      return `${THAI_MONTHS[startDate.getMonth()]} ${buddhistYear}`
    }

    return `${formatDate(selected.value.start)} - ${formatDate(selected.value.end)}`
  }

  return formatDate(selected.value.start)
})
</script>

<template>
  <UPopover :content="{ align: 'start' }" :modal="true" :ui="{ content: 'max-w-[95vw] max-h-[85vh] overflow-auto' }">
    <UButton color="neutral" variant="ghost" icon="i-lucide-calendar" class="data-[state=open]:bg-elevated group">
      <!-- ซ่อน text บน mobile, แสดงบน sm+ -->
      <span class="hidden sm:inline truncate">{{ formatDisplayText }}</span>

      <template #trailing>
        <UIcon
name="i-lucide-chevron-down"
          class="shrink-0 text-dimmed size-5 group-data-[state=open]:rotate-180 transition-transform duration-200" />
      </template>
    </UButton>

    <template #content>
      <div
        class="flex flex-col sm:flex-row sm:items-stretch sm:divide-x divide-default max-h-[80vh] sm:max-h-none overflow-y-auto sm:overflow-visible">
        <!-- Mobile: Quick Presets (Horizontal Scroll) -->
        <div class="sm:hidden border-b border-default p-2">
          <p class="text-xs text-muted px-2 py-1 font-medium">ช่วงเวลา</p>
          <div class="flex gap-1 overflow-x-auto pb-2">
            <UButton
v-for="(range, index) in ranges" :key="index" :label="range.label" color="neutral" variant="ghost"
              size="xs" :class="[isRangeSelected(range) ? 'bg-elevated' : '']" @click="selectRange(range)" />
          </div>

          <!-- Mobile: Year & Month Selectors -->
          <div class="flex gap-2 mt-2">
            <USelect
v-model="selectedYear" :items="availableYears" value-key="value" class="flex-1" size="sm"
              placeholder="เลือกปี" />
            <USelect
:model-value="undefined" :items="monthOptions" value-key="month" class="flex-1" size="sm"
              placeholder="เลือกเดือน"
              @update:model-value="(val: number) => selectMonth({ month: val, year: selectedYear })" />
          </div>
        </div>

        <!-- Desktop: Preset Ranges & Month Selection (Sidebar) -->
        <div class="hidden sm:flex flex-col w-48 max-h-100 overflow-y-auto">
          <!-- Quick Presets -->
          <div class="border-b border-default pb-2 mb-2">
            <p class="text-xs text-muted px-4 py-1 font-medium">ช่วงเวลา</p>
            <UButton
v-for="(range, index) in ranges" :key="index" :label="range.label" color="neutral" variant="ghost"
              class="rounded-none px-4 w-full justify-start"
              :class="[isRangeSelected(range) ? 'bg-elevated' : 'hover:bg-elevated/50']" truncate
              @click="selectRange(range)" />
          </div>

          <!-- Year Selector -->
          <div class="border-b border-default pb-2 mb-2">
            <p class="text-xs text-muted px-4 py-1 font-medium">เลือกปี</p>
            <USelect
v-model="selectedYear" :items="availableYears" value-key="value" class="mx-2 mb-2 w-40 px-2"
              size="sm" />
          </div>

          <!-- Month Selection -->
          <div>
            <p class="text-xs text-muted px-4 py-1 font-medium">
              เลือกเดือน ({{ selectedYear + 543 }})
            </p>
            <UButton
v-for="(option, index) in monthOptions" :key="index" :label="option.label" color="neutral"
              variant="ghost" class="rounded-none px-4 w-full justify-start"
              :class="[isMonthSelected(option) ? 'bg-elevated' : 'hover:bg-elevated/50']" truncate
              @click="selectMonth(option)" />
          </div>
        </div>

        <!-- Calendar - 1 เดือนบน mobile, 2 เดือนบน desktop -->
        <div class="sm:hidden">
          <UCalendar v-model="calendarRange" class="p-2" :number-of-months="1" range locale="th-TH" />
        </div>
        <div class="hidden sm:block">
          <UCalendar v-model="calendarRange" class="p-2" :number-of-months="2" range locale="th-TH" />
        </div>
      </div>
    </template>
  </UPopover>
</template>
