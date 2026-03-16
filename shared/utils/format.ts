import { format, isSameYear } from 'date-fns'
import { th } from 'date-fns/locale'
import type { Period } from '../types/dashboard' // ดึงมาจากข้างๆ โฟลเดอร์ types

export const THAI_MONTHS = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

/**
 * Format ตัวเลขเป็นสกุลเงินบาทไทย
 */
export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('th-TH', {
        style: 'currency',
        currency: 'THB',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount)
}

/**
 * Format ตัวเลขทั่วไป มีลูกน้ำคั่น
 */
export function formatNumber(amount: number): string {
    return new Intl.NumberFormat('th-TH').format(amount)
}

/**
 * Format วันที่และเวลา (เช่น 1 ม.ค. 2024 14:30 น.)
 */
export function formatDateTime(date: Date | string): string {
    const d = new Date(date)
    const buddhistYear = d.getFullYear() + 543
    const datePart = format(d, 'd MMM', { locale: th })
    const timePart = format(d, "HH:mm '\u0e19.'")
    return `${datePart} ${buddhistYear} ${timePart}`
}

/**
 * Format วันที่ให้สั้นและเข้าใจง่ายตามประเภท Period (วัน/สัปดาห์/เดือน)
 */
export function formatDateByPeriod(date: Date, period: Period): string {
    const isCurrentYear = isSameYear(date, new Date())

    switch (period) {
        case 'daily':
            // ถ้าเป็นปีปัจจุบันแสดง "1 ม.ค." ถ้าไม่ใช่ปีนี้แสดง "1 ม.ค. 2023"
            return format(date, isCurrentYear ? 'd MMM' : 'd MMM yy', { locale: th })

        case 'weekly':
            // ของสัปดาห์อาจจะแสดงเป็นสัปดาห์ที่เท่าไหร่ หรือวันจันทร์ของสัปดาห์
            return format(date, isCurrentYear ? 'd MMM' : 'd MMM yy', { locale: th })

        case 'monthly':
            // แสดง "ม.ค. 2024"
            return format(date, isCurrentYear ? 'MMM' : 'MMM yy', { locale: th })

        default:
            return format(date, 'd MMM yy', { locale: th })
    }
}
