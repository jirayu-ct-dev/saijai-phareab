<script setup lang="ts">
import { packageTypeColors, packageTypeLabels } from '~~/shared/config/packageConfig'
import { orderStatusLabels } from '~~/shared/config/orderConfig'
import { formatCurrency, formatDateTime } from '~~/shared/utils/format'
import type {
  EntitlementStatus,
  PackageSaleStatus,
  PaymentMethod,
  Role,
  ServiceOrderStatus
} from '~~/shared/types/enums'

definePageMeta({
  layout: 'admin',
  middleware: ['role-admin']
})

type BadgeColor = 'error' | 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'neutral'
type InfoRow = { label: string; value: string; valueClass?: string }

type UserDetailResponse = {
  user: {
    id: string
    email: string
    name: string | null
    image: string | null
    role: Role
    phoneNumber: string | null
    emailVerified: boolean
    createdAt: string
    updatedAt: string
    lineUserId: string | null
  }
  stats: {
    activeEntitlementCount: number
    totalEntitlementCount: number
    totalCreditsRemaining: number
    totalCreditsUsed: number
    totalPackageSales: number
    totalPayments: number
    totalServiceOrders: number
    totalSpent: number
  }
  memberEntitlements: Array<{
    id: string
    status: EntitlementStatus
    creditInitial: number | null
    creditRemaining: number | null
    creditUsed: number
    startAt: string | null
    endAt: string | null
    activatedAt: string | null
    suspendedAt: string | null
    createdAt: string
    product: {
      id: string
      name: string
      packageType: 'MAIN' | 'ADDON'
      credits: number | null
      validityDays: number | null
      price: number
    }
    sourceSale: {
      id: string
      createdAt: string
    } | null
  }>
  recentPayments: Array<{
    id: string
    amount: number
    paymentMethod: PaymentMethod
    isVerified: boolean
    note: string | null
    createdAt: string
    paidAt: string | null
    packageSale: {
      id: string
      items: Array<{
        id: string
        quantity: number
        totalPrice: number
        product: {
          id: string
          name: string
          packageType: 'MAIN' | 'ADDON'
        }
      }>
    } | null
    serviceOrder: {
      id: string
      status: ServiceOrderStatus
    } | null
  }>
  recentSales: Array<{
    id: string
    status: PackageSaleStatus
    totalAmount: number
    note: string | null
    createdAt: string
    items: Array<{
      id: string
      quantity: number
      totalPrice: number
      product: {
        id: string
        name: string
        packageType: 'MAIN' | 'ADDON'
      }
    }>
  }>
  recentServiceOrders: Array<{
    id: string
    status: ServiceOrderStatus
    creditUsed: number | null
    totalAmount: number | null
    createdAt: string
    memberEntitlement: {
      id: string
      product: {
        id: string
        name: string
      }
    } | null
    items: Array<{
      id: string
      quantity: number
      totalPrice: number
      isPackageIncluded: boolean
      label: string
    }>
  }>
}

const route = useRoute()
const userId = computed(() => String(route.params.id))

const { data, status, refresh, error } = await useFetch<UserDetailResponse>(
  () => `/api/admin/users/${userId.value}`,
  {
    key: () => `admin-user-detail-${userId.value}`
  }
)

const isLoading = computed(() => status.value === 'pending')
const user = computed(() => data.value?.user ?? null)
const stats = computed(() => data.value?.stats ?? null)
const entitlements = computed(() => data.value?.memberEntitlements ?? [])
const recentPayments = computed(() => data.value?.recentPayments ?? [])
const recentSales = computed(() => data.value?.recentSales ?? [])
const recentServiceOrders = computed(() => data.value?.recentServiceOrders ?? [])

const roleLabelMap: Record<Role, string> = {
  USER: 'ผู้ใช้งาน',
  EMPLOYEE: 'พนักงาน',
  ADMIN: 'แอดมิน'
}

const entitlementStatusMap: Record<EntitlementStatus, { label: string; color: BadgeColor }> = {
  ACTIVE: { label: 'ใช้งานอยู่', color: 'success' },
  PENDING: { label: 'รอเปิดใช้งาน', color: 'warning' },
  SUSPENDED: { label: 'ระงับ', color: 'neutral' },
  EXPIRED: { label: 'หมดอายุ', color: 'neutral' },
  CANCELLED: { label: 'ยกเลิก', color: 'error' }
}

