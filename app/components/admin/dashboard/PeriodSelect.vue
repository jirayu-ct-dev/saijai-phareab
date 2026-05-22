<script setup lang="ts">
import { eachDayOfInterval } from 'date-fns'
import type { Period, Range } from '~~/shared/types/dashboard'

const model = defineModel<Period>({ required: true })

const props = defineProps<{
  range: Range
}>()

const days = computed(() => eachDayOfInterval(props.range))

// Period options with Thai labels
const periodLabels: Record<Period, string> = {
  daily: 'รายวัน',
  weekly: 'รายสัปดาห์',
  monthly: 'รายเดือน'
}

const periods = computed<Period[]>(() => {
  if (days.value.length <= 8) {
    return ['daily']
  }

  if (days.value.length <= 31) {
    return ['daily', 'weekly']
  }

  return ['weekly', 'monthly']
})

// Items for select with Thai labels
const periodItems = computed(() => 
  periods.value.map(p => ({
    value: p,
    label: periodLabels[p]
  }))
)

// Ensure the model value is always a valid period
watch(periods, () => {
  if (!periods.value.includes(model.value)) {
    model.value = periods.value[0]!
  }
})
</script>

<template>
  <USelect
    v-model="model"
    :items="periodItems"
    value-key="value"
    variant="ghost"
    class="data-[state=open]:bg-elevated"
    :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
  />
</template>
