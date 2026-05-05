<script setup lang="ts">
import { sub } from "date-fns";
import type { DropdownMenuItem } from "@nuxt/ui";
import type { Period, Range } from "~~/shared/types/dashboard";

definePageMeta({
  middleware: ["role-admin-home"],
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
</script>

<template>
  <UDashboardPanel id="home">
    <template #header>
      <UDashboardNavbar title="Home" :ui="{ right: 'gap-3' }">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>

        <template #right>
          <UDropdownMenu :items="items">
            <UButton icon="i-lucide-plus" size="md" class="rounded-full" />
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
      <div class="flex flex-col gap-4 p-4 sm:gap-6 sm:p-6">
        <ClientOnly>
          <AdminDashboardStats :period="period" :range="range" />
          <template #fallback>
            <UPageGrid class="grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-px">
              <UPageCard
                v-for="i in 4"
                :key="i"
                variant="subtle"
                :ui="{
                  container: 'gap-y-1.5',
                  wrapper: 'items-start',
                  leading: 'p-2.5 rounded-full bg-primary/10 ring ring-inset ring-primary/25 flex-col',
                  title: 'font-normal text-muted text-xs',
                }"
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
        <div class="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <AdminDashboardChart :period="period" :range="range" />
          <AdminDashboardOrderTypeChart :period="period" :range="range" />
        </div>
        <div class="flex flex-col gap-4">
          <ClientOnly>
            <AdminDashboardRecentPayments :period="period" :range="range" />
            <AdminDashboardSales :period="period" :range="range" />
            <template #fallback>
              <UCard v-for="i in 2" :key="i">
                <div class="space-y-3">
                  <div v-for="j in 4" :key="j" class="h-10 rounded bg-elevated animate-pulse" />
                </div>
              </UCard>
            </template>
          </ClientOnly>
        </div>
      </div>
    </template>
  </UDashboardPanel>
</template>
