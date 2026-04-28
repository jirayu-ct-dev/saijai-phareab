<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Period, Range } from '~~/shared/types/dashboard'
import type { OrderStatus, OrderType } from '~~/shared/types/enums'
import {
  orderStatusLabels,
  orderStatusColors,
  orderTypeLabels,
  orderTypeColors,
} from '~~/shared/config/orderConfig'
import { formatCurrency, formatDateTime } from '~~/shared/utils/format'

const props = defineProps<{
  period: Period
  range: Range
}>()

const UBadge = resolveComponent('UBadge')
const UAvatar = resolveComponent('UAvatar')

interface RecentOrder {
  id: string
  orderNo: string | null
  status: OrderStatus
  orderType: OrderType
  creditUsed: number | null
  hangerCharge: { count: number; pricePerUnit: number; total: number } | null
  totalAmount: number
  createdAt: string
  customer: {
    id: string
    name: string
    image: string | null
    phoneNumber: string | null
    lineUserId: string | null
  }
}

const router = useRouter()

const { data, status } = useAsyncData<RecentOrder[]>(
  'recent-orders',
  () => $fetch('/api/admin/dashboard/recent-orders'),
  { server: false, default: () => [] }
)

const columns: TableColumn<RecentOrder>[] = [
  {
    accessorKey: 'orderNo',
    header: 'เลขที่',
    cell: ({ row }) =>
      h('span', { class: 'font-mono text-sm text-muted' }, row.original.orderNo ?? `#${row.original.id.slice(-6)}`),
  },
  {
    accessorKey: 'customer',
    header: 'ลูกค้า',
    cell: ({ row }) => {
      const c = row.original.customer
      return h('div', { class: 'flex items-center gap-2' }, [
        h(UAvatar, { as: { img: 'img' }, src: c.image ?? '', alt: c.name, size: 'sm', loading: 'lazy' }),
        h('div', { class: 'min-w-0' }, [
          h('p', { class: 'font-medium text-sm truncate' }, c.name),
          h('p', { class: 'text-xs text-muted truncate' }, c.phoneNumber ?? ''),
        ]),
      ])
    },
  },
  {
    accessorKey: 'orderType',
    header: 'ประเภท',
    cell: ({ row }) =>
      h(UBadge, {
        variant: 'subtle',
        color: orderTypeColors[row.original.orderType],
      }, () => orderTypeLabels[row.original.orderType]),
  },
  {
    accessorKey: 'status',
    header: 'สถานะ',
    cell: ({ row }) =>
      h(UBadge, {
        variant: 'subtle',
        color: orderStatusColors[row.original.status],
      }, () => orderStatusLabels[row.original.status]),
  },
  {
    accessorKey: 'totalAmount',
    header: () => h('div', { class: 'text-right' }, 'ยอด'),
    cell: ({ row }) => {
      const o = row.original
      const isPackage = o.orderType === 'PACKAGE'
      return h('div', { class: 'text-right space-y-0.5' }, [
        isPackage && o.creditUsed != null
          ? h('span', { class: 'text-primary font-semibold text-sm' }, `-${o.creditUsed} เครดิต`)
          : h('span', { class: 'font-semibold text-sm' }, formatCurrency(o.totalAmount)),
        h('div', { class: 'text-[10px] text-muted' },
          o.hangerCharge ? `ไม้แขวน ${formatCurrency(o.hangerCharge.total)}` : ''),
      ])
    },
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
      return h(resolveComponent('UIButtonChatLine'), { lineUserId, iconOnly: true })
    },
  },
]
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <p class="font-semibold">รายการรับผ้าล่าสุด</p>
        <UButton
          to="/admin/service-orders"
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
        tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr]:cursor-pointer [&>tr]:transition-colors [&>tr]:hover:bg-elevated/60',
        th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default',
      }"
      @select="(_e: Event, row) => router.push(`/admin/service-orders/${row.original.id}`)"
    >
      <template #empty>
        <div class="flex flex-col items-center justify-center py-8 text-muted">
          <UIcon name="i-lucide-shopping-basket" class="size-10 mb-3 opacity-50" />
          <p>ยังไม่มีออเดอร์</p>
        </div>
      </template>
    </UTable>
  </UCard>
</template>
