<script setup lang="ts">
import { orderStatusLabels, orderStatusColors } from "~~/shared/config/orderConfig";
import type { ServiceOrderStatus } from "~~/shared/types/enums";

definePageMeta({
  middleware: ["role-employee"],
  layout: "admin",
});

interface EmployeeStats {
  receivedToday: number;
  inProgress: number;
  readyToDeliver: number;
  completedToday: number;
}

interface PendingOrder {
  id: string;
  orderNo: string | null;
  status: ServiceOrderStatus;
  createdAt: string | Date;
  dueAt: string | Date | null;
  customer: {
    id: string | null;
    name: string;
    phoneNumber: string | null;
    image: string | null;
    lineUserId: string | null;
  };
}

const { data: stats, status: statsStatus, refresh: refreshStats } = useAsyncData<EmployeeStats>(
  "employee-stats",
  () => $fetch("/api/admin/dashboard/employee-stats"),
  { server: false }
);
const { data: orders, status: ordersStatus, refresh: refreshOrders } = useAsyncData<PendingOrder[]>(
  "employee-pending-orders",
  () => $fetch("/api/admin/dashboard/pending-orders"),
  { server: false, default: () => [] }
);

const isStatsPending = computed(() => statsStatus.value === "pending");
const isOrdersPending = computed(() => ordersStatus.value === "pending");

const getAvatarProps = (customer?: PendingOrder["customer"] | null) => ({
  as: { img: "img" },
  src: customer?.image || "",
  alt: customer?.name || "ลูกค้า",
  loading: "lazy" as const,
});

function refresh() {
  refreshStats();
  refreshOrders();
}

const statCards = computed(() => [
  { title: "รับผ้าวันนี้", icon: "i-lucide-shopping-basket", to: "/admin/service-orders", value: stats.value?.receivedToday ?? 0 },
  { title: "รอดำเนินการ", icon: "i-lucide-loader-circle", to: "/admin/service-orders", value: stats.value?.inProgress ?? 0 },
  { title: "พร้อมส่งคืน", icon: "i-lucide-package-check", to: "/admin/service-orders", value: stats.value?.readyToDeliver ?? 0 },
  { title: "ส่งคืนวันนี้", icon: "i-lucide-check-circle", to: "/admin/service-orders", value: stats.value?.completedToday ?? 0 },
]);

const cardUi = {
  container: "gap-y-1.5",
  wrapper: "items-start",
  leading: "p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col",
  title: "font-normal text-muted text-xs truncate",
};

const columns = [
  { accessorKey: "orderNo", header: "เลขที่" },
  { accessorKey: "customer", header: "ลูกค้า" },
  { accessorKey: "status", header: "สถานะ" },
  { accessorKey: "dueAt", header: "นัดรับ" },
  { id: "actions", header: "" },
];

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  const local = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return `${local.getUTCDate()}/${local.getUTCMonth() + 1}/${local.getUTCFullYear() + 543}`;
}

function openLineChat(lineUserId: string) {
  window.open(`https://line.me/R/oaMessage/${lineUserId}`, "_blank");
}
</script>

