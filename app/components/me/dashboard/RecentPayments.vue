<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { formatCurrency, formatDateTime } from '~~/shared/utils/format'

const UBadge = resolveComponent('UBadge')

interface RecentPayment {
  id: string
  paymentNo: string | null
  amount: number
  paymentType: 'PACKAGE' | 'ORDER'
  createdAt: string
}

const router = useRouter()

const { data, status } = useAsyncData<RecentPayment[]>(
  'me-recent-payments',
  () => $fetch<RecentPayment[]>('/api/me/dashboard/recent-payments'),
  { server: false, default: () => [] }
)

const columns: TableColumn<RecentPayment>[] = [
  {
    accessorKey: 'paymentNo',
    header: 'เลขที่บิล',
    cell: ({ row }) =>
      h('span', { class: 'font-mono text-sm text-muted' }, row.original.paymentNo ?? `#${row.original.id.slice(-6)}`),
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
]
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex items-center justify-between">
        <p class="font-semibold">ชำระเงินล่าสุด</p>
        <UButton
          to="/me/receipts"
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
      @select="(_e: Event, row) => router.push(`/me/receipts/${row.original.id}`)"
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
