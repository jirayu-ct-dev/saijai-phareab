<script setup lang="ts">
import { h, resolveComponent } from 'vue'
import type { TableColumn } from '@nuxt/ui'
import type { Period, Range } from '~~/shared/types/dashboard'
import { adminTableUi, getAdminListCardClass } from '~~/shared/config/adminUi'
import { formatCurrency, formatDateTime } from '~~/shared/utils/format'

const props = defineProps<{
  period: Period
  range: Range
}>()

const UBadge = resolveComponent('UBadge')
const UAvatar = resolveComponent('UAvatar')

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

const router = useRouter()

const { data, status } = useAsyncData<RecentPayment[]>(
  'recent-payments',
  () => $fetch<RecentPayment[]>('/api/admin/dashboard/recent-payments'),
  { server: false, default: () => [] }
)

const getAvatarProps = (customer?: RecentPayment['customer'] | null) => ({
  as: { img: 'img' },
  src: customer?.image || '',
  alt: customer?.name || 'ลูกค้า',
  loading: 'lazy' as const,
})

const columns: TableColumn<RecentPayment>[] = [
  {
    accessorKey: 'customer',
    header: 'ลูกค้า',
    cell: ({ row }) => {
      const c = row.original.customer
      return h('div', { class: 'flex items-center gap-2' }, [
        h(UAvatar, { ...getAvatarProps(c), size: 'sm' }),
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
      return h(resolveComponent('UIButtonChatLine'), { lineUserId, iconOnly: true })
    },
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

    <div class="md:hidden">
      <div v-if="status === 'pending'" class="space-y-3">
        <USkeleton v-for="i in 4" :key="i" class="h-28 w-full rounded-xl" />
      </div>

      <div v-else-if="!data?.length" class="flex flex-col items-center justify-center py-8 text-muted">
        <UIcon name="i-lucide-receipt" class="mb-3 size-10 opacity-50" />
        <p>ยังไม่มีรายการชำระเงิน</p>
      </div>

      <div v-else class="space-y-4">
        <div
          v-for="payment in data"
          :key="payment.id"
          :class="getAdminListCardClass(payment.paymentType === 'PACKAGE' ? 'secondary' : 'primary')"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex min-w-0 items-center gap-2">
              <UAvatar
                v-bind="getAvatarProps(payment.customer)"
                size="sm"
                class="shrink-0"
              />
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-highlighted">{{ payment.customer.name }}</p>
                <p class="truncate font-mono text-xs text-muted">{{ payment.paymentNo || payment.id }}</p>
              </div>
            </div>

            <UBadge
              :color="payment.paymentType === 'PACKAGE' ? 'secondary' : 'primary'"
              variant="subtle"
              size="sm"
              class="shrink-0"
            >
              {{ payment.paymentType === 'PACKAGE' ? 'แพ็กเกจ' : 'ออเดอร์' }}
            </UBadge>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2 border-t border-default pt-3 text-xs">
            <div>
              <p class="text-muted">ยอดชำระ</p>
              <p class="mt-1 font-semibold text-highlighted">{{ formatCurrency(payment.amount) }}</p>
            </div>
            <div>
              <p class="text-muted">เวลา</p>
              <p class="mt-1 text-highlighted">{{ formatDateTime(payment.createdAt) }}</p>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-end gap-1 border-t border-default pt-3">
            <UIButtonChatLine
              v-if="payment.customer.lineUserId"
              :line-user-id="payment.customer.lineUserId"
              icon-only
              size="xs"
            />
            <UButton
              icon="i-lucide-eye"
              size="xs"
              color="neutral"
              variant="ghost"
              aria-label="ดูรายการชำระเงิน"
              @click="router.push(`/admin/payment/${payment.id}`)"
            />
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
      @select="(_e: Event, row) => router.push(`/admin/payment/${row.original.id}`)"
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