<template>
  <UDashboardPanel id="employee-dashboard">
    <template #header>
      <UDashboardNavbar title="ภาพรวมงานวันนี้">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UIButtonRefresh @click="refresh" />
          <UButton icon="i-lucide-plus" size="md" class="rounded-full" to="/admin/service-orders/new" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 p-4 sm:gap-6 sm:p-6">

        <!-- Stats -->
        <ClientOnly>
          <UPageGrid class="grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-px">
            <template v-if="isStatsPending">
              <UPageCard
                v-for="i in 4"
                :key="`sk-${i}`"
                variant="subtle"
                :ui="cardUi"
                class="min-w-0 lg:rounded-none first:rounded-l-lg last:rounded-r-lg"
              >
                <template #leading>
                  <div class="p-2.5 rounded-full bg-elevated animate-pulse size-10" />
                </template>
                <template #title>
                  <div class="h-3 w-16 rounded bg-elevated animate-pulse" />
                </template>
                <div class="h-7 w-full max-w-28 rounded bg-elevated animate-pulse mt-1" />
              </UPageCard>
            </template>
            <template v-else>
              <UPageCard
                v-for="card in statCards"
                :key="card.title"
                :icon="card.icon"
                :title="card.title"
                :to="card.to"
                variant="subtle"
                :ui="cardUi"
                class="min-w-0 lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1"
              >
                <span class="break-words text-lg font-semibold leading-tight text-highlighted sm:text-2xl">{{ card.value }}</span>
              </UPageCard>
            </template>
          </UPageGrid>

          <template #fallback>
            <UPageGrid class="grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-px">
              <UPageCard
                v-for="i in 4"
                :key="`fb-${i}`"
                variant="subtle"
                :ui="cardUi"
                class="min-w-0 lg:rounded-none first:rounded-l-lg last:rounded-r-lg"
              >
                <template #leading>
                  <div class="p-2.5 rounded-full bg-elevated animate-pulse size-10" />
                </template>
                <template #title>
                  <div class="h-3 w-16 rounded bg-elevated animate-pulse" />
                </template>
                <div class="h-7 w-full max-w-28 rounded bg-elevated animate-pulse mt-1" />
              </UPageCard>
            </UPageGrid>
          </template>
        </ClientOnly>

        <!-- Shortcuts -->
        <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
          <UButton icon="i-lucide-shopping-basket" to="/admin/service-orders/new" color="primary" class="justify-center sm:justify-start">
            รับผ้าใหม่
          </UButton>
          <UButton icon="i-lucide-scan-line" to="/admin/service-orders/scan" color="neutral" variant="outline" class="justify-center sm:justify-start">
            สแกนสถานะ
          </UButton>
        </div>

        <!-- Pending Orders -->
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <p class="font-semibold">รายการรอดำเนินการ</p>
              <UBadge :label="String(orders?.length ?? 0)" color="neutral" variant="subtle" />
            </div>
          </template>

          <ClientOnly>
            <div class="md:hidden">
              <div v-if="isOrdersPending" class="space-y-3">
                <USkeleton v-for="i in 5" :key="i" class="h-32 w-full rounded-xl" />
              </div>

              <div v-else-if="!orders?.length" class="flex flex-col items-center justify-center py-8 text-muted">
                <UIcon name="i-lucide-shopping-basket" class="mb-3 size-10 opacity-50" />
                <p>ไม่มีรายการรอดำเนินการ</p>
              </div>

              <div v-else class="space-y-3">
                <div
                  v-for="order in orders"
                  :key="order.id"
                  class="rounded-xl border border-default bg-default p-3"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="truncate font-mono text-xs text-muted">{{ order.orderNo || order.id }}</p>
                      <div class="mt-1 flex min-w-0 items-center gap-2">
                        <UAvatar v-bind="getAvatarProps(order.customer)" size="sm" class="shrink-0" />
                        <span class="min-w-0">
                          <span class="block truncate text-sm font-medium text-highlighted">{{ order.customer.name }}</span>
                          <span class="block truncate text-xs text-muted">{{ order.customer.phoneNumber || 'ไม่ระบุเบอร์' }}</span>
                        </span>
                      </div>
                    </div>

                    <UBadge
                      :label="orderStatusLabels[order.status]"
                      :color="orderStatusColors[order.status]"
                      variant="subtle"
                      class="shrink-0"
                    />
                  </div>

                  <div class="mt-3 grid grid-cols-2 gap-2 border-t border-default pt-3 text-xs">
                    <div>
                      <p class="text-muted">นัดรับ</p>
                      <p class="mt-1 text-highlighted">{{ formatDate(order.dueAt ? String(order.dueAt) : null) }}</p>
                    </div>
                    <div>
                      <p class="text-muted">เลขที่</p>
                      <p class="mt-1 truncate font-mono text-highlighted">{{ order.orderNo || order.id }}</p>
                    </div>
                  </div>

                  <div class="mt-3 flex items-center justify-end gap-1 border-t border-default pt-3">
                    <UButton
                      v-if="order.customer.lineUserId"
                      icon="i-lucide-message-circle"
                      size="xs"
                      color="success"
                      variant="subtle"
                      aria-label="แชท"
                      @click="openLineChat(order.customer.lineUserId)"
                    />
                    <UButton
                      icon="i-lucide-eye"
                      size="xs"
                      color="neutral"
                      variant="ghost"
                      aria-label="ดูรายการรับผ้า"
                      :to="`/admin/service-orders/${order.id}`"
                    />
                  </div>
                </div>
              </div>
            </div>

            <UTable :data="orders ?? []" :columns="columns" class="hidden md:block">
              <template #customer-cell="{ row }">
                <div class="flex items-center gap-2">
                  <UAvatar v-bind="getAvatarProps(row.original.customer)" size="xs" />
                  <div>
                    <p class="text-sm font-medium">{{ row.original.customer.name }}</p>
                    <p v-if="row.original.customer.phoneNumber" class="text-xs text-muted">
                      {{ row.original.customer.phoneNumber }}
                    </p>
                  </div>
                </div>
              </template>

              <template #status-cell="{ row }">
                <UBadge
                  :label="orderStatusLabels[row.original.status as ServiceOrderStatus]"
                  :color="orderStatusColors[row.original.status as ServiceOrderStatus] as any"
                  variant="subtle"
                />
              </template>

              <template #dueAt-cell="{ row }">
                {{ formatDate(row.original.dueAt) }}
              </template>

              <template #actions-cell="{ row }">
                <div class="flex items-center gap-2 justify-end">
                  <UButton
                    v-if="row.original.customer.lineUserId"
                    icon="i-lucide-message-circle"
                    size="xs"
                    color="success"
                    variant="subtle"
                    label="แชท"
                    @click="openLineChat(row.original.customer.lineUserId)"
                  />
                  <UButton
                    icon="i-lucide-eye"
                    size="xs"
                    color="neutral"
                    variant="ghost"
                    :to="`/admin/service-orders/${row.original.id}`"
                  />
                </div>
              </template>
            </UTable>

            <template #fallback>
              <div class="space-y-3 p-2">
                <div v-for="i in 4" :key="i" class="h-10 rounded bg-elevated animate-pulse" />
              </div>
            </template>
          </ClientOnly>
        </UCard>

      </div>
    </template>
  </UDashboardPanel>
</template>
