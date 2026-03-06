<script setup lang="ts">
import { authClient } from '~/utils/auth-client';
import type { NavigationMenuItem, DropdownMenuItem } from '@nuxt/ui'

const { addLineFriend } = useLiffAuth()
const { logout, user } = useUser()
const sessionRef = authClient.useSession();
const session = computed(() => sessionRef.value.data);
const open = ref(false)

const menu = computed<NavigationMenuItem[]>(() => [
    {
        label: 'ค่าบริการ',
        to: { path: '/', hash: '#per-item-pricing', force: true },
        exact: true,
        exactHash: true
    },
    {
        label: 'สมัครสมาชิก',
        to: { path: '/', hash: '#monthly-membership', force: true },
        exact: true,
        exactHash: true
    },
    {
        label: 'คำถามที่พบบ่อย',
        to: { path: '/', hash: '#faq', force: true },
        exact: true,
        exactHash: true
    },
    {
        label: 'ติดต่อเรา',
        to: { path: '/', hash: '#contact', force: true },
        exact: true,
        exactHash: true
    }
])

const itemsDropdown = computed<DropdownMenuItem[][]>(() => [
    [
        {
            label: session.value?.user.name || '',
            avatar: {
                as: { img: 'img' },
                src: session.value?.user.image || '',
                loading: 'lazy'
            },
            type: 'label'
        }
    ],
    [
        {
            label: 'Profile',
            icon: 'i-lucide-user'
        },
        {
            label: 'Settings',
            icon: 'i-lucide-cog'
        }
    ],
    [
        {
            label: 'member',
            icon: 'i-lucide-users',
            to: '/member'
        },
        {
            label: 'empoyee',
            icon: 'i-lucide-user-cog',
            to: '/employee'
        },
        {
            label: 'admin',
            icon: 'i-lucide-user-cog',
            to: '/admin'
        },
    ],
    [
        {
            label: 'Logout',
            icon: 'i-lucide-log-out',
            color: 'error',
            class: 'cursor-pointer',
            onClick: () => {
                logout();
            }
        }
    ]
])

</script>

<template>
    <UHeader v-model:open="open" mode="slideover">

        <UNavigationMenu :items="menu" />

        <!-- Logo & Brand -->
        <template #title>
            <div class="flex items-center gap-2">
                <img src="/logo-saijai-phareab.png" class="h-15" alt="SaiJai-Phareab" />
                <div>
                    <p class="font-semibold"><span class="text-primary">ใส่ใจ </span>ผ้าเรียบ</p>
                    <p class="text-[0.7rem] font-medium text-gray-500 tracking-widest dark:text-gray-300">LAUNDRY
                        SERVICE</p>
                </div>
            </div>
        </template>

        <!-- Right Side Actions -->
        <template #right>
            <div v-show="!open" class="hidden md:flex items-center  gap-1.5">


                <UIButtonAddFriendLine />
                <UColorModeButton />
                <div v-if="!session" class="hidden md:inline-flex">
                    <UButton color="neutral" variant="ghost" class="p-2" to="/auth/login" label="ลงชื่อเข้าใช้" />
                    <UButton color="primary" variant="solid" class="p-2" to="/auth/register" label="สมัครสมาชิก" />
                </div>

                <div v-if="session" class="flex gap-3 items-center px-4">
                    <UDropdownMenu :items="itemsDropdown">
                        <div class="cursor-pointer flex items-center gap-1">
                            <UAvatar :as="{ img: 'img' }" :src="session.user.image || ''" :alt="session.user.name"
                                loading="lazy" />
                            <UIcon name="i-lucide-chevron-down" class="size-4 text-muted" />
                        </div>
                    </UDropdownMenu>
                </div>
            </div>
        </template>

        <!-- Mobile Menu Body -->
        <template #body>
            <UNavigationMenu :items="menu" orientation="vertical" class="-mx-2.5" />
            <USeparator class="my-4" />
            <UIButtonAddFriendLine v-if="!addLineFriend" class="w-full" />
            <div v-if="!session" class="mt-4 flex flex-col gap-2">
                <UButton block color="neutral" variant="outline" to="/auth/login" label="ลงชื่อเข้าใช้" />
                <UButton block color="primary" variant="solid" to="/auth/register" label="สมัครสมาชิก" />
            </div>
        </template>


    </UHeader>
    <UMain>
        <div class="container mx-auto max-w-7xl px-10 lg:px-12">
            <slot />
        </div>
    </UMain>
</template>