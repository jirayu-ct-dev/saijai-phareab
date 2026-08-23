<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";

defineProps<{
  collapsed?: boolean;
}>();

const colorMode = useColorMode();
const { user, userAvatar, logout } = useUser();
const route = useRoute();

const userMenuName = computed(() => user.value?.name || "ผู้ใช้งาน");
// Suspended staff (isActive === false) get the customer menu until reactivated.
const isStaff = computed(() => {
  const role = user.value?.role;
  return (role === "ADMIN" || role === "EMPLOYEE") && user.value?.isActive !== false;
});

const profileRoute = computed(() => (isStaff.value ? "/admin/settings/profile" : "/me/settings/profile"));
const settingsRoute = computed(() => (isStaff.value ? "/admin/settings/billing" : "/me/settings/notification"));
const homeRoute = computed(() => "/");
const adminHomeRoute = computed(() =>
  user.value?.role === "ADMIN" ? "/admin" : "/admin/employee-dashboard",
);
const isAdminArea = computed(() => route.path.startsWith("/admin"));

const handleLogout = async (e: Event) => {
  e.preventDefault();
  try {
    await logout();
    await navigateTo("/auth/login");
  } catch (error) {
    console.error("[UserMenu] logout failed", error);
  }
};

const items = computed<DropdownMenuItem[][]>(() => [
  [
    {
      type: "label",
      label: userMenuName.value,
      avatar: userAvatar.value,
    },
  ],
  [
    {
      label: "ข้อมูลส่วนตัว",
      icon: "i-lucide-user",
      to: profileRoute.value,
    },
    {
      label: "ตั้งค่า",
      icon: "i-lucide-settings",
      to: settingsRoute.value,
    },
  ],
  ...(isStaff.value
    ? [
        [
          {
            label: isAdminArea.value ? "สลับไปหน้าลูกค้า" : "สลับไปหน้าผู้ดูแล",
            icon: isAdminArea.value ? "i-lucide-layout-dashboard" : "i-lucide-shield",
            onSelect() {
              navigateTo(isAdminArea.value ? "/me" : adminHomeRoute.value);
            },
          },
        ],
      ]
    : []),
  [
    {
      label: "หน้าหลัก",
      icon: "i-lucide-house",
      onSelect() {
        navigateTo(homeRoute.value);
      },
    },
  ],
  [
    {
      label: colorMode.value === "dark" ? "เปลี่ยนเป็นธีมสว่าง" : "เปลี่ยนเป็นธีมมืด",
      icon: colorMode.value === "dark" ? "i-lucide-sun" : "i-lucide-moon",
      class: "cursor-pointer",
      onSelect() {
        colorMode.preference = colorMode.value === "dark" ? "light" : "dark";
      },
    },
  ],
  [
    {
      label: "ออกจากระบบ",
      icon: "i-lucide-log-out",
      color: "error",
      class: "cursor-pointer",
      onSelect: handleLogout,
    },
  ],
]);
</script>

<template>
  <UDropdownMenu
    :items="items"
    :content="{ align: collapsed ? 'end' : 'center', collisionPadding: 12 }"
    :ui="{ content: collapsed ? 'w-48' : 'w-(--reka-dropdown-menu-trigger-width)' }"
  >
    <UButton
      v-bind="{
        avatar: userAvatar,
        label: collapsed ? undefined : userMenuName,
        trailingIcon: collapsed ? undefined : 'i-lucide-chevrons-up-down',
      }"
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      class="data-[state=open]:bg-elevated"
      :ui="{ trailingIcon: 'text-dimmed' }"
    />
  </UDropdownMenu>
</template>
