<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { OrderStatus, OrderType } from '~~/shared/types/enums'
import {
  orderStatusLabels,
  orderStatusColors,
} from '~~/shared/config/orderConfig'
import { adminEmptyStateClass, adminMobileListCardClass, adminTableUi } from '~~/shared/config/adminUi'
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
  <section class="flex flex-col gap-1">
    <div class="admin-dashboard-card flex items-center justify-between rounded-md border border-default/30 bg-default px-3 py-2 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-default/20 dark:bg-elevated/55">
      <p class="font-semibold text-highlighted">ออเดอร์ล่าสุด</p>
      <UButton
        to="/me/service-orders"
        variant="link"
        color="primary"
        size="sm"
        trailing-icon="i-lucide-arrow-right"
      >
        ดูทั้งหมด
      </UButton>
    </div>

    <div class="md:hidden">
      <div v-if="status === 'pending'" class="space-y-1">
        <USkeleton v-for="i in 4" :key="i" class="h-20 w-full rounded-md" />
      </div>

      <div v-else-if="!orders.length" :class="adminEmptyStateClass">
        <UIcon name="i-lucide-shopping-basket" class="mb-3 size-10 opacity-50" />
        <p>ยังไม่มีออเดอร์</p>
      </div>

      <div v-else class="space-y-1">
        <div
          v-for="order in orders"
          :key="order.id"
          :class="[adminMobileListCardClass, 'admin-dashboard-card rounded-md cursor-pointer']"
          @click="router.push(`/me/service-orders/${order.id}`)"
        >
          <div class="flex items-center gap-2 p-2">
            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 items-baseline gap-1.5">
                <span class="truncate text-sm font-medium text-highlighted">{{ order.orderNo ?? `#${order.id.slice(-6)}` }}</span>
              </div>
              <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                <UBadge :color="orderStatusColors[order.status]" variant="subtle" size="xs">{{ orderStatusLabels[order.status] }}</UBadge>
                <span>{{ formatDateTime(order.receivedAt) }}</span>
              </div>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-0.5">
              <span class="text-sm font-semibold text-primary leading-none">{{ formatCurrency(order.totalAmount) }}</span>
            </div>
            <div class="flex shrink-0 items-center">
              <UButton icon="i-lucide-eye" size="xs" color="neutral" variant="ghost" aria-label="ดูออเดอร์" @click.stop="router.push(`/me/service-orders/${order.id}`)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="admin-dashboard-card hidden overflow-hidden rounded-md border border-default/30 bg-default shadow-[0_1px_2px_rgb(15_23_42/0.04)] md:block dark:border-default/20 dark:bg-elevated/55">
      <UTable
        :data="orders"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="adminTableUi"
        @select="(_e: Event, row) => router.push(`/me/service-orders/${row.original.id}`)"
      >
        <template #empty>
          <div :class="adminEmptyStateClass">
            <UIcon name="i-lucide-shopping-basket" class="size-10 mb-3 opacity-50" />
            <p>ยังไม่มีออเดอร์</p>
          </div>
        </template>
      </UTable>
    </div>
  </section>
</template>
