<script setup lang="ts">
import AccountManagementSection from "~~/app/components/account/AccountManagementSection.vue";

definePageMeta({
  middleware: ["role-employee"],
  layout: "admin",
});
</script>

<template>
  <div class="mx-auto w-full max-w-3xl space-y-3 p-2 sm:p-6">
    <div class="rounded-md border border-default/30 bg-default px-4 py-3 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-default/20 dark:bg-elevated/55">
      <h1 class="text-xl font-semibold">จัดการบัญชี</h1>
      <p class="mt-1 text-sm text-muted">ข้อมูลส่วนตัว ความปลอดภัย และการตั้งค่าบัญชีของคุณ</p>
    </div>

    <AccountManagementSection callback-url="/admin/settings/account" />
  </div>
</template>
