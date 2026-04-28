<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const links = [[{
          label: "ข้อมูลร้าน",
          icon: "i-lucide-store",
          to: "/admin/settings/shop",
          exact: true,
        },
        {
          label: "ข้อมูลส่วนตัว",
          icon: "i-lucide-user",
          to: "/admin/settings/profile",
          exact: true,
        },
        {
          label: "จัดการพนักงาน",
          icon: "i-lucide-user-cog",
          to: "/admin/settings/employee",
          exact: true,
        },
        {
          label: "จัดการสมาชิก",
          icon: "i-lucide-user-star",
          to: "/admin/settings/member",
          exact: true,
        },
        {
          label: "การแจ้งเตือน",
          icon: "i-lucide-bell",
          to: "/admin/settings/notification",
          exact: true,
        },
        {
          label: "ความปลอดภัย",
          icon: "i-lucide-lock",
          to: "/admin/settings/security",
          exact: true,
        },
        {
          label: "Export ข้อมูล",
          icon: "i-lucide-download",
          to: "/admin/settings/backup",
          exact: true,
        },
        {
          label: "ตั้งค่าธุรกิจ",
          icon: "i-lucide-coins",
          to: "/admin/settings/billing",
          exact: true,
        },]] satisfies NavigationMenuItem[][]
</script>

<template>
  <UDashboardPanel id="settings" :ui="{ body: 'lg:py-12' }">
    <template #header>
      <UDashboardNavbar title="Settings">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
      </UDashboardNavbar>

      <UDashboardToolbar>
        <!-- NOTE: The `-mx-1` class is used to align with the `DashboardSidebarCollapse` button here. -->
        <UNavigationMenu :items="links" highlight class="-mx-1 flex-1" />
      </UDashboardToolbar>
    </template>

    <template #body>
      <div class="flex flex-col gap-4 sm:gap-6 lg:gap-12 w-full lg:max-w-2xl mx-auto">
        <NuxtPage />
      </div>
    </template>
  </UDashboardPanel>
</template>