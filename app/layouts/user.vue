<script setup lang="ts">
import type { NavigationMenuItem } from "@nuxt/ui";

const open = ref(false);
const route = useRoute();
const { user } = useUser();
const { isMember } = useMemberStatus();

const closeSidebar = () => {
  open.value = false;
};

const menu = computed<any[][]>(() => {
  const mainGroup: any[] = [
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
      to: "/me/orders",
      onSelect: closeSidebar,
    },
    {
      label: "รายการใบเสร็จ",
      icon: "i-lucide-receipt",
      to: "/me/receipts",
      onSelect: closeSidebar,
    },
    {
      label: "เลือกซื้อแพ็กเกจ",
      icon: "i-lucide-shopping-bag",
      to: "/me/packages",
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
      /* 
      {
        label: "ที่อยู่",
        icon: "i-lucide-map-pin",
        to: "/me/settings/addresses",
        exact: true,
        onSelect: closeSidebar,
      }, 
      */
    ] as any
  });

  return [mainGroup];
});

const groups = computed(() => {
  const items = menu.value[0]?.flatMap((item: any) => {
    if (item.children) {
      return item.children.map((child: any) => ({
        id: child.to,
        label: child.label,
        icon: child.icon,
        to: child.to,
      }));
    }
    return [{
      id: item.to,
      label: item.label,
      icon: item.icon,
      to: item.to,
    }];
  });

  return [
    {
      id: "links",
      label: "Go to",
      items,
    }
  ];
});
</script>

<template>
  <UDashboardGroup unit="rem">
      <UDashboardSidebar
        id="default"
        v-model:open="open"
        collapsible
        resizable
        class="bg-elevated/25"
        :ui="{ footer: 'lg:border-t lg:border-default' }"
      >
        <template #header="{ collapsed }">
          <AppLogo :collapsed="collapsed" label="SAIJAI MEMBER" to="/me" />
        </template>

        <template #default="{ collapsed }">
          <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

          <UNavigationMenu :collapsed="collapsed" :items="menu[0]" orientation="vertical" tooltip popover />
        </template>

        <template #footer="{ collapsed }">
          <UserMenu :collapsed="collapsed" />
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

    <div class="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <slot />
    </div>
  </UDashboardGroup>
</template>
