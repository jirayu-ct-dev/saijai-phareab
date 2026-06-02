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

defineProps<{
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
  <section class="flex flex-col gap-1">
    <div class="-mx-2 flex items-center justify-between border border-default/30 bg-default px-3 py-2 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
      <p class="font-semibold text-highlighted">รายการรับผ้าล่าสุด</p>
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

    <div class="md:hidden">
      <div v-if="status === 'pending'" class="-mx-2 space-y-1 sm:mx-0">
        <USkeleton v-for="i in 4" :key="i" class="h-36 w-full sm:rounded-lg" />
      </div>

      <div
        v-else-if="!data?.length"
        class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30"
      >
        <UIcon name="i-lucide-shopping-basket" class="mb-3 size-10 opacity-50" />
        <p>ยังไม่มีออเดอร์</p>
      </div>

      <div v-else class="-mx-2 space-y-1 sm:mx-0">
        <div
          v-for="order in data"
          :key="order.id"
          class="border border-default/30 bg-default transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70 sm:rounded-lg"
        >
          <div class="flex items-center gap-2 p-2">
            <UAvatar v-bind="getAvatarProps(order.customer)" size="sm" class="shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 items-baseline gap-1.5">
                <span class="truncate text-sm font-medium text-highlighted">{{ order.customer.name }}</span>
                <span class="shrink-0 font-mono text-[10px] text-muted">{{ order.orderNo ?? `#${order.id.slice(-6)}` }}</span>
              </div>
              <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                <UBadge :color="orderTypeColors[order.orderType]" variant="subtle" size="xs">{{ orderTypeLabels[order.orderType] }}</UBadge>
                <UBadge :color="orderStatusColors[order.status]" variant="subtle" size="xs">{{ orderStatusLabels[order.status] }}</UBadge>
                <span>{{ formatDateTime(order.createdAt) }}</span>
              </div>
            </div>
            <div class="flex shrink-0 flex-col items-end gap-0.5">
              <span class="text-sm font-semibold text-primary leading-none">{{ formatOrderAmount(order) }}</span>
              <span v-if="order.hangerCharge" class="text-[10px] text-muted">ไม้แขวน {{ formatCurrency(order.hangerCharge.total) }}</span>
            </div>
            <div class="flex shrink-0 items-center">
              <UIButtonChatLine v-if="order.customer.lineUserId" :line-user-id="order.customer.lineUserId" icon-only size="xs" />
              <UButton icon="i-lucide-eye" size="xs" color="neutral" variant="ghost" aria-label="ดูรายการรับผ้า" @click="router.push(`/admin/service-orders/${order.id}`)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="hidden overflow-hidden rounded-lg border border-default/30 bg-default dark:border-default/20 dark:bg-elevated/55 md:block">
      <UTable
        :data="data"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="{
          root: 'relative overflow-x-auto',
          base: 'table-fixed border-separate border-spacing-0',
          thead: 'sticky top-0 z-1 [&>tr]:bg-default dark:[&>tr]:bg-default/80 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr:hover>td]:bg-primary/5 dark:[&>tr:hover>td]:bg-elevated/45',
          th: 'border-b border-default bg-default py-2.5 text-xs font-semibold uppercase tracking-wide text-toned dark:border-default/40 dark:bg-default/80',
          td: 'border-b border-default py-2.5 transition-colors dark:border-default/25',
          separator: 'h-0',
        }"
        @select="(_e: Event, row) => router.push(`/admin/service-orders/${row.original.id}`)"
      >
        <template #empty>
          <div class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30">
            <UIcon name="i-lucide-shopping-basket" class="size-10 mb-3 opacity-50" />
            <p>ยังไม่มีออเดอร์</p>
          </div>
        </template>
      </UTable>
    </div>
  </section>
</template>
