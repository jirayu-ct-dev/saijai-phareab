import type { PaymentMethod } from '../types/enums'

export const paymentMethodLabels: Record<PaymentMethod, string> = {
    CASH: 'เงินสด',
    TRANSFER: 'โอนเงิน',
}
