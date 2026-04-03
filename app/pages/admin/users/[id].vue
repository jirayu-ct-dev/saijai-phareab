<script setup lang="ts">
import { computed } from "vue";
import { packageTypeColors, packageTypeLabels } from "~~/shared/config/packageConfig";
import { paymentStatusLabels } from "~~/shared/config/paymentConfig";
import { formatCurrency, formatDateTime } from "~~/shared/utils/format";
import type {
  EntitlementStatus,
  PackageSaleStatus,
  PaymentMethod,
  PaymentStatus,
  Role,
  ServiceOrderStatus,
} from "~~/shared/types/enums";

definePageMeta({
  layout: "admin",
  middleware: ["role-admin"],
});

type UserDetailResponse = {
  user: {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    role: Role;
    phoneNumber: string | null;
    emailVerified: boolean;
    createdAt: string;
    updatedAt: string;
    lineUserId: string | null;
  };
  stats: {
    activeEntitlementCount: number;
    totalEntitlementCount: number;
    totalCreditsRemaining: number;
    totalCreditsUsed: number;
    totalPackageSales: number;
    totalPayments: number;
    totalServiceOrders: number;
    totalSpent: number;
  };
  memberEntitlements: Array<{
    id: string;
    status: EntitlementStatus;
    creditInitial: number | null;
    creditRemaining: number | null;
    creditUsed: number;
    startAt: string | null;
    endAt: string | null;
    activatedAt: string | null;
    suspendedAt: string | null;
    createdAt: string;
    product: {
      id: string;
      name: string;
      packageType: "MAIN" | "ADDON";
      credits: number | null;
      validityDays: number | null;
      price: number;
    };
    sourceSale: {
      id: string;
      createdAt: string;
    } | null;
  }>;
  recentPayments: Array<{
    id: string;
    amount: number;
    paymentMethod: PaymentMethod;
    status: PaymentStatus;
    note: string | null;
    createdAt: string;
    paidAt: string | null;
    packageSale: {
      id: string;
      items: Array<{
        id: string;
        quantity: number;
        totalPrice: number;
        product: {
          id: string;
          name: string;
          packageType: "MAIN" | "ADDON";
        };
      }>;
    } | null;
    serviceOrder: {
      id: string;
      status: ServiceOrderStatus;
    } | null;
  }>;
  recentSales: Array<{
    id: string;
    status: PackageSaleStatus;
    totalAmount: number;
    note: string | null;
    createdAt: string;
    items: Array<{
      id: string;
      quantity: number;
      totalPrice: number;
      product: {
        id: string;
        name: string;
        packageType: "MAIN" | "ADDON";
      };
    }>;
    payment: {
      id: string;
      amount: number;
      paymentMethod: PaymentMethod;
      status: PaymentStatus;
      createdAt: string;
    } | null;
  }>;
  recentServiceOrders: Array<{
    id: string;
    status: ServiceOrderStatus;
    creditUsed: number | null;
    totalAmount: number | null;
    note: string | null;
    createdAt: string;
    memberEntitlement: {
      id: string;
      product: {
        id: string;
        name: string;
      };
    } | null;
    items: Array<{
      id: string;
      quantity: number;
      totalPrice: number;
      isPackageIncluded: boolean;
      label: string;
    }>;
  }>;
};

const route = useRoute();
const userId = computed(() => String(route.params.id));

const { data, status, refresh, error } = await useFetch<UserDetailResponse>(
  () => `/api/admin/users/${userId.value}`,
  {
    key: () => `admin-user-detail-${userId.value}`,
  },
);

const isLoading = computed(() => status.value === "pending");
const user = computed(() => data.value?.user ?? null);
const stats = computed(() => data.value?.stats ?? null);

const roleLabelMap: Record<Role, string> = {
  USER: "ผู้ใช้",
  EMPLOYEE: "พนักงาน",
  ADMIN: "แอดมิน",
};

const entitlementStatusMap: Record<
  EntitlementStatus,
  { label: string; color: "success" | "warning" | "neutral" | "error" }
