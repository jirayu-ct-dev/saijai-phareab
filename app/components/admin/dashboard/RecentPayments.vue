<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Period, Range } from '~~/shared/types/dashboard'
import { formatCurrency, formatDateTime } from '~~/shared/utils/format'

const props = defineProps<{
  period: Period
  range: Range
}>()

const UBadge = resolveComponent('UBadge')
const UAvatar = resolveComponent('UAvatar')
const UButton = resolveComponent('UButton')

interface RecentPayment {
  id: string
  paymentNo: string | null
  amount: number
  paymentType: 'PACKAGE' | 'ORDER'
  createdAt: string
  customer: {
    id: string
    name: string
    image: string | null
    lineUserId: string | null
  }
}

const { data, status } = useAsyncData<RecentPayment[]>(
  'recent-payments',
  () => $fetch('/api/admin/dashboard/recent-payments'),
  { server: false, default: () => [] }
)

const columns: TableColumn<RecentPayment>[] = [
  {
    accessorKey: 'customer',
    header: 'ลูกค้า',
    cell: ({ row }) => {
      const c = row.original.customer
      return h('div', { class: 'flex items-center gap-2' }, [
        h(UAvatar, { src: c.image, alt: c.name, size: 'sm' }),
        h('span', { class: 'font-medium text-sm truncate' }, c.name),
      ])
    },
  },
  {
    accessorKey: 'paymentType',
    header: 'รายการ',
    cell: ({ row }) => {
      const type = row.original.paymentType
      return h(UBadge, {
        variant: 'subtle',
        size: 'sm',
        color: type === 'PACKAGE' ? 'secondary' : 'primary',
      }, () => type === 'PACKAGE' ? 'แพ็กเกจ' : 'ออเดอร์')
    },
  },
  {
    accessorKey: 'amount',
    header: () => h('div', { class: 'text-right' }, 'ยอด'),
    cell: ({ row }) =>
      h('div', { class: 'text-right font-semibold' }, formatCurrency(row.original.amount)),
  },
  {
    accessorKey: 'createdAt',
    header: 'เวลา',
    cell: ({ row }) =>
      h('span', { class: 'text-xs text-muted' }, formatDateTime(row.original.createdAt)),
  },
  {
    accessorKey: 'chat',
    header: '',
    cell: ({ row }) => {
      const lineUserId = row.original.customer.lineUserId
      if (!lineUserId) return h('span')
      return h(resolveComponent('UIButtonChatLine'), { lineUserId })
    },
  },
  {
    accessorKey: 'id',
    header: '',
    cell: ({ row }) =>
      h(UButton, {
        to: `/admin/payment/${row.original.id}`,
        variant: 'ghost',
        color: 'neutral',
        icon: 'i-lucide-chevron-right',
        size: 'xs',
      }),
  },
]
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <p class="font-semibold">ชำระเงินล่าสุด</p>
        <UButton
          to="/admin/payment"
          variant="link"
          color="primary"
          size="sm"
          trailing-icon="i-lucide-arrow-right"
        >
          ดูทั้งหมด
        </UButton>
      </div>
    </template>

    <UTable
      :data="data"
      :columns="columns"
      :loading="status === 'pending'"
      :ui="{
        base: 'table-fixed border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0',
        th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default',
      }"
    >
      <template #empty>
        <div class="flex flex-col items-center justify-center py-8 text-muted">
          <UIcon name="i-lucide-receipt" class="size-10 mb-3 opacity-50" />
          <p>ยังไม่มีรายการชำระเงิน</p>
        </div>
      </template>
    </UTable>
  </UCard>
</template>
