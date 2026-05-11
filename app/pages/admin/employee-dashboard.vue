<script setup lang="ts">
import { sub } from "date-fns";
import type { DropdownMenuItem } from "@nuxt/ui";
import type { Period, Range } from "~~/shared/types/dashboard";

definePageMeta({
  middleware: ["role-employee"],
  layout: "admin",
});

const items = [[
  {
    label: "เพิ่มรายการรับผ้า",
    icon: "i-lucide-shopping-basket",
    to: "/admin/service-orders",
  },
  {
    label: "เพิ่มรายการขาย",
    icon: "i-lucide-shopping-cart",
    to: "/admin/sales",
  },
  {
    label: "ดูรายการชำระเงิน",
    icon: "i-lucide-receipt",
    to: "/admin/payment",
  },
]] satisfies DropdownMenuItem[][];

interface EmployeeStats {
  receivedToday: number;
  inProgress: number;
  readyToDeliver: number;
  completedToday: number;
}

const { data: stats, status: statsStatus, refresh: refreshStats } = useAsyncData<EmployeeStats>(
  "employee-stats",
  () => $fetch("/api/admin/dashboard/employee-stats"),
  { server: false }
);

const isStatsPending = computed(() => statsStatus.value === "pending");

const range = shallowRef<Range>({
  start: sub(new Date(), { days: 14 }),
  end: new Date(),
});
const period = ref<Period>("daily");

function refresh() {
  refreshStats();
  refreshNuxtData("recent-orders");
}

const statCards = computed(() => [
  {
    title: "รับผ้าวันนี้",
    icon: "i-lucide-shopping-basket",
    to: "/admin/service-orders",
    value: stats.value?.receivedToday ?? 0,
    toneClass: "border-info/20 bg-info/5 hover:bg-info/10 dark:border-default/25 dark:bg-elevated/45 dark:hover:bg-elevated/60",
  },
  {
    title: "รอดำเนินการ",
    icon: "i-lucide-loader-circle",
    to: "/admin/service-orders",
    value: stats.value?.inProgress ?? 0,
    toneClass: "border-warning/20 bg-warning/5 hover:bg-warning/10 dark:border-default/25 dark:bg-elevated/45 dark:hover:bg-elevated/60",
  },
  {
    title: "พร้อมส่งคืน",
    icon: "i-lucide-package-check",
    to: "/admin/service-orders",
    value: stats.value?.readyToDeliver ?? 0,
    toneClass: "border-primary/20 bg-primary/5 hover:bg-primary/10 dark:border-default/25 dark:bg-elevated/45 dark:hover:bg-elevated/60",
  },
  {
    title: "ส่งคืนวันนี้",
    icon: "i-lucide-check-circle",
    to: "/admin/service-orders",
    value: stats.value?.completedToday ?? 0,
    toneClass: "border-success/20 bg-success/5 hover:bg-success/10 dark:border-default/25 dark:bg-elevated/45 dark:hover:bg-elevated/60",
  },
]);

const cardUi = {
  container: "gap-y-1.5",
  wrapper: "items-start",
  leading: "p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col",
  title: "font-normal text-muted text-xs truncate",
};
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
          <UDropdownMenu :items="items">
            <UButton icon="i-lucide-plus" size="md" class="rounded-full" />
          </UDropdownMenu>
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
                class="min-w-0 lg:rounded-none first:rounded-l-lg last:rounded-r-lg dark:border-default/25 dark:bg-elevated/45"
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
                :class="[
                  'min-w-0 lg:rounded-none first:rounded-l-lg last:rounded-r-lg hover:z-1',
                  card.toneClass,
                ]"
              >
                <span class="wrap-break-word text-lg font-semibold leading-tight text-highlighted sm:text-2xl">{{ card.value }}</span>
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
                class="min-w-0 lg:rounded-none first:rounded-l-lg last:rounded-r-lg dark:border-default/25 dark:bg-elevated/45"
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

        <!-- Recent Orders -->
        <ClientOnly>
          <AdminDashboardSales :period="period" :range="range" />
          <template #fallback>
            <UCard class="dark:border-default/25 dark:bg-elevated/45">
              <div class="space-y-3">
                <div v-for="i in 4" :key="i" class="h-10 rounded bg-elevated animate-pulse" />
              </div>
            </UCard>
          </template>
        </ClientOnly>

      </div>
    </template>
  </UDashboardPanel>
</template>
