<script setup lang="ts">
import { sub } from "date-fns";
import type { Period, Range } from "~~/shared/types/dashboard";
import { adminDashboardBodyClass, adminMetricCardClass } from "~~/shared/config/adminUi";

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const range = shallowRef<Range>({
  start: sub(new Date(), { days: 14 }),
  end: new Date(),
});
const period = ref<Period>("daily");

const { user } = useUser();

const showEmailBanner = ref(true);
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
  <div class="flex-1 flex flex-col min-h-0">
    <UDashboardPanel id="me-home" grow>
      <template #header>
        <UDashboardNavbar title="แดชบอร์ด" :ui="{ right: 'gap-3' }">
          <template #leading>
            <UDashboardSidebarCollapse />
          </template>
          <template #right>
            <UButton
              icon="i-lucide-refresh-cw"
              color="neutral"
              variant="outline"
              size="md"
              class="rounded-full"
              title="รีเฟรชข้อมูล"
              aria-label="รีเฟรชข้อมูล"
              :loading="isRefreshing"
              @click="handleRefresh"
            />
          </template>
        </UDashboardNavbar>

      <UDashboardToolbar>
        <template #left>
          <ClientOnly>
            <div class="flex flex-wrap gap-2 -ms-1">
              <MeDashboardDateRangePicker v-model="range" />
              <MeDashboardPeriodSelect v-model="period" :range="range" />
            </div>
          </ClientOnly>
        </template>
      </UDashboardToolbar>
    </template>

      <template #body>
        <div :class="adminDashboardBodyClass">
          <!-- Email Verification Banner (Phase 3) -->
          <ClientOnly>
            <div class="mb-4">
              <UAlert
                v-if="showEmailBanner && user && !user.emailVerified"
                color="warning"
                variant="subtle"
                icon="i-lucide-mail-warning"
                title="ยังไม่ได้ยืนยันอีเมล"
                description="ยืนยันอีเมลของคุณเพื่อรับใบเสร็จและการแจ้งเตือนทางอีเมล"
                :actions="[{
                  label: 'ไปยืนยันอีเมล',
                  to: '/me/settings/profile',
                  color: 'warning',
                  variant: 'solid',
                }]"
                close
                @close="showEmailBanner = false"
              />
            </div>
          </ClientOnly>

          <!-- Membership Card (Member เท่านั้น) -->
          <MeDashboardMembershipCard />

          <!-- Stats Cards -->
          <ClientOnly>
            <MeDashboardStats :period="period" :range="range" />
            <template #fallback>
              <UPageGrid class="lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-px">
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
                  :class="[adminMetricCardClass, 'admin-dashboard-card']"
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

          <!-- Charts Grid -->
          <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <MeDashboardChart :period="period" :range="range" />
            <MeDashboardOrderStatusChart :period="period" :range="range" />
          </div>

          <!-- Tables -->
          <div class="flex flex-col gap-4">
            <ClientOnly>
              <MeDashboardRecentPayments />
              <MeDashboardRecentOrders />
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
  </div>
</template>
