<script setup lang="ts">
import PasswordChangeForm from "~~/app/components/account/PasswordChangeForm.vue";
import ActiveSessionsList from "~~/app/components/account/ActiveSessionsList.vue";

definePageMeta({
  middleware: ["role-employee"],
  layout: "admin",
});
</script>

<template>
  <div class="mx-auto w-full max-w-3xl space-y-3 p-2 sm:space-y-4 sm:p-6">
    <div class="rounded-md border border-default/30 bg-default px-4 py-3 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-default/20 dark:bg-elevated/55">
      <h1 class="text-xl font-semibold">ความปลอดภัย</h1>
      <p class="mt-1 text-sm text-muted">รหัสผ่านและอุปกรณ์ที่เข้าสู่ระบบ</p>
    </div>

    <PasswordChangeForm />
    <ActiveSessionsList />
  </div>
</template>
