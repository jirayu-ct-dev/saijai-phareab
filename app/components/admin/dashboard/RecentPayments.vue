<script setup lang="ts">
/**
 * Dashboard Recent Payments Component
 *
 * แสดงรายการชำระเงินล่าสุดสำหรับ Admin Dashboard
 */

import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Period, Range } from '~~/shared/types/dashboard'
import type { PaymentStatus } from '~~/shared/types/enums'
import {
  paymentStatusLabels,
  paymentStatusColors
} from '~~/shared/config/paymentConfig'
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

// ============================================================
// Types
// ============================================================

interface RecentPayment {
  id: string
  customerName: string
  customerAvatar: string
  lineUserId?: string | null
  amount: number
  status: PaymentStatus
  paymentType: 'PACKAGE' | 'ORDER'
  createdAt: Date
}

// ============================================================
// Mock Data Generator (ลบเมื่อเชื่อม API จริง)
// ============================================================

const mockCustomers = [
  { name: 'คุณสมชาย ใจดี', avatar: 'SC', lineUserId: 'Ubbcf8a984739434e4c0766983a54ad1a' },
  { name: 'คุณสมหญิง รักสะอาด', avatar: 'SY', lineUserId: 'Ubbcf8a984739434e4c0766983a54ad1a' },
  { name: 'คุณวิชัย ผ้าเรียบ', avatar: 'WC', lineUserId: 'Ubbcf8a984739434e4c0766983a54ad1a' },
  { name: 'คุณนิภา ซักรีด', avatar: 'NP', lineUserId: 'Ubbcf8a984739434e4c0766983a54ad1a' },
  { name: 'คุณประเสริฐ สะดวก', avatar: 'PS', lineUserId: 'Ubbcf8a984739434e4c0766983a54ad1a' }
]

const mockStatuses: PaymentStatus[] = ['PENDING', 'VERIFIED', 'FAILED']

const generateMockPayments = (count: number): RecentPayment[] => {
  const payments: RecentPayment[] = []
  const now = new Date()

  for (let i = 0; i < count; i++) {
    const hoursAgo = randomInt(0, 48)
    const date = new Date(now.getTime() - hoursAgo * 3600000)
    const customer = randomFrom(mockCustomers)

    payments.push({
      id: `PAY-${(2000 + randomInt(1, 999))}`,
      customerName: customer.name,
      customerAvatar: customer.avatar,
      lineUserId: customer.lineUserId,
      amount: randomInt(500, 5000),
      status: randomFrom(mockStatuses),
      paymentType: Math.random() > 0.5 ? 'PACKAGE' : 'ORDER',
      createdAt: date
    })
  }

  return payments.sort((a, b) =>
    b.createdAt.getTime() - a.createdAt.getTime()
  )
}

// ============================================================
// Data Fetching
// ============================================================

const { data, status } = await useAsyncData<RecentPayment[]>(
  'recent-payments',
  async () => {
    // TODO: เปลี่ยนเป็นเรียก API จริง
    return generateMockPayments(5)
  },
  {
    watch: [() => props.period, () => props.range],
    default: () => []
  }
)

// ============================================================
// Table Columns
// ============================================================

const columns: TableColumn<RecentPayment>[] = [
  {
    accessorKey: 'customerName',
    header: 'ลูกค้า'
  },
  {
    accessorKey: 'paymentType',
    header: 'รายการ',
    cell: ({ row }) => {
      const type = row.getValue('paymentType') as 'PACKAGE' | 'ORDER'
      const label = type === 'PACKAGE' ? 'แพ็กเกจ' : 'ออเดอร์'
      const color = type === 'PACKAGE' ? 'secondary' : 'primary'
      
      return h(UBadge, {
        variant: 'subtle',
        size: 'sm',
        color
      }, () => label)
    }
  },
  {
    accessorKey: 'amount',
    header: () => h('div', { class: 'text-right' }, 'จำนวนเงิน'),
    cell: ({ row }) => {
      const amount = Number(row.getValue('amount'))
      return h('div', { class: 'text-right font-medium' }, formatCurrency(amount))
    }
  },
  {
    accessorKey: 'status',
    header: 'สถานะ',
    cell: ({ row }) => {
      const s = row.getValue('status') as PaymentStatus
      return h(UBadge, {
        variant: 'subtle',
        color: paymentStatusColors[s]
      }, () => paymentStatusLabels[s])
    }
  },
  {
    accessorKey: 'createdAt',
    header: 'เวลา',
    cell: ({ row }) => formatDateTime(row.getValue('createdAt'))
  },
  {
    accessorKey: 'chatLine',
    header: 'แชท LINE',
    cell: ({ row }) => {
      const lineUserId = row.original.lineUserId
      if (!lineUserId) return '-'
      
      return h(resolveComponent('UIButtonChatLine'), {
        lineUserId: lineUserId
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
        <p class="font-semibold">ชำระเงินล่าสุด</p>
        <UButton
          to="/admin/confirm-payment"
          variant="link"
          color="primary"
          size="sm"
          trailing-icon="i-lucide-arrow-right"
        >
          ดูทั้งหมด
        </UButton>
      </div>
    </template>

    <!-- Table -->
    <UTable
      :data="data"
      :columns="columns"
      :loading="status === 'pending'"
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
        <div class="flex flex-col items-center justify-center py-8 text-muted">
          <UIcon name="i-lucide-receipt" class="size-10 mb-3 opacity-50" />
          <p>ไม่มีรายการชำระเงินในช่วงนี้</p>
        </div>
      </template>
    </UTable>
  </UCard>
</template>
