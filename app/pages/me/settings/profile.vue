<script setup lang="ts">
import ProfileForm from "~~/app/components/account/ProfileForm.vue";

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
      </div>
    </UDashboardPanel>
  </UDashboardPage>
</template>
