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
import { adminMobileListCardClass, adminTableUi } from '~~/shared/config/adminUi'
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

const formatOrderAmount = (order: RecentOrder) => {
  if (order.orderType === 'PACKAGE' && order.creditUsed != null) return `-${order.creditUsed} เครดิต`
  return formatCurrency(order.totalAmount)
}

const getAvatarProps = (customer?: RecentOrder['customer'] | null) => ({
  as: { img: 'img' },
  src: customer?.image || '',
  alt: customer?.name || 'ลูกค้า',
  loading: 'lazy' as const,
})

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
        h(UAvatar, { ...getAvatarProps(c), size: 'sm' }),
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

    <div class="md:hidden">
      <div v-if="status === 'pending'" class="space-y-3">
        <USkeleton v-for="i in 4" :key="i" class="h-36 w-full rounded-xl" />
      </div>

      <div v-else-if="!data?.length" class="flex flex-col items-center justify-center py-8 text-muted">
        <UIcon name="i-lucide-shopping-basket" class="mb-3 size-10 opacity-50" />
        <p>ยังไม่มีออเดอร์</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="order in data"
          :key="order.id"
          :class="adminMobileListCardClass"
        >
          <div class="p-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate font-mono text-xs text-muted">{{ order.orderNo ?? `#${order.id.slice(-6)}` }}</p>
              <div class="mt-1 flex min-w-0 items-center gap-2">
                <UAvatar
                  v-bind="getAvatarProps(order.customer)"
                  size="sm"
                  class="shrink-0"
                />
                <span class="min-w-0">
                  <span class="block truncate text-sm font-medium text-highlighted">{{ order.customer.name }}</span>
                  <span class="block truncate text-xs text-muted">{{ order.customer.phoneNumber || 'ไม่ระบุเบอร์' }}</span>
                </span>
              </div>
            </div>

            <div class="flex shrink-0 flex-col items-end gap-1 text-right">
              <UBadge
                :color="orderStatusColors[order.status]"
                variant="subtle"
                size="xs"
              >
                {{ orderStatusLabels[order.status] }}
              </UBadge>
              <span class="text-[11px] leading-tight text-muted">
                {{ formatDateTime(order.createdAt) }}
              </span>
            </div>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3 text-xs dark:border-gray-800">
            <div>
              <p class="text-muted">ประเภท</p>
              <UBadge :color="orderTypeColors[order.orderType]" variant="subtle" size="xs" class="mt-1">
                {{ orderTypeLabels[order.orderType] }}
              </UBadge>
            </div>
            <div>
              <p class="text-muted">ยอด</p>
              <p class="mt-1 text-lg font-semibold text-primary">{{ formatOrderAmount(order) }}</p>
              <p v-if="order.hangerCharge" class="mt-0.5 text-muted">
                ไม้แขวน {{ formatCurrency(order.hangerCharge.total) }}
              </p>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-end gap-1 border-t border-gray-100 pt-3 dark:border-gray-800">
            <UIButtonChatLine
              v-if="order.customer.lineUserId"
              :line-user-id="order.customer.lineUserId"
              icon-only
              size="xs"
            />
            <UButton
              icon="i-lucide-eye"
              size="xs"
              color="neutral"
              variant="ghost"
              aria-label="ดูรายการรับผ้า"
              @click="router.push(`/admin/service-orders/${order.id}`)"
            />
          </div>
          </div>
        </div>
      </div>
    </div>

    <UTable
      :data="data"
      :columns="columns"
      :loading="status === 'pending'"
      class="hidden md:block"
      :ui="adminTableUi"
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
