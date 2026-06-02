<script setup lang="ts">
import AccountManagementSection from "~~/app/components/account/AccountManagementSection.vue";

definePageMeta({
  middleware: ["role-employee"],
  layout: "admin",
});
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-3 p-2 sm:p-6">
    <section class="-mx-2 border border-default/30 bg-default px-4 py-3 dark:border-default/20 dark:bg-elevated/55 sm:mx-0 sm:rounded-lg">
      <h1 class="text-xl font-semibold text-highlighted">จัดการบัญชี</h1>
      <p class="mt-1 text-sm text-muted">ข้อมูลส่วนตัว ความปลอดภัย และการตั้งค่าบัญชีของคุณ</p>
    </section>

    <AccountManagementSection callback-url="/admin/settings/account" />
  </div>
</template>
