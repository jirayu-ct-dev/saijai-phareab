<script setup lang="ts">
import * as adminUi from "~~/shared/config/adminUi";

const adminDashboardCardClass =
  adminUi.adminDashboardCardClass
  ?? "admin-dashboard-card rounded-md border border-default/30 bg-default p-4 shadow-[0_1px_2px_rgb(15_23_42/0.04),0_6px_18px_-10px_rgb(15_23_42/0.08)] dark:border-default/20 dark:bg-elevated/55";

const notify = useNotify();
const { user } = useUser();

const { data, status, refresh } = await useFetch<{ lineNotifyEnabled: boolean; hasLineLinked: boolean }>(
  "/api/me/notification-preferences",
  { key: "me-notification-preferences" },
);

const isLoading = computed(() => status.value === "pending");
const isSaving = ref(false);

const lineNotifyEnabled = ref(true);

watch(
  () => data.value,
  (val) => {
    if (!val) return;
    lineNotifyEnabled.value = val.lineNotifyEnabled;
  },
  { immediate: true },
);

const onToggle = async (value: boolean) => {
  isSaving.value = true;
  try {
    await $fetch("/api/me/notification-preferences", {
      method: "PUT",
      body: { lineNotifyEnabled: value },
    });
    lineNotifyEnabled.value = value;
    notify.updated();
    await refresh();
  } catch {
    notify.serverError();
    lineNotifyEnabled.value = !value;
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <UDashboardPanel id="settings-notification">
    <template #header>
      <UDashboardNavbar title="การแจ้งเตือน" icon="i-lucide-bell">
        <template #leading>
          <UDashboardSidebarCollapse class="hidden lg:inline-flex" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-3 p-2 sm:gap-4 sm:p-4 md:gap-6 md:p-6">
        <USkeleton v-if="isLoading" class="h-32 w-full rounded-md" />

        <template v-else>
          <section :class="[adminDashboardCardClass, 'flex items-center gap-3 p-3! sm:p-4!']">
            <div class="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <UIcon name="i-lucide-bell" class="size-5" />
            </div>
            <div class="min-w-0">
              <p class="text-sm font-semibold text-highlighted">การแจ้งเตือนผ่าน LINE</p>
              <p class="mt-0.5 text-xs text-muted">จัดการการแจ้งเตือนผ่าน LINE สำหรับบัญชีของคุณ</p>
            </div>
          </section>

          <section :class="[adminDashboardCardClass, 'p-3! sm:p-4!']">
            <div v-if="!user" class="text-sm text-muted">กรุณาเข้าสู่ระบบ</div>

            <div v-else class="space-y-3 sm:space-y-4">
              <div
                v-if="!data?.hasLineLinked"
                class="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm text-warning"
              >
                <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0" />
                <p>บัญชีของคุณยังไม่ได้ผูกกับ LINE — ผูกบัญชีก่อนเพื่อรับการแจ้งเตือน</p>
              </div>

              <div class="flex items-center justify-between gap-4 rounded-md border border-default/30 bg-elevated/30 p-3 dark:border-default/20 dark:bg-elevated/25">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-highlighted">รับการแจ้งเตือนทาง LINE</p>
                  <p class="mt-1 text-xs text-muted">
                    เปิดเพื่อรับใบเสร็จและสถานะผ้าผ่าน LINE จากร้าน
                  </p>
                </div>
                <USwitch
                  :model-value="lineNotifyEnabled"
                  :loading="isSaving"
                  @update:model-value="onToggle"
                />
              </div>
            </div>
          </section>
        </template>
      </div>
    </template>
  </UDashboardPanel>
</template>
