<script setup lang="ts">
import { orderStatusLabels, orderStatusColors } from "~~/shared/config/orderConfig";
import type { ServiceOrderStatus } from "~~/shared/types/enums";

definePageMeta({
  middleware: ["role-employee"],
  layout: "admin",
});

const { data: stats, status: statsStatus, refresh: refreshStats } = useAsyncData(
  "employee-stats",
  () => $fetch("/api/admin/dashboard/employee-stats"),
  { server: false }
);
const { data: orders, refresh: refreshOrders } = useAsyncData(
  "employee-pending-orders",
  () => $fetch("/api/admin/dashboard/pending-orders"),
  { server: false }
);

const isStatsPending = computed(() => statsStatus.value === "pending");

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
  title: "font-normal text-muted text-xs",
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
      <div class="flex flex-col gap-6 p-4 sm:p-6">

        <!-- Stats -->
        <ClientOnly>
          <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px">
            <template v-if="isStatsPending">
              <UPageCard
                v-for="i in 4"
                :key="`sk-${i}`"
                variant="subtle"
                :ui="cardUi"
                class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg"
              >
                <template #leading>
                  <div class="p-2.5 rounded-full bg-elevated animate-pulse size-10" />
                </template>
                <template #title>
                  <div class="h-3 w-16 rounded bg-elevated animate-pulse" />
                </template>
                <div class="h-8 w-28 rounded bg-elevated animate-pulse mt-1" />
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
                class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1"
              >
                <span class="text-2xl font-semibold text-highlighted">{{ card.value }}</span>
              </UPageCard>
            </template>
          </UPageGrid>

          <template #fallback>
            <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px">
              <UPageCard
                v-for="i in 4"
                :key="`fb-${i}`"
                variant="subtle"
                :ui="cardUi"
                class="lg:rounded-none first:rounded-l-lg last:rounded-r-lg"
              >
                <template #leading>
                  <div class="p-2.5 rounded-full bg-elevated animate-pulse size-10" />
                </template>
                <template #title>
                  <div class="h-3 w-16 rounded bg-elevated animate-pulse" />
                </template>
                <div class="h-8 w-28 rounded bg-elevated animate-pulse mt-1" />
              </UPageCard>
            </UPageGrid>
          </template>
        </ClientOnly>

        <!-- Shortcuts -->
        <div class="flex flex-wrap gap-3">
          <UButton icon="i-lucide-shopping-basket" to="/admin/service-orders/new" color="primary">
            รับผ้าใหม่
          </UButton>
          <UButton icon="i-lucide-scan-line" to="/admin/service-orders/scan" color="neutral" variant="outline">
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
            <UTable :data="orders ?? []" :columns="columns">
              <template #customer-cell="{ row }">
                <div class="flex items-center gap-2">
                  <UAvatar :src="row.original.customer.image ?? undefined" :alt="row.original.customer.name" size="xs" />
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
