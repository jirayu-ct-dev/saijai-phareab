<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const notify = useNotify()
const { state, connectUsb, connectBluetooth, disconnect, setPaperWidth } = useThermalPrinter()

const hasWebUsb = import.meta.client && 'usb' in navigator
const hasWebBt  = import.meta.client && 'bluetooth' in navigator
const isSecureCtx = import.meta.client && window.isSecureContext

function explainUnsupported(kind: 'usb' | 'bluetooth'): string | null {
  if (!import.meta.client) return null
  if (!isSecureCtx) {
    return 'ต้องเปิดเว็บผ่าน HTTPS หรือ localhost เท่านั้น เบราว์เซอร์ถึงจะอนุญาตให้เชื่อมต่ออุปกรณ์'
  }
  const ua = navigator.userAgent
  const isChromium = /Chrome|Edg|Opera/i.test(ua) && !/Firefox/i.test(ua)
  if (!isChromium) {
    return 'เบราว์เซอร์นี้ไม่รองรับ — กรุณาใช้ Chrome หรือ Edge เวอร์ชันล่าสุด'
  }
  if (kind === 'bluetooth') {
    return 'เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth — บน Linux อาจต้องเปิด flag ที่ chrome://flags#enable-experimental-web-platform-features และตรวจสอบว่าระบบ Bluetooth เปิดอยู่'
  }
  return 'เบราว์เซอร์นี้ไม่รองรับ WebUSB — ลองอัปเดต Chrome/Edge หรือใช้เครื่องที่รองรับ'
}

async function handleConnectUsb() {
  if (!hasWebUsb) {
    notify.error(explainUnsupported('usb') ?? 'ไม่สามารถเชื่อมต่อ USB ได้')
    return
  }
  await connectUsb()
  if (state.value.isConnected) {
    notify.success('เชื่อมต่อ USB เรียบร้อย')
    isOpen.value = false
  } else if (state.value.error) {
    notify.error(state.value.error)
  }
}

async function handleConnectBluetooth() {
  if (!hasWebBt) {
    notify.error(explainUnsupported('bluetooth') ?? 'ไม่สามารถเชื่อมต่อ Bluetooth ได้')
    return
  }
  await connectBluetooth()
  if (state.value.isConnected) {
    notify.success('เชื่อมต่อ Bluetooth เรียบร้อย')
    isOpen.value = false
  } else if (state.value.error) {
    notify.error(state.value.error)
  }
}

async function handleDisconnect() {
  await disconnect()
  notify.info('ตัดการเชื่อมต่อแล้ว')
}
</script>

<template>
  <UModal v-model:open="isOpen" title="การเชื่อมต่อเครื่องพิมพ์">
    <template #body>
      <div class="space-y-5">

        <!-- Connection status -->
        <div class="flex items-center gap-3 rounded-md border border-default p-3">
          <span
            class="size-3 shrink-0 rounded-full"
            :class="state.isConnected ? 'bg-green-500' : 'bg-neutral-300'"
          />
          <div class="min-w-0">
            <p class="text-sm font-medium leading-5">
              {{ state.isConnected ? state.deviceName : 'ยังไม่เชื่อมต่อ' }}
            </p>
            <p class="text-xs text-muted">
              {{ state.isConnected ? (state.connectionType === 'usb' ? 'USB' : 'Bluetooth') : 'เลือกวิธีเชื่อมต่อด้านล่าง' }}
            </p>
          </div>
          <UButton
            v-if="state.isConnected"
            label="ตัดการเชื่อมต่อ"
            color="error"
            variant="soft"
            size="xs"
            class="ml-auto shrink-0"
            @click="handleDisconnect"
          />
        </div>

        <!-- Paper width -->
        <div>
          <p class="mb-2 text-sm font-medium">ขนาดกระดาษ</p>
          <div class="flex gap-2">
            <UButton
              label="80mm"
              :variant="state.paperWidth === 80 ? 'solid' : 'outline'"
              color="neutral"
              class="flex-1"
              @click="setPaperWidth(80)"
            />
            <UButton
              label="58mm"
              :variant="state.paperWidth === 58 ? 'solid' : 'outline'"
              color="neutral"
              class="flex-1"
              @click="setPaperWidth(58)"
            />
          </div>
        </div>

        <!-- Connect buttons -->
        <div v-if="!state.isConnected" class="space-y-2">
          <p class="text-sm font-medium">เชื่อมต่อผ่าน</p>

          <UButton
            label="USB (WebUSB)"
            icon="i-lucide-usb"
            color="neutral"
            variant="outline"
            class="w-full justify-start"
            :disabled="state.isConnecting"
            :loading="state.isConnecting && state.connectionType === null"
            @click="handleConnectUsb"
          />

          <UButton
            label="Bluetooth (BLE)"
            icon="i-lucide-bluetooth"
            color="neutral"
            variant="outline"
            class="w-full justify-start"
            :disabled="state.isConnecting"
            :loading="state.isConnecting && state.connectionType === null"
            @click="handleConnectBluetooth"
          />
        </div>

        <!-- Browser support note -->
        <p class="text-xs text-muted leading-5">
          รองรับ Xprinter และเครื่องพิมพ์ ESC/POS ทั่วไป
          เชื่อมต่อครั้งแรกเบราว์เซอร์จะถามอนุญาต
          ครั้งต่อไปจะเชื่อมต่ออัตโนมัติ (USB)
        </p>
      </div>
    </template>
  </UModal>
</template>
