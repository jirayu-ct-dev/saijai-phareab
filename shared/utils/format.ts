import { format, isSameYear } from 'date-fns'
import { th } from 'date-fns/locale'
import type { Period } from '../types/dashboard'

const BANGKOK_TIME_ZONE = 'Asia/Bangkok'

const currencyFormatter = new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
})

const numberFormatter = new Intl.NumberFormat('th-TH')

const shortDateFormatter = new Intl.DateTimeFormat('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: BANGKOK_TIME_ZONE
})

const timeFormatter = new Intl.DateTimeFormat('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: BANGKOK_TIME_ZONE
})

const toBangkokDate = (date: Date | string): Date => {
    const source = date instanceof Date ? date : new Date(date)
    const localized = source.toLocaleString('sv-SE', { timeZone: BANGKOK_TIME_ZONE })
    return new Date(localized)
}

export const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

export function formatCurrency(amount: number): string {
    return currencyFormatter.format(amount)
}

export function formatNumber(amount: number): string {
    return numberFormatter.format(amount)
}

export function formatDateTime(date: Date | string): string {
    const bangkokDate = toBangkokDate(date)
    const datePart = shortDateFormatter.format(bangkokDate)
    const timePart = timeFormatter.format(bangkokDate)
    return `${datePart} ${timePart} น.`
}

export function formatDateByPeriod(date: Date, period: Period): string {
    const isCurrentYear = isSameYear(date, new Date())

    switch (period) {
        case 'daily':
            return format(date, isCurrentYear ? 'd MMM' : 'd MMM yy', { locale: th })

        case 'weekly':
            return format(date, isCurrentYear ? 'd MMM' : 'd MMM yy', { locale: th })

        case 'monthly':
            return format(date, isCurrentYear ? 'MMM' : 'MMM yy', { locale: th })

        default:
            return format(date, 'd MMM yy', { locale: th })
    }
}

export const formatCredits = (credits: number | null | undefined): string => {
    const n = credits ?? 0
    return n > 0 ? n.toLocaleString('th-TH') : '—'
}

export const formatDays = (days: number | null | undefined): string => {
    return days ? `${days} วัน` : '—'
}
