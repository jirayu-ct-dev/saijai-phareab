<script setup lang="ts">
const notify = useNotify();

const { data, status, refresh } = useFetch<{ lineNotifyEnabled: boolean; hasLineLinked: boolean }>(
  "/api/me/notification-preferences",
  { key: "me-notification-preferences", lazy: true },
);

const isLoading = computed(() => status.value === "pending");
const isSaving = ref(false);
const lineNotifyEnabled = ref(true);

watch(
  data,
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
  <USkeleton v-if="isLoading" class="h-32 w-full rounded-lg" />

  <section
    v-else
    class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg"
  >
    <div class="mb-4">
      <p class="font-semibold text-highlighted">การแจ้งเตือนทาง LINE</p>
      <p class="mt-1 text-xs text-muted">เปิด/ปิดการรับใบเสร็จและสถานะผ่าน LINE</p>
    </div>

    <div v-if="!data?.hasLineLinked" class="mb-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
      <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0" />
      <span>ยังไม่ได้เชื่อมบัญชี LINE เชื่อมก่อนเพื่อรับการแจ้งเตือน</span>
    </div>

    <div class="flex items-center justify-between gap-4">
      <div class="min-w-0">
        <p class="font-medium">รับการแจ้งเตือน</p>
        <p class="mt-1 text-xs text-muted">รับใบเสร็จ สถานะผ้า และข้อมูลสำคัญผ่าน LINE</p>
      </div>
      <USwitch
        :model-value="lineNotifyEnabled"
        :loading="isSaving"
        @update:model-value="onToggle"
      />
    </div>
  </section>
</template>
