import type { PaymentMethod, PaymentStatus } from '../types/enums'

export const paymentMethodLabels: Record<PaymentMethod, string> = {
    CASH: 'เงินสด',
    TRANSFER: 'โอนเงิน',
}

export const paymentStatusLabels: Record<PaymentStatus, string> = {
    UNPAID: 'ยังไม่ชำระ',
    PENDING_VERIFICATION: 'รอตรวจสอบ',
    PAID: 'ชำระแล้ว',
    CANCELLED: 'ยกเลิก',
}

export const paymentStatusColors: Record<PaymentStatus, 'neutral' | 'warning' | 'success' | 'error'> = {
    UNPAID: 'neutral',
    PENDING_VERIFICATION: 'warning',
    PAID: 'success',
    CANCELLED: 'error',
}