> = {
  ACTIVE: { label: "ใช้งานอยู่", color: "success" },
  PENDING: { label: "รอเปิดใช้งาน", color: "warning" },
  SUSPENDED: { label: "ระงับ", color: "neutral" },
  EXPIRED: { label: "หมดอายุ", color: "neutral" },
  CANCELLED: { label: "ยกเลิก", color: "error" },
};

const saleStatusMap: Record<
  PackageSaleStatus,
  { label: string; color: "success" | "warning" | "neutral" | "error" }
> = {
  PAID: { label: "ชำระแล้ว", color: "success" },
  PENDING: { label: "รอชำระ", color: "warning" },
  DRAFT: { label: "ฉบับร่าง", color: "neutral" },
  CANCELLED: { label: "ยกเลิก", color: "error" },
};

const orderStatusMap: Record<
  ServiceOrderStatus,
  { label: string; color: "success" | "warning" | "neutral" | "error" | "info" }
> = {
  RECEIVED: { label: "รับงานแล้ว", color: "info" },
  PENDING: { label: "รอดำเนินการ", color: "warning" },
  CHECKING: { label: "กำลังตรวจสอบ", color: "info" },
  PROCESSING: { label: "กำลังดำเนินการ", color: "warning" },
  PENDING_REVIEW: { label: "รอตรวจทาน", color: "warning" },
  COMPLETED: { label: "เสร็จสิ้น", color: "success" },
  CANCELLED: { label: "ยกเลิก", color: "error" },
};

const paymentMethodLabelMap: Record<PaymentMethod, string> = {
  CASH: "เงินสด",
  TRANSFER: "โอน",
};

const paymentStatusColorMap: Record<PaymentStatus, "success" | "warning" | "error"> = {
  PENDING: "warning",
  VERIFIED: "success",
  FAILED: "error",
};

const activeEntitlements = computed(() =>
  (data.value?.memberEntitlements ?? []).filter((entitlement) => entitlement.status === "ACTIVE"),
);

const inactiveEntitlements = computed(() =>
  (data.value?.memberEntitlements ?? []).filter((entitlement) => entitlement.status !== "ACTIVE"),
);

const summaryCards = computed(() => {
  if (!stats.value) return [];

  return [
    {
      label: "แพ็กเกจที่ใช้งาน",
      value: String(stats.value.activeEntitlementCount),
      hint: `ทั้งหมด ${stats.value.totalEntitlementCount} รายการ`,
    },
    {
      label: "เครดิตคงเหลือ",
      value: String(stats.value.totalCreditsRemaining),
      hint: `ใช้ไป ${stats.value.totalCreditsUsed}`,
    },
    {
      label: "ยอดชำระสะสม",
      value: formatCurrency(stats.value.totalSpent),
      hint: `${stats.value.totalPayments} รายการชำระเงิน`,
    },
    {
      label: "ประวัติการใช้งาน",
      value: String(stats.value.totalServiceOrders),
      hint: `${stats.value.totalPackageSales} รายการขายแพ็กเกจ`,
    },
  ];
});

const packageSaleSummary = (payment: UserDetailResponse["recentPayments"][number]) => {
  if (payment.packageSale) {
    return payment.packageSale.items.map((item) => `${item.product.name} x${item.quantity}`).join(", ");
  }

  return `งานซัก ${payment.serviceOrder?.id || ""}`.trim();
};

const saleItemSummary = (sale: UserDetailResponse["recentSales"][number]) =>
  sale.items.map((item) => `${item.product.name} x${item.quantity}`).join(", ");

const serviceOrderSummary = (order: UserDetailResponse["recentServiceOrders"][number]) =>
  order.items.map((item) => `${item.label} x${item.quantity}`).join(", ");

const formatValidity = (days: number | null) => (days ? `${days} วัน` : "ไม่กำหนดอายุ");

const formatOrderTotal = (amount: number | null) => (amount != null ? formatCurrency(amount) : "-");
</script>

