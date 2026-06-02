<script setup lang="ts">
type SessionItem = {
  id: string;
  token?: string;
  expiresAt: string | Date;
  createdAt: string | Date;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type CurrentSessionRecord = {
  session?: {
    id?: string;
    token?: string;
  };
};

const notify = useNotify();
const { session: currentSession } = useUser();

const sessions = ref<SessionItem[]>([]);
const isLoading = ref(true);
const isProcessing = ref(false);

const loadSessions = async () => {
  isLoading.value = true;
  try {
    const { data, error } = await authClient.listSessions();
    if (error) throw new Error(error.message || "");
    sessions.value = (data as SessionItem[]) ?? [];
  } catch {
    notify.serverError();
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadSessions();
});

const onRevoke = async (token?: string) => {
  if (!token) return;
  isProcessing.value = true;
  try {
    const { error } = await authClient.revokeSession({ token });
    if (error) throw new Error(error.message || "");
    notify.success("ออกจากระบบอุปกรณ์นั้นแล้ว");
    await loadSessions();
  } catch {
    notify.serverError();
  } finally {
    isProcessing.value = false;
  }
};

const onRevokeOthers = async () => {
  isProcessing.value = true;
  try {
    const { error } = await authClient.revokeOtherSessions();
    if (error) throw new Error(error.message || "");
    notify.success("ออกจากระบบอุปกรณ์อื่นทั้งหมดแล้ว");
    await loadSessions();
  } catch {
    notify.serverError();
  } finally {
    isProcessing.value = false;
  }
};

const detectDevice = (ua: string | null | undefined): string => {
  if (!ua) return "ไม่ทราบอุปกรณ์";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "อื่นๆ";
};

const detectBrowser = (ua: string | null | undefined): string => {
  if (!ua) return "";
  if (/LIFF|Line/i.test(ua)) return "LINE";
  if (/Edg\//i.test(ua)) return "Edge";
  if (/Chrome\//i.test(ua)) return "Chrome";
  if (/Firefox\//i.test(ua)) return "Firefox";
  if (/Safari\//i.test(ua)) return "Safari";
  return "";
};

const isCurrentSession = (s: SessionItem) => {
  const sessionRecord = currentSession.value as CurrentSessionRecord | null;
  return sessionRecord?.session?.id === s.id || sessionRecord?.session?.token === s.token;
};

const formatTime = (value: string | Date) => {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
};
</script>

<template>
  <section class="-mx-2 border border-default/30 bg-default p-4 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="font-semibold text-highlighted">อุปกรณ์ที่เข้าสู่ระบบอยู่</p>
        <p class="mt-1 text-xs text-muted">รายการ session ที่ active ของบัญชีคุณ</p>
      </div>
      <UButton
        v-if="sessions.length > 1"
        color="error"
        variant="ghost"
        size="sm"
        icon="i-lucide-log-out"
        :loading="isProcessing"
        class="justify-center"
        @click="onRevokeOthers"
      >
        ออกจากระบบอุปกรณ์อื่นทั้งหมด
      </UButton>
    </div>

    <USkeleton v-if="isLoading" class="h-32 w-full rounded-lg" />

    <div v-else-if="!sessions.length" class="rounded-lg border border-dashed border-default/30 p-6 text-center text-sm text-muted dark:border-default/20">
      ไม่มี session ที่ active
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="s in sessions"
        :key="s.id"
        class="flex items-center justify-between gap-3 rounded-lg border border-default/30 bg-default p-2 dark:border-default/20 dark:bg-elevated/55"
      >
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-sm font-medium">{{ detectDevice(s.userAgent) }}</p>
            <span v-if="detectBrowser(s.userAgent)" class="text-xs text-muted">· {{ detectBrowser(s.userAgent) }}</span>
            <UBadge v-if="isCurrentSession(s)" color="success" size="xs" variant="subtle">อุปกรณ์นี้</UBadge>
          </div>
          <p class="mt-0.5 text-xs text-muted">
            IP: {{ s.ipAddress || "ไม่ทราบ" }} · เริ่ม {{ formatTime(s.createdAt) }}
          </p>
        </div>
        <UButton
          v-if="!isCurrentSession(s)"
          icon="i-lucide-x"
          color="error"
          variant="ghost"
          size="sm"
          :loading="isProcessing"
          @click="onRevoke(s.token)"
        />
      </div>
    </div>
  </section>
</template>
