<script setup lang="ts">
type ProfileResponse = { hasPasswordCredential: boolean };

const notify = useNotify();
const { data, status } = useFetch<ProfileResponse>("/api/me/profile", { key: "me-profile" });
const isLoading = computed(() => status.value === "pending");

const form = reactive({ currentPassword: "", newPassword: "", confirmPassword: "" });
const isSaving = ref(false);

const onSubmit = async () => {
  if (!form.currentPassword || !form.newPassword) {
    return notify.validationError("กรุณากรอกรหัสผ่าน");
  }
  if (form.newPassword.length < 8) {
    return notify.validationError("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร");
  }
  if (form.newPassword !== form.confirmPassword) {
    return notify.validationError("รหัสผ่านยืนยันไม่ตรงกัน");
  }

  isSaving.value = true;
  try {
    const { error } = await authClient.changePassword({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
      revokeOtherSessions: true,
    });
    if (error) throw new Error(error.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    form.currentPassword = "";
    form.newPassword = "";
    form.confirmPassword = "";
    notify.success("เปลี่ยนรหัสผ่านสำเร็จ");
  } catch (e: any) {
    notify.error(e?.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <USkeleton v-if="isLoading" class="h-64 w-full rounded-lg" />

  <UCard v-else>
    <template #header>
      <div>
        <p class="font-semibold">รหัสผ่าน</p>
        <p class="text-xs text-muted mt-1">เปลี่ยนรหัสผ่านสำหรับเข้าสู่ระบบ</p>
      </div>
    </template>

    <div v-if="!data?.hasPasswordCredential" class="rounded-lg border border-default bg-elevated/30 p-3 text-sm text-muted">
      บัญชีของคุณ login ด้วย LINE — ไม่มีรหัสผ่านให้เปลี่ยน
    </div>

    <UForm v-else :state="form" class="space-y-3" @submit="onSubmit">
      <UFormField label="รหัสผ่านเดิม" name="currentPassword" required>
        <UInput v-model="form.currentPassword" type="password" autocomplete="current-password" class="w-full" />
      </UFormField>
      <UFormField label="รหัสผ่านใหม่" name="newPassword" required>
        <UInput v-model="form.newPassword" type="password" autocomplete="new-password" class="w-full" />
        <template #help>
          <span class="text-xs text-muted">อย่างน้อย 8 ตัวอักษร</span>
        </template>
      </UFormField>
      <UFormField label="ยืนยันรหัสผ่านใหม่" name="confirmPassword" required>
        <UInput v-model="form.confirmPassword" type="password" autocomplete="new-password" class="w-full" />
      </UFormField>
    </UForm>

    <template v-if="data?.hasPasswordCredential" #footer>
      <div class="flex justify-end">
        <UButton :loading="isSaving" icon="i-lucide-key-round" @click="onSubmit">
          เปลี่ยนรหัสผ่าน
        </UButton>
      </div>
    </template>
  </UCard>
</template>
