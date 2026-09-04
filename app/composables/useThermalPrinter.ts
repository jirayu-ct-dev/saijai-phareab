import type { DirectPrintResult, LanPrinterCandidate, LanPrinterDescriptor } from "~~/shared/types/printing";
import {
  DirectPrintFailure,
  DirectPrintMutex,
  executeDirectPrint,
} from "~~/shared/utils/directPrint";
import { fingerprintPrintBytes } from "~~/shared/utils/printByteFingerprint";

// Bluetooth service/characteristic UUIDs for common thermal printer firmware variants
const BT_PROFILES = [
  // Xprinter / common Chinese BLE printers
  { service: '0000ff00-0000-1000-8000-00805f9b34fb', tx: '0000ff02-0000-1000-8000-00805f9b34fb' },
  // Nordic UART Service (NUS) — another common firmware
  { service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e', tx: '6e400002-b5a3-f393-e0a9-e50e24dcca9e' },
  // Generic ESC/POS over BLE
  { service: '000018f0-0000-1000-8000-00805f9b34fb', tx: '00002af1-0000-1000-8000-00805f9b34fb' },
]

const BLE_CHUNK = 20 // conservative BLE MTU minimum
const GATEWAY_STORAGE_KEY = 'saijai-print-gateway'

// Module-level device handles — non-reactive, persist across navigations
let _usbDevice: USBDevice | null = null
let _usbEndpoint: { interfaceNumber: number; endpointNumber: number } | null = null
let _btChar: BluetoothRemoteGATTCharacteristic | null = null
let _autoReconnectDone = false
let _gatewayRestorePromise: Promise<boolean> | null = null
const directPrintMutex = new DirectPrintMutex()

const debugPrintBytes = async (stage: 'C_BROWSER_RECEIVE' | 'D_GATEWAY_SEND', bytes: Uint8Array) => {
  if (!import.meta.dev) return
  try {
    console.debug(`[print-bytes:${stage}]`, await fingerprintPrintBytes(bytes))
  } catch {
    // Diagnostics must never block a print attempt (for example when Web
    // Crypto is unavailable in an insecure development browser context).
    console.debug(`[print-bytes:${stage}] fingerprint unavailable`, { byteLength: bytes.byteLength })
  }
}

interface PrinterState {
  isConnected: boolean
  connectionType: 'wifi' | 'usb' | 'bluetooth' | null
  deviceName: string | null
  paperWidth: 58 | 80
  isConnecting: boolean
  error: string | null
  gatewayPairingRequired: boolean
  gatewayPrinters: LanPrinterDescriptor[]
  gatewayCandidates: LanPrinterCandidate[]
  selectedGatewayPrinterId: string | null
}

interface GatewaySavedState {
  token?: string
  selectedPrinterId?: string
  paperWidth?: 58 | 80
}

const readSavedState = (): GatewaySavedState => {
  if (!import.meta.client) return {}
  try { return JSON.parse(localStorage.getItem(GATEWAY_STORAGE_KEY) ?? '{}') as GatewaySavedState }
  catch { return {} }
}

export function useThermalPrinter() {
  const state = useState<PrinterState>('thermalPrinter', () => {
    const saved = readSavedState()
    return {
      isConnected: false,
      connectionType: null,
      deviceName: null,
      paperWidth: (saved.paperWidth === 58 ? 58 : 80),
      isConnecting: false,
      error: null,
      gatewayPairingRequired: false,
      gatewayPrinters: [],
      gatewayCandidates: [],
      selectedGatewayPrinterId: saved.selectedPrinterId ?? null,
    }
  })

  function persist() {
    if (import.meta.client) {
      const saved = readSavedState()
      localStorage.setItem(GATEWAY_STORAGE_KEY, JSON.stringify({
        ...saved,
        paperWidth: state.value.paperWidth,
        selectedPrinterId: state.value.selectedGatewayPrinterId,
      }))
    }
  }

  function setPaperWidth(w: 58 | 80) {
    state.value.paperWidth = w
    persist()
  }

  const runtimeConfig = useRuntimeConfig()
  const gatewayUrl = computed(() => String(runtimeConfig.public.printGatewayUrl ?? '').replace(/\/+$/, ''))
  const gatewayEnabled = computed(() => runtimeConfig.public.printGatewayEnabled === true && gatewayUrl.value.length > 0)

  const gatewayToken = (): string | null => readSavedState().token ?? null
  const gatewayFetch = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    if (!gatewayEnabled.value) throw new Error('ยังไม่ได้เปิดใช้งาน LAN Print Gateway')
    const token = gatewayToken()
    const headers = new Headers(init.headers)
    if (token) headers.set('authorization', `Bearer ${token}`)
    const response = await fetch(`${gatewayUrl.value}${path}`, { ...init, headers, signal: init.signal ?? AbortSignal.timeout(10_000) })
    const body = await response.json().catch(() => null) as ({ code?: string } & T) | null
    if (response.status === 401) {
      state.value.gatewayPairingRequired = true
      throw new Error(body?.code === 'PAIRING_CODE_INVALID' ? 'รหัสจับคู่ไม่ถูกต้องหรือหมดอายุ' : 'ต้องจับคู่เบราว์เซอร์กับ Print Gateway ก่อน')
    }
    if (!response.ok || !body) throw new Error('Print Gateway ไม่พร้อมใช้งาน')
    return body
  }

  const selectGatewayPrinter = (printerId: string) => {
    const printer = state.value.gatewayPrinters.find(item => item.id === printerId && item.online)
    if (!printer) return false
    state.value.selectedGatewayPrinterId = printer.id
    state.value.isConnected = true
    state.value.connectionType = 'wifi'
    state.value.deviceName = printer.name
    state.value.error = null
    persist()
    return true
  }

  const refreshGatewayPrinters = async () => {
    const result = await gatewayFetch<{ printers: LanPrinterDescriptor[] }>('/printers')
    state.value.gatewayPrinters = result.printers
    const online = result.printers.filter(printer => printer.online)
    const saved = online.find(printer => printer.id === state.value.selectedGatewayPrinterId)
    if (saved) selectGatewayPrinter(saved.id)
    else if (online.length === 1) selectGatewayPrinter(online[0]!.id)
    else {
      state.value.isConnected = false
      state.value.connectionType = null
      state.value.deviceName = null
    }
    return result.printers
  }

  const restoreGatewayConnection = async (): Promise<boolean> => {
    if (!import.meta.client || !gatewayEnabled.value) return false
    if (_gatewayRestorePromise) return _gatewayRestorePromise

    _gatewayRestorePromise = (async () => {
      const saved = readSavedState()
      state.value.selectedGatewayPrinterId = saved.selectedPrinterId ?? null
      if (!saved.token) {
        state.value.gatewayPairingRequired = true
        return false
      }

      state.value.isConnecting = true
      state.value.error = null
      try {
        await refreshGatewayPrinters()
        state.value.gatewayPairingRequired = false
        return state.value.isConnected && state.value.connectionType === 'wifi'
      } catch (error) {
        state.value.error = error instanceof Error ? error.message : 'เชื่อมต่อ LAN Print Gateway ไม่สำเร็จ'
        return false
      } finally {
        state.value.isConnecting = false
      }
    })()

    try {
      return await _gatewayRestorePromise
    } finally {
      _gatewayRestorePromise = null
    }
  }

  async function connectWifi() {
    if (!import.meta.client) return
    state.value.isConnecting = true
    state.value.error = null
    try {
      if (!gatewayEnabled.value) throw new Error('ยังไม่ได้เปิดใช้งาน LAN Print Gateway')
      const response = await fetch(`${gatewayUrl.value}/health`, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(3000),
      })
      if (!response.ok) throw new Error('ไม่พบ LAN Print Gateway')
      const health = await response.json() as { available?: boolean; pairingRequired?: boolean }
      if (health.available !== true) throw new Error('LAN Print Gateway ยังไม่พร้อมใช้งาน')
      state.value.gatewayPairingRequired = health.pairingRequired === true || !gatewayToken()
      if (state.value.gatewayPairingRequired) throw new Error('ต้องจับคู่เบราว์เซอร์กับ Print Gateway ก่อน')
      const printers = await refreshGatewayPrinters()
      const onlineCount = printers.filter(printer => printer.online).length
      if (onlineCount === 0) {
        await discoverGatewayPrinters()
        throw new Error(printers.length === 0 ? 'ยังไม่มีเครื่องพิมพ์ที่ยืนยัน กรุณาเลือกเครื่องที่ค้นพบ' : 'เครื่องเดิมออฟไลน์ กรุณาค้นหาและยืนยันเครื่องใหม่')
      }
      if (!state.value.isConnected) throw new Error('พบหลายเครื่อง กรุณาเลือกเครื่องพิมพ์')
    } catch (error) {
      state.value.error = error instanceof Error ? error.message : 'เชื่อมต่อ LAN Print Gateway ไม่สำเร็จ'
    } finally {
      state.value.isConnecting = false
    }
  }

  const pairGateway = async (code: string) => {
    const result = await gatewayFetch<{ token: string; expiresAt: string }>('/pair', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }),
    })
    const saved = readSavedState()
    localStorage.setItem(GATEWAY_STORAGE_KEY, JSON.stringify({ ...saved, token: result.token }))
    state.value.gatewayPairingRequired = false
    state.value.error = null
    await refreshGatewayPrinters()
  }

  const discoverGatewayPrinters = async (force = false) => {
    const result = await gatewayFetch<{ candidates: LanPrinterCandidate[] }>(`/discover${force ? '?force=true' : ''}`, { method: 'POST' })
    state.value.gatewayCandidates = result.candidates
    return result.candidates
  }

  const trustGatewayPrinter = async (candidateId: string, name: string, replacesPrinterId?: string) => {
    const result = await gatewayFetch<{ printer: LanPrinterDescriptor }>('/printers/trust', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ candidateId, name, replacesPrinterId }),
    })
    await refreshGatewayPrinters()
    selectGatewayPrinter(result.printer.id)
    state.value.error = null
  }

  // ── USB ──────────────────────────────────────────────────────────────────

  async function _findBulkOut(device: USBDevice) {
    for (const cfg of device.configurations) {
      for (const iface of cfg.interfaces) {
        for (const alt of iface.alternates) {
          for (const ep of alt.endpoints) {
            if (ep.direction === 'out' && ep.type === 'bulk') {
              return { interfaceNumber: iface.interfaceNumber, endpointNumber: ep.endpointNumber }
            }
          }
        }
      }
    }
    throw new Error('ไม่พบ bulk OUT endpoint บนอุปกรณ์นี้')
  }

  async function _openUsb(device: USBDevice) {
    await device.open()
    if (device.configuration === null) await device.selectConfiguration(1)
    const ep = await _findBulkOut(device)
    await device.claimInterface(ep.interfaceNumber)
    _usbDevice = device
    _usbEndpoint = ep
    state.value.isConnected = true
    state.value.connectionType = 'usb'
    state.value.deviceName = device.productName || 'USB Printer'

    navigator.usb.addEventListener('disconnect', (e: Event) => {
      if ((e as USBConnectionEvent).device === _usbDevice) {
        _usbDevice = null
        _usbEndpoint = null
        state.value.isConnected = false
        state.value.connectionType = null
        state.value.deviceName = null
      }
    }, { once: true } as AddEventListenerOptions)
  }

  async function connectUsb() {
    if (!import.meta.client || !('usb' in navigator)) {
      state.value.error = 'เบราว์เซอร์นี้ไม่รองรับ WebUSB — ใช้ Chrome หรือ Edge'
      return
    }
    state.value.isConnecting = true
    state.value.error = null
    try {
      const device = await navigator.usb.requestDevice({ filters: [] })
      await _openUsb(device)
    } catch (e) {
      if (e instanceof Error && e.name !== 'NotFoundError') state.value.error = e.message
    } finally {
      state.value.isConnecting = false
    }
  }

  async function autoReconnectUsb() {
    if (!import.meta.client || !('usb' in navigator) || _usbDevice) return
    try {
      const devices = await navigator.usb.getDevices()
      if (devices[0]) await _openUsb(devices[0])
    } catch { /* silent — user can connect manually */ }
  }

  // ── Bluetooth ────────────────────────────────────────────────────────────

  async function connectBluetooth() {
    if (!import.meta.client || !('bluetooth' in navigator)) {
      state.value.error = 'เบราว์เซอร์นี้ไม่รองรับ Web Bluetooth'
      return
    }
    state.value.isConnecting = true
    state.value.error = null
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: BT_PROFILES.map(p => p.service),
      })
      const server = await device.gatt!.connect()

      let char: BluetoothRemoteGATTCharacteristic | null = null
      for (const { service, tx } of BT_PROFILES) {
        try {
          const svc = await server.getPrimaryService(service)
          char = await svc.getCharacteristic(tx)
          break
        } catch { /* try next profile */ }
      }
      if (!char) throw new Error('ไม่พบ service ที่รองรับ — ตรวจสอบรุ่นเครื่องพิมพ์')

      _btChar = char
      device.addEventListener('gattserverdisconnected', () => {
        _btChar = null
        state.value.isConnected = false
        state.value.connectionType = null
        state.value.deviceName = null
      })

      state.value.isConnected = true
      state.value.connectionType = 'bluetooth'
      state.value.deviceName = device.name || 'Bluetooth Printer'
    } catch (e) {
      if (e instanceof Error && e.name !== 'NotFoundError') state.value.error = e.message
    } finally {
      state.value.isConnecting = false
    }
  }

  // ── Disconnect ───────────────────────────────────────────────────────────

  async function disconnect() {
    try { await _usbDevice?.close() } catch { /* ignore */ }
    try { _btChar?.service.device.gatt?.disconnect() } catch { /* ignore */ }
    _usbDevice = null
    _usbEndpoint = null
    _btChar = null
    state.value.isConnected = false
    state.value.connectionType = null
    state.value.deviceName = null
    state.value.error = null
  }

  // ── Send ─────────────────────────────────────────────────────────────────

  async function send(bytes: Uint8Array) {
    await debugPrintBytes('D_GATEWAY_SEND', bytes)
    if (state.value.connectionType === 'wifi') {
      try {
        const printerId = state.value.selectedGatewayPrinterId
        if (!printerId) throw new Error('ยังไม่ได้เลือกเครื่องพิมพ์')
        const token = gatewayToken()
        if (!token) throw new Error('ต้องจับคู่เบราว์เซอร์กับ Print Gateway ก่อน')
        const response = await fetch(`${gatewayUrl.value}/print/${encodeURIComponent(printerId)}`, {
          method: 'POST',
          headers: { 'content-type': 'application/octet-stream', authorization: `Bearer ${token}` },
          body: bytes as BodyInit,
        })
        const result = await response.json().catch(() => null) as {
          code?: string
          bytesMayHaveBeenWritten?: boolean
        } | null
        if (response.ok && result?.code === 'SENT') return
        const code = result?.code
        if (code === 'BUSY' || code === 'TIMEOUT' || code === 'OFFLINE') {
          if (code !== 'BUSY') {
            state.value.isConnected = false
            state.value.connectionType = null
            state.value.deviceName = null
          }
          throw new DirectPrintFailure(code, code, {
            bytesMayHaveBeenWritten: result?.bytesMayHaveBeenWritten === true,
          })
        }
        state.value.isConnected = false
        state.value.connectionType = null
        state.value.deviceName = null
        throw new Error('ผลการส่งงานพิมพ์ไม่ชัดเจน')
      } catch (error) {
        if (!(error instanceof DirectPrintFailure && error.code === 'BUSY')) {
          state.value.isConnected = false
          state.value.connectionType = null
          state.value.deviceName = null
        }
        throw error
      }
    }
    if (state.value.connectionType === 'usb' && _usbDevice && _usbEndpoint) {
      await _usbDevice.transferOut(_usbEndpoint.endpointNumber, bytes.buffer as ArrayBuffer)
      return
    }
    if (state.value.connectionType === 'bluetooth' && _btChar) {
      for (let i = 0; i < bytes.length; i += BLE_CHUNK) {
        await _btChar.writeValue(bytes.slice(i, i + BLE_CHUNK).buffer as ArrayBuffer)
      }
      return
    }
    throw new Error('ไม่ได้เชื่อมต่อเครื่องพิมพ์')
  }

  const print = async (loadBytes: () => Promise<Uint8Array>): Promise<DirectPrintResult> =>
    executeDirectPrint({
      ensureConnected: async () => state.value.isConnected,
      loadBytes: async () => {
        const bytes = await loadBytes()
        await debugPrintBytes('C_BROWSER_RECEIVE', bytes)
        return bytes
      },
      sendBytes: send,
    }, directPrintMutex)

  // Restore the saved LAN selection after hydration, then fall back to a USB
  // device that this browser has already been granted permission to use.
  if (import.meta.client && !_autoReconnectDone) {
    _autoReconnectDone = true
    onMounted(async () => {
      const restoredGateway = await restoreGatewayConnection()
      if (!restoredGateway) await autoReconnectUsb()
    })
  }

  return {
    state,
    connectWifi,
    restoreGatewayConnection,
    pairGateway,
    refreshGatewayPrinters,
    discoverGatewayPrinters,
    trustGatewayPrinter,
    selectGatewayPrinter,
    connectUsb,
    connectBluetooth,
    autoReconnectUsb,
    disconnect,
    send,
    print,
    setPaperWidth,
  }
}
