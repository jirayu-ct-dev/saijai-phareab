<script setup lang="ts">
const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  connected: []
}>()

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
})

const notify = useNotify()
const {
  state, connectWifi, connectUsb, connectBluetooth, disconnect, setPaperWidth,
  pairGateway, discoverGatewayPrinters, trustGatewayPrinter, selectGatewayPrinter,
} = useThermalPrinter()
const pairingCode = ref('')
const printerName = ref('เครื่องหน้าเคาน์เตอร์')
const isGatewayActionPending = ref(false)
const showDiscovery = ref(false)
const discoveryAttempted = ref(false)
const showFallbackMethods = ref(false)

const isGatewayBusy = computed(() => state.value.isConnecting || isGatewayActionPending.value)
const connectionStatusTitle = computed(() => {
  if (state.value.isConnecting) return 'กำลังตรวจสอบการเชื่อมต่อ'
  if (state.value.isConnected) return state.value.deviceName ?? 'เชื่อมต่อแล้ว'
  return 'ยังไม่ได้เชื่อมต่อเครื่องพิมพ์'
})
const connectionStatusDescription = computed(() => {
  if (state.value.isConnecting) return 'กรุณารอสักครู่'
  if (state.value.isConnected) {
    return state.value.connectionType === 'wifi'
      ? 'พร้อมพิมพ์ผ่าน Wi-Fi / Ethernet'
      : state.value.connectionType === 'usb'
        ? 'พร้อมพิมพ์ผ่าน USB'
        : 'พร้อมพิมพ์ผ่าน Bluetooth'
  }
  return 'แนะนำให้ใช้ Wi-Fi / Ethernet สำหรับเครื่องหน้าเคาน์เตอร์'
})

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

const finishConnection = (message: string) => {
  notify.success(message)
  isOpen.value = false
  emit('connected')
}

async function handleConnectWifi() {
  await connectWifi()
  if (state.value.isConnected) finishConnection('เชื่อมต่อเครื่องพิมพ์ผ่านเครือข่ายเรียบร้อย')
  else {
    if (state.value.gatewayCandidates.length > 0) showDiscovery.value = true
    if (state.value.error) notify.error(state.value.error)
  }
}

const handlePairGateway = async () => {
  isGatewayActionPending.value = true
  try {
    await pairGateway(pairingCode.value.trim())
    pairingCode.value = ''
    if (state.value.isConnected) finishConnection('จับคู่และเชื่อมต่อเครื่องพิมพ์เรียบร้อย')
    else {
      if (state.value.gatewayPrinters.length === 0) await discoverGatewayPrinters()
      notify.success('จับคู่กับ Print Gateway เรียบร้อย')
    }
  } catch (error) {
    notify.error(error instanceof Error ? error.message : 'จับคู่ Print Gateway ไม่สำเร็จ')
  } finally {
    isGatewayActionPending.value = false
  }
}

const handleDiscover = async () => {
  isGatewayActionPending.value = true
  showDiscovery.value = true
  discoveryAttempted.value = true
  try {
    const candidates = await discoverGatewayPrinters(true)
    if (candidates.length === 0) notify.info('ไม่พบเครื่องพิมพ์ใหม่ เครื่องที่บันทึกไว้จะไม่แสดงซ้ำในผลค้นหา')
  } catch (error) {
    notify.error(error instanceof Error ? error.message : 'ค้นหาเครื่องพิมพ์ไม่สำเร็จ')
  } finally {
    isGatewayActionPending.value = false
  }
}

const handleTrustCandidate = async (candidateId: string) => {
  isGatewayActionPending.value = true
  try {
    const offlinePrinter = state.value.gatewayPrinters.length === 1 && !state.value.gatewayPrinters[0]?.online
      ? state.value.gatewayPrinters[0]
      : undefined
    await trustGatewayPrinter(candidateId, printerName.value.trim() || 'เครื่องหน้าเคาน์เตอร์', offlinePrinter?.id)
    finishConnection(offlinePrinter ? 'เปลี่ยนไปใช้เครื่องพิมพ์ใหม่เรียบร้อย' : 'เพิ่มเครื่องพิมพ์เรียบร้อย')
  } catch (error) {
    notify.error(error instanceof Error ? error.message : 'ยืนยันเครื่องพิมพ์ไม่สำเร็จ')
  } finally {
    isGatewayActionPending.value = false
  }
}

const handleSelectPrinter = (printerId: string) => {
  if (selectGatewayPrinter(printerId)) finishConnection('เลือกเครื่องพิมพ์เรียบร้อย')
}

async function handleConnectUsb() {
  if (!hasWebUsb) {
    notify.error(explainUnsupported('usb') ?? 'ไม่สามารถเชื่อมต่อ USB ได้')
    return
  }
  await connectUsb()
  if (state.value.isConnected) {
    finishConnection('เชื่อมต่อ USB เรียบร้อย')
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
    finishConnection('เชื่อมต่อ Bluetooth เรียบร้อย')
  } else if (state.value.error) {
    notify.error(state.value.error)
  }
}