const saleStatusMap: Record<PackageSaleStatus, { label: string; color: BadgeColor }> = {
  PAID: { label: 'ชำระแล้ว', color: 'success' },
  PENDING: { label: 'รอชำระ', color: 'warning' },
  DRAFT: { label: 'ฉบับร่าง', color: 'neutral' },
  CANCELLED: { label: 'ยกเลิก', color: 'error' }
}

const paymentMethodLabelMap: Record<PaymentMethod, string> = {
  CASH: 'เงินสด',
  TRANSFER: 'โอน'
}

const getAvatarProps = (target?: UserDetailResponse['user'] | null) => ({
  as: { img: 'img' },
  src: target?.image || '',
  alt: target?.name || target?.email || 'ลูกค้า',
  loading: 'lazy' as const
})

const hasMembership = computed(() => entitlements.value.some((e) => e.status === 'ACTIVE'))

const customerRows = computed<InfoRow[]>(() => {
  if (!user.value) return []

  return [
    { label: 'ชื่อ', value: user.value.name || '-' },
    { label: 'อีเมล', value: user.value.email, valueClass: 'break-all' },
    { label: 'เบอร์โทร', value: user.value.phoneNumber || '-' },
    { label: 'LINE User ID', value: user.value.lineUserId || '-', valueClass: 'break-all font-mono text-xs' },
    { label: 'สิทธิ์', value: roleLabelMap[user.value.role] },
    { label: 'สถานะอีเมล', value: user.value.emailVerified ? 'ยืนยันแล้ว' : 'รอยืนยัน' },
    { label: 'สมัครเมื่อ', value: formatDateTime(user.value.createdAt) },
    { label: 'อัปเดตล่าสุด', value: formatDateTime(user.value.updatedAt) }
  ]
})

const customerRowsLeft = computed(() => customerRows.value.slice(0, Math.ceil(customerRows.value.length / 2)))
const customerRowsRight = computed(() => customerRows.value.slice(Math.ceil(customerRows.value.length / 2)))

const statCards = computed(() => {
  if (!stats.value) return []

  const s = stats.value

  return [
    {
      title: 'แพ็กเกจที่ใช้งานอยู่',
      icon: 'i-lucide-package-check',
      value: String(s.activeEntitlementCount),
      hint: `สิทธิ์ทั้งหมด ${s.totalEntitlementCount}`
    },
    {
      title: 'เครดิตคงเหลือ',
      icon: 'i-lucide-coins',
      value: String(s.totalCreditsRemaining),
      hint: `ใช้ไป ${s.totalCreditsUsed}`
    },
    {
      title: 'ยอดชำระสะสม',
      icon: 'i-lucide-banknote',
      value: formatCurrency(s.totalSpent),
      hint: `${s.totalPayments} รายการชำระเงิน`,
      to: '/admin/payment'
    },
    {
      title: 'รายการผ้าทั้งหมด',
      icon: 'i-lucide-clipboard-list',
      value: String(s.totalServiceOrders),
      hint: `${s.totalPackageSales} รายการขายแพ็กเกจ`,
      to: '/admin/service-orders'
    }
  ]
})

const paymentSummary = (payment: UserDetailResponse['recentPayments'][number]) => {
  if (payment.packageSale?.items.length) {
    return payment.packageSale.items.map((item) => `${item.product.name} x${item.quantity}`).join(', ')
  }

  if (payment.serviceOrder) {
    const order = recentServiceOrders.value.find((o) => o.id === payment.serviceOrder?.id)
    if (order) {
      const total = order.items.reduce((sum, item) => sum + item.quantity, 0)
      return `ส่งซักทั้งหมด ${total} ชิ้น`
    }
    return 'รายการผ้า'
  }

  return '-'
}

const saleSummary = (sale: UserDetailResponse['recentSales'][number]) =>
  sale.items.map((item) => `${item.product.name} x${item.quantity}`).join(', ')

const formatOrderTotal = (amount: number | null) => (amount != null ? formatCurrency(amount) : '-')

