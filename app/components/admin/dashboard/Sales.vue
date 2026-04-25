<script setup lang="ts">
/**
 * Dashboard Recent Orders Component
 * 
 * แสดงออเดอร์ล่าสุดสำหรับ Admin Dashboard
 * - คอลัมน์ลูกค้า: รูปโปรไฟล์ + ชื่อ + ลิงก์ LINE (ถ้าล็อกอินด้วย LINE)
 * - คอลัมน์ยอดเงิน: แพ็กเกจ = เครดิต (+ค่าไม้แขวน) / หน้าร้าน = ยอดเงิน
 */

import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Period, Range } from '~~/shared/types/dashboard'
import type { OrderStatus, OrderType } from '~~/shared/types/enums'
import {
  orderStatusLabels,
  orderStatusColors,
  orderTypeLabels,
  orderTypeColors
} from '~~/shared/config/orderConfig'
import { formatCurrency, formatDateTime } from '~~/shared/utils/format'
import { randomInt, randomFrom } from '~~/shared/utils/math'

// ============================================================
// Props
// ============================================================

const props = defineProps<{
  period: Period
  range: Range
}>()

// ============================================================
// Components (for render functions)
// ============================================================

const UBadge = resolveComponent('UBadge')
const UAvatar = resolveComponent('UAvatar')
const UButton = resolveComponent('UButton')
const UTooltip = resolveComponent('UTooltip')

// ============================================================
// Mock Order Interface (ลบเมื่อเชื่อม API จริง)
// ============================================================

interface MockOrder {
  id: string
  orderType: OrderType
  currentStatus: OrderStatus
  totalAmount: number
  creditUsed: number | null
  hangerCharge: { count: number; pricePerUnit: number; total: number } | null
  customerId: string
  customer: {
    name: string
    image: string | null
    phoneNumber: string | null
    lineUserId: string | null   // LINE userId จาก Account (providerId = 'line')
  }
  createdAt: Date
}

// ============================================================
// Mock Data Generator (ลบเมื่อเชื่อม API จริง)
// ============================================================

const mockCustomers = [
  { name: 'คุณสมชาย ใจดี', image: null, phoneNumber: '081-234-5678', lineUserId: 'Ubbcf8a984739434e4c0766983a54ad1a' },
  { name: 'คุณสมหญิง รักสะอาด', image: null, phoneNumber: '089-876-5432', lineUserId: null },
  { name: 'คุณวิชัย ผ้าเรียบ', image: null, phoneNumber: '062-111-2222', lineUserId: 'Ubbcf8a984739434e4c0766983a54ad1a' },
  { name: 'คุณนิภา ซักรีด', image: null, phoneNumber: null, lineUserId: 'Ubbcf8a984739434e4c0766983a54ad1a' },
  { name: 'คุณประเสริฐ สะดวก', image: null, phoneNumber: '095-333-4444', lineUserId: null }
]

const mockStatuses: OrderStatus[] = ['RECEIVED', 'PENDING', 'CHECKING', 'PROCESSING', 'PENDING_REVIEW', 'COMPLETED', 'CANCELLED']
const mockOrderTypes: OrderType[] = ['PACKAGE', 'STOREFRONT']

