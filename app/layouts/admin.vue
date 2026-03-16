<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';

const open = ref(false)
const route = useRoute()


const menu = [
    [
        {
            label: 'แดชบอร์ด',
            icon: 'i-lucide-house',
            to: '/admin',
            onSelect: () => {
                open.value = false
            }
        },
        {
            label: 'จัดการออเดอร์',
            icon: 'i-lucide-shopping-basket',
            to: '/admin/orders',
            onSelect: () => {
                open.value = false
            }
        },
        {
            label: 'อนุมัติการชำระเงิน',
            icon: 'i-lucide-receipt',
            to: '/admin/confirm-payment',
            onSelect: () => {
                open.value = false
            }
        },
        {
            label: 'จัดการผู้ใช้งาน',
            icon: 'i-lucide-users',
            to: '/admin/users',
            onSelect: () => {
                open.value = false
            }
        },
        {
            label: 'จัดการแพ็คเกจรายเดือน',
            icon: 'i-lucide-package',
            to: '/admin/packages',
            onSelect: () => {
                open.value = false
            }
        },
        {
            label: 'จัดการราคาหน้าร้าน',
            icon: 'i-lucide-tag',
            to: '/admin/prices',
            onSelect: () => {
                open.value = false
            }
        },
        {
            label: 'ตั้งค่าระบบ',
            icon: 'i-lucide-settings',
            to: '/admin/settings',
            defaultOpen: true,
            type: 'trigger',
            children: [
                {
                    label: 'ข้อมูลส่วนตัว',
                    icon: 'i-lucide-user',
                    to: '/admin/settings/profile',
                    exact: true,
                    onSelect: () => {
                        open.value = false
                    }
                },
                {
                    label: 'จัดการพนักงาน',
                    icon: 'i-lucide-user-cog',
                    to: '/admin/settings/employee',
                    exact: true,
                    onSelect: () => {
                        open.value = false
                    }
                },
                {
                    label: 'จัดการสมาชิก',
                    icon: 'i-lucide-user-star',
                    to: '/admin/settings/member',
                    exact: true,
                    onSelect: () => {
                        open.value = false
                    }
                },
                {
                    label: 'การแจ้งเตือน',
                    icon: 'i-lucide-bell',
                    to: '/admin/settings/notification',
                    exact: true,
                    onSelect: () => {
                        open.value = false
                    }
                },
                {
                    label: 'ความปลอดภัย',
                    icon: 'i-lucide-lock',
                    to: '/admin/settings/security',
                    exact: true,
                    onSelect: () => {
                        open.value = false
                    }
                }
            ]
        }
    ],
    [
        {
            label: 'คู่มือการใช้งาน',
            icon: 'i-lucide-book',
            to: '/admin/settings/handbook',
            exact: true,
            onSelect: () => {
                open.value = false
            }
        }
    ]
] satisfies NavigationMenuItem[][]

const groups = computed(() => [{
    id: 'links',
    label: 'Go to',
    items: menu.flat()
}, {
    id: 'code',
    label: 'Code',
    items: [{
        id: 'source',
        label: 'View page source',
        icon: 'i-simple-icons-line',
        to: `https://github.com/nuxt-ui-templates/dashboard/blob/main/app/pages${route.path === '/' ? '/index' : route.path}.vue`,
        target: '_blank',
        class: 'text-[#00b900]'
    }]
}])

</script>

<template>
    <UDashboardGroup unit="rem">
        <UDashboardSidebar id="default" v-model:open="open" collapsible resizable class="bg-elevated/25"
            :ui="{ footer: 'lg:border-t lg:border-default' }">
            <template #header="{ collapsed }">
                <AppLogo :collapsed="collapsed" label="ADMIN PANEL" to="/admin" />
            </template>

            <template #default="{ collapsed }">
                <UDashboardSearchButton :collapsed="collapsed" class="bg-transparent ring-default" />

                <UNavigationMenu :collapsed="collapsed" :items="menu[0]" orientation="vertical" tooltip popover />

                <UNavigationMenu :collapsed="collapsed" :items="menu[1]" orientation="vertical" tooltip class="mt-auto" />
            </template>

            <template #footer="{ collapsed }">
                <UserMenu :collapsed="collapsed" />
            </template>
        </UDashboardSidebar>

        <UDashboardSearch :groups="groups" />

        <div class="flex flex-col min-h-0 flex-1 overflow-y-auto">
            <slot />
        </div>
    </UDashboardGroup>
</template>