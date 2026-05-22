<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

definePageMeta({
  layout: "user",
  middleware: ["role-user"],
});

const links = [
  { label: "ข้อมูลส่วนตัว", icon: "i-lucide-user", to: "/me/settings/profile", exact: true },
  { label: "ที่อยู่จัดส่ง", icon: "i-lucide-map-pin", to: "/me/settings/addresses", exact: true },
  { label: "การแจ้งเตือน", icon: "i-lucide-bell", to: "/me/settings/notification", exact: true },
  { label: "ความปลอดภัย", icon: "i-lucide-lock", to: "/me/settings/security", exact: true },
] satisfies NavigationMenuItem[]
</script>

<template>
  <UDashboardPanel id="settings" :ui="{ body: 'lg:py-12' }">
    <template #header>
      <UDashboardNavbar title="ตั้งค่าการใช้งาน">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <UNavigationMenu :items="links" highlight class="-mx-1 flex-1" />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="mx-auto flex w-full flex-col gap-3 lg:max-w-2xl">
        <NuxtPage />
      </div>
    </template>
  </UDashboardPanel>
</template>