const generateMockOrders = (count: number): MockOrder[] => {
  const orders: MockOrder[] = []
  const now = new Date()

  for (let i = 0; i < count; i++) {
    const hoursAgo = randomInt(0, 48)
    const date = new Date(now.getTime() - hoursAgo * 3600000)
    const customer = randomFrom(mockCustomers)
    const orderType = randomFrom(mockOrderTypes)
    const hasHanger = Math.random() > 0.6

    orders.push({
      id: (1000 + randomInt(1, 999)).toString(),
      orderType,
      currentStatus: randomFrom(mockStatuses),
      totalAmount: orderType === 'STOREFRONT' ? randomInt(100, 2000) : 0,
      creditUsed: orderType === 'PACKAGE' ? randomInt(3, 15) : null,
      hangerCharge: hasHanger ? { count: randomInt(1, 5), pricePerUnit: 10, total: randomInt(10, 50) } : null,
      customerId: `user-${i}`,
      customer,
      createdAt: date
    })
  }

  return orders.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

// ============================================================
// Helpers
// ============================================================

/**
 * สร้างลิงก์เปิดแชท LINE กับลูกค้า
 * ใช้ LINE Official Account Manager deep link
 */
// (ลบ getLineChatUrl ออกไปไว้ใน LineChatButton แล้ว)

// ============================================================
// Data Fetching
// ============================================================

const { data, status } = await useAsyncData<MockOrder[]>(
  'recent-orders',
  async () => {
    // TODO: เปลี่ยนเป็นเรียก API จริง
    return generateMockOrders(5)
  },
  {
    watch: [() => props.period, () => props.range],
    default: () => []
  }
)

// ============================================================
// Table Columns
// ============================================================

const columns: TableColumn<MockOrder>[] = [
  {
    accessorKey: 'id',
    header: 'รหัส',
    cell: ({ row }) => h('span', { class: 'font-mono text-sm' }, `#${row.original.id}`)
  },
  {
    accessorKey: 'customer',
    header: 'ลูกค้า',
    cell: ({ row }) => {
      const customer = row.original.customer
      if (!customer) return '-'

      const children = [
        // Avatar + Info
        h(UAvatar, {
          as: { img: 'img' },
          src: customer.image,
          alt: customer.name,
          size: 'sm',
          loading: 'lazy' as 'lazy'
        }),
        h('div', { class: 'min-w-0 space-y-0.5' }, [
          h('p', { class: 'font-medium text-highlighted text-sm truncate' }, customer.name),
          h('div', { class: 'flex items-center gap-1.5' }, [
            customer.phoneNumber
              ? h('span', { class: 'text-xs text-muted truncate' }, customer.phoneNumber)
              : null
          ])
        ])
      ]

      return h('div', { class: 'flex items-center gap-2.5' }, children)
    }
  },
  {
    accessorKey: 'orderType',
    header: 'ประเภท',
    cell: ({ row }) => {
      const type = row.original.orderType
      return h(UBadge, {
        variant: 'subtle',
        color: orderTypeColors[type]
      }, () => orderTypeLabels[type])
    }
  },
  {
    accessorKey: 'currentStatus',
    header: 'สถานะ',
    cell: ({ row }) => {
      const status = row.original.currentStatus
      return h(UBadge, {
        variant: 'subtle',
        color: orderStatusColors[status]
      }, () => orderStatusLabels[status])
    }
  },
  {
    accessorKey: 'totalAmount',
    header: () => h('div', { class: 'text-right' }, 'ยอด'),
    cell: ({ row }) => {
      const order = row.original
      const isPackage = order.orderType === 'PACKAGE'
      const parts: any[] = []

      if (isPackage && order.creditUsed != null) {
        // แพ็กเกจ: แสดงเครดิต
        parts.push(
          h('span', { class: 'text-primary font-semibold' }, `-${order.creditUsed} เครดิต`)
        )

        if (order.hangerCharge) {
          parts.push(
            h('div', { class: 'text-[10px] text-muted leading-tight' },
              `ค่าไม้แขวน ${formatCurrency(order.hangerCharge.total)}`
            )
          )
        }
      } else {
        // หน้าร้าน: แสดงยอดเงิน
        const total = Number(order.totalAmount) + (order.hangerCharge?.total ?? 0)
        parts.push(
          h('span', { class: 'font-medium' }, formatCurrency(total))
        )

        // ถ้ามีค่าไม้แขวนแยก แสดงย่อย
        if (order.hangerCharge) {
          parts.push(
            h('div', { class: 'text-[10px] text-muted leading-tight' },
              `รวมไม้แขวน ${formatCurrency(order.hangerCharge.total)}`
            )
          )
        }
      }

      return h('div', { class: 'text-right space-y-0.5' }, parts)
    }
  },
  {
    accessorKey: 'createdAt',
    header: 'เวลา',
    cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, formatDateTime(row.original.createdAt))
  },
  {
    accessorKey: 'chatLine',
    header: 'แชท LINE',
    cell: ({ row }) => {
      const customer = row.original.customer
      if (!customer || !customer.lineUserId) return '-'
      
      return h(resolveComponent('UIButtonChatLine'), {
        lineUserId: customer.lineUserId
      })
    }
  }
]
</script>

<template>
  <UCard>
    <!-- Header -->
    <template #header>
      <div class="flex items-center justify-between">
        <p class="font-semibold">รายการรับผ้าล่าสุด</p>
        <UButton to="/admin/service-orders" variant="link" color="primary" size="sm" trailing-icon="i-lucide-arrow-right">
          ดูทั้งหมด
        </UButton>
      </div>
    </template>

    <!-- Table -->
    <UTable :data="data" :columns="columns" :loading="status === 'pending'" :ui="{
      base: 'table-fixed border-separate border-spacing-0',
      thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
      tbody: '[&>tr]:last:[&>td]:border-b-0',
      th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
      td: 'border-b border-default'
    }">
      <!-- Empty State -->
      <template #empty>
        <div class="flex flex-col items-center justify-center py-8 text-muted">
          <UIcon name="i-lucide-shopping-basket" class="size-10 mb-3 opacity-50" />
          <p>ไม่มีออเดอร์ในช่วงเวลานี้</p>
        </div>
      </template>
    </UTable>
  </UCard>
</template>
