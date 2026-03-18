<script setup lang="ts">
/**
 * Confirm Modal Component
 * Modal ยืนยันการดำเนินการ (ใช้ได้ทั่วไป)
 * 
 * Props:
 * - open: เปิด/ปิด modal
 * - title: หัวข้อ modal
 * - description: คำอธิบายสั้นๆ
 * - icon: icon ที่แสดงทางซ้าย
 * - iconColor: สีของ icon (info, warning, error, success)
 * - message: ข้อความหลัก
 * - subMessage: ข้อความรอง
 * - confirmLabel: ข้อความปุ่มยืนยัน
 * - confirmColor: สีปุ่มยืนยัน
 * - loading: สถานะกำลังโหลด
 */

type IconColor = 'info' | 'warning' | 'error' | 'success' | 'primary' | 'neutral'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  description?: string
  icon?: string
  iconColor?: IconColor
  message?: string
  subMessage?: string
  confirmLabel?: string
  confirmColor?: IconColor
  loading?: boolean
}>(), {
  title: 'ยืนยันการดำเนินการ',
  description: '',
  icon: 'i-lucide-alert-triangle',
  iconColor: 'warning',
  message: 'คุณต้องการดำเนินการนี้หรือไม่?',
  subMessage: '',
  confirmLabel: 'ยืนยัน',
  confirmColor: 'warning',
  loading: false
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
  cancel: []
}>()

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
})

const handleCancel = () => {
  emit('cancel')
  isOpen.value = false
}

const handleConfirm = () => {
  emit('confirm')
}

// Color classes mapping
const iconBgClass = computed(() => {
  const map: Record<IconColor, string> = {
    info: 'bg-info/10 text-info',
    warning: 'bg-warning/10 text-warning',
    error: 'bg-error/10 text-error',
    success: 'bg-success/10 text-success',
    primary: 'bg-primary/10 text-primary',
    neutral: 'bg-neutral/10 text-neutral'
  }
  return map[props.iconColor] ?? map.warning
})
</script>

<template>
  <UModal 
    v-model:open="isOpen"
    :title="title"
    :description="description"
  >
    <template #body>
      <div class="flex gap-4">
        <div 
          class="shrink-0 size-12 rounded-full flex items-center justify-center"
          :class="iconBgClass"
        >
          <UIcon :name="icon" class="size-6" />
        </div>
        <div class="flex-1">
          <p class="text-muted text-sm">
            <slot name="message">{{ message }}</slot>
          </p>
          <p v-if="subMessage || $slots.subMessage" class="mt-2 text-muted text-xs">
            <slot name="subMessage">{{ subMessage }}</slot>
          </p>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex justify-end gap-3 w-full">
        <UButton
          label="ยกเลิก"
          color="neutral"
          variant="outline"
          @click="handleCancel"
        />
        <UButton
          :label="confirmLabel"
          :color="confirmColor"
          :loading="loading"
          @click="handleConfirm"
        />
      </div>
    </template>
  </UModal>
</template>
