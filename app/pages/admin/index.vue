<script setup lang="ts">
import { sub } from "date-fns";
import type { DropdownMenuItem } from "@nuxt/ui";
import type { Period, Range } from "~~/shared/types/dashboard";

definePageMeta({
  middleware: ["role-admin-home"],
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
  {
    label: "เพิ่มผู้ใช้",
    icon: "i-lucide-user-plus",
    to: "/admin/users",
  },
]] satisfies DropdownMenuItem[][];

const range = shallowRef<Range>({
  start: sub(new Date(), { days: 14 }),
  end: new Date(),
});
const period = ref<Period>("daily");

const isRefreshing = ref(false);
const handleRefresh = async () => {
  isRefreshing.value = true;
  try {
    await refreshNuxtData();
  } finally {
    isRefreshing.value = false;
  }
};
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Home" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            size="md"
            title="รีเฟรชข้อมูล"
            aria-label="รีเฟรชข้อมูล"
            :loading="isRefreshing"
            @click="handleRefresh"
          />
          <UDropdownMenu :items="items">
            <UButton icon="i-lucide-plus" size="md" />
          </UDropdownMenu>
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <ClientOnly>
            <div class="flex flex-wrap gap-2 -ms-1">
              <AdminDashboardDateRangePicker v-model="range" />
              <AdminDashboardPeriodSelect v-model="period" :range="range" />
            </div>
          </ClientOnly>
        </template>
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-3 p-2 sm:p-6">
        <ClientOnly>
          <AdminDashboardStats :period="period" :range="range" />
          <template #fallback>
            <div class="-mx-2 grid grid-cols-2 gap-2 sm:mx-0 sm:gap-3 lg:grid-cols-4">
              <div
                v-for="i in 4"
                :key="i"
                class="min-h-28 border border-default/30 bg-default p-3 dark:border-default/20 dark:bg-elevated/55 sm:rounded-lg"
              >
                <div class="size-10 rounded-full bg-elevated animate-pulse" />
                <div class="mt-3 h-3 w-16 rounded bg-elevated animate-pulse" />
                <div class="mt-2 h-7 w-full max-w-28 rounded bg-elevated animate-pulse" />
              </div>
            </div>
          </template>
        </ClientOnly>
        <div class="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <AdminDashboardChart :period="period" :range="range" />
          <AdminDashboardOrderTypeChart :period="period" :range="range" />
        </div>
        <div class="flex flex-col gap-3">
          <ClientOnly>
            <AdminDashboardRecentPayments :period="period" :range="range" />
            <AdminDashboardSales :period="period" :range="range" />
            <template #fallback>
              <section
                v-for="i in 2"
                :key="i"
                class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg"
              >
                <div class="space-y-3">
                  <div v-for="j in 4" :key="j" class="h-10 rounded bg-elevated animate-pulse" />
                </div>
              </section>
            </template>
          </ClientOnly>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
