<script setup lang="ts">
import { useMediaQuery } from "@vueuse/core";
import type { NavigationMenuItem } from "@nuxt/ui";

const SESSION_CHECK_INTERVAL_MS = 60_000;
const open = ref(false);
const { session } = useUser();
const { isMember } = useMemberStatus();
const isDesktopSidebar = useMediaQuery("(min-width: 1024px)");

const sidebarCollapsed = (collapsed: boolean) => isDesktopSidebar.value ? collapsed : false;

type MenuItem = NavigationMenuItem & {
  id?: string;
  to?: string;
  children?: MenuItem[];
};

const closeSidebar = () => {
  open.value = false;
};

const menu = computed<MenuItem[][]>(() => {
  const mainGroup: MenuItem[] = [
    {
      label: "แดชบอร์ด",
      icon: "i-lucide-layout-dashboard",
      to: "/me",
      exact: true,
      onSelect: closeSidebar,
    },
    {
      label: "รายการออเดอร์",
      icon: "i-lucide-shopping-basket",
      to: "/me/service-orders",
      onSelect: closeSidebar,
    },
    {
      label: "รายการชำระเงิน",
      icon: "i-lucide-receipt",
      to: "/me/payment",
      onSelect: closeSidebar,
    },
    {
      label: "เลือกซื้อแพ็กเกจ",
      icon: "i-lucide-shopping-bag",
      to: "/me/packages",
      onSelect: closeSidebar,
    },
    {
      label: "ราคาหน้าร้าน",
      icon: "i-lucide-tags",
      to: "/me/pricing",
      onSelect: closeSidebar,
    },
  ];

  if (isMember.value) {
    mainGroup.push({
      label: "แพ็กเกจของฉัน",
      icon: "i-lucide-package-check",
      to: "/me/membership",
      onSelect: closeSidebar,
    });
  }

  mainGroup.push({
    label: "ตั้งค่า",
    icon: "i-lucide-settings",
    to: "/me/settings",
    defaultOpen: true,
    type: "trigger",
    children: [
      {
        label: "ข้อมูลส่วนตัว",
        icon: "i-lucide-user",
        to: "/me/settings/profile",
        exact: true,
        onSelect: closeSidebar,
      },
      {
        label: "การแจ้งเตือน",
        icon: "i-lucide-bell",
        to: "/me/settings/notification",
        exact: true,
        onSelect: closeSidebar,
      },
      {
        label: "ความปลอดภัย",
        icon: "i-lucide-lock",
        to: "/me/settings/security",
        exact: true,
        onSelect: closeSidebar,
      },
      {
        label: "ที่อยู่",
        icon: "i-lucide-map-pin",
        to: "/me/settings/addresses",
        exact: true,
        onSelect: closeSidebar,
      },
    ],
  });

  const helpGroup: MenuItem[] = [
    {
      label: "คู่มือการใช้งาน",
      icon: "i-lucide-book",
      to: "/me/handbook",
      exact: true,
      onSelect: closeSidebar,
    },
  ];

  return [mainGroup, helpGroup];
});

const groups = computed(() => {
  return [
    {
      id: "links",
      label: "Go to",
      items: menu.value.flat(),
    }
  ];
});

const checkUserSession = async () => {
  if (import.meta.server) return;
  try {
    const currentSession = await fetchSessionStatus();
    if (!currentSession?.user) {
      session.value = null;
      await navigateTo("/auth/login");
      return;
    }

    session.value = currentSession;
  } catch {
    session.value = null;
    await navigateTo("/auth/login");
  }
};

let sessionCheckTimer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  void checkUserSession();
  sessionCheckTimer = setInterval(() => {
    void checkUserSession();
  }, SESSION_CHECK_INTERVAL_MS);
  window.addEventListener("focus", checkUserSession);
});
onBeforeUnmount(() => {
  if (sessionCheckTimer) clearInterval(sessionCheckTimer);
  window.removeEventListener("focus", checkUserSession);
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
          <AppLogo :collapsed="sidebarCollapsed(collapsed)" label="SAIJAI MEMBER" to="/me" />
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
