<script setup lang="ts">
import { useMediaQuery } from "@vueuse/core";
import type { NavigationMenuItem } from "@nuxt/ui";
import type { Role } from "~~/shared/types/enums";

const SESSION_CHECK_INTERVAL_MS = 60_000;

const open = ref(false);
const { user, session } = useUser();
const isDesktopSidebar = useMediaQuery("(min-width: 1024px)");

const sidebarCollapsed = (collapsed: boolean) => isDesktopSidebar.value ? collapsed : false;

const closeSidebar = () => {
  open.value = false;
};

const role = computed<Role | undefined>(() => user.value?.role);
const isAdmin = computed(() => role.value === "ADMIN");
const homeTarget = computed(() => (isAdmin.value ? "/admin" : "/admin/employee-dashboard"));

const adminMenu = [
  [
    {
      label: "แดชบอร์ด",
      icon: "i-lucide-house",
      to: "/admin",
      exact: true,
      onSelect: closeSidebar,
    },
    {
      label: "รายการขาย",
      icon: "i-lucide-shopping-cart",
      to: "/admin/sales",
      onSelect: closeSidebar,
    },
    {
      label: "รายการรับผ้า",
      icon: "i-lucide-shopping-basket",
      to: "/admin/service-orders",
      onSelect: closeSidebar,
    },
    {
      label: "ประวัติการชำระเงิน",
      icon: "i-lucide-receipt",
      to: "/admin/payment",
      onSelect: closeSidebar,
    },
    {
      label: "จัดการผู้ใช้งาน",
      icon: "i-lucide-users",
      to: "/admin/users",
      onSelect: closeSidebar,
    },
    {
      label: "จัดการแพ็กเกจรายเดือน",
      icon: "i-lucide-package",
      to: "/admin/packages",
      onSelect: closeSidebar,
    },
    {
      label: "จัดการราคาหน้าร้าน",
      icon: "i-lucide-tag",
      to: "/admin/pricing",
      onSelect: closeSidebar,
    },
    {
      label: "ตั้งค่าระบบ",
      icon: "i-lucide-settings",
      to: "/admin/settings",
      defaultOpen: true,
      type: "trigger",
      children: [
        {
          label: "ข้อมูลร้าน",
          icon: "i-lucide-store",
          to: "/admin/settings/shop",
          exact: true,
          onSelect: closeSidebar,
        },
        {
          label: "จัดการบัญชี",
          icon: "i-lucide-user-round-cog",
          to: "/admin/settings/account",
          exact: true,
          onSelect: closeSidebar,
        },
        {
          label: "จัดการพนักงาน",
          icon: "i-lucide-user-cog",
          to: "/admin/settings/employee",
          exact: true,
          onSelect: closeSidebar,
        },
        {
          label: "จัดการสมาชิก",
          icon: "i-lucide-user-star",
          to: "/admin/settings/member",
          exact: true,
          onSelect: closeSidebar,
        },
        // {
        //   label: "จัดการ Rich Menu",
        //   icon: "i-lucide-menu",
        //   to: "/admin/settings/richmenu",
        //   exact: true,
        //   onSelect: closeSidebar,
        // },
        {
          label: "การแจ้งเตือน",
          icon: "i-lucide-bell",
          to: "/admin/settings/notification",
          exact: true,
          onSelect: closeSidebar,
        },
        {
          label: "Export ข้อมูล",
          icon: "i-lucide-download",
          to: "/admin/settings/backup",
          exact: true,
          onSelect: closeSidebar,
        },
        {
          label: "ตั้งค่าธุรกิจ",
          icon: "i-lucide-coins",
          to: "/admin/settings/billing",
          exact: true,
          onSelect: closeSidebar,
        },
        {
          label: "ถังขยะ",
          icon: "i-lucide-trash-2",
          to: "/admin/settings/deleted-data",
          exact: true,
          onSelect: closeSidebar,
        },
      ],
    },
  ],
  [
    {
      label: "คู่มือการใช้งาน",
      icon: "i-lucide-book",
      to: "/admin/settings/handbook",
      exact: true,
      onSelect: closeSidebar,
    },
  ],
] satisfies NavigationMenuItem[][];

