import type { OrderStatus, OrderType } from '../types/enums'

export const orderStatusLabels: Record<OrderStatus, string> = {
    RECEIVED: 'รับผ้าแล้ว',
    PENDING: 'รอดำเนินการ',
    CHECKING: 'กำลังตรวจสอบ',
    PROCESSING: 'กำลังซัก',
    PENDING_REVIEW: 'รอตรวจสอบ',
    COMPLETED: 'เสร็จสิ้น',
    CANCELLED: 'ยกเลิก',
}

export const orderStatusColors: Record<OrderStatus, string> = {
    RECEIVED: 'info',
    PENDING: 'neutral',
    CHECKING: 'warning',
    PROCESSING: 'primary',
    PENDING_REVIEW: 'secondary',
    COMPLETED: 'success',
    CANCELLED: 'error',
}

export const orderTypeLabels: Record<OrderType, string> = {
    PACKAGE: 'แพ็กเกจ',
    STOREFRONT: 'หน้าร้าน',
}

export const orderTypeColors: Record<OrderType, string> = {
    PACKAGE: 'secondary',
    STOREFRONT: 'primary',
}


