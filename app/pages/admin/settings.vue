<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const { user } = useUser()
const isAdmin = computed(() => user.value?.role === 'ADMIN')

const adminLinks = [
  { label: "ข้อมูลร้าน", icon: "i-lucide-store", to: "/admin/settings/shop", exact: true },
  { label: "จัดการบัญชี", icon: "i-lucide-user-round-cog", to: "/admin/settings/account", exact: true },
  { label: "จัดการพนักงาน", icon: "i-lucide-user-cog", to: "/admin/settings/employee", exact: true },
  { label: "จัดการสมาชิก", icon: "i-lucide-user-star", to: "/admin/settings/member", exact: true },
  { label: "จัดการ Rich Menu", icon: "i-lucide-menu", to: "/admin/settings/richmenu", exact: true },
  { label: "การแจ้งเตือน", icon: "i-lucide-bell", to: "/admin/settings/notification", exact: true },
  { label: "Export ข้อมูล", icon: "i-lucide-download", to: "/admin/settings/backup", exact: true },
  { label: "ตั้งค่าธุรกิจ", icon: "i-lucide-coins", to: "/admin/settings/billing", exact: true },
  { label: "ถังขยะ", icon: "i-lucide-trash-2", to: "/admin/settings/deleted-data", exact: true },
] satisfies NavigationMenuItem[]

const employeeLinks = [
  { label: "จัดการบัญชี", icon: "i-lucide-user-round-cog", to: "/admin/settings/account", exact: true },
] satisfies NavigationMenuItem[]

const links = computed(() => [isAdmin.value ? adminLinks : employeeLinks])
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
      <NuxtPage />
    </template>
  </UDashboardPanel>
</template>
