import { formatCurrency, formatDateTime, formatDate } from "~~/shared/utils/format";
import type { ReceiptPayload } from "~~/shared/types/receipt";

// ─── Minimal ESC/POS encoder with Thai (TIS-620 / codepage 21) support ──────
// Thai Unicode block U+0E00–U+0E7F maps linearly to TIS-620 bytes 0xA0–0xFF.
// Each Thai character occupies exactly 1 byte and 1 column cell on the printer.

const ESC = 0x1B
const GS  = 0x1D
const LF  = 0x0A

class ThermalEncoder {
  private buf: number[] = []

  private push(...b: number[]): this { this.buf.push(...b); return this }

  init():  this { return this.push(ESC, 0x40) }          // ESC @ — reset
  thai():  this { return this.push(ESC, 0x74, 21) }      // ESC t 21 — TIS-620

  align(d: 'left' | 'center' | 'right'): this {
    return this.push(ESC, 0x61, d === 'left' ? 0 : d === 'center' ? 1 : 2)
  }

  bold(on: boolean): this { return this.push(ESC, 0x45, on ? 1 : 0) }

  // GS ! — character width/height multiplier (1=normal, 2=double)
  size(w: 1 | 2, h: 1 | 2): this {
    return this.push(GS, 0x21, ((w - 1) << 4) | (h - 1))
  }

  text(s: string): this {
    for (const ch of s) {
      const cp = ch.codePointAt(0)!
      if (cp < 0x80) {
        this.buf.push(cp)
      } else if (cp >= 0x0E00 && cp <= 0x0E7F) {
        this.buf.push((cp - 0x0E00) + 0xA0)  // Unicode Thai → TIS-620
      } else {
        this.buf.push(0x20)                    // unsupported char → space
      }
    }
    return this
  }

  nl():               this { return this.push(LF) }
  line(s: string):    this { return this.text(s).nl() }
  rule(n: number):    this { return this.line('-'.repeat(n)) }
  dblRule(n: number): this { return this.line('='.repeat(n)) }

  feed(n = 3): this { return this.push(ESC, 0x64, n) }

  // GS V — cut paper  (0 = full cut, 1 = partial cut)
  cut(partial = true): this { return this.push(GS, 0x56, partial ? 1 : 0) }

  // ESC p — open cash drawer on pin 2
  cashDrawer(): this { return this.push(ESC, 0x70, 0, 60, 120) }

  encode(): Uint8Array { return new Uint8Array(this.buf) }
}

// ─── Layout constants ────────────────────────────────────────────────────────

const LAYOUT = {
  80: { W: 48, nameW: 22, priceW: 9, qtyW: 5, totalW: 12, summLW: 22, infoLW: 14 },
  58: { W: 32, nameW: 14, priceW: 7, qtyW: 4, totalW: 7,  summLW: 16, infoLW: 10 },
} as const

type Layout = typeof LAYOUT[keyof typeof LAYOUT]

// ─── Formatting helpers ──────────────────────────────────────────────────────

// Spread-based slice handles multi-byte Thai chars correctly in JS strings.
const alignLeft  = (s: string, n: number) => [...s].slice(0, n).join('').padEnd(n)
const alignRight = (s: string, n: number) => [...s].slice(0, n).join('').padStart(n)

function summRow(label: string, value: string, L: Layout): string {
  return alignLeft(label, L.summLW) + alignRight(value, L.W - L.summLW)
}

function infoRow(label: string, value: string, L: Layout): string {
  const sep = ': '
  const maxV = L.W - L.infoLW - sep.length
  return alignLeft(label, L.infoLW) + sep + alignLeft(value, maxV)
}

function itemRow(name: string, price: string, qty: string, total: string, L: Layout): string {
  return alignLeft(name, L.nameW) + alignRight(price, L.priceW) + alignRight(qty, L.qtyW) + alignRight(total, L.totalW)
}

// ─── Receipt builder ─────────────────────────────────────────────────────────

