<script setup lang="ts">
const notify = useNotify();

const { data, status, refresh } = await useFetch<{ lineNotifyEnabled: boolean; hasLineLinked: boolean }>(
  "/api/me/notification-preferences",
  { key: "me-notification-preferences" },
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

  <UCard v-else>
    <template #header>
      <div>
        <p class="font-semibold">การแจ้งเตือนทาง LINE</p>
        <p class="text-xs text-muted mt-1">เปิด/ปิดการรับใบเสร็จและสถานะผ่าน LINE</p>
      </div>
    </template>

    <div v-if="!data?.hasLineLinked" class="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm text-warning mb-3">
      ⚠ ยังไม่ได้เชื่อมบัญชี LINE — เชื่อมก่อนเพื่อรับการแจ้งเตือน
    </div>

    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="font-medium">รับการแจ้งเตือน</p>
        <p class="text-xs text-muted mt-1">รับใบเสร็จ สถานะผ้า และข้อมูลสำคัญผ่าน LINE</p>
      </div>
      <USwitch
        :model-value="lineNotifyEnabled"
        :loading="isSaving"
        @update:model-value="onToggle"
      />
    </div>
  </UCard>
</template>
