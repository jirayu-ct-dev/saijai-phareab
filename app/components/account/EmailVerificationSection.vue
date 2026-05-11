<script setup lang="ts">
import { authClient } from "~~/app/utils/auth-client";

type ProfileResponse = { email: string; emailVerified: boolean };

const props = withDefaults(
  defineProps<{
    callbackURL?: string;
  }>(),
  {
    callbackURL: "/",
  },
);

const notify = useNotify();
const { data, status } = await useFetch<ProfileResponse>("/api/me/profile", {
  key: "me-profile",
});
const isLoading = computed(() => status.value === "pending");
const email = computed(() => data.value?.email ?? null);
const emailVerified = computed(() => data.value?.emailVerified ?? false);

const isSending = ref(false);
const sentTo = ref<string | null>(null);

const onSend = async () => {
  if (!email.value) return;
  isSending.value = true;
  try {
    const { error } = await authClient.sendVerificationEmail({
      email: email.value,
      callbackURL: props.callbackURL,
    });
    if (error) throw new Error(error.message ?? "send failed");
    sentTo.value = email.value;
    notify.success("ส่งอีเมลยืนยันแล้ว ตรวจสอบกล่องจดหมายของคุณ");
  } catch {
    notify.serverError();
  } finally {
    isSending.value = false;
  }
};
</script>

<template>
  <USkeleton v-if="isLoading" class="h-48 w-full rounded-lg" />

  <UCard v-else>
    <template #header>
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="font-semibold">การยืนยันอีเมล</p>
          <p class="text-xs text-muted mt-1">ยืนยันอีเมลเพื่อเพิ่มความปลอดภัยให้บัญชี</p>
        </div>
        <UBadge
          :color="emailVerified ? 'success' : 'warning'"
          variant="subtle"
          :icon="emailVerified ? 'i-lucide-badge-check' : 'i-lucide-mail-warning'"
        >
          {{ emailVerified ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน" }}
        </UBadge>
      </div>
    </template>

    <div class="space-y-3">
      <div class="text-sm">
        <span class="text-muted">อีเมล: </span>
        <span class="font-medium">{{ email ?? "—" }}</span>
      </div>

      <p v-if="emailVerified" class="text-sm text-muted">อีเมลนี้ได้รับการยืนยันแล้ว</p>
      <p v-else-if="sentTo" class="text-sm text-success">
        ส่งลิงก์ยืนยันไปที่ {{ sentTo }} แล้ว กรุณาตรวจสอบกล่องจดหมาย (รวมถึงสแปม)
      </p>
      <p v-else class="text-sm text-muted">กดปุ่มด้านล่างเพื่อส่งลิงก์ยืนยันไปที่อีเมลของคุณ</p>
    </div>

    <template v-if="!emailVerified" #footer>
      <div class="flex justify-end">
        <UButton
          :loading="isSending"
          :disabled="!email"
          icon="i-lucide-mail-check"
          @click="onSend"
        >
          {{ sentTo ? "ส่งอีกครั้ง" : "ส่งอีเมลยืนยัน" }}
        </UButton>
      </div>
    </template>
  </UCard>
</template>
