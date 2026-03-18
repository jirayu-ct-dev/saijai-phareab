import type { PackageType } from '../types/enums'

/** Label mapping สำหรับประเภทแพ็กเกจ */
export const packageTypeLabels: Record<PackageType, string> = {
    MAIN: 'แพ็กเกจหลัก',
    ADDON: 'แพ็กเกจเสริม',
}

/** Color mapping สำหรับ UBadge ของ Nuxt UI */
export const packageTypeColors: Record<PackageType, 'primary' | 'secondary'> = {
    MAIN: 'primary',
    ADDON: 'secondary',
}

/** Config สถานะ Active/Inactive สำหรับ UBadge */
export const packageActiveConfig = {
    active:   { label: 'เปิดใช้งาน',   color: 'success' as const },
    inactive: { label: 'ปิดการใช้งาน', color: 'neutral' as const },
}
