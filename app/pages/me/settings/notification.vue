<script setup lang="ts">
import NotificationPreferenceForm from "~~/app/components/account/NotificationPreferenceForm.vue";

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});
</script>

<template>
  <UDashboardPage>
    <UDashboardPanel grow>
      <UDashboardNavbar title="การแจ้งเตือน" />

      <div class="p-6 max-w-2xl mx-auto space-y-6 w-full">
        <NotificationPreferenceForm />
      </div>
    </UDashboardPanel>
  </UDashboardPage>
</template>