async function handleDisconnect() {
  await disconnect()
  notify.info('ตัดการเชื่อมต่อแล้ว')
}

watch(() => props.open, (open) => {
  if (!open) return
  showDiscovery.value = state.value.gatewayCandidates.length > 0
  discoveryAttempted.value = false
  showFallbackMethods.value = false
})
</script>

<template>
  <UModal
    v-model:open="isOpen"
    title="เชื่อมต่อเครื่องพิมพ์"
    description="เลือกเครื่องแล้วพิมพ์ได้ทันที โดยไม่ต้องตั้งค่าใหม่ทุกครั้ง"
    :ui="{ content: 'sm:max-w-lg', body: 'max-h-[75vh] overflow-y-auto' }"
  >
    <template #body>
      <div class="space-y-4">

        <!-- Connection status -->
        <div
          class="flex items-start gap-3 rounded-lg border p-4"
          :class="state.isConnected ? 'border-success/30 bg-success/5' : 'border-default bg-elevated/50'"
          role="status"
          aria-live="polite"
        >
          <UIcon
            :name="state.isConnected ? 'i-lucide-circle-check' : state.isConnecting ? 'i-lucide-loader-circle' : 'i-lucide-printer'"
            class="mt-0.5 size-5 shrink-0"
            :class="[
              state.isConnected ? 'text-success' : 'text-muted',
              { 'animate-spin': state.isConnecting },
            ]"
          />
          <div class="min-w-0">
            <p class="text-sm font-semibold text-highlighted">{{ connectionStatusTitle }}</p>
            <p class="mt-0.5 text-xs leading-5 text-muted">{{ connectionStatusDescription }}</p>
          </div>
          <UButton
            v-if="state.isConnected"
            label="ยกเลิก"
            color="error"
            variant="ghost"
            size="xs"
            class="ml-auto shrink-0"
            @click="handleDisconnect"
          />
        </div>

        <div v-if="!state.isConnected" class="space-y-4">
          <!-- Preferred LAN path -->
          <section class="space-y-3 rounded-lg border border-default p-4">
            <div class="flex items-start gap-3">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UIcon name="i-lucide-wifi" class="size-5" />
              </div>
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-sm font-semibold text-highlighted">Wi-Fi / Ethernet</h3>
                  <UBadge label="แนะนำ" color="primary" variant="soft" size="sm" />
                </div>
                <p class="mt-1 text-xs leading-5 text-muted">ใช้เครื่องที่บันทึกไว้ได้ทันที หรือค้นหาเมื่อติดตั้งเครื่องใหม่</p>
              </div>
            </div>

            <UAlert
              v-if="state.error"
              color="warning"
              variant="soft"
              icon="i-lucide-circle-alert"
              :description="state.error"
            />

            <div v-if="state.gatewayPairingRequired" class="space-y-3 rounded-md bg-elevated p-3">
              <div>
                <p class="text-sm font-medium text-highlighted">เชื่อมเบราว์เซอร์กับเครื่องร้านครั้งแรก</p>
                <p class="mt-1 text-xs leading-5 text-muted">กรอกรหัส 6 หลักจาก Print Gateway ทำครั้งเดียวต่อเบราว์เซอร์</p>
              </div>
              <UFormField label="รหัสจับคู่ 6 หลัก">
                <UInput
                  v-model="pairingCode"
                  inputmode="numeric"
                  maxlength="6"
                  autocomplete="one-time-code"
                  class="w-full"
                  placeholder="000000"
                />
              </UFormField>
              <UButton
                label="จับคู่และค้นหาเครื่อง"
                icon="i-lucide-link"
                class="w-full"
                :loading="isGatewayActionPending"
                @click="handlePairGateway"
              />
            </div>

            <template v-else>
              <div v-if="state.gatewayPrinters.length > 0" class="space-y-2">
                <p class="text-xs font-medium text-muted">เครื่องที่บันทึกไว้</p>
                <button
                  v-for="printer in state.gatewayPrinters"
                  :key="printer.id"
                  type="button"
                  class="flex min-h-12 w-full items-center gap-3 rounded-md border border-default px-3 py-2 text-left transition-colors hover:bg-elevated focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50"
                  :disabled="!printer.online || isGatewayBusy"
                  @click="handleSelectPrinter(printer.id)"
                >
                  <UIcon name="i-lucide-printer" class="size-5 shrink-0 text-muted" />
                  <span class="min-w-0 flex-1 truncate text-sm font-medium text-highlighted">{{ printer.name }}</span>
                  <UBadge
                    :label="printer.online ? 'พร้อมใช้' : 'ออฟไลน์'"
                    :color="printer.online ? 'success' : 'neutral'"
                    variant="soft"
                    size="sm"
                  />
                </button>
              </div>

              <UButton
                v-if="state.gatewayPrinters.length === 0"
                label="ตรวจสอบเครื่องที่บันทึกไว้"
                icon="i-lucide-refresh-cw"
                color="primary"
                class="w-full"
                :loading="state.isConnecting"
                :disabled="isGatewayActionPending"
                @click="handleConnectWifi"
              />

              <UButton
                :label="showDiscovery ? 'ซ่อนการค้นหาเครื่องใหม่' : 'เพิ่มหรือเปลี่ยนเครื่องพิมพ์'"
                :icon="showDiscovery ? 'i-lucide-chevron-up' : 'i-lucide-plus'"
                color="neutral"
                variant="ghost"
                class="w-full"
                :aria-expanded="showDiscovery"
                @click="showDiscovery = !showDiscovery"
              />
            </template>

            <div v-if="!state.gatewayPairingRequired && showDiscovery" class="space-y-3 border-t border-default pt-3">
              <div>
                <p class="text-sm font-medium text-highlighted">ค้นหาเครื่องใหม่</p>
                <p class="mt-1 text-xs leading-5 text-muted">เครื่องที่บันทึกไว้ด้านบนจะไม่แสดงซ้ำในผลค้นหา</p>
              </div>
              <UButton
                label="ค้นหาเครื่องใหม่ในเครือข่ายร้าน"
                icon="i-lucide-scan-search"
                color="neutral"
                variant="soft"
                class="w-full justify-start"
                :loading="isGatewayActionPending"
                @click="handleDiscover"
              />

              <p v-if="discoveryAttempted && state.gatewayCandidates.length === 0" class="rounded-md bg-elevated p-3 text-xs leading-5 text-muted">
                ไม่พบเครื่องใหม่ หากเครื่องที่บันทึกไว้ด้านบนขึ้น “พร้อมใช้” ให้เลือกเครื่องนั้นได้เลย
              </p>

              <template v-if="state.gatewayCandidates.length > 0">
                <UFormField label="ชื่อที่ใช้เรียกเครื่อง">
                  <UInput v-model="printerName" class="w-full" maxlength="80" />
                </UFormField>
                <UButton
                  v-for="candidate in state.gatewayCandidates"
                  :key="candidate.id"
                  :label="`ใช้ ${candidate.name}`"
                  icon="i-lucide-circle-check"
                  class="w-full justify-start"
                  :loading="isGatewayActionPending"
                  @click="handleTrustCandidate(candidate.id)"
                />
              </template>
            </div>
          </section>

          <!-- Explicit fallbacks keep the normal path short. -->
          <section class="rounded-lg border border-default">
            <button
              type="button"
              class="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              :aria-expanded="showFallbackMethods"
              @click="showFallbackMethods = !showFallbackMethods"
            >
              <UIcon name="i-lucide-cable" class="size-5 text-muted" />
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-medium text-highlighted">วิธีเชื่อมต่อสำรอง</span>
                <span class="block text-xs text-muted">USB หรือ Bluetooth</span>
              </span>
              <UIcon :name="showFallbackMethods ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="size-4 text-muted" />
            </button>

            <div v-if="showFallbackMethods" class="grid gap-2 border-t border-default p-3 sm:grid-cols-2">
              <UButton
                label="USB"
                icon="i-lucide-usb"
                color="neutral"
                variant="outline"
                class="w-full justify-start"
                :disabled="state.isConnecting"
                :loading="state.isConnecting && state.connectionType === null"
                @click="handleConnectUsb"
              />
              <UButton
                label="Bluetooth"
                icon="i-lucide-bluetooth"
                color="neutral"
                variant="outline"
                class="w-full justify-start"
                :disabled="state.isConnecting"
                :loading="state.isConnecting && state.connectionType === null"
                @click="handleConnectBluetooth"
              />
            </div>
          </section>
        </div>

        <!-- Paper width is a document preference, not a connection step. -->
        <div class="flex items-center justify-between gap-3 border-t border-default pt-4">
          <div>
            <p class="text-sm font-medium text-highlighted">ขนาดกระดาษ</p>
            <p class="text-xs text-muted">XP-C260M ใช้ 80 mm</p>
          </div>
          <div class="flex gap-1" role="group" aria-label="เลือกขนาดกระดาษ">
            <UButton
              label="80 mm"
              size="sm"
              :variant="state.paperWidth === 80 ? 'solid' : 'outline'"
              color="neutral"
              @click="setPaperWidth(80)"
            />
            <UButton
              label="58 mm"
              size="sm"
              :variant="state.paperWidth === 58 ? 'solid' : 'outline'"
              color="neutral"
              @click="setPaperWidth(58)"
            />
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>
