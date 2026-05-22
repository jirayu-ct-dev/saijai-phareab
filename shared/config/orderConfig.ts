import type { OrderStatus, OrderType } from '../types/enums'

export const orderStatusLabels: Record<OrderStatus, string> = {
    RECEIVED: 'รับผ้า',
    PROCESSING: 'ดำเนินการ',
    DELIVERING: 'กำลังส่ง/รอรับ',
    COMPLETED: 'เสร็จสิ้น',
    CANCELLED: 'ยกเลิก',
}

export const orderStatusColors: Record<OrderStatus, string> = {
    RECEIVED: 'info',
    PROCESSING: 'primary',
    DELIVERING: 'warning',
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


