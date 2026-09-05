<script setup lang="ts">
import { sub } from "date-fns";
import type { Period, Range } from "~~/shared/types/dashboard";

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
const EMAIL_BANNER_KEY = "saijai-email-banner-dismissed";
onMounted(() => {
  if (localStorage.getItem(EMAIL_BANNER_KEY) === "1") showEmailBanner.value = false;
});
const dismissEmailBanner = () => {
  showEmailBanner.value = false;
  try {
    localStorage.setItem(EMAIL_BANNER_KEY, "1");
  } catch {
    // localStorage ใช้ไม่ได้ (เช่น private mode) — ปิดเฉพาะรอบนี้
  }
};
const isRefreshing = ref(false);
const refreshTick = ref(0);
const handleRefresh = async () => {
  isRefreshing.value = true;
  refreshTick.value += 1;
  try {
    await refreshNuxtData();
  } finally {
    isRefreshing.value = false;
  }
};
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
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
              class="shrink-0 border-default/40 bg-elevated/60 text-toned hover:bg-elevated"
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
            <div class="-ms-1 flex flex-wrap gap-2">
              <MeDashboardDateRangePicker v-model="range" />
              <MeDashboardPeriodSelect v-model="period" :range="range" />
            </div>
          </ClientOnly>
        </template>
      </UDashboardToolbar>
    </template>

      <template #body>
        <div class="flex flex-col gap-3 p-2 sm:p-6">
          <!-- Email Verification Banner (Phase 3) -->
          <ClientOnly>
            <div>
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
                @update:open="dismissEmailBanner"
              />
            </div>
          </ClientOnly>

          <!-- Membership Card (Member เท่านั้น) -->
          <MeDashboardMembershipCard :refreshing="isRefreshing" />

          <!-- Stats Cards -->
          <ClientOnly>
            <MeDashboardStats
              :period="period"
              :range="range"
              :refreshing="isRefreshing"
            />
            <template #fallback>
              <div class="-mx-2 grid grid-cols-2 gap-2 sm:mx-0 sm:gap-3 xl:grid-cols-4">
                <div
                  v-for="i in 4"
                  :key="i"
                  class="min-h-28 bg-default p-3 dark:bg-elevated/55 sm:rounded-lg sm:border sm:border-default/30 sm:dark:border-default/20"
                >
                  <div class="space-y-3">
                    <USkeleton class="size-10 rounded-full" />
                    <USkeleton class="h-3 w-16 rounded-lg" />
                    <USkeleton class="h-8 w-28 rounded-lg" />
                  </div>
                </div>
              </div>
            </template>
          </ClientOnly>

          <!-- Charts -->
          <div>
            <MeDashboardChart
              :period="period"
              :range="range"
              :refreshing="isRefreshing"
              :refresh-key="refreshTick"
            />
          </div>

          <!-- Tables -->
          <div class="flex flex-col gap-3">
            <ClientOnly>
              <MeDashboardRecentPayments :refreshing="isRefreshing" />
              <MeDashboardRecentOrders :refreshing="isRefreshing" />
              <template #fallback>
                <div
                  v-for="i in 2"
                  :key="i"
                  class="-mx-2 border border-default/30 bg-default p-3 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg"
                >
                  <div class="space-y-2">
                    <USkeleton v-for="j in 4" :key="j" class="h-12 w-full rounded-lg" />
                  </div>
                </div>
              </template>
            </ClientOnly>
          </div>
        </div>
      </template>
    </UDashboardPanel>
  </div>
</template>
