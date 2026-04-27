<script setup lang="ts">
import PasswordChangeForm from "~~/app/components/account/PasswordChangeForm.vue";
import ActiveSessionsList from "~~/app/components/account/ActiveSessionsList.vue";

definePageMeta({
  middleware: ["role-employee"],
  layout: "admin",
});
</script>

<template>
  <div class="w-full p-6 max-w-2xl mx-auto space-y-6">
    <div>
      <h1 class="text-xl font-semibold">ความปลอดภัย</h1>
      <p class="text-sm text-muted mt-1">รหัสผ่านและอุปกรณ์ที่เข้าสู่ระบบ</p>
    </div>

    <PasswordChangeForm />
    <ActiveSessionsList />
  </div>
</template>
