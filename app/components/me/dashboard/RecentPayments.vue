<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import { adminEmptyStateClass, adminMobileListCardClass, adminTableUi } from '~~/shared/config/adminUi'
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
  <section class="flex flex-col gap-1">
    <div class="admin-dashboard-card flex items-center justify-between rounded-md border border-default/30 bg-default px-3 py-2 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-default/20 dark:bg-elevated/55">
      <p class="font-semibold text-highlighted">ชำระเงินล่าสุด</p>
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

    <div class="md:hidden">
      <div v-if="status === 'pending'" class="space-y-1">
        <USkeleton v-for="i in 4" :key="i" class="h-20 w-full rounded-md" />
      </div>

      <div v-else-if="!data?.length" :class="adminEmptyStateClass">
        <UIcon name="i-lucide-receipt" class="mb-3 size-10 opacity-50" />
        <p>ยังไม่มีรายการชำระเงิน</p>
      </div>

      <div v-else class="space-y-1">
        <div
          v-for="payment in data"
          :key="payment.id"
          :class="[adminMobileListCardClass, 'admin-dashboard-card rounded-md cursor-pointer']"
          @click="router.push(`/me/receipts/${payment.id}`)"
        >
          <div class="flex items-center gap-2 p-2">
            <div class="min-w-0 flex-1">
              <div class="flex min-w-0 items-baseline gap-1.5">
                <span class="truncate text-sm font-medium text-highlighted">{{ payment.paymentNo ?? `#${payment.id.slice(-6)}` }}</span>
              </div>
              <div class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted">
                <UBadge :color="payment.paymentType === 'PACKAGE' ? 'secondary' : 'primary'" variant="subtle" size="xs">
                  {{ payment.paymentType === 'PACKAGE' ? 'แพ็กเกจ' : 'ออเดอร์' }}
                </UBadge>
                <span>{{ formatDateTime(payment.createdAt) }}</span>
              </div>
            </div>
            <span class="shrink-0 text-sm font-semibold text-primary">{{ formatCurrency(payment.amount) }}</span>
            <div class="flex shrink-0 items-center">
              <UButton icon="i-lucide-eye" size="xs" color="neutral" variant="ghost" aria-label="ดูรายการชำระเงิน" @click.stop="router.push(`/me/receipts/${payment.id}`)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="admin-dashboard-card hidden overflow-hidden rounded-md border border-default/30 bg-default shadow-[0_1px_2px_rgb(15_23_42/0.04)] md:block dark:border-default/20 dark:bg-elevated/55">
      <UTable
        :data="data"
        :columns="columns"
        :loading="status === 'pending'"
        :ui="adminTableUi"
        @select="(_e: Event, row) => router.push(`/me/receipts/${row.original.id}`)"
      >
        <template #empty>
          <div :class="adminEmptyStateClass">
            <UIcon name="i-lucide-receipt" class="size-10 mb-3 opacity-50" />
            <p>ยังไม่มีรายการชำระเงิน</p>
          </div>
        </template>
      </UTable>
    </div>
  </section>
</template>
