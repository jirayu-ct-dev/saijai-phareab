<script setup lang="ts">
import ProfileForm from "~~/app/components/account/ProfileForm.vue";
import LineLinkSection from "~~/app/components/account/LineLinkSection.vue";
import NotificationPreferenceForm from "~~/app/components/account/NotificationPreferenceForm.vue";
import EmailVerificationSection from "~~/app/components/account/EmailVerificationSection.vue";

definePageMeta({
  middleware: ["role-employee"],
  layout: "admin",
});
</script>

<template>
  <div class="w-full p-6 max-w-2xl mx-auto space-y-6">
    <div>
      <h1 class="text-xl font-semibold">ข้อมูลส่วนตัว</h1>
      <p class="text-sm text-muted mt-1">จัดการข้อมูลและการเชื่อมต่อบัญชีของคุณ</p>
    </div>

    <ProfileForm />
    <EmailVerificationSection callback-url="/admin/settings/profile" />
    <LineLinkSection />
    <NotificationPreferenceForm />
  </div>
</template>