const employeeMenu = [
  [
    {
      label: "ภาพรวม",
      icon: "i-lucide-layout-dashboard",
      to: "/admin/employee-dashboard",
      exact: true,
      onSelect: closeSidebar,
    },
    {
      label: "รายการขาย",
      icon: "i-lucide-shopping-cart",
      to: "/admin/sales",
      onSelect: closeSidebar,
    },
    {
      label: "ประวัติการชำระเงิน",
      icon: "i-lucide-receipt",
      to: "/admin/payment",
      onSelect: closeSidebar,
    },
    {
      label: "รายการรับผ้า",
      icon: "i-lucide-shopping-basket",
      to: "/admin/service-orders",
      onSelect: closeSidebar,
    },
    {
      label: "จัดการราคาหน้าร้าน",
      icon: "i-lucide-tag",
      to: "/admin/pricing",
      onSelect: closeSidebar,
    },
    {
      label: "ตั้งค่า",
      icon: "i-lucide-settings",
      to: "/admin/settings",
      defaultOpen: true,
      type: "trigger",
      children: [
        {
          label: "จัดการบัญชี",
          icon: "i-lucide-user-round-cog",
          to: "/admin/settings/account",
          exact: true,
          onSelect: closeSidebar,
        },
      ],
    },
  ],
  [
    {
      label: "คู่มือการใช้งาน",
      icon: "i-lucide-book",
      to: "/admin/settings/handbook",
      exact: true,
      onSelect: closeSidebar,
    },
  ],
] satisfies NavigationMenuItem[][];

const menu = computed(() => (isAdmin.value ? adminMenu : employeeMenu));

const groups = computed(() => [
  {
    id: "links",
    label: "Go to",
    items: menu.value.flat(),
  },
]);

const checkAdminSession = async () => {
  if (import.meta.server) return;
  try {
    const currentSession = await fetchSessionStatus();
    if (!currentSession?.user) {
      session.value = null;
      await navigateTo("/auth/login");
      return;
    }

    session.value = currentSession;
    if (currentSession.user.isActive === false) {
      await navigateTo("/me");
    }
  } catch {
    session.value = null;
    await navigateTo("/auth/login");
  }
};

let sessionCheckTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  void checkAdminSession();
  sessionCheckTimer = setInterval(() => {
    void checkAdminSession();
  }, SESSION_CHECK_INTERVAL_MS);
  window.addEventListener("focus", checkAdminSession);
});
onBeforeUnmount(() => {
  if (sessionCheckTimer) clearInterval(sessionCheckTimer);
  window.removeEventListener("focus", checkAdminSession);
});
</script>

<template>
  <UDashboardGroup unit="rem" class="admin-shell">
      <UDashboardSidebar
        id="default"
        v-model:open="open"
        collapsible
        resizable
        class="admin-sidebar bg-default/80 backdrop-blur-sm"
        :ui="{ footer: 'lg:border-t lg:border-default/60' }"
      >
        <template #header="{ collapsed }">
          <AppLogo :collapsed="sidebarCollapsed(collapsed)" label="ADMIN PANEL" :to="homeTarget" />
        </template>

        <template #default="{ collapsed }">
          <UDashboardSearchButton :collapsed="sidebarCollapsed(collapsed)" class="bg-transparent ring-default" />

          <UNavigationMenu :collapsed="sidebarCollapsed(collapsed)" :items="menu[0]" orientation="vertical" tooltip popover />

          <UNavigationMenu
            v-if="menu[1]?.length"
            :collapsed="sidebarCollapsed(collapsed)"
            :items="menu[1]"
            orientation="vertical"
            tooltip
            class="mt-auto"
          />
        </template>

        <template #footer="{ collapsed }">
          <UserMenu :collapsed="sidebarCollapsed(collapsed)" />
        </template>
      </UDashboardSidebar>

      <UDashboardSearch :groups="groups" />

      <template #fallback>
        <aside class="hidden border-r border-default bg-elevated/25 lg:flex lg:w-72 lg:flex-col">
          <div class="border-b border-default px-4 py-4">
            <USkeleton class="h-8 w-36" />
          </div>
          <div class="space-y-3 px-4 py-4">
            <USkeleton class="h-10 w-full" />
            <USkeleton class="h-9 w-full" />
            <USkeleton class="h-9 w-full" />
            <USkeleton class="h-9 w-full" />
          </div>
          <div class="mt-auto border-t border-default px-4 py-4">
            <USkeleton class="h-10 w-full" />
          </div>
        </aside>
      </template>

    <div class="admin-workspace flex min-h-0 flex-1 flex-col overflow-y-auto">
      <slot />
    </div>
  </UDashboardGroup>
</template>
