<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { OrderStatus, OrderType } from '~~/shared/types/enums'
import {
  orderStatusLabels,
  orderStatusColors,
} from '~~/shared/config/orderConfig'
import { formatCurrency, formatDateTime } from '~~/shared/utils/format'

const UBadge = resolveComponent('UBadge')

interface RecentOrder {
  id: string
  orderNo: string | null
  status: OrderStatus
  totalAmount: number
  receivedAt: string
}

const router = useRouter()

const { data: dashboardData, status } = useFetch('/api/me')

const orders = computed<RecentOrder[]>(() => {
  if (!dashboardData.value) return []
  return dashboardData.value.recentOrders.map((o) => ({
    id: o.id,
    orderNo: o.orderNo,
    status: o.status as OrderStatus,
    totalAmount: o.totalAmount,
    receivedAt: o.receivedAt,
  }))
})

const columns: TableColumn<RecentOrder>[] = [
  {
    accessorKey: 'orderNo',
    header: 'เลขที่',
    cell: ({ row }) =>
      h('span', { class: 'font-mono text-sm text-muted' }, row.original.orderNo ?? `#${row.original.id.slice(-6)}`),
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
    cell: ({ row }) =>
      h('div', { class: 'text-right font-semibold text-sm' }, formatCurrency(row.original.totalAmount)),
  },
  {
    accessorKey: 'receivedAt',
    header: 'เวลา',
    cell: ({ row }) =>
      h('span', { class: 'text-xs text-muted' }, formatDateTime(row.original.receivedAt)),
  },
]
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <p class="font-semibold">ออเดอร์ล่าสุด</p>
        <UButton
          to="/me/orders"
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
      :data="orders"
      :columns="columns"
      :loading="status === 'pending'"
      :ui="{
        base: 'table-fixed border-separate border-spacing-0',
        thead: '[&>tr]:bg-elevated/50 [&>tr]:after:content-none',
        tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr]:cursor-pointer [&>tr]:transition-colors [&>tr]:hover:bg-elevated/60',
        th: 'first:rounded-l-lg last:rounded-r-lg border-y border-default first:border-l last:border-r',
        td: 'border-b border-default',
      }"
      @select="(_e: Event, row) => router.push(`/me/orders/${row.original.id}`)"
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
