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
  <UDashboardPage>
    <UDashboardPanel grow>
      <UDashboardNavbar title="ข้อมูลส่วนตัว" />

      <div class="p-6 max-w-2xl mx-auto space-y-6 w-full">
        <ProfileForm />
        <EmailVerificationSection callback-url="/me/settings/profile" />
        <LineLinkSection />
        <NotificationPreferenceForm />
      </div>
    </UDashboardPanel>
  </UDashboardPage>
</template>
