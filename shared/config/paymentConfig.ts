import type { PaymentStatus } from '../types/enums'

export const paymentStatusLabels: Record<PaymentStatus, string> = {
    PENDING: 'รอตรวจสอบ',
    VERIFIED: 'ยืนยันแล้ว',
    FAILED: 'ไม่ผ่าน',
}

export const paymentStatusColors: Record<PaymentStatus, string> = {
    PENDING: 'warning',
    VERIFIED: 'success',
    FAILED: 'error',
}
