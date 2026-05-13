<script setup lang="ts">
type ProfileResponse = {
  hasLineLinked: boolean;
};

const notify = useNotify();
const route = useRoute();
const router = useRouter();
const { data, status, refresh } = useFetch<ProfileResponse>("/api/me/profile", { key: "me-profile" });
const isLoading = computed(() => status.value === "pending");
const isProcessing = ref(false);

// Handle OAuth callback result from query params
onMounted(async () => {
  const error = route.query.error as string | undefined;
  if (error) {
    if (error === "account_already_linked" || error === "ACCOUNT_ALREADY_LINKED") {
      notify.error("LINE นี้เชื่อมต่อกับบัญชีอื่นอยู่แล้ว");
    } else if (error === "provider_already_linked" || error === "PROVIDER_ALREADY_LINKED") {
      notify.error("บัญชีนี้เชื่อมต่อ LINE แล้ว");
    } else {
      notify.error(`เชื่อมต่อบัญชี LINE ไม่สำเร็จ (${error})`);
    }
    await router.replace({ query: { ...route.query, error: undefined } });
    return;
  }
  const linked = route.query.linked as string | undefined;
  if (linked === "line") {
    notify.success("เชื่อมบัญชี LINE สำเร็จ");
    await refresh();
    await router.replace({ query: { ...route.query, linked: undefined } });
  }
});

const onLink = async () => {
  if (data.value?.hasLineLinked) {
    return notify.error("บัญชีนี้เชื่อมต่อ LINE แล้ว");
  }
  isProcessing.value = true;
  try {
    const callbackURL = `${window.location.pathname}?linked=line`;
    const { error } = await authClient.linkSocial({ provider: "line", callbackURL });
    if (error) {
      const code = error.code as string | undefined;
      if (code === "ACCOUNT_ALREADY_LINKED" || code === "account_already_linked") {
        notify.error("LINE นี้เชื่อมต่อกับบัญชีอื่นอยู่แล้ว");
      } else {
        notify.error(error.message || "เชื่อมต่อบัญชี LINE ไม่สำเร็จ");
      }
    }
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
  <USkeleton v-if="isLoading" class="h-32 w-full rounded-md" />

  <UCard v-else class="p-2">
    <template #header>
      <div>
        <p class="font-semibold">บัญชี LINE</p>
        <p class="mt-1 text-xs text-muted">ใช้สำหรับรับการแจ้งเตือนและ login ด้วย LINE</p>
      </div>
    </template>

    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex min-w-0 items-center gap-3">
        <UIcon name="i-simple-icons-line" class="size-8 text-[#06C755]" />
        <div class="min-w-0">
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
        class="justify-center sm:shrink-0"
        @click="onUnlink"
      >
        ยกเลิก
      </UButton>
      <UButton
        v-else
        color="primary"
        :loading="isProcessing"
        icon="i-lucide-link"
        class="justify-center sm:shrink-0"
        @click="onLink"
      >
        เชื่อมบัญชี
      </UButton>
    </div>
  </UCard>
</template>
