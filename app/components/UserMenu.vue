<script setup lang="ts">
import type { DropdownMenuItem } from "@nuxt/ui";

defineProps<{
  collapsed?: boolean;
}>();

const colorMode = useColorMode();
const { user, userAvatar, logout } = useUser();

const userMenuName = computed(() => user.value?.name || "ผู้ใช้งาน");
const isStaff = computed(() => {
  const role = user.value?.role;
  return role === "ADMIN" || role === "EMPLOYEE";
});

const profileRoute = computed(() => (isStaff.value ? "/admin/settings/profile" : "/settings/notification"));
const settingsRoute = computed(() => (isStaff.value ? "/admin/settings/billing" : "/settings/notification"));
const homeRoute = computed(() => (isStaff.value ? "/admin" : "/"));

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
      label: "ธีม",
      icon: "i-lucide-sun-moon",
      class: "cursor-pointer",
      children: [
        {
          label: "สว่าง",
          icon: "i-lucide-sun",
          type: "checkbox",
          checked: colorMode.value === "light",
          class: "cursor-pointer",
          onSelect(e: Event) {
            e.preventDefault();
            colorMode.preference = "light";
          },
        },
        {
          label: "มืด",
          icon: "i-lucide-moon",
          type: "checkbox",
          checked: colorMode.value === "dark",
          class: "cursor-pointer",
          onSelect(e: Event) {
            e.preventDefault();
            colorMode.preference = "dark";
          },
        },
      ],
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
    :content="{ align: 'center', collisionPadding: 12 }"
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
