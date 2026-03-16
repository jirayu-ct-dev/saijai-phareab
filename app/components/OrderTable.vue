<script setup lang="ts">
/**
 * Order Table Component
 *
 * ตารางออเดอร์กลาง ใช้ได้ทุกหน้า (admin, employee, member)
 * รองรับ: ค้นหา, กรองสถานะ, เรียงลำดับ, Pagination
 */

import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Order } from '~~/shared/types/order'
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
// Components (for render functions)
// ============================================================

const UBadge = resolveComponent('UBadge')

// ============================================================
// Reactive State
// ============================================================

const search = ref('')
const statusFilter = ref<OrderStatus | 'ALL'>('ALL')
const page = ref(1)
const pageSize = 10

// ============================================================
// Status Filter Options
// ============================================================

const statusOptions = computed(() => [
  { label: 'ทั้งหมด', value: 'ALL' },
  ...Object.entries(orderStatusLabels).map(([value, label]) => ({
    label,
    value
  }))
])

// ============================================================
// Mock Data Generator (ลบเมื่อเชื่อม API จริง)
// ============================================================

const mockCustomers = [
  'คุณสมชาย ใจดี',
  'คุณสมหญิง รักสะอาด',
  'คุณวิชัย ผ้าเรียบ',
  'คุณนิภา ซักรีด',
  'คุณประเสริฐ สะดวก',
  'คุณอรุณ สว่างจิต',
  'คุณมาลี ดอกไม้',
  'คุณสุรชัย ทันสมัย',
  'คุณพิมพ์ สะอาดใส',
  'คุณธนา รักดี'
]

const mockStatuses: OrderStatus[] = ['RECEIVED', 'PENDING', 'CHECKING', 'PROCESSING', 'PENDING_REVIEW', 'COMPLETED', 'CANCELLED']
const mockOrderTypes: OrderType[] = ['PACKAGE', 'STOREFRONT']

const allOrders = ref<any[]>([])

// สร้าง Mock Orders ตอน mount
onMounted(() => {
  const orders = []
  const now = new Date()

  for (let i = 0; i < 35; i++) {
    const hoursAgo = randomInt(0, 720) // ภายใน 30 วัน
    const date = new Date(now.getTime() - hoursAgo * 3600000)

    orders.push({
      id: (1000 + i).toString(),
      orderType: randomFrom(mockOrderTypes),
      currentStatus: randomFrom(mockStatuses),
      totalAmount: randomInt(100, 3000),
      customerId: `user-${i}`,
      customerName: randomFrom(mockCustomers),
      createdAt: date
    })
  }

  allOrders.value = orders.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
})

// ============================================================
// Filtered & Paginated Data
// ============================================================

const filteredOrders = computed(() => {
  let result = allOrders.value

  // กรองตามสถานะ
  if (statusFilter.value !== 'ALL') {
    result = result.filter(o => o.currentStatus === statusFilter.value)
  }

  // ค้นหาตามรหัสหรือชื่อลูกค้า
  if (search.value.trim()) {
    const q = search.value.trim().toLowerCase()
    result = result.filter(o =>
      o.id.includes(q) ||
      o.customerName.toLowerCase().includes(q)
    )
  }

  return result
})

const totalPages = computed(() => Math.ceil(filteredOrders.value.length / pageSize))

const paginatedOrders = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredOrders.value.slice(start, start + pageSize)
})

// รีเซ็ตหน้าเมื่อเปลี่ยนตัวกรอง
watch([search, statusFilter], () => {
  page.value = 1
})

// ============================================================
// Table Columns
// ============================================================

const columns: TableColumn<any>[] = [
  {
    accessorKey: 'id',
    header: 'รหัส',
    cell: ({ row }) => `#${row.getValue('id')}`
  },
  {
    accessorKey: 'createdAt',
    header: 'วันที่',
    cell: ({ row }) => formatDateTime(row.getValue('createdAt'))
  },
  {
    accessorKey: 'customerName',
    header: 'ลูกค้า'
  },
  {
    accessorKey: 'orderType',
    header: 'ประเภท',
    cell: ({ row }) => {
      const type = row.getValue('orderType') as OrderType
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
      const status = row.getValue('currentStatus') as OrderStatus
      return h(UBadge, {
        variant: 'subtle',
        color: orderStatusColors[status]
      }, () => orderStatusLabels[status])
    }
  },
  {
    accessorKey: 'totalAmount',
    header: () => h('div', { class: 'text-right' }, 'ยอดเงิน'),
    cell: ({ row }) => {
      const amount = Number(row.getValue('totalAmount'))
      return h('div', { class: 'text-right font-medium' }, formatCurrency(amount))
    }
  }
]
</script>

<template>
  <UCard>
    <!-- Header -->
    <template #header>
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p class="font-semibold text-lg">รายการออเดอร์</p>

        <div class="flex flex-wrap items-center gap-2">
          <!-- ค้นหา -->
          <UInput
            v-model="search"
            icon="i-lucide-search"
            placeholder="ค้นหารหัส, ชื่อลูกค้า..."
            size="sm"
            class="w-full sm:w-56"
            :ui="{ root: 'flex-1 sm:flex-initial' }"
          />

          <!-- กรองสถานะ -->
          <USelect
            v-model="statusFilter"
            :items="statusOptions"
            value-key="value"
            size="sm"
            class="w-full sm:w-40"
            icon="i-lucide-filter"
          />
        </div>
      </div>
    </template>

    <!-- Table -->
    <UTable
      :data="paginatedOrders"
      :columns="columns"
      :ui="{
        base: 'table-fixed border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0',
        th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default'
      }"
    >
      <!-- Empty State -->
      <template #empty>
        <div class="flex flex-col items-center justify-center py-12 text-muted">
          <UIcon name="i-lucide-search-x" class="size-12 mb-3 opacity-50" />
          <p class="font-medium">ไม่พบออเดอร์</p>
          <p class="text-sm mt-1">ลองเปลี่ยนคำค้นหาหรือตัวกรอง</p>
        </div>
      </template>
    </UTable>

    <!-- Footer: Pagination & Summary -->
    <template #footer>
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p class="text-sm text-muted">
          แสดง {{ paginatedOrders.length }} จาก {{ filteredOrders.length }} รายการ
        </p>

        <UPagination
          v-if="totalPages > 1"
          v-model="page"
          :total="filteredOrders.length"
          :items-per-page="pageSize"
          size="sm"
        />
      </div>
    </template>
  </UCard>
</template>
