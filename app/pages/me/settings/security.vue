<script setup lang="ts">
import PasswordChangeForm from "~~/app/components/account/PasswordChangeForm.vue";
import ActiveSessionsList from "~~/app/components/account/ActiveSessionsList.vue";
import LineLinkSection from "~~/app/components/account/LineLinkSection.vue";

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});
</script>

<template>
  <UDashboardPage>
    <UDashboardPanel grow>
      <UDashboardNavbar title="ความปลอดภัย" />

      <div class="p-6 max-w-2xl mx-auto space-y-6 w-full">
        <LineLinkSection />
        <PasswordChangeForm />
        <ActiveSessionsList />
      </div>
    </UDashboardPanel>
  </UDashboardPage>
</template>
