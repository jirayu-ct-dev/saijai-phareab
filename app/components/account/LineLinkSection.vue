<script setup lang="ts">
type ProfileResponse = {
  hasLineLinked: boolean;
};

const notify = useNotify();
const { data, status, refresh } = useFetch<ProfileResponse>("/api/me/profile", { key: "me-profile" });
const isLoading = computed(() => status.value === "pending");
const isProcessing = ref(false);

const onLink = async () => {
  isProcessing.value = true;
  try {
    const { error } = await authClient.linkSocial({ provider: "line", callbackURL: window.location.href });
    if (error) throw new Error(error.message || "");
  } catch {
    notify.error("เชื่อมต่อบัญชี LINE ไม่สำเร็จ");
  } finally {
    isProcessing.value = false;
  }
};

const onUnlink = async () => {
  isProcessing.value = true;
  try {
    const { error } = await authClient.unlinkAccount({ providerId: "line" });
    if (error) throw new Error(error.message || "");
    notify.success("ยกเลิกการเชื่อมบัญชี LINE แล้ว");
    await refresh();
  } catch {
    notify.error("ยกเลิกการเชื่อมบัญชี LINE ไม่สำเร็จ");
  } finally {
    isProcessing.value = false;
  }
};
</script>

<template>
  <USkeleton v-if="isLoading" class="h-32 w-full rounded-lg" />

  <UCard v-else>
    <template #header>
      <div>
        <p class="font-semibold">บัญชี LINE</p>
        <p class="text-xs text-muted mt-1">ใช้สำหรับรับการแจ้งเตือนและ login ด้วย LINE</p>
      </div>
    </template>

    <div class="flex items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <UIcon name="i-simple-icons-line" class="size-8 text-[#06C755]" />
        <div>
          <p class="text-sm font-medium">
            {{ data?.hasLineLinked ? "เชื่อมบัญชี LINE แล้ว" : "ยังไม่ได้เชื่อมบัญชี LINE" }}
          </p>
          <p class="text-xs text-muted">
            {{ data?.hasLineLinked ? "พร้อมรับการแจ้งเตือน" : "เชื่อมบัญชีเพื่อรับการแจ้งเตือนผ่าน LINE" }}
          </p>
        </div>
      </div>

      <UButton
        v-if="data?.hasLineLinked"
        color="error"
        variant="ghost"
        :loading="isProcessing"
        icon="i-lucide-unlink"
        @click="onUnlink"
      >
        ยกเลิก
      </UButton>
      <UButton v-else color="primary" :loading="isProcessing" icon="i-lucide-link" @click="onLink">
        เชื่อมบัญชี
      </UButton>
    </div>
  </UCard>
</template>