export function buildReceiptBytes(
  payload: ReceiptPayload,
  shop: { name: string; address: string; phone: string } | null,
  paperWidth: 58 | 80,
  openDrawer = false,
): Uint8Array {
  const L = LAYOUT[paperWidth]
  const enc = new ThermalEncoder()

  const so = payload.serviceOrder
  const ps = payload.packageSale
  const entitlement = so?.memberEntitlement ?? null
  const isMember = Boolean(entitlement)
  const isMemberFree = isMember && Number(payload.amount) === 0

  // ── Cash drawer (fire before receipt so drawer opens as paper prints) ──
  if (openDrawer) enc.cashDrawer()

  enc.init().thai()

  // ── Header ──────────────────────────────────────────────────────────────
  enc.align('center').bold(true).size(2, 2)
  enc.line(shop?.name ?? 'ร้านซักผ้า')
  enc.size(1, 1).bold(false)
  if (shop?.address) enc.line(shop.address)
  if (shop?.phone)   enc.line(shop.phone)
  enc.nl()

  // ── Title ────────────────────────────────────────────────────────────────
  enc.rule(L.W)
  enc.bold(true)
  enc.line(isMemberFree ? 'ใบแจ้งการใช้บริการ' : 'ใบเสร็จรับเงิน')
  enc.bold(false).rule(L.W)

  // ── Info rows ────────────────────────────────────────────────────────────
  enc.align('left')

  const receiptCode = payload.paymentNo ?? `PAY-${payload.id.slice(-8).toUpperCase()}`
  const sellerName  = ps?.soldBy?.name ?? so?.employee?.name ?? '-'
  const customerName = payload.customer.name || payload.customer.email || '-'

  const rows: Array<[string, string | null | undefined]> = [
    ['เลขที่บิล',   receiptCode],
    ['เลขรับผ้า',   so?.orderNo],
    !so ? ['วันที่', formatDateTime(payload.createdAt)] : ['', null],
    so   ? ['วันที่รับผ้า', formatDateTime(so.receivedAt)] : ['', null],
    (so && so.status !== 'COMPLETED') ? ['วันนัดรับ', so.dueAt ? formatDateTime(so.dueAt) : 'ไม่ระบุ'] : ['', null],
    (so && so.status === 'COMPLETED') ? ['วันที่ส่งผ้า', (() => {
      const d = so.deliveredAt ?? payload.paidAt ?? so.dueAt ?? null
      return d ? formatDateTime(d) : 'ไม่ระบุ'
    })()] : ['', null],
    isMember ? ['แพ็กเกจ',  entitlement!.productName] : ['', null],
    isMember ? ['รูปแบบ',   'แพ็กเกจรายเดือน']       : ['', null],
    ['ชื่อลูกค้า', customerName],
    ['พนักงาน',    sellerName],
    ['โทร',        payload.customer.phoneNumber],
  ]

  for (const [label, value] of rows) {
    if (label && value) enc.line(infoRow(label, value, L))
  }

  enc.rule(L.W)

  // ── Items table ──────────────────────────────────────────────────────────
  enc.bold(true)
  enc.line(itemRow('รายการ', 'ราคา', 'จนวน', 'รวม', L))
  enc.bold(false).rule(L.W)

  const items = ps
    ? ps.items.map(i => ({ name: i.name, price: i.unitPrice, qty: i.quantity, total: i.totalPrice, isWashFold: false,             isMemberFree: false }))
    : (so?.items ?? []).map(i => ({ name: i.name, price: i.unitPrice, qty: i.quantity, total: i.totalPrice, isWashFold: Boolean(i.isWashFold), isMemberFree: isMember && i.totalPrice === 0 }))

  for (const item of items) {
    const priceStr = item.isWashFold ? '—' : (item.isMemberFree ? '-' : formatCurrency(item.price))
    const totalStr = item.isWashFold ? 'ชั่งกิโล' : (item.isMemberFree ? `${item.qty} เครดิต` : formatCurrency(item.total))
    enc.line(itemRow(item.name, priceStr, `x${item.qty}`, totalStr, L))
  }

  enc.rule(L.W)

  // ── Summary ──────────────────────────────────────────────────────────────
  const subtotal  = ps?.subtotalAmount ?? so?.subtotalAmount ?? 0
  const discount  = ps?.discountAmount ?? so?.discountAmount ?? 0
  const hanger    = so?.hangerCharge ?? null
  const washFold  = so?.weightKg ? { kg: so.weightKg, perKg: so.washFoldPricePerKg ?? 0 } : null
  const totalQty  = items.reduce((s, i) => s + i.qty, 0)

  enc.line(summRow('รวมจำนวนรายการ', `${totalQty} ชิ้น`, L))

  if (washFold) {
    enc.line(summRow('ซัก-พับ ชั่งกิโล', `${washFold.kg.toFixed(1)}กก. x${formatCurrency(washFold.perKg)}`, L))
  }
  if (hanger && !washFold) {
    enc.line(summRow('รวมไม้แขวน', `${hanger.count} ชิ้น`, L))
  }

  enc.line(summRow('ราคา', formatCurrency(subtotal), L))

  if (hanger && hanger.total > 0) {
    enc.line(summRow('ค่าไม้แขวน', formatCurrency(hanger.total), L))
  }

  enc.line(summRow('ส่วนลด', formatCurrency(discount), L))

  if (payload.vat) {
    const vatLabel = payload.vat.included ? `ราคารวม VAT ${payload.vat.rate}% แล้ว` : 'ราคาก่อน VAT'
    enc.line(summRow(vatLabel, formatCurrency(payload.vat.baseAmount), L))
    enc.line(summRow(`VAT ${payload.vat.rate}%`, formatCurrency(payload.vat.amount), L))
  }

  const noteText = payload.note || ps?.note || so?.note
  if (noteText) {
    enc.nl().bold(true).line('หมายเหตุ:').bold(false)
    // Break note into lines of lineWidth chars
    const chars = [...noteText]
    for (let i = 0; i < Math.min(chars.length, L.W * 3); i += L.W) {
      enc.line(chars.slice(i, i + L.W).join(''))
    }
  }

  // ── Member usage history ─────────────────────────────────────────────────
  const usageHistory = so?.usageHistory ?? []

  if (isMember && entitlement) {
    const dateW = Math.floor(L.W * 0.5)
    const qtyW  = L.W - 5 - dateW

    enc.nl().align('center').bold(true).line('สรุปการใช้บริการ').bold(false).align('left')
    enc.rule(L.W)
    enc.bold(true)
    enc.line(alignLeft('ครั้งที่', 5) + alignLeft('วันที่ใช้บริการ', dateW) + alignRight('จนวน(ชิ้น)', qtyW))
    enc.bold(false).rule(L.W)

    for (const row of usageHistory) {
      const idx = row.isCurrent ? `${row.sessionIndex}*` : String(row.sessionIndex)
      enc.line(alignLeft(idx, 5) + alignLeft(formatDate(row.receivedAt), dateW) + alignRight(String(row.quantity), qtyW))
    }

    enc.rule(L.W)
    const totalUsed = usageHistory.reduce((s, r) => s + r.quantity, 0)
    enc.line(summRow('รวม', String(totalUsed), L))
    enc.line(summRow('คงเหลือ(เครดิต)', `${entitlement.creditRemaining}/${entitlement.creditInitial}`, L))
    if (entitlement.endAt) enc.line(summRow('หมดอายุ', formatDate(entitlement.endAt), L))
  }

  // ── Grand total ──────────────────────────────────────────────────────────
  enc.nl().dblRule(L.W)
  enc.align('center').bold(true).size(1, 2)
  enc.line(summRow('รวมทั้งสิ้น', isMemberFree ? 'ใช้สิทธิ์แพ็กเกจ' : formatCurrency(payload.amount), L))
  enc.size(1, 1).bold(false).align('left')
  enc.dblRule(L.W)

  // ── Footer ───────────────────────────────────────────────────────────────
  enc.feed(2).align('center').line('ขอบคุณที่ใช้บริการ')
  enc.feed(1).cut()

  return enc.encode()
}
