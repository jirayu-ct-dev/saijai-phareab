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

// Module-level device handles — non-reactive, persist across navigations
let _usbDevice: USBDevice | null = null
let _usbEndpoint: { interfaceNumber: number; endpointNumber: number } | null = null
let _btChar: BluetoothRemoteGATTCharacteristic | null = null
let _autoReconnectDone = false

interface PrinterState {
  isConnected: boolean
  connectionType: 'usb' | 'bluetooth' | null
  deviceName: string | null
  paperWidth: 58 | 80
  isConnecting: boolean
  error: string | null
}

export function useThermalPrinter() {
  const state = useState<PrinterState>('thermalPrinter', () => {
    const saved = import.meta.client
      ? (JSON.parse(localStorage.getItem('thermal-printer') ?? '{}') as Partial<PrinterState>)
      : {}
    return {
      isConnected: false,
      connectionType: null,
      deviceName: null,
      paperWidth: (saved.paperWidth === 58 ? 58 : 80),
      isConnecting: false,
      error: null,
    }
  })

  function persist() {
    if (import.meta.client) {
      localStorage.setItem('thermal-printer', JSON.stringify({
        paperWidth: state.value.paperWidth,
      }))
    }
  }

  function setPaperWidth(w: 58 | 80) {
    state.value.paperWidth = w
    persist()
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

  // Auto-reconnect once per app session on first composable call
  if (import.meta.client && !_autoReconnectDone) {
    _autoReconnectDone = true
    onMounted(() => void autoReconnectUsb())
  }

  return {
    state,
    connectUsb,
    connectBluetooth,
    autoReconnectUsb,
    disconnect,
    send,
    setPaperWidth,
  }
}
