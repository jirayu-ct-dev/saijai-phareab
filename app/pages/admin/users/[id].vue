<script setup lang="ts">
import { packageTypeColors, packageTypeLabels } from '~~/shared/config/packageConfig'
import { orderStatusLabels } from '~~/shared/config/orderConfig'
import { formatCurrency, formatDateTime } from '~~/shared/utils/format'
import * as adminUi from '~~/shared/config/adminUi'

const adminDashboardBodyClass =
  adminUi.adminDashboardBodyClass
  ?? 'admin-dashboard flex flex-col gap-4 p-2 sm:gap-6 sm:p-6'
import type {
  EntitlementStatus,
  PackageSaleStatus,
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
    mainCreditsRemaining: number
    mainCreditsInitial: number
    addonCreditsRemaining: number
    addonCreditsInitial: number
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

const { data, pending, status, refresh, error } = await useFetch<UserDetailResponse>(
  () => `/api/admin/users/${userId.value}`,
  {
    key: () => `admin-user-detail-${userId.value}`,
    server: false,
    lazy: true,
  }
)

const hydrated = ref(false)
onMounted(() => { hydrated.value = true })
const isLoading = computed(() => pending.value || status.value === 'idle')
const showSkeleton = computed(() => !hydrated.value || isLoading.value)
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
  const cards = [
    s.totalEntitlementCount > 0 && {
      title: 'แพ็กเกจที่ใช้งานอยู่',
      icon: 'i-lucide-package-check',
      value: String(s.activeEntitlementCount),
      hint: `สิทธิ์ทั้งหมด ${s.totalEntitlementCount}`
    },
    s.mainCreditsInitial > 0 && {
      title: 'เครดิตหลัก',
      icon: 'i-lucide-coins',
      value: `${s.mainCreditsRemaining}/${s.mainCreditsInitial}`,
      hint: `ใช้ไป ${s.mainCreditsInitial - s.mainCreditsRemaining}`
    },
    s.addonCreditsInitial > 0 && {
      title: 'เครดิตเสริม',
      icon: 'i-lucide-sparkles',
      value: `${s.addonCreditsRemaining}/${s.addonCreditsInitial}`,
      hint: `ใช้ไป ${s.addonCreditsInitial - s.addonCreditsRemaining}`
    },
    s.totalPayments > 0 && {
      title: 'ยอดชำระสะสม',
      icon: 'i-lucide-banknote',
      value: formatCurrency(s.totalSpent),
      hint: `${s.totalPayments} รายการชำระเงิน`,
      to: '/admin/payment'
    },
    s.totalServiceOrders > 0 && {
      title: 'รายการผ้าทั้งหมด',
      icon: 'i-lucide-clipboard-list',
      value: String(s.totalServiceOrders),
      hint: `${s.totalPackageSales} รายการขายแพ็กเกจ`,
      to: '/admin/service-orders'
    }
  ]
  return cards.filter(Boolean) as Array<{ title: string; icon: string; value: string; hint: string; to?: string }>
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
              class="shrink-0"
              aria-label="กลับหน้าลูกค้า"
              :ui="{ label: 'hidden sm:inline' }"
              @click="navigateTo('/admin/users')"
            />
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="outline"
              :loading="isLoading"
              class="shrink-0"
              aria-label="รีเฟรชข้อมูล"
              :ui="{ label: 'hidden sm:inline' }"
              @click="refresh()"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <!-- Loading Skeleton -->
      <div v-if="showSkeleton" :class="adminDashboardBodyClass">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex items-center gap-3">
            <USkeleton class="size-16 rounded-full" />
            <div class="space-y-2">
              <USkeleton class="h-5 w-48 rounded" />
              <USkeleton class="h-3 w-40 rounded" />
            </div>
          </div>
          <div class="flex gap-2">
            <USkeleton class="h-9 w-24 rounded-md" />
            <USkeleton class="h-9 w-24 rounded-md" />
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <USkeleton v-for="i in 4" :key="`u-stat-${i}`" class="h-20 w-full rounded-md" />
        </div>

        <div class="grid gap-4 sm:gap-6 lg:grid-cols-2">
          <div v-for="i in 4" :key="`u-card-${i}`" class="rounded-md border border-default bg-default p-5 space-y-3">
            <USkeleton class="h-5 w-40 rounded" />
            <div class="space-y-2">
              <USkeleton v-for="j in 3" :key="`u-card-${i}-${j}`" class="h-10 w-full rounded-md" />
            </div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" :class="adminDashboardBodyClass">
        <div class="rounded-md border border-error/40 bg-error/5 p-6 text-error">
          {{ error.statusMessage || 'ไม่สามารถโหลดรายละเอียดลูกค้าได้' }}
        </div>
      </div>

      <!-- Not Found -->
      <div v-else-if="!user || !stats" :class="adminDashboardBodyClass">
        <div class="rounded-md border border-default bg-default p-6">
          <p class="text-base font-semibold text-highlighted">ไม่พบข้อมูลลูกค้า</p>
          <p class="mt-2 text-sm text-muted">ลูกค้านี้อาจถูกลบหรือคุณไม่มีสิทธิ์เข้าถึง</p>
        </div>
      </div>

      <!-- Main Content -->
      <div v-else :class="adminDashboardBodyClass">

        <!-- SECTION 1: Profile Header -->
        <UCard :ui="{ body: 'p-4! sm:p-5!' }">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="flex items-start gap-4">
              <UAvatar v-bind="getAvatarProps(user)" size="xl" class="shrink-0 ring-2 ring-primary/15" />
              <div class="min-w-0 space-y-1.5">
                <div class="flex flex-wrap items-center gap-2">
                  <h1 class="truncate text-xl font-bold text-highlighted sm:text-2xl">
                    {{ user.name || user.email || '-' }}
                  </h1>
                  <UBadge v-if="hasMembership" color="primary" variant="subtle" size="sm" :ui="{ base: 'rounded-md!' }">
                    <UIcon name="i-lucide-crown" class="size-3 mr-1" />ลูกค้ารายเดือน
                  </UBadge>
                </div>
                <p class="text-xs text-muted break-all sm:text-sm flex items-center gap-1.5">
                  <UIcon name="i-lucide-mail" class="size-3.5 shrink-0" />
                  {{ user.email }}
                </p>
                <p v-if="user.phoneNumber" class="text-xs text-muted sm:text-sm flex items-center gap-1.5">
                  <UIcon name="i-lucide-phone" class="size-3.5 shrink-0" />
                  {{ user.phoneNumber }}
                </p>
                <div class="flex flex-wrap items-center gap-1.5 pt-1">
                  <UBadge color="neutral" variant="subtle" size="sm" :ui="{ base: 'rounded-md!' }">{{ roleLabelMap[user.role] }}</UBadge>
                  <UBadge :color="user.emailVerified ? 'success' : 'warning'" variant="subtle" size="sm" :ui="{ base: 'rounded-md!' }">
                    <UIcon :name="user.emailVerified ? 'i-lucide-check-circle' : 'i-lucide-clock'" class="size-3 mr-1" />
                    {{ user.emailVerified ? 'ยืนยันอีเมลแล้ว' : 'รอยืนยันอีเมล' }}
                  </UBadge>
                  <UBadge v-if="user.lineUserId" color="success" variant="subtle" size="sm" icon="i-simple-icons-line" :ui="{ base: 'rounded-md!' }">LINE</UBadge>
                </div>
              </div>
            </div>
            <UIButtonChatLine :line-user-id="user.lineUserId" label="แชท LINE" size="sm" class="self-start shrink-0" />
          </div>
        </UCard>

        <!-- SECTION 2: Stats Grid -->
        <div v-if="statCards.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <UCard
            v-for="card in statCards"
            :key="card.title"
            :to="card.to"
            :ui="{ body: 'p-3 sm:p-4' }"
            :class="['transition', card.to ? 'hover:ring-1 hover:ring-primary/40 cursor-pointer' : '']"
          >
            <div class="flex items-start gap-2.5">
              <div class="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <UIcon :name="card.icon" class="size-4.5" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs text-muted truncate">{{ card.title }}</p>
                <p class="mt-0.5 text-lg font-bold text-highlighted truncate leading-tight">{{ card.value }}</p>
                <p class="text-[10px] text-muted truncate">{{ card.hint }}</p>
              </div>
            </div>
          </UCard>
        </div>

        <!-- SECTION 3: ข้อมูลทั่วไป + แพ็กเกจ -->
        <div class="grid gap-4 lg:grid-cols-2">
          <!-- ข้อมูลทั่วไป -->
          <UCard :ui="{ body: 'p-4! sm:p-5!' }">
            <p class="text-sm font-semibold text-highlighted mb-3">ข้อมูลทั่วไป</p>
            <dl class="space-y-2.5">
              <div v-for="row in customerRows" :key="row.label" class="flex items-baseline justify-between gap-3">
                <dt class="text-xs text-muted whitespace-nowrap shrink-0">{{ row.label }}</dt>
                <dd class="text-right text-xs text-highlighted" :class="row.valueClass">{{ row.value }}</dd>
              </div>
            </dl>
          </UCard>

          <!-- แพ็กเกจ -->
          <UCard id="packages" :ui="{ body: 'p-4! sm:p-5!' }">
            <div class="flex items-center justify-between gap-2 mb-3">
              <p class="text-sm font-semibold text-highlighted">แพ็กเกจ</p>
              <UBadge color="neutral" variant="subtle" size="sm">{{ entitlements.length }} รายการ</UBadge>
            </div>

            <div v-if="entitlements.length" class="divide-y divide-default">
              <div
                v-for="entitlement in entitlements"
                :key="entitlement.id"
                class="flex items-start gap-2 py-2.5 first:pt-0 last:pb-0"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1">
                    <p class="text-sm text-highlighted truncate">{{ entitlement.product.name }}</p>
                    <UBadge :color="packageTypeColors[entitlement.product.packageType]" variant="subtle" size="xs" :ui="{ base: 'rounded-md!' }">
                      {{ packageTypeLabels[entitlement.product.packageType] }}
                    </UBadge>
                  </div>
                  <p class="mt-0.5 text-xs text-muted">
                    เครดิต {{ entitlement.creditRemaining ?? 0 }}/{{ entitlement.creditInitial ?? 0 }}
                    · ฿{{ formatCurrency(entitlement.product.price) }}
                    <template v-if="entitlement.endAt"> · หมด {{ formatDateTime(entitlement.endAt) }}</template>
                  </p>
                </div>
                <UBadge :color="entitlementStatusMap[entitlement.status].color" variant="subtle" size="xs" class="shrink-0" :ui="{ base: 'rounded-md!' }">
                  {{ entitlementStatusMap[entitlement.status].label }}
                </UBadge>
              </div>
            </div>
            <p v-else class="text-sm text-muted py-4 text-center">ยังไม่มีแพ็กเกจ</p>
          </UCard>
        </div>

        <!-- SECTION 4: กิจกรรมล่าสุด -->
        <div class="grid gap-4 lg:grid-cols-3">

          <!-- การซื้อแพ็กเกจ -->
          <UCard :ui="{ body: 'p-4! sm:p-5!' }">
            <div class="flex items-center justify-between gap-2 mb-3">
              <div class="flex items-center gap-1.5">
                <p class="text-sm font-semibold text-highlighted">การซื้อแพ็กเกจ</p>
                <UBadge color="neutral" variant="subtle" size="xs">{{ recentSales.length }}</UBadge>
              </div>
              <UButton icon="i-lucide-arrow-up-right" color="neutral" variant="ghost" size="xs" @click="navigateTo('/admin/sales')" />
            </div>
            <div v-if="recentSales.length" class="divide-y divide-default">
              <div v-for="sale in recentSales" :key="sale.id" class="py-2.5 first:pt-0 last:pb-0 cursor-pointer hover:bg-elevated/50 -mx-2 px-2 rounded-md transition-colors" @click="navigateTo('/admin/sales')">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs text-highlighted truncate">{{ saleSummary(sale) }}</p>
                  <span class="text-xs font-semibold text-highlighted shrink-0">{{ formatCurrency(sale.totalAmount) }}</span>
                </div>
                <div class="flex items-center justify-between gap-2 mt-0.5">
                  <span class="text-xs text-muted">{{ saleStatusMap[sale.status].label }}</span>
                  <span class="text-xs text-muted">{{ formatDateTime(sale.createdAt) }}</span>
                </div>
              </div>
            </div>
            <p v-else class="text-xs text-muted py-4 text-center">ยังไม่มีประวัติ</p>
          </UCard>

          <!-- รายการผ้า -->
          <UCard :ui="{ body: 'p-4! sm:p-5!' }">
            <div class="flex items-center justify-between gap-2 mb-3">
              <div class="flex items-center gap-1.5">
                <p class="text-sm font-semibold text-highlighted">รายการผ้า</p>
                <UBadge color="neutral" variant="subtle" size="xs">{{ stats.totalServiceOrders }}</UBadge>
              </div>
              <UButton icon="i-lucide-arrow-up-right" color="neutral" variant="ghost" size="xs" @click="navigateTo('/admin/service-orders')" />
            </div>
            <div v-if="recentServiceOrders.length" class="divide-y divide-default">
              <div v-for="order in recentServiceOrders" :key="order.id" class="py-2.5 first:pt-0 last:pb-0 cursor-pointer hover:bg-elevated/50 -mx-2 px-2 rounded-md transition-colors" @click="navigateTo(`/admin/service-orders/${order.id}`)">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs text-highlighted truncate">{{ orderItemCount(order) }} ชิ้น</p>
                  <span class="text-xs font-semibold text-highlighted shrink-0">{{ formatOrderTotal(order.totalAmount) }}</span>
                </div>
                <div class="flex items-center justify-between gap-2 mt-0.5">
                  <span class="text-xs text-muted">{{ orderStatusLabels[order.status] }}</span>
                  <span class="text-xs text-muted">{{ formatDateTime(order.createdAt) }}</span>
                </div>
              </div>
            </div>
            <p v-else class="text-xs text-muted py-4 text-center">ยังไม่มีประวัติ</p>
          </UCard>

          <!-- การชำระเงิน -->
          <UCard :ui="{ body: 'p-4! sm:p-5!' }">
            <div class="flex items-center justify-between gap-2 mb-3">
              <div class="flex items-center gap-1.5">
                <p class="text-sm font-semibold text-highlighted">การชำระเงิน</p>
                <UBadge color="neutral" variant="subtle" size="xs">{{ recentPayments.length }}</UBadge>
              </div>
              <UButton icon="i-lucide-arrow-up-right" color="neutral" variant="ghost" size="xs" @click="navigateTo('/admin/payment')" />
            </div>
            <div v-if="recentPayments.length" class="divide-y divide-default">
              <div v-for="payment in recentPayments" :key="payment.id" class="py-2.5 first:pt-0 last:pb-0 cursor-pointer hover:bg-elevated/50 -mx-2 px-2 rounded-md transition-colors" @click="navigateTo(`/admin/payment/${payment.id}`)">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-xs text-highlighted truncate">{{ paymentSummary(payment) }}</p>
                  <span class="text-xs font-semibold text-highlighted shrink-0">{{ formatCurrency(payment.amount) }}</span>
                </div>
                <div class="flex items-center justify-between gap-2 mt-0.5">
                  <span class="text-xs text-muted">{{ payment.paidAt ? 'ชำระแล้ว' : 'รอดำเนินการ' }}</span>
                  <span class="text-xs text-muted">{{ formatDateTime(payment.createdAt) }}</span>
                </div>
              </div>
            </div>
            <p v-else class="text-xs text-muted py-4 text-center">ยังไม่มีประวัติ</p>
          </UCard>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
