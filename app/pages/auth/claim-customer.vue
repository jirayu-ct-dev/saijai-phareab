<script setup lang="ts">
definePageMeta({ layout: false });

type ClaimValidation = {
  valid: boolean;
  customer?: { name: string | null; phoneNumber: string | null };
};

const route = useRoute();
const notify = useNotify();
const { user, logout } = useUser();
const token = ref(typeof route.query.token === "string" ? route.query.token : "");
const validation = ref<ClaimValidation | null>(null);
const isValidating = ref(false);
const isSubmitting = ref(false);
const completedEmail = ref("");
const verificationEmailSent = ref(true);
const showPassword = ref(false);
const isSigningOut = ref(false);
const form = reactive({ email: "", password: "", confirmPassword: "" });

const validateToken = async () => {
  if (user.value) return notify.validationError("กรุณาออกจากระบบบัญชีปัจจุบันก่อนเปิดใช้งานบัญชีลูกค้า");
  const value = token.value.trim();
  if (!value) return notify.validationError("กรุณากรอกรหัสเปิดใช้งาน");
  isValidating.value = true;
  validation.value = null;
  try {
    validation.value = await $fetch<ClaimValidation>("/api/auth/claim-customer", { query: { token: value } });
    if (!validation.value.valid) notify.error("รหัสเปิดใช้งานไม่ถูกต้องหรือหมดอายุแล้ว");
  } catch (error: unknown) {
    const message = (error as { data?: { statusMessage?: string } })?.data?.statusMessage;
    notify.error(message || "ไม่สามารถตรวจสอบรหัสเปิดใช้งานได้");
  } finally {
    isValidating.value = false;
  }
};

const submitClaim = async () => {
  if (user.value) return notify.validationError("กรุณาออกจากระบบบัญชีปัจจุบันก่อนเปิดใช้งานบัญชีลูกค้า");
  if (!validation.value?.valid) return;
  if (!form.email.trim()) return notify.validationError("กรุณากรอกอีเมล");
  if (form.password.length < 8) return notify.validationError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
  if (form.password !== form.confirmPassword) return notify.validationError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
  isSubmitting.value = true;
  try {
    const result = await $fetch<{ success: true; email: string; verificationEmailSent?: boolean }>("/api/auth/claim-customer", {
      method: "POST",
      body: { token: token.value.trim(), email: form.email.trim(), password: form.password },
    });
    completedEmail.value = result.email;
    verificationEmailSent.value = result.verificationEmailSent !== false;
    notify.success(verificationEmailSent.value ? "เปิดใช้งานบัญชีสำเร็จ กรุณาตรวจสอบอีเมล" : "เปิดใช้งานบัญชีสำเร็จ");
  } catch (error: unknown) {
    const message = (error as { data?: { statusMessage?: string } })?.data?.statusMessage;
    notify.error(message || "ไม่สามารถเปิดใช้งานบัญชีได้");
  } finally {
    isSubmitting.value = false;
  }
};

const signOutBeforeClaim = async () => {
  isSigningOut.value = true;
  try {
    await logout();
    validation.value = null;
    notify.success("ออกจากระบบแล้ว คุณสามารถเปิดใช้งานบัญชีลูกค้าได้");
    if (token.value.trim()) await validateToken();
  } catch (error: unknown) {
    notify.error(error instanceof Error ? error.message : "ไม่สามารถออกจากระบบได้");
  } finally {
    isSigningOut.value = false;
  }
};

