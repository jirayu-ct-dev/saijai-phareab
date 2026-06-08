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
    label: "ดูประวัติการชำระเงิน",
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

const hydrated = ref(false);
onMounted(() => { hydrated.value = true; });
const isStatsPending = computed(() => statsStatus.value === "pending" || statsStatus.value === "idle");
const showStatsSkeleton = computed(() => !hydrated.value || isStatsPending.value || isRefreshing.value);
const showRecentSkeleton = computed(() => !hydrated.value || isRefreshing.value);

const range = shallowRef<Range>({
  start: sub(new Date(), { days: 14 }),
  end: new Date(),
});
const period = ref<Period>("daily");

const isRefreshing = ref(false);
async function refresh() {
  isRefreshing.value = true;
  try {
    await Promise.all([
      refreshStats(),
      refreshNuxtData("recent-orders"),
    ]);
  } finally {
    isRefreshing.value = false;
  }
}

const statCards = computed(() => [
  {
    title: "รับผ้าวันนี้",
    icon: "i-lucide-shopping-basket",
    to: "/admin/service-orders",
    value: stats.value?.receivedToday ?? 0,
  },
  {
    title: "รอดำเนินการ",
    icon: "i-lucide-loader-circle",
    to: "/admin/service-orders",
    value: stats.value?.inProgress ?? 0,
  },
  {
    title: "พร้อมส่งคืน",
    icon: "i-lucide-package-check",
    to: "/admin/service-orders",
    value: stats.value?.readyToDeliver ?? 0,
  },
  {
    title: "ส่งคืนวันนี้",
    icon: "i-lucide-check-circle",
    to: "/admin/service-orders",
    value: stats.value?.completedToday ?? 0,
  },
]);

</script>

<template>
  <UDashboardPanel id="employee-dashboard">
    <template #header>
      <UDashboardNavbar title="ภาพรวมงานวันนี้">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <UIButtonRefresh :loading="isRefreshing" @click="refresh" />
          <UDropdownMenu :items="items">
            <UButton icon="i-lucide-plus" size="md" />
          </UDropdownMenu>
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-3 p-2 sm:p-6">

        <!-- Stats -->
        <div class="-mx-2 grid grid-cols-2 gap-2 sm:mx-0 sm:gap-3 lg:grid-cols-4">
          <template v-if="showStatsSkeleton">
            <div
              v-for="i in 4"
              :key="`stat-sk-${i}`"
              class="min-h-28 border border-default/30 bg-default p-3 dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg"
            >
              <USkeleton class="size-10 rounded-full" />
              <USkeleton class="mt-3 h-3 w-16 rounded" />
              <USkeleton class="mt-1 h-7 w-20 rounded" />
            </div>
          </template>
          <template v-else>
            <NuxtLink
              v-for="card in statCards"
              :key="card.title"
              :to="card.to"
              class="min-h-28 border border-default/30 bg-default p-3 transition-[background-color,border-color] duration-200 hover:border-default/45 hover:bg-default dark:border-default/20 dark:bg-elevated/55 dark:hover:bg-elevated/70 sm:rounded-lg"
            >
              <div class="flex size-10 items-center justify-center rounded-full bg-default/80 text-highlighted ring ring-inset ring-default/70 dark:bg-elevated/70 dark:ring-default/45">
                <UIcon :name="card.icon" class="size-5" />
              </div>
              <p class="mt-3 truncate text-xs font-normal text-muted">{{ card.title }}</p>
              <span class="wrap-break-word text-lg font-semibold leading-tight text-highlighted sm:text-2xl">{{ card.value }}</span>
            </NuxtLink>
          </template>
        </div>

        <!-- Recent Orders -->
        <section
          v-if="showRecentSkeleton"
          class="-mx-2 space-y-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg"
        >
          <USkeleton class="h-5 w-40 rounded" />
          <USkeleton v-for="i in 4" :key="`recent-sk-${i}`" class="h-12 w-full rounded-lg" />
        </section>
        <AdminDashboardSales v-else :period="period" :range="range" />

      </div>
    </template>
  </UDashboardPanel>
</template>