const orderItemCount = (order: UserDetailResponse['recentServiceOrders'][number]) =>
  order.items.reduce((sum, item) => sum + item.quantity, 0)
</script>

<template>
  <UDashboardPanel id="user-detail">
    <template #header>
      <UDashboardNavbar :title="user?.name || user?.email || 'รายละเอียดลูกค้า'" icon="i-lucide-user-round">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              label="กลับหน้าลูกค้า"
              icon="i-lucide-arrow-left"
              color="neutral"
              variant="outline"
              @click="navigateTo('/admin/users')"
            />
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="outline"
              :loading="isLoading"
              @click="refresh()"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Error State -->
      <div v-if="error" class="rounded-2xl border border-error/40 bg-error/5 p-6 text-error">
        {{ error.statusMessage || 'ไม่สามารถโหลดรายละเอียดลูกค้าได้' }}
      </div>

      <!-- Loading State -->
      <div v-else-if="!user || !stats" class="flex items-center justify-center py-20 text-muted">
        กำลังโหลดข้อมูล...
      </div>

      <!-- Main Content -->
      <div v-else class="space-y-6">
        <!-- ═══════════════════════════════════════════
             SECTION 1: Profile Header
             ═══════════════════════════════════════════ -->
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex items-center gap-4">
            <UAvatar v-bind="getAvatarProps(user)" size="xl" />
            <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <h1 class="truncate text-xl font-bold text-highlighted">
                  {{ user.name || user.email || '-' }}
                </h1>
                <UBadge v-if="hasMembership" color="primary" variant="subtle">
                  <UIcon name="i-lucide-crown" class="size-3" />
                    ลูกค้ารายเดือน
                  </UBadge>
                </div>
                <p class="mt-0.5 text-sm text-muted break-all">{{ user.email }}</p>
                <div class="mt-2 flex flex-wrap items-center gap-1.5">
                  <UBadge color="neutral" variant="subtle" size="md">{{ roleLabelMap[user.role] }}</UBadge>
                  <UBadge :color="user.emailVerified ? 'success' : 'warning'" variant="subtle" size="md">
                    {{ user.emailVerified ? 'ยืนยันอีเมลแล้ว' : 'รอยืนยันอีเมล' }}
                  </UBadge>
                  <UBadge color="neutral" variant="outline" size="md" class="font-mono">
                    ID: {{ user.id }}
                  </UBadge>
                </div>
            </div>
          </div>
          <UIButtonChatLine
            :line-user-id="user.lineUserId"
            label="แชท LINE"
            size="sm"
          />
        </div>

        <!-- ═══════════════════════════════════════════
             SECTION 2: Stats Grid  (kept as-is)
             ═══════════════════════════════════════════ -->
        <UPageGrid class="grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4 lg:gap-px">
          <UPageCard
            v-for="card in statCards"
            :key="card.title"
            :icon="card.icon"
            :title="card.title"
            :to="card.to"
            variant="subtle"
            :ui="{
              container: 'gap-y-1.5',
              wrapper: 'items-start',
              leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
              title: 'font-normal text-muted text-sm'
            }"
            class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1"
          >
            <div class="flex flex-col gap-1">
              <span class="text-2xl font-semibold text-highlighted">
                {{ card.value }}
              </span>
              <p class="text-sm text-muted">
                {{ card.hint }}
              </p>
            </div>
          </UPageCard>
        </UPageGrid>

        <!-- ═══════════════════════════════════════════
             SECTION 3: ข้อมูลลูกค้า + แพ็กเกจ (2-col)
             ═══════════════════════════════════════════ -->
        <div class="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <!-- ── ข้อมูลทั่วไป ── -->
          <UCard :ui="{ root: 'rounded-2xl border border-default shadow-none', body: 'p-5' }">
            <p class="text-base font-semibold text-highlighted mb-4">ข้อมูลทั่วไป</p>
            <!-- Mobile: single column -->
            <dl class="space-y-3 md:hidden">
              <div v-for="row in customerRows" :key="row.label" class="flex items-baseline justify-between gap-4">
                <dt class="text-sm text-muted whitespace-nowrap">{{ row.label }}</dt>
                <dd class="text-right text-sm text-highlighted" :class="row.valueClass">{{ row.value }}</dd>
              </div>
            </dl>
            <!-- Desktop: 2 columns with dashed divider -->
            <div class="hidden md:grid grid-cols-[1fr_auto_1fr] gap-0">
              <dl class="space-y-3 pr-5">
                <div v-for="row in customerRowsLeft" :key="row.label" class="flex items-baseline justify-between gap-4">
                  <dt class="text-sm text-muted whitespace-nowrap">{{ row.label }}</dt>
                  <dd class="text-sm text-right text-highlighted" :class="row.valueClass">{{ row.value }}</dd>
                </div>
              </dl>
              <div class="border-l border-dashed border-default" />
              <dl class="space-y-3 pl-5">
                <div v-for="row in customerRowsRight" :key="row.label" class="flex items-baseline justify-between gap-4">
                  <dt class="text-sm text-muted whitespace-nowrap">{{ row.label }}</dt>
                  <dd class="text-sm text-right text-highlighted" :class="row.valueClass">{{ row.value }}</dd>
                </div>
              </dl>
            </div>
          </UCard>

          <!-- ── แพ็กเกจ ── -->
          <UCard :ui="{ root: 'rounded-2xl border border-default shadow-none', body: 'p-5' }">
            <div class="flex items-center justify-between gap-3 mb-4">
              <p class="text-base font-semibold text-highlighted">แพ็กเกจ</p>
              <UBadge color="neutral" variant="subtle" size="sm">
                {{ entitlements.length }} รายการ
              </UBadge>
            </div>

            <div v-if="entitlements.length" class="divide-y divide-default">
              <div
                v-for="entitlement in entitlements"
                :key="entitlement.id"
                class="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <p class="text-highlighted truncate">{{ entitlement.product.name }}</p>
                    <UBadge :color="packageTypeColors[entitlement.product.packageType]" variant="subtle" size="sm">
                      {{ packageTypeLabels[entitlement.product.packageType] }}
                    </UBadge>
                  </div>
                  <p class="mt-1 text-sm text-muted">
                    เครดิต {{ entitlement.creditRemaining ?? 0 }}/{{ entitlement.creditInitial ?? 0 }}
                    · ราคา {{ formatCurrency(entitlement.product.price) }}
                    <template v-if="entitlement.endAt"> · หมดอายุ {{ formatDateTime(entitlement.endAt) }}</template>
                  </p>
                </div>
                <UBadge :color="entitlementStatusMap[entitlement.status].color" variant="subtle" size="sm">
                  {{ entitlementStatusMap[entitlement.status].label }}
                </UBadge>
              </div>
            </div>
            <p v-else class="text-sm text-muted py-4 text-center">ยังไม่มีแพ็กเกจ</p>
          </UCard>
        </div>

        <!-- ═══════════════════════════════════════════
             SECTION 4: กิจกรรมล่าสุด (3-col)
             ═══════════════════════════════════════════ -->
        <div class="grid gap-5 lg:grid-cols-3">

          <!-- ── การซื้อแพ็กเกจ ── -->
          <UCard :ui="{ root: 'rounded-2xl border border-default shadow-none', body: 'p-5' }">
            <div class="flex items-center justify-between gap-2 mb-4">
              <div class="flex items-center gap-2">
                <p class="text-base font-semibold text-highlighted">การซื้อแพ็กเกจ</p>
                <UBadge color="neutral" variant="subtle" size="sm">{{ recentSales.length }} รายการ</UBadge>
              </div>
              <UButton label="ดูทั้งหมด" icon="i-lucide-arrow-up-right" color="neutral" variant="ghost" size="xs" @click="navigateTo('/admin/sales')" />
            </div>

            <div v-if="recentSales.length" class="divide-y divide-default">
              <div v-for="sale in recentSales" :key="sale.id" class="group cursor-pointer py-3 first:pt-0 last:pb-0 hover:bg-elevated/50 -mx-2 px-2 rounded-lg transition-colors" @click="navigateTo(`/admin/sales`)">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <p class="text-highlighted">{{ saleSummary(sale) }}</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-highlighted">{{ formatCurrency(sale.totalAmount) }}</span>
                    <UIcon name="i-lucide-arrow-up-right" class="size-4 text-muted" />
                  </div>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm text-muted text-right">{{ saleStatusMap[sale.status].label }}</span>
                  <p class="mt-1 text-sm text-muted text-right">{{ formatDateTime(sale.createdAt) }}</p>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-muted py-6 text-center">ยังไม่มีประวัติ</p>
          </UCard>

          <!-- ── งานบริการ ── -->
          <UCard :ui="{ root: 'rounded-2xl border border-default shadow-none', body: 'p-5' }">
            <div class="flex items-center justify-between gap-2 mb-4">
              <div class="flex items-center gap-2">
                <p class="text-base font-semibold text-highlighted">รายการผ้า</p>
                <UBadge color="neutral" variant="subtle" size="sm">{{ stats.totalServiceOrders }} งาน</UBadge>
              </div>
              <UButton label="ดูทั้งหมด" icon="i-lucide-arrow-up-right" color="neutral" variant="ghost" size="xs" @click="navigateTo('/admin/service-orders')" />
            </div>

            <div v-if="recentServiceOrders.length" class="divide-y divide-default">
              <div v-for="order in recentServiceOrders" :key="order.id" class="group cursor-pointer py-3 first:pt-0 last:pb-0 hover:bg-elevated/50 -mx-2 px-2 rounded-lg transition-colors" @click="navigateTo(`/admin/service-orders/${order.id}`)">
                <div class="flex items-center justify-between gap-2">
                   <p class="text-highlighted truncate">ส่งซักทั้งหมด {{ orderItemCount(order) }} ชิ้น</p>
                  <div class="flex items-center gap-2">
                    <div class="flex items-center gap-2 text-highlighted">
                      <span v-show="order.creditUsed === 0">เครดิต {{ order.creditUsed ?? 0 }} | </span>
                      <span>{{ formatOrderTotal(order.totalAmount) }}</span>
                    </div>
                    <UIcon name="i-lucide-arrow-up-right" class="size-4 text-muted" />
                  </div>
                </div>

                <div class="mt-1 flex items-center justify-between text-sm text-muted">
                  <span>{{ orderStatusLabels[order.status] }}</span>
                  <span>{{ formatDateTime(order.createdAt) }}</span>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-muted py-6 text-center">ยังไม่มีประวัติ</p>
          </UCard>

          <!-- ── การชำระเงิน ── -->
          <UCard :ui="{ root: 'rounded-2xl border border-default shadow-none', body: 'p-5' }">
            <div class="flex items-center justify-between gap-2 mb-4">
              <div class="flex items-center gap-2">
                <p class="text-base font-semibold text-highlighted">การชำระเงิน</p>
                <UBadge color="neutral" variant="subtle" size="sm">{{ recentPayments.length }} รายการ</UBadge>
              </div>
              <UButton label="ดูทั้งหมด" icon="i-lucide-arrow-up-right" color="neutral" variant="ghost" size="xs" @click="navigateTo('/admin/payment')" />
            </div>

            <div v-if="recentPayments.length" class="divide-y divide-default">
              <div v-for="payment in recentPayments" :key="payment.id" class="group cursor-pointer py-3 first:pt-0 last:pb-0 hover:bg-elevated/50 -mx-2 px-2 rounded-lg transition-colors" @click="navigateTo(`/admin/payment/${payment.id}`)">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2">
                    <p class="text-highlighted">{{ paymentSummary(payment) }}</p>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-highlighted">{{ formatCurrency(payment.amount) }}</span>
                    <UIcon name="i-lucide-arrow-up-right" class="size-4 text-muted" />
                  </div>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <span class="text-sm text-muted">{{ payment.isVerified ? "ยืนยันแล้ว" : "รอตรวจสอบ" }} · {{ paymentMethodLabelMap[payment.paymentMethod] }}</span>
                  <p class="mt-1 text-sm text-muted text-right">{{ formatDateTime(payment.createdAt) }}</p>
                </div>
              </div>
            </div>
            <p v-else class="text-sm text-muted py-6 text-center">ยังไม่มีประวัติ</p>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
