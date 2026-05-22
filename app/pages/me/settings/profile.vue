<script setup lang="ts">
import ProfileForm from "~~/app/components/account/ProfileForm.vue";
import EmailVerificationSection from "~~/app/components/account/EmailVerificationSection.vue";
import LineLinkSection from "~~/app/components/account/LineLinkSection.vue";
import NotificationPreferenceForm from "~~/app/components/account/NotificationPreferenceForm.vue";

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});
</script>

<template>
  <div class="mx-auto w-full max-w-3xl space-y-3 p-2 sm:p-6">
    <div class="rounded-md border border-default/30 bg-default px-4 py-3 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:border-default/20 dark:bg-elevated/55">
      <h1 class="text-xl font-semibold">ข้อมูลส่วนตัว</h1>
      <p class="mt-1 text-sm text-muted">จัดการข้อมูลและการเชื่อมต่อบัญชีของคุณ</p>
    </div>

    <ProfileForm />
    <EmailVerificationSection callback-url="/me/settings/profile" />
    <LineLinkSection />
    <NotificationPreferenceForm />
  </div>
</template>
