<script setup lang="ts">
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
  <div class="w-full p-6 max-w-xl mx-auto space-y-6">
    <div>
      <h1 class="text-xl font-semibold">การแจ้งเตือน</h1>
      <p class="text-sm text-muted mt-1">จัดการการแจ้งเตือนผ่าน LINE สำหรับบัญชีของคุณ</p>
    </div>

    <USkeleton v-if="isLoading" class="h-32 w-full rounded-lg" />

    <UCard v-else>
      <div v-if="!user" class="text-sm text-muted">กรุณาเข้าสู่ระบบ</div>

      <div v-else class="space-y-4">
        <div v-if="!data?.hasLineLinked" class="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning">
          ⚠ บัญชีของคุณยังไม่ได้ผูกกับ LINE — ผูกบัญชีก่อนเพื่อรับการแจ้งเตือน
        </div>

        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="font-medium">รับการแจ้งเตือนทาง LINE</p>
            <p class="text-xs text-muted mt-1">
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
    </UCard>
  </div>
</template>