<template>
  <UDashboardPanel id="user-detail">
    <template #header>
      <UDashboardNavbar :title="user?.name || user?.email || 'รายละเอียดสมาชิก'" icon="i-lucide-user-round">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>

        <template #right>
          <div class="flex items-center gap-2">
            <UButton
              label="กลับหน้าผู้ใช้"
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
              @click="() => refresh()"
            />
          </div>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="error" class="rounded-2xl border border-error/40 bg-error/5 p-6 text-error">
        {{ error.statusMessage || "ไม่สามารถโหลดรายละเอียดสมาชิกได้" }}
      </div>

      <div v-else-if="!user || !stats" class="flex items-center justify-center py-20 text-muted">
        กำลังโหลดข้อมูล...
      </div>

      <div v-else class="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section class="rounded-3xl border border-default bg-gradient-to-br from-default via-default to-elevated/30 p-6 shadow-sm lg:p-8">
          <div class="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div class="flex items-start gap-4">
              <UAvatar :src="user.image || undefined" :alt="user.name || user.email" size="3xl" />

              <div class="min-w-0 space-y-3">
                <div class="flex flex-wrap items-center gap-2">
                  <h2 class="text-2xl font-semibold text-highlighted">
                    {{ user.name || "ไม่ระบุชื่อ" }}
                  </h2>
                  <UBadge color="neutral" variant="subtle">
                    {{ roleLabelMap[user.role] }}
                  </UBadge>
                  <UBadge :color="user.emailVerified ? 'success' : 'warning'" variant="subtle">
                    {{ user.emailVerified ? "ยืนยันอีเมลแล้ว" : "รอยืนยันอีเมล" }}
                  </UBadge>
                </div>

                <p class="text-sm text-muted break-all">
                  {{ user.email }}
                </p>

                <div class="flex flex-wrap gap-2 text-sm text-muted">
                  <span class="rounded-full border border-default px-3 py-1">
                    โทร {{ user.phoneNumber || "-" }}
                  </span>
                  <span class="rounded-full border border-default px-3 py-1">
                    LINE {{ user.lineUserId || "-" }}
                  </span>
                  <span class="rounded-full border border-default px-3 py-1">
                    สมัครเมื่อ {{ formatDateTime(user.createdAt) }}
                  </span>
                </div>
              </div>
            </div>

            <div class="grid w-full gap-3 sm:grid-cols-2 xl:w-[34rem]">
              <div
                v-for="card in summaryCards"
                :key="card.label"
                class="rounded-2xl border border-default bg-default/80 p-4"
              >
                <p class="text-sm text-muted">{{ card.label }}</p>
                <p class="mt-2 text-2xl font-semibold text-highlighted">{{ card.value }}</p>
                <p class="mt-1 text-xs text-muted">{{ card.hint }}</p>
              </div>
            </div>
          </div>
        </section>

        <section class="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div class="rounded-3xl border border-default bg-default p-6 shadow-sm">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold text-highlighted">แพ็กเกจที่ใช้งานอยู่</h3>
                <p class="text-sm text-muted">ดูเครดิตคงเหลือ สถานะ และวันหมดอายุของสมาชิก</p>
              </div>
              <UBadge color="success" variant="subtle">
                {{ activeEntitlements.length }} ใช้งานอยู่
              </UBadge>
            </div>

            <div v-if="activeEntitlements.length" class="mt-5 space-y-3">
              <div
                v-for="entitlement in activeEntitlements"
                :key="entitlement.id"
                class="rounded-2xl border border-default bg-elevated/15 p-4"
              >
                <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <p class="font-semibold text-highlighted">{{ entitlement.product.name }}</p>
                      <UBadge :color="packageTypeColors[entitlement.product.packageType]" variant="subtle">
                        {{ packageTypeLabels[entitlement.product.packageType] }}
                      </UBadge>
                      <UBadge :color="entitlementStatusMap[entitlement.status].color" variant="subtle">
                        {{ entitlementStatusMap[entitlement.status].label }}
                      </UBadge>
                    </div>
                    <p class="mt-1 text-sm text-muted">
                      ราคา {{ formatCurrency(entitlement.product.price) }} • อายุ {{ formatValidity(entitlement.product.validityDays) }}
                    </p>
                  </div>

                  <div class="grid grid-cols-2 gap-2 text-sm sm:min-w-[18rem]">
                    <div class="rounded-xl border border-default bg-default p-3">
                      <p class="text-xs text-muted">เครดิตเริ่มต้น</p>
                      <p class="mt-1 font-medium text-highlighted">{{ entitlement.creditInitial ?? 0 }}</p>
                    </div>
                    <div class="rounded-xl border border-default bg-default p-3">
                      <p class="text-xs text-muted">เครดิตคงเหลือ</p>
                      <p class="mt-1 font-medium text-highlighted">{{ entitlement.creditRemaining ?? 0 }}</p>
                    </div>
                    <div class="rounded-xl border border-default bg-default p-3">
                      <p class="text-xs text-muted">ใช้ไป</p>
                      <p class="mt-1 font-medium text-highlighted">{{ entitlement.creditUsed }}</p>
                    </div>
                    <div class="rounded-xl border border-default bg-default p-3">
                      <p class="text-xs text-muted">หมดอายุ</p>
                      <p class="mt-1 font-medium text-highlighted">
                        {{ entitlement.endAt ? formatDateTime(entitlement.endAt) : "-" }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div v-else class="mt-5 rounded-2xl border border-dashed border-default p-8 text-center text-muted">
              ยังไม่มีแพ็กเกจที่ใช้งานอยู่
            </div>
          </div>

          <div class="rounded-3xl border border-default bg-default p-6 shadow-sm">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold text-highlighted">ภาพรวมสมาชิก</h3>
                <p class="text-sm text-muted">ข้อมูลติดต่อและสิทธิ์ที่ไม่ได้ใช้งานแล้ว</p>
              </div>
              <UBadge color="neutral" variant="subtle">
                ทั้งหมด {{ data?.memberEntitlements.length || 0 }} สิทธิ์
              </UBadge>
            </div>

            <div class="mt-5 grid gap-3">
              <div class="rounded-2xl border border-default bg-elevated/15 p-4">
                <p class="text-xs text-muted">อีเมล</p>
                <p class="mt-1 break-all font-medium text-highlighted">{{ user.email }}</p>
              </div>
              <div class="rounded-2xl border border-default bg-elevated/15 p-4">
                <p class="text-xs text-muted">เบอร์โทร</p>
                <p class="mt-1 font-medium text-highlighted">{{ user.phoneNumber || "-" }}</p>
              </div>
              <div class="rounded-2xl border border-default bg-elevated/15 p-4">
                <p class="text-xs text-muted">LINE User ID</p>
                <p class="mt-1 break-all font-medium text-highlighted">{{ user.lineUserId || "-" }}</p>
              </div>
            </div>

            <div v-if="inactiveEntitlements.length" class="mt-6">
              <div class="mb-3 flex items-center justify-between gap-2">
                <h4 class="font-medium text-highlighted">สิทธิ์อื่น ๆ</h4>
                <span class="text-xs text-muted">{{ inactiveEntitlements.length }} รายการ</span>
              </div>
              <div class="space-y-2">
                <div
                  v-for="entitlement in inactiveEntitlements"
                  :key="entitlement.id"
                  class="flex items-start justify-between gap-3 rounded-2xl border border-default bg-default p-4"
                >
                  <div class="min-w-0">
                    <p class="truncate font-medium text-highlighted">{{ entitlement.product.name }}</p>
                    <p class="mt-1 text-sm text-muted">
                      คงเหลือ {{ entitlement.creditRemaining ?? 0 }} • หมดอายุ {{ entitlement.endAt ? formatDateTime(entitlement.endAt) : "-" }}
                    </p>
                  </div>
                  <UBadge :color="entitlementStatusMap[entitlement.status].color" variant="subtle">
                    {{ entitlementStatusMap[entitlement.status].label }}
                  </UBadge>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-3xl border border-default bg-default p-6 shadow-sm">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-lg font-semibold text-highlighted">ประวัติการชำระเงิน</h3>
              <p class="text-sm text-muted">รายการรับชำระล่าสุดของลูกค้ารายนี้</p>
            </div>
            <UButton
              label="ไปหน้าการชำระเงิน"
              icon="i-lucide-arrow-right"
              color="neutral"
              variant="ghost"
              @click="navigateTo('/admin/payment')"
            />
          </div>

          <div v-if="data?.recentPayments.length" class="mt-5 divide-y divide-default">
            <div
              v-for="payment in data.recentPayments"
              :key="payment.id"
              class="flex flex-col gap-3 py-4 lg:flex-row lg:items-start lg:justify-between"
            >
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="font-medium text-highlighted">{{ formatCurrency(payment.amount) }}</p>
                  <UBadge :color="paymentStatusColorMap[payment.status]" variant="subtle">
                    {{ paymentStatusLabels[payment.status] }}
                  </UBadge>
                  <span class="text-sm text-muted">{{ paymentMethodLabelMap[payment.paymentMethod] }}</span>
                </div>
                <p class="mt-1 text-sm text-muted">{{ packageSaleSummary(payment) }}</p>
                <p class="mt-1 text-xs text-muted">{{ formatDateTime(payment.createdAt) }}</p>
              </div>
            </div>
          </div>

          <div v-else class="mt-5 rounded-2xl border border-dashed border-default p-8 text-center text-muted">
            ยังไม่มีประวัติการชำระเงิน
          </div>
        </section>

        <section class="grid gap-6 xl:grid-cols-2">
          <div class="rounded-3xl border border-default bg-default p-6 shadow-sm">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold text-highlighted">ประวัติการซื้อแพ็กเกจ</h3>
                <p class="text-sm text-muted">รายการขายแพ็กเกจล่าสุดของลูกค้ารายนี้</p>
              </div>
              <UButton
                label="ไปหน้าคิดเงิน"
                icon="i-lucide-arrow-right"
                color="neutral"
                variant="ghost"
                @click="navigateTo('/admin/sales')"
              />
            </div>

            <div v-if="data?.recentSales.length" class="mt-5 divide-y divide-default">
              <div
                v-for="sale in data.recentSales"
                :key="sale.id"
                class="flex flex-col gap-3 py-4"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p class="font-medium text-highlighted">{{ formatCurrency(sale.totalAmount) }}</p>
                    <p class="text-xs text-muted">{{ formatDateTime(sale.createdAt) }}</p>
                  </div>
                  <UBadge :color="saleStatusMap[sale.status].color" variant="subtle">
                    {{ saleStatusMap[sale.status].label }}
                  </UBadge>
                </div>
                <p class="text-sm text-muted">{{ saleItemSummary(sale) }}</p>
              </div>
            </div>

            <div v-else class="mt-5 rounded-2xl border border-dashed border-default p-8 text-center text-muted">
              ยังไม่มีประวัติการซื้อแพ็กเกจ
            </div>
          </div>

          <div class="rounded-3xl border border-default bg-default p-6 shadow-sm">
            <div class="flex items-center justify-between gap-3">
              <div>
                <h3 class="text-lg font-semibold text-highlighted">ประวัติการใช้งาน</h3>
                <p class="text-sm text-muted">การใช้เครดิตหรือแพ็กเกจกับงานบริการล่าสุด</p>
              </div>
              <UBadge color="neutral" variant="subtle">
                {{ stats.totalServiceOrders }} งาน
              </UBadge>
            </div>

            <div v-if="data?.recentServiceOrders.length" class="mt-5 divide-y divide-default">
              <div
                v-for="order in data.recentServiceOrders"
                :key="order.id"
                class="flex flex-col gap-3 py-4"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p class="font-medium text-highlighted">
                      {{ order.memberEntitlement?.product.name || "งานทั่วไป" }}
                    </p>
                    <p class="text-xs text-muted">{{ formatDateTime(order.createdAt) }}</p>
                  </div>
                  <UBadge :color="orderStatusMap[order.status].color" variant="subtle">
                    {{ orderStatusMap[order.status].label }}
                  </UBadge>
                </div>
                <p class="text-sm text-muted">{{ serviceOrderSummary(order) }}</p>
                <p class="text-xs text-muted">
                  ใช้เครดิต {{ order.creditUsed ?? 0 }} • ยอดรวม {{ formatOrderTotal(order.totalAmount) }}
                </p>
              </div>
            </div>

            <div v-else class="mt-5 rounded-2xl border border-dashed border-default p-8 text-center text-muted">
              ยังไม่มีประวัติการใช้งานแพ็กเกจ
            </div>
          </div>
        </section>
      </div>
    </template>
  </UDashboardPanel>
</template>