onMounted(() => {
  if (token.value && !user.value) void validateToken();
});
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10 dark:bg-gray-950">
    <UCard class="w-full max-w-lg">
      <template #header>
        <div class="text-center">
          <AppLogo to="/" label="SAIJAI LAUNDRY" class="mx-auto mb-5 w-fit" />
          <h1 class="text-2xl font-bold text-highlighted">เปิดใช้งานบัญชีลูกค้า</h1>
          <p class="mt-2 text-sm text-muted">ใช้รหัสจากร้านเพื่อดูรายการซัก แพ็กเกจ และการชำระเงินเดิมของคุณ</p>
        </div>
      </template>

      <div v-if="completedEmail" class="space-y-5 text-center">
        <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-success/10 text-success">
          <UIcon name="i-lucide-mail-check" class="size-7" />
        </div>
        <div>
          <p class="font-semibold text-highlighted">เปิดใช้งานบัญชีแล้ว</p>
          <p v-if="verificationEmailSent" class="mt-1 text-sm text-muted">ส่งอีเมลยืนยันไปที่ {{ completedEmail }} กรุณายืนยันก่อนเข้าสู่ระบบ</p>
          <p v-else class="mt-1 text-sm text-warning">ยังส่งอีเมลยืนยันไม่ได้ กรุณาใช้เมนูลืมรหัสผ่านหรือติดต่อร้านเพื่อขอความช่วยเหลือ</p>
        </div>
        <UButton to="/auth/login" block size="lg">ไปหน้าเข้าสู่ระบบ</UButton>
      </div>

      <div v-else-if="user" class="space-y-5 text-center">
        <div class="mx-auto flex size-14 items-center justify-center rounded-full bg-warning/10 text-warning">
          <UIcon name="i-lucide-log-out" class="size-7" />
        </div>
        <div>
          <p class="font-semibold text-highlighted">กรุณาออกจากระบบก่อน</p>
          <p class="mt-1 text-sm text-muted">
            ขณะนี้คุณเข้าสู่ระบบด้วย {{ user.email }} การเปิดใช้งานรหัสนี้เป็นอีกบัญชีหนึ่งและระบบจะไม่รวมบัญชีให้อัตโนมัติ
          </p>
        </div>
        <UButton block size="lg" icon="i-lucide-log-out" :loading="isSigningOut" @click="signOutBeforeClaim">
          ออกจากระบบเพื่อเปิดใช้งานบัญชี
        </UButton>
      </div>

      <div v-else class="space-y-5">
        <UFormField label="รหัสเปิดใช้งาน" required>
          <div class="flex gap-2">
            <UInput v-model="token" class="min-w-0 flex-1" autocomplete="one-time-code" :disabled="Boolean(validation?.valid)" />
            <UButton color="neutral" variant="outline" :loading="isValidating" :disabled="Boolean(validation?.valid)" @click="validateToken">ตรวจสอบ</UButton>
          </div>
        </UFormField>

        <div v-if="validation?.valid" class="space-y-5">
          <div class="rounded-lg border border-success/30 bg-success/5 p-4">
            <p class="text-sm font-medium text-success">พบบัญชีของคุณ</p>
            <p class="mt-1 font-semibold text-highlighted">{{ validation.customer?.name || "ลูกค้าของร้าน" }}</p>
            <p class="text-sm text-muted">{{ validation.customer?.phoneNumber }}</p>
          </div>

          <UForm :state="form" class="space-y-4" @submit="submitClaim">
            <UFormField label="อีเมลสำหรับเข้าสู่ระบบ" required>
              <UInput v-model="form.email" type="email" autocomplete="email" class="w-full" />
            </UFormField>
            <UFormField label="ตั้งรหัสผ่าน" required>
              <UInput v-model="form.password" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" class="w-full">
                <template #trailing><UButton color="neutral" variant="link" :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'" @click="showPassword = !showPassword" /></template>
              </UInput>
            </UFormField>
            <UFormField label="ยืนยันรหัสผ่าน" required>
              <UInput v-model="form.confirmPassword" :type="showPassword ? 'text' : 'password'" autocomplete="new-password" class="w-full" />
            </UFormField>
            <UButton type="submit" block size="lg" :loading="isSubmitting">เปิดใช้งานบัญชี</UButton>
          </UForm>
        </div>
      </div>

      <template #footer>
        <p class="text-center text-sm text-muted">มีบัญชีแล้ว? <NuxtLink to="/auth/login" class="font-semibold text-primary hover:underline">เข้าสู่ระบบ</NuxtLink></p>
      </template>
    </UCard>
  </div>
</template>
