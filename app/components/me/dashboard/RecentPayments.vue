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

const props = withDefaults(defineProps<{
  refreshing?: boolean
}>(), {
  refreshing: false,
})

const router = useRouter()

const { data, status } = useAsyncData<RecentPayment[]>(
  'me-recent-payments',
  () => $fetch<RecentPayment[]>('/api/me/dashboard/recent-payments'),
  { server: false, default: () => [] }
 )

const isPending = computed(() => status.value === 'pending' || props.refreshing)

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
    <div class="-mx-2 flex items-center justify-between border border-default/30 bg-default px-3 py-2 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
      <p class="font-semibold text-highlighted">ชำระเงินล่าสุด</p>
      <UButton
        to="/me/payment"
        variant="link"
        color="primary"
        size="sm"
        trailing-icon="i-lucide-arrow-right"
      >
        ดูทั้งหมด
      </UButton>
    </div>

    <div class="md:hidden">
      <div v-if="isPending" class="-mx-2 space-y-1 sm:mx-0">
        <div
          v-for="i in 4"
          :key="i"
          class="border border-default/30 bg-default p-2 dark:border-default/20 dark:bg-elevated/55"
        >
          <div class="flex items-center gap-2">
            <div class="min-w-0 flex-1 space-y-1.5">
              <USkeleton class="h-4 w-32 rounded-lg" />
              <USkeleton class="h-3 w-44 rounded-lg" />
            </div>
            <USkeleton class="h-5 w-20 rounded-lg" />
          </div>
        </div>
      </div>

      <div v-else-if="!data?.length" class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30">
        <UIcon name="i-lucide-receipt" class="mb-3 size-10 opacity-50" />
        <p>ยังไม่มีรายการชำระเงิน</p>
      </div>

      <div v-else class="-mx-2 space-y-1 sm:mx-0">
        <div
          v-for="payment in data"
          :key="payment.id"
          class="cursor-pointer border border-default/30 bg-default transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70"
          @click="router.push(`/me/payment/${payment.id}`)"
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
              <UButton icon="i-lucide-eye" size="xs" color="neutral" variant="ghost" aria-label="ดูรายการชำระเงิน" @click.stop="router.push(`/me/payment/${payment.id}`)" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="hidden overflow-hidden rounded-lg border border-default/30 bg-default dark:border-default/20 dark:bg-elevated/55 md:block">
      <UTable
        :data="data"
        :columns="columns"
        :loading="isPending"
        :ui="{
          root: 'relative overflow-x-auto',
          base: 'table-fixed border-separate border-spacing-0',
          thead: 'sticky top-0 z-1 [&>tr]:bg-default dark:[&>tr]:bg-default/80 [&>tr]:after:content-none',
          tbody: '[&>tr]:last:[&>td]:border-b-0 [&>tr:hover>td]:bg-primary/5 dark:[&>tr:hover>td]:bg-elevated/45',
          th: 'border-b border-default bg-default py-2.5 text-xs font-semibold uppercase tracking-wide text-toned dark:border-default/40 dark:bg-default/80',
          td: 'border-b border-default py-2.5 transition-colors dark:border-default/25',
          separator: 'h-0',
        }"
        @select="(_e: Event, row) => router.push(`/me/payment/${row.original.id}`)"
      >
        <template #empty>
          <div class="flex flex-col items-center justify-center rounded-lg border border-dashed border-default/30 bg-default/55 px-3 py-5 text-center text-muted dark:border-default/20 dark:bg-elevated/30">
            <UIcon name="i-lucide-receipt" class="size-10 mb-3 opacity-50" />
            <p>ยังไม่มีรายการชำระเงิน</p>
          </div>
        </template>
      </UTable>
    </div>
  </section>
</template>
